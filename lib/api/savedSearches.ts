/**
 * Saved searches (mls-v2 `saved-searches/`, GAP-03).
 *
 * PRODUCT RULE: one saved search per user. The backend cap defaults to 1
 * (MAX_SAVED_SEARCHES_PER_USER), and the UI replaces the existing row with a
 * PUT rather than POSTing a second one into a 429.
 *
 * `filters_json` stores BACKEND params — exactly what `toBackendParams` sends
 * to `properties/filter/`, minus paging — so a future alert job can replay a
 * saved search against the API verbatim. `fromBackendParams` is the inverse
 * that rebuilds the /listings URL; the pair is round-trip tested.
 *
 * Alerts: `alert_cadence` drives the backend's saved-search email job
 * (mls-v2 services/saved_search_alerts.py), which replays `filters_json`
 * through `properties/filter/` and emails listings new since the last check.
 * The backend also accepts "instant", which it runs as daily; the UI offers
 * only what actually happens.
 */

import { apiFetch } from "@/lib/api/client";
import { SORT_TO_ORDERBY, toBackendParams } from "@/lib/api/properties";
import { matchPropertyAgePreset } from "@/lib/search/listingFilterOptions";
import type { ListingQuery, ListingSort } from "@/lib/types/domain";
import { formatPriceCompact } from "@/lib/utils/format";
import { formatPostal } from "@/lib/utils/postal";
import { backendStatusGroup, STATUS_TABS, statusParamForGroup } from "@/lib/utils/status";
import { buildListingHref, buildListingQueryString } from "@/lib/utils/searchParams";

const MLS = "/api/mls";

/**
 * The UI property type is matched client-side (see lib/api/properties.ts), so
 * it has no backend param. It rides along under an explicit, non-colliding key
 * that `properties/filter/` ignores.
 */
const UI_TYPE_KEY = "ui_type";

export type SavedFilters = Record<string, string>;

export const ALERT_CADENCES = ["daily", "weekly", "off"] as const;
export type AlertCadence = (typeof ALERT_CADENCES)[number];

export const ALERT_CADENCE_LABELS: Record<AlertCadence, string> = {
  daily: "Email me daily",
  weekly: "Email me weekly",
  off: "No emails",
};

export function isAlertCadence(value: unknown): value is AlertCadence {
  return typeof value === "string" && (ALERT_CADENCES as readonly string[]).includes(value);
}

/** Backend cadence → UI cadence. "instant" runs as daily, so it shows as daily. */
export function toAlertCadence(value: string | undefined): AlertCadence {
  if (value === "instant") return "daily";
  return isAlertCadence(value) ? value : "off";
}

export interface SavedSearch {
  id: number;
  name: string;
  filters: SavedFilters;
  alertCadence: AlertCadence;
  lastRunAt: string | null;
  lastResultCount: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface BackendSavedSearch {
  id: number;
  name: string;
  filters_json?: Record<string, unknown> | null;
  alert_cadence?: string;
  last_run_at?: string | null;
  last_result_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

function mapSavedSearch(row: BackendSavedSearch): SavedSearch {
  const filters: SavedFilters = {};
  for (const [key, value] of Object.entries(row.filters_json ?? {})) {
    if (value !== null && value !== undefined && value !== "") filters[key] = String(value);
  }
  return {
    id: row.id,
    name: row.name,
    filters,
    alertCadence: toAlertCadence(row.alert_cadence),
    lastRunAt: row.last_run_at ?? null,
    lastResultCount: row.last_result_count ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Filters codec                                                               */
/* -------------------------------------------------------------------------- */

/** ListingQuery → `filters_json`. Values are strings, as the backend stores them. */
export function toSavedFilters(query: ListingQuery): SavedFilters {
  const params = toBackendParams({ ...query, bounds: undefined });
  const out: SavedFilters = {};
  for (const [key, value] of Object.entries(params)) {
    if (key === "limit" || key === "offset") continue;
    if (value === null || value === undefined || value === "") continue;
    out[key] = Array.isArray(value) ? value.join(",") : String(value);
  }
  // "newest" is the default ordering; storing it would make an otherwise
  // identical search compare unequal to one saved without it.
  if (out.orderby === SORT_TO_ORDERBY.newest) delete out.orderby;
  // With AI preferences, "Best match" is the default instead.
  if (query.semantic && out.orderby === SORT_TO_ORDERBY.relevance) delete out.orderby;
  if (query.type) out[UI_TYPE_KEY] = query.type;
  return out;
}

function intParam(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

const BASEMENT_VALUES = new Set(["yes", "finished", "unfinished", "apartment", "none"]);

function parseBasementFilter(value: string | undefined): ListingQuery["basement"] | undefined {
  const raw = value?.trim().toLowerCase();
  if (!raw || !BASEMENT_VALUES.has(raw)) return undefined;
  return raw as ListingQuery["basement"];
}

function parsePolygonJson(raw: string | undefined): ListingQuery["polygon"] {
  if (!raw) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return undefined;
    const points = value
      .map((point) => ({ lat: Number(point?.lat), lng: Number(point?.lng) }))
      .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
    return points.length >= 3 ? points : undefined;
  } catch {
    return undefined;
  }
}

/** `filters_json` → ListingQuery. Unknown keys are ignored. */
export function fromBackendParams(filters: SavedFilters): ListingQuery {
  const sort = (Object.entries(SORT_TO_ORDERBY).find(([, orderby]) => orderby === filters.orderby)?.[0] ??
    (filters.semantic ? "relevance" : "newest")) as ListingSort;
  const postal = (filters.postal_code ?? "").split(",").map((code) => code.trim()).filter(Boolean);
  const subTypes = (filters.property_sub_type ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  // Rentals were once saved as the UI type "Rental"; they restore as Rent.
  const legacyRent = filters[UI_TYPE_KEY]?.toLowerCase() === "rental";
  const HOME_TYPE_TO_UI: Record<string, string> = {
    detached: "Detached",
    semi: "Semi-Detached",
    townhouse: "Townhome",
    condo: "Condo",
  };
  const homeTypeUi = filters.home_type
    ? HOME_TYPE_TO_UI[filters.home_type.toLowerCase()]
    : undefined;

  return {
    search: filters.search || undefined,
    city: filters.city || undefined,
    // Searches saved before the Buy/Rent split have no transaction_type; they
    // restore as Buy, the same default the URL parser applies.
    transaction:
      filters.transaction_type === "sold"
        ? "sold"
        : filters.transaction_type === "rent" || legacyRent
          ? "rent"
          : "sale",
    // Status tabs save as `status_group`; searches saved before that kept `status`.
    status: statusParamForGroup(filters.status_group) ?? (filters.status || undefined),
    type: legacyRent ? undefined : filters[UI_TYPE_KEY] || homeTypeUi || undefined,
    hasLease: filters.has_lease === "true" || undefined,
    priceMin: intParam(filters.price_min),
    priceMax: intParam(filters.price_max),
    bedsMin: intParam(filters.bedrooms) ?? intParam(filters.beds_min),
    bathsMin: intParam(filters.bathrooms) ?? intParam(filters.baths_min),
    soldWithinDays: intParam(filters.sold_within_days),
    sqftMin: intParam(filters.sqft_min),
    sqftMax: intParam(filters.sqft_max),
    yearBuiltMin: intParam(filters.year_built_min),
    yearBuiltMax: intParam(filters.year_built_max),
    garagesMin: intParam(filters.garages_min),
    storiesMin: intParam(filters.stories_min),
    storiesMax: intParam(filters.stories_max),
    basement: parseBasementFilter(filters.basement),
    feeMin: intParam(filters.maintenance_fee_min),
    feeMax: intParam(filters.maintenance_fee_max),
    listedSince: /^\d{4}-\d{2}-\d{2}$/.test(filters.listed_since ?? "")
      ? filters.listed_since
      : undefined,
    buildingType: filters.structure_type || undefined,
    ownership: filters.common_interest || undefined,
    keywords: (() => {
      const words = (filters.keywords ?? "")
        .split(",")
        .map((word) => word.trim())
        .filter(Boolean);
      return words.length ? words : undefined;
    })(),
    propertySubTypes: subTypes.length ? subTypes : undefined,
    postalCodes: postal.length ? postal : undefined,
    openHouse: filters.has_open_house === "1" || filters.has_open_house === "true" || undefined,
    polygon: parsePolygonJson(filters.polygon),
    semantic: filters.semantic?.trim() || undefined,
    sort: sort === "relevance" && !filters.semantic ? "newest" : sort,
  };
}

/**
 * Canonical identity of a search, for "is the current page the saved one?".
 * Compared through the URL serialiser so paging, view and param order never
 * make two equivalent searches look different.
 */
export function searchIdentity(query: ListingQuery): string {
  return buildListingQueryString({ ...query, view: undefined, page: undefined });
}

export function savedSearchIdentity(saved: SavedSearch): string {
  return searchIdentity(fromBackendParams(saved.filters));
}

/** Where "Run search" goes: the map when the search is a drawn area. */
export function savedSearchHref(saved: SavedSearch): string {
  const query = fromBackendParams(saved.filters);
  return buildListingHref(query, query.polygon ? "/map-search" : "/listings");
}

/* -------------------------------------------------------------------------- */
/* Human-readable criteria                                                     */
/* -------------------------------------------------------------------------- */

const TYPE_PLURALS: Record<string, string> = {
  Detached: "Detached homes",
  "Semi-Detached": "Semi-detached homes",
  Townhome: "Townhomes",
  Condo: "Condos",
  Luxury: "Luxury homes",
  Rental: "Rentals",
};

/** Read-only chips describing a search, in a stable order. */
export function describeCriteria(query: ListingQuery): string[] {
  const chips: string[] = [];
  if (query.search) chips.push(`"${query.search}"`);
  if (query.city) chips.push(query.city);
  if (query.transaction === "rent") chips.push("For rent");
  for (const code of query.postalCodes ?? []) chips.push(formatPostal(code));
  if (query.polygon?.length) {
    chips.push(
      query.schoolLabel
        ? `Near ${query.schoolLabel}${query.schoolKm ? ` (${query.schoolKm} km)` : ""}`
        : "Drawn area",
    );
  }
  if (query.status) {
    const group = backendStatusGroup(query.status);
    chips.push(STATUS_TABS.find((tab) => tab.group === group)?.label ?? query.status);
  }
  if (query.openHouse) chips.push("Open house");
  if (query.type) chips.push(query.type);
  if (query.priceMin && query.priceMax) {
    chips.push(`${formatPriceCompact(query.priceMin)} – ${formatPriceCompact(query.priceMax)}`);
  } else if (query.priceMin) {
    chips.push(`From ${formatPriceCompact(query.priceMin)}`);
  } else if (query.priceMax) {
    chips.push(`Under ${formatPriceCompact(query.priceMax)}`);
  }
  if (query.bedsMin) chips.push(`${query.bedsMin}+ beds`);
  if (query.bathsMin) chips.push(`${query.bathsMin}+ baths`);
  if (query.sqftMin) chips.push(`${query.sqftMin.toLocaleString("en-CA")}+ sq ft`);
  {
    const age = matchPropertyAgePreset(query.yearBuiltMin, query.yearBuiltMax);
    if (age) chips.push(`Age: ${age.label}`);
    else {
      if (query.yearBuiltMin) chips.push(`Built ${query.yearBuiltMin}+`);
      if (query.yearBuiltMax) chips.push(`Built ${query.yearBuiltMax} or earlier`);
    }
  }
  if (query.garagesMin) chips.push(`${query.garagesMin}+ garage`);
  if (query.storiesMin) chips.push(`${query.storiesMin}+ floors`);
  if (query.basement) {
    const labels: Record<NonNullable<ListingQuery["basement"]>, string> = {
      yes: "Has basement",
      finished: "Finished basement",
      unfinished: "Unfinished basement",
      apartment: "Basement apartment",
      none: "No basement",
    };
    chips.push(labels[query.basement]);
  }
  if (query.semantic) chips.push(`Like: ${query.semantic}`);
  return chips;
}

/** Default name, e.g. "Condos in Vaughan under $900K". Max 120 chars (backend limit). */
export function defaultSearchName(query: ListingQuery): string {
  const subject = query.type ? (TYPE_PLURALS[query.type] ?? query.type) : "Homes";
  const place = query.city
    ? query.city
    : query.postalCodes?.length
      ? query.postalCodes.map(formatPostal).join(", ")
      : query.polygon?.length
        ? "my drawn area"
        : query.search
          ? `"${query.search}"`
          : null;

  let name = place ? `${subject} in ${place}` : subject;
  if (query.priceMax) name += ` under ${formatPriceCompact(query.priceMax)}`;
  else if (query.priceMin) name += ` from ${formatPriceCompact(query.priceMin)}`;
  if (query.bedsMin) name += `, ${query.bedsMin}+ beds`;
  if (query.openHouse) name += " with open houses";
  return name.slice(0, 120);
}

/* -------------------------------------------------------------------------- */
/* Server calls (route handlers attach the user's token)                       */
/* -------------------------------------------------------------------------- */

export async function listSavedSearches(token: string): Promise<SavedSearch[]> {
  const rows = await apiFetch<BackendSavedSearch[] | { results?: BackendSavedSearch[] }>(
    `${MLS}/saved-searches/`,
    { token },
  );
  const list = Array.isArray(rows) ? rows : (rows.results ?? []);
  return list.map(mapSavedSearch);
}

export async function createSavedSearch(
  token: string,
  input: { name: string; filters: SavedFilters; alertCadence?: AlertCadence },
): Promise<SavedSearch> {
  const row = await apiFetch<BackendSavedSearch>(`${MLS}/saved-searches/`, {
    method: "POST",
    token,
    body: {
      name: input.name,
      filters_json: input.filters,
      ...(input.alertCadence ? { alert_cadence: input.alertCadence } : {}),
    },
  });
  return mapSavedSearch(row);
}

export async function updateSavedSearch(
  token: string,
  id: number,
  patch: { name?: string; filters?: SavedFilters; alertCadence?: AlertCadence },
): Promise<SavedSearch> {
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.filters !== undefined) body.filters_json = patch.filters;
  if (patch.alertCadence !== undefined) body.alert_cadence = patch.alertCadence;
  const row = await apiFetch<BackendSavedSearch>(`${MLS}/saved-searches/${id}/`, {
    method: "PUT",
    token,
    body,
  });
  return mapSavedSearch(row);
}

export async function deleteSavedSearch(token: string, id: number): Promise<void> {
  await apiFetch<void>(`${MLS}/saved-searches/${id}/`, { method: "DELETE", token });
}
