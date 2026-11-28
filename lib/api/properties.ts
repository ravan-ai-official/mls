/**
 * Property search, detail and compare.
 *
 * Backend filter support (API_GAPS G1) landed in mls-v2 `PropertyFilterView`:
 * `price_min`/`price_max`, `beds_min`, `baths_min`, `sqft_min`/`sqft_max`,
 * `year_built_min` and a repeatable `property_sub_type` are now applied in SQL,
 * so those queries are exact, fully paginated and no longer window-capped.
 *
 * Property TYPE is server-side too, via the backend's `home_type` filter
 * (2026-09). This feed's `property_sub_type` is "Single Family" for 4,114 of
 * 4,622 rows, so it cannot tell a condo from a house; `home_type` reads
 * `structure_type` + `property_attached_yn` instead. "Luxury" is a living-area
 * band (effective sqft > 3500 → `sqft_min=3501`), not a structure or price
 * floor. Only a type with no server mapping still falls back to the windowed
 * client-side match (disclosed in the UI as "About N").
 */

import { ApiError, apiFetch, type RequestOptions } from "@/lib/api/client";
import { mapPropertyDetail, mapPropertySummary, mapPropertyTypeFacet, matchesUiType } from "@/lib/api/mappers";
import {
  DEFAULT_FILTER_SCHEMA,
  normalizeFilterSchema,
  type FilterSchema,
} from "@/lib/search/filterSchema";
import { backendStatusGroup, type BackendStatusGroup } from "@/lib/utils/status";
import type {
  BackendListResponse,
  BackendPropertyDetail,
  BackendPropertySummary,
  BackendPropertyTypeFacet,
} from "@/lib/types/backend";
import type {
  ListingQuery,
  ListingSort,
  Paginated,
  PropertyDetail,
  PropertyFacets,
  PropertySummary,
  PropertyTypeFacet,
} from "@/lib/types/domain";

const MLS = "/api/mls";

/** Max rows we will pull when emulating an unsupported filter client-side. */
const CLIENT_FILTER_WINDOW = 300;
/** Backend caps `limit` at 100. */
const MAX_PAGE_SIZE = 100;

/** UI type → backend `home_type` (mls-v2 query_helpers.HOME_TYPE_Q). */
export const HOME_TYPE_PARAM: Readonly<Record<string, string>> = {
  Detached: "detached",
  "Semi-Detached": "semi",
  Townhome: "townhouse",
  Condo: "condo",
};
/**
 * Luxury = effective living area strictly greater than 3500 sq ft.
 * Listing API uses gte, so pass 3501 (matches backend Coalesce(above_grade,
 * living_area, building_area_total) > 3500).
 */
export const LUXURY_MIN_SQFT = 3501;

function typeIsServerSide(type: string): boolean {
  return type in HOME_TYPE_PARAM || type === "Luxury";
}

/** Min sqft with the Luxury size floor applied (no price floor for Luxury). */
function effectiveSqftMin(query: ListingQuery): number | undefined {
  return query.type === "Luxury"
    ? Math.max(query.sqftMin ?? 0, LUXURY_MIN_SQFT)
    : query.sqftMin;
}

export const SORT_TO_ORDERBY: Record<ListingSort, string> = {
  // Backend ranks by similarity to `semantic` (AI search's "Best match").
  relevance: "relevance",
  // Kept for explicit saved-search round-trips; default "newest" omits
  // orderby in toBackendParams (sorted active queries timeout or empty).
  newest: "-modification_timestamp",
  "price-asc": "list_price",
  "price-desc": "-list_price",
  "beds-desc": "-bedrooms_total",
  "sqft-desc": "-building_area_total",
};

/** True when the query uses a filter the backend cannot express. */
function needsClientFiltering(query: ListingQuery): boolean {
  return Boolean(query.type) && !typeIsServerSide(query.type!);
}

function applyClientFilters(items: PropertySummary[], query: ListingQuery): PropertySummary[] {
  if (!query.type) return items;
  return items.filter((item) => matchesUiType(item.type, query.type!));
}

/**
 * ListingQuery → `properties/filter/` params. Exported because it is the ONE
 * translation: the map route and saved searches (whose `filters_json` stores
 * exactly this, minus paging) reuse it rather than re-deriving the mapping.
 */
export function toBackendParams(query: ListingQuery, limit?: number, offset?: number) {
  // Never ask the backend for relaxed / nearby / catalogue fallbacks. An empty
  // match must render the empty state — substitute listings are always wrong.
  // Status tabs select a GROUP ("Sold" also matches "Closed"/"Leased").
  const transaction = query.transaction ?? "sale";
  // Prefer an explicit status group. When the URL has none, For Sale / For Rent
  // must still exclude sold — otherwise map (and any caller that forgets
  // status=Active) mixes closed homes into the active catalogue.
  const explicitGroup = backendStatusGroup(query.status);
  const group =
    explicitGroup ??
    (query.status
      ? undefined
      : transaction === "sold"
        ? "sold"
        : "active");
  const sortKey =
    query.sort === "relevance" && !query.semantic ? "newest" : (query.sort ?? "newest");
  // Omit default "newest" — sorted active+sale queries are intermittent and
  // often exceed the client timeout from Vercel, while the backend default is
  // fast and returns the full active set.
  const orderby =
    sortKey === "newest" ? undefined : SORT_TO_ORDERBY[sortKey];
  return {
    limit,
    offset,
    search: query.search,
    city: query.city,
    status: group ? undefined : query.status,
    status_group: group ?? undefined,
    transaction_type: transaction,
    has_lease: query.hasLease ? "true" : undefined,
    orderby,
    semantic: query.semantic,
    // Server-side since G1 — exact counts, no window cap.
    price_min: query.priceMin,
    price_max: query.priceMax,
    bedrooms: query.bedsMin,
    bathrooms: query.bathsMin,
    beds_min: query.bedsMin,
    baths_min: query.bathsMin,
    sold_within_days:
      transaction === "sold" ? query.soldWithinDays : undefined,
    sqft_min: effectiveSqftMin(query),
    sqft_max: query.sqftMax,
    year_built_min: query.yearBuiltMin,
    garages_min: query.garagesMin,
    stories_min: query.storiesMin,
    basement: query.basement,
    // Repeatable: buildQuery() appends one key per entry, which DRF reads via
    // getlist(). Only sent when the caller passes real feed values.
    property_sub_type: query.propertySubTypes?.length ? query.propertySubTypes : undefined,
    home_type: query.type ? HOME_TYPE_PARAM[query.type] : undefined,
    // Matched against the listing description (public_remarks), OR'ed.
    keywords: query.keywords?.length ? query.keywords.join(",") : undefined,
    year_built_max: query.yearBuiltMax,
    stories_max: query.storiesMax,
    maintenance_fee_min: query.feeMin,
    maintenance_fee_max: query.feeMax,
    listed_since: query.listedSince,
    structure_type: query.buildingType,
    common_interest: query.ownership,
    lat_min: query.bounds?.latMin,
    lat_max: query.bounds?.latMax,
    lng_min: query.bounds?.lngMin,
    lng_max: query.bounds?.lngMax,
    polygon: query.polygon ? JSON.stringify(query.polygon) : undefined,
    // Backend normalises spaces/case; FSAs prefix-match, full codes are exact.
    postal_code: query.postalCodes?.length ? query.postalCodes.join(",") : undefined,
    has_open_house: query.openHouse ? "1" : undefined,
    allow_fallback: "false",
  };
}

export interface ListingsResult extends Paginated<PropertySummary> {
  /**
   * True when unsupported filters forced client-side filtering, so `total` is a
   * count within the fetched window rather than the full result set.
   */
  approximate: boolean;
  /** True when the client-side window was exhausted and results may be missing. */
  truncated: boolean;
}

/** Listings filter often needs >15s from Vercel when the feed is under load. */
const LISTINGS_TIMEOUT_MS = 25_000;

type FilterParams = ReturnType<typeof toBackendParams>;

/**
 * Fetch one filter page. On timeout / empty active+orderby responses, retry
 * once without orderby so the For Sale tab still renders.
 */
async function fetchListingsPage(
  params: FilterParams,
  opts: RequestOptions,
): Promise<BackendListResponse<BackendPropertySummary>> {
  const request = (next: FilterParams, extra: RequestOptions = {}) =>
    apiFetch<BackendListResponse<BackendPropertySummary>>(`${MLS}/properties/filter/`, {
      ...opts,
      timeoutMs: LISTINGS_TIMEOUT_MS,
      ...extra,
      params: next,
    });

  const withoutOrderby = { ...params, orderby: undefined };

  try {
    const data = await request(params);
    if (
      (data.count ?? 0) === 0 &&
      (data.results?.length ?? 0) === 0 &&
      params.status_group === "active" &&
      params.orderby
    ) {
      return request(withoutOrderby, { cache: "no-store" });
    }
    return data;
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 504 &&
      params.orderby
    ) {
      return request(withoutOrderby, { cache: "no-store" });
    }
    throw error;
  }
}

export async function searchProperties(
  query: ListingQuery = {},
  options: RequestOptions = {},
): Promise<ListingsResult> {
  const pageSize = Math.min(query.limit ?? 12, MAX_PAGE_SIZE);
  const offset = query.offset ?? 0;
  // Feed-backed search is safe to ISR briefly; callers that need fresh data
  // (personalization, auth) pass cache: "no-store" or their own revalidate.
  const opts: RequestOptions = { revalidate: 60, ...options };

  if (!needsClientFiltering(query)) {
    const params = toBackendParams(query, pageSize, offset);
    const data = await fetchListingsPage(params, opts);
    return {
      items: (data.results ?? []).map(mapPropertySummary),
      total: data.count ?? 0,
      nextOffset: data.next,
      previousOffset: data.previous,
      approximate: false,
      truncated: false,
    };
  }

  // Type filter only: every OTHER filter still narrows the query server-side
  // first, so the window we scan is already as small as the backend can make it.
  const data = await fetchListingsPage(toBackendParams(query, MAX_PAGE_SIZE, 0), opts);

  const first = (data.results ?? []).map(mapPropertySummary);
  const available = Math.min(data.count ?? 0, CLIENT_FILTER_WINDOW);

  // Fetch the remaining window pages CONCURRENTLY. Serially these were three
  // round-trips stacked inside one render, which blew the client's timeout
  // and failed the page outright — a parallel fan-out costs one round-trip.
  const offsets: number[] = [];
  for (let at = first.length; at < available; at += MAX_PAGE_SIZE) {
    offsets.push(at);
  }

  const pages = await Promise.all(
    offsets.map((at) =>
      fetchListingsPage(toBackendParams(query, MAX_PAGE_SIZE, at), opts)
        .then((page) => (page.results ?? []).map(mapPropertySummary))
        // One slow page must not fail the whole grid; it only narrows the
        // window, which `truncated` already discloses.
        .catch(() => [] as PropertySummary[]),
    ),
  );

  const pool = first.concat(...pages);
  const fetched = pool.length;

  const filtered = applyClientFilters(pool, query);
  const page = filtered.slice(offset, offset + pageSize);

  return {
    items: page,
    total: filtered.length,
    nextOffset: offset + pageSize < filtered.length ? offset + pageSize : null,
    previousOffset: offset > 0 ? Math.max(0, offset - pageSize) : null,
    approximate: true,
    truncated: (data.count ?? 0) > fetched,
  };
}

/**
 * GET properties/facets/ — counts per status, sub-type and price bucket for the
 * current filter set (API_GAPS G2). Powers the listings status tabs.
 *
 * Sends the same scoping filters as the listings query (including `search`)
 * so tab counts match the result total. Polygon is still omitted — expensive
 * and rare on this strip. A failure returns null; tabs stay without counts.
 */
/** Option sets + sheet visibility by transaction_type. Falls back on 404. */
export async function getFilterSchema(
  options: RequestOptions = {},
): Promise<FilterSchema> {
  try {
    const data = await apiFetch<unknown>(`${MLS}/properties/filter-schema/`, {
      revalidate: 3600,
      ...options,
    });
    return normalizeFilterSchema(data);
  } catch {
    return DEFAULT_FILTER_SCHEMA;
  }
}

export async function getPropertyFacets(
  query: ListingQuery = {},
  options: RequestOptions = {},
): Promise<PropertyFacets | null> {
  try {
    const group = backendStatusGroup(query.status);
    const data = await apiFetch<{
      status?: Record<string, number>;
      status_group?: Partial<Record<BackendStatusGroup, number>>;
      property_sub_type?: Record<string, number>;
      price_buckets?: Array<{ min: number; max: number | null; count: number }>;
      open_house?: number;
    }>(`${MLS}/properties/facets/`, {
      revalidate: 300,
      ...options,
      params: {
        search: query.search,
        city: query.city,
        status: group ? undefined : query.status,
        status_group: group ?? undefined,
        transaction_type: query.transaction,
        has_lease: query.hasLease ? "true" : undefined,
        price_min: query.priceMin,
        price_max: query.priceMax,
        beds_min: query.bedsMin,
        baths_min: query.bathsMin,
        sqft_min: effectiveSqftMin(query),
        sqft_max: query.sqftMax,
        year_built_min: query.yearBuiltMin,
        garages_min: query.garagesMin,
        stories_min: query.storiesMin,
        basement: query.basement,
        property_sub_type: query.propertySubTypes?.length
          ? query.propertySubTypes
          : undefined,
        home_type: query.type ? HOME_TYPE_PARAM[query.type] : undefined,
        keywords: query.keywords?.length ? query.keywords.join(",") : undefined,
        year_built_max: query.yearBuiltMax,
        stories_max: query.storiesMax,
        maintenance_fee_min: query.feeMin,
        maintenance_fee_max: query.feeMax,
        listed_since: query.listedSince,
        structure_type: query.buildingType,
        common_interest: query.ownership,
        postal_code: query.postalCodes?.length ? query.postalCodes.join(",") : undefined,
        has_open_house: query.openHouse ? "1" : undefined,
      },
    });
    return {
      status: data.status ?? {},
      // Older backends omit it; null keeps the tabs but drops their counts.
      statusGroup: data.status_group ?? null,
      propertySubType: data.property_sub_type ?? {},
      priceBuckets: data.price_buckets ?? [],
      // Older backends omit it; null hides the tab rather than showing "0".
      openHouse: typeof data.open_house === "number" ? data.open_house : null,
    };
  } catch {
    return null;
  }
}

export async function getProperty(
  listingKey: string,
  options: RequestOptions = {},
): Promise<PropertyDetail> {
  const data = await apiFetch<BackendPropertyDetail>(
    `${MLS}/properties/${encodeURIComponent(listingKey)}/`,
    options,
  );
  return mapPropertyDetail(data);
}

/** GET properties/compare/?listing_key=A&listing_key=B */
export async function compareProperties(
  listingKeys: string[],
  options: RequestOptions = {},
): Promise<PropertyDetail[]> {
  if (listingKeys.length === 0) return [];
  const data = await apiFetch<BackendPropertyDetail[]>(`${MLS}/properties/compare/`, {
    ...options,
    params: { listing_key: listingKeys },
  });
  return (data ?? []).map(mapPropertyDetail);
}

export async function getPropertyTypes(
  options: RequestOptions = {},
): Promise<PropertyTypeFacet[]> {
  const data = await apiFetch<{ results: BackendPropertyTypeFacet[] }>(
    `${MLS}/properties/property-types/`,
    { revalidate: 3600, ...options },
  );
  return (data.results ?? []).map(mapPropertyTypeFacet);
}

/** Curated rails used on the home page. */
export async function getNewlyListed(
  limit = 8,
  options: RequestOptions = {},
): Promise<PropertySummary[]> {
  const data = await apiFetch<BackendListResponse<BackendPropertySummary>>(
    `${MLS}/properties/newly-listed-properties/`,
    { revalidate: 600, ...options, params: { limit, ...options.params } },
  );
  return (data.results ?? []).map(mapPropertySummary);
}

/**
 * Home "Featured" rail (mls-backend FeaturedPropertiesAPIView).
 *
 * Pass last-search filter params only when the visitor has real search history
 * — the backend treats those as “has history” (featured_source=history) and
 * skips curated fill. Omit them (still forward IP headers) so IP-local +
 * curated defaults can run. Never invent cities. Rentals are excluded server-side.
 * Default limit is 12.
 */
export async function getFeaturedProperties(
  limit = 12,
  options: RequestOptions & {
    /** @deprecated Prefer `historyParams` — kept for city-only callers. */
    cities?: string[];
    /** Last-search filters (city, price_min, beds_min, …). Empty → no history. */
    historyParams?: Record<string, string | number | undefined>;
  } = {},
): Promise<{
  listings: PropertySummary[];
  pinnedCount: number;
  localCount: number;
  historyCount: number;
  curatedCount: number;
  hasSearchHistory: boolean;
}> {
  const { cities, historyParams, ...rest } = options;
  const history = { ...(historyParams ?? {}) };
  // Legacy city-only callers → cities= so backend still detects history.
  if (!history.city && !history.cities && cities?.length) {
    history.cities = cities.join(",");
  }
  const hasHistoryParams = Object.values(history).some(
    (value) => value !== undefined && value !== null && String(value).trim() !== "",
  );

  const data = await apiFetch<
    BackendListResponse<BackendPropertySummary & { featured_source?: string }> & {
      pinned_count?: number;
      local_count?: number;
      history_count?: number;
      curated_count?: number;
      has_search_history?: boolean;
    }
  >(`${MLS}/properties/featured-properties/`, {
    revalidate: hasHistoryParams ? 60 : 300,
    ...rest,
    params: {
      limit,
      // Never send IP city as cities= — only real search history.
      ...(hasHistoryParams ? history : {}),
      ...rest.params,
    },
  });
  return {
    listings: (data.results ?? []).map(mapPropertySummary),
    pinnedCount: data.pinned_count ?? 0,
    localCount: data.local_count ?? 0,
    historyCount: data.history_count ?? 0,
    curatedCount: data.curated_count ?? 0,
    hasSearchHistory: Boolean(data.has_search_history) || hasHistoryParams,
  };
}

export async function getExclusiveProperties(
  limit = 8,
  options: RequestOptions = {},
): Promise<PropertySummary[]> {
  const data = await apiFetch<BackendListResponse<BackendPropertySummary>>(
    `${MLS}/properties/exclusive-properties/`,
    { revalidate: 600, ...options, params: { limit, ...options.params } },
  );
  return (data.results ?? []).map(mapPropertySummary);
}

export async function getOpenHouses(
  limit = 8,
  options: RequestOptions = {},
): Promise<PropertySummary[]> {
  const data = await apiFetch<
    BackendListResponse<BackendPropertySummary> | BackendPropertySummary[]
  >(`${MLS}/properties/open-houses/`, {
    revalidate: 300,
    ...options,
    params: { limit, ...options.params },
  });
  const rows = Array.isArray(data) ? data : (data.results ?? []);
  return rows.map(mapPropertySummary);
}

export async function getSimilarProperties(
  listingKey: string,
  options: RequestOptions = {},
): Promise<PropertySummary[]> {
  const data = await apiFetch<
    | BackendPropertySummary[]
    | {
        results?: BackendPropertySummary[];
        /** Ranked matches. Each row wraps the listing under `property`. */
        for_this_home?: Array<{ property?: BackendPropertySummary | null }>;
        fallback?: Array<{ property?: BackendPropertySummary | null }>;
      }
  >(`${MLS}/properties/${encodeURIComponent(listingKey)}/recommendations/`, {
    revalidate: 300,
    ...options,
  });
  if (Array.isArray(data)) return data.map(mapPropertySummary);
  const ranked = (data.for_this_home ?? [])
    .map((row) => row.property)
    .filter((row): row is BackendPropertySummary => Boolean(row?.listing_key));
  if (ranked.length > 0) return ranked.map(mapPropertySummary);
  const fallback = (data.fallback ?? [])
    .map((row) => row.property)
    .filter((row): row is BackendPropertySummary => Boolean(row?.listing_key));
  const rows = fallback.length > 0 ? fallback : (data.results ?? []);
  return rows.map(mapPropertySummary);
}

/** Sold / for-sale / rent peers for the Comparables tab (distance + type + beds + price). */
export async function getPropertyComparables(
  listingKey: string,
  limit = 4,
  options: RequestOptions = {},
): Promise<{ sale: PropertySummary[]; sold: PropertySummary[]; rent: PropertySummary[] }> {
  const data = await apiFetch<{
    sale?: BackendPropertySummary[];
    sold?: BackendPropertySummary[];
    rent?: BackendPropertySummary[];
  }>(`${MLS}/properties/${encodeURIComponent(listingKey)}/comparables/`, {
    revalidate: 300,
    ...options,
    params: { limit, ...options.params },
  });
  return {
    sale: (data.sale ?? []).map(mapPropertySummary),
    sold: (data.sold ?? []).map(mapPropertySummary),
    rent: (data.rent ?? []).map(mapPropertySummary),
  };
}

/** Listings flagged as community features (curated by the brokerage). */
export async function getCommunityProperties(
  limit = 8,
  options: RequestOptions = {},
): Promise<PropertySummary[]> {
  const data = await apiFetch<BackendListResponse<BackendPropertySummary>>(
    `${MLS}/properties/community-properties/`,
    { revalidate: 600, ...options, params: { limit, ...options.params } },
  );
  return (data.results ?? []).map(mapPropertySummary);
}

/**
 * Lease-only listings (lease_amount > 0). Backs the navbar's "Rent" entry point
 * more accurately than filtering resale rows by property type.
 */
export async function getLeaseProperties(
  limit = 12,
  options: RequestOptions = {},
): Promise<PropertySummary[]> {
  const data = await apiFetch<BackendListResponse<BackendPropertySummary>>(
    `${MLS}/properties/lease-properties/`,
    { revalidate: 600, ...options, params: { limit, ...options.params } },
  );
  return (data.results ?? []).map(mapPropertySummary);
}

/**
 * AI-written listing summary. The endpoint is generative, so treat a failure as
 * "no summary" rather than an error — the page always has public_remarks.
 */
export async function getListingSummary(
  listingKey: string,
  options: RequestOptions = {},
): Promise<string | null> {
  try {
    const data = await apiFetch<{ summary?: string; text?: string }>(
      `${MLS}/properties/ai-summary/`,
      { revalidate: 3600, ...options, params: { listing_key: listingKey } },
    );
    const summary = (data.summary ?? data.text ?? "").trim();
    return summary.length > 0 ? summary : null;
  } catch {
    return null;
  }
}
