import type { ListingQuery, ListingSort, ListingTransaction } from "@/lib/types/domain";
import { parsePolygonParam, serializePolygonParam } from "@/lib/map/polygon";
import { parsePostalList } from "@/lib/utils/postal";

/** UI type label → filter `home_type` (mirrors lib/api/properties HOME_TYPE_PARAM). */
const HOME_TYPE_PARAM: Readonly<Record<string, string>> = {
  Detached: "detached",
  "Semi-Detached": "semi",
  Townhome: "townhouse",
  Condo: "condo",
};

/**
 * URL search params are the single source of truth for listing filters, so any
 * filtered view is shareable and the back button restores it exactly.
 *
 * /listings and /map-search read the SAME params, so switching views carries
 * the search over instead of silently resetting it.
 *
 * Writers use the MLS filter contract names (`search`, `price_min`, `beds_min`,
 * …). Readers still accept the older camelCase / short aliases so bookmarks
 * and saved links keep working.
 */

export const PAGE_SIZE = 12;

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/** First non-empty value among candidate keys (canonical first, then legacy). */
function pick(params: RawParams, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const raw = first(params[key])?.trim();
    if (raw) return raw;
  }
  return undefined;
}

function int(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

const BASEMENT_VALUES = new Set(["yes", "finished", "unfinished", "apartment", "none"]);

function parseBasement(
  value: string | undefined,
): ListingQuery["basement"] | undefined {
  const raw = value?.trim().toLowerCase();
  if (!raw || !BASEMENT_VALUES.has(raw)) return undefined;
  return raw as ListingQuery["basement"];
}

function parseKeywords(value: string | undefined): string[] | undefined {
  const words = (value ?? "").split(",").map((word) => word.trim()).filter(Boolean).slice(0, 10);
  return words.length > 0 ? words : undefined;
}

const SORTS: ListingSort[] = [
  "relevance",
  "newest",
  "price-asc",
  "price-desc",
  "beds-desc",
  "sqft-desc",
];

/** UI sort keys ↔ backend `orderby` (and legacy URL `sort=`). */
const ORDERBY_TO_SORT: Record<string, ListingSort> = {
  relevance: "relevance",
  "-modification_timestamp": "newest",
  "-original_entry_timestamp": "newest",
  list_price: "price-asc",
  "-list_price": "price-desc",
  "-bedrooms_total": "beds-desc",
  "-building_area_total": "sqft-desc",
};

const HOME_TYPE_TO_UI: Record<string, string> = Object.fromEntries(
  Object.entries(HOME_TYPE_PARAM).map(([ui, home]) => [home, ui]),
);

/**
 * `transaction_type=rent` / `tx=rent` is Rent; anything else is Buy.
 * `type=Rental` is the pre-`tx` spelling and still means Rent.
 */
function parseTransaction(params: RawParams): {
  transaction: ListingTransaction;
  type: string | undefined;
} {
  const typeRaw = pick(params, "type");
  const homeType = pick(params, "home_type");
  const legacyRent = typeRaw?.toLowerCase() === "rental";
  const rent =
    pick(params, "transaction_type", "tx")?.toLowerCase() === "rent" || legacyRent;
  const type = legacyRent
    ? undefined
    : typeRaw || (homeType ? HOME_TYPE_TO_UI[homeType.toLowerCase()] ?? homeType : undefined);
  return { transaction: rent ? "rent" : "sale", type };
}

function parseSort(params: RawParams, semantic: string | undefined): ListingSort {
  const sortRaw = pick(params, "sort");
  const orderbyRaw = pick(params, "orderby");
  const defaultSort: ListingSort = semantic ? "relevance" : "newest";
  if (sortRaw && SORTS.includes(sortRaw as ListingSort)) return sortRaw as ListingSort;
  if (orderbyRaw && ORDERBY_TO_SORT[orderbyRaw]) return ORDERBY_TO_SORT[orderbyRaw];
  return defaultSort;
}

/** Reads a listing query out of Next's resolved searchParams object. */
export function parseListingParams(params: RawParams): ListingQuery {
  const { transaction, type } = parseTransaction(params);
  const page = int(pick(params, "page")) ?? 1;
  // Invalid tokens in a hand-edited URL are dropped rather than failing the
  // page; the filter form is where a user gets told what was wrong.
  const postal = parsePostalList(pick(params, "postal_code", "postal") ?? "").codes;
  const polygon = parsePolygonParam(pick(params, "poly"));
  const semantic = pick(params, "semantic", "ai")?.slice(0, 300) || undefined;
  const sort = parseSort(params, semantic);
  const openHouseRaw = pick(params, "has_open_house", "openHouse");

  return {
    search: pick(params, "search", "q") || undefined,
    city: pick(params, "city") || undefined,
    status: pick(params, "status_group", "status") || undefined,
    transaction,
    type,
    priceMin: int(pick(params, "price_min", "priceMin")),
    priceMax: int(pick(params, "price_max", "priceMax")),
    bedsMin: int(pick(params, "beds_min", "beds")),
    bathsMin: int(pick(params, "baths_min", "baths")),
    sqftMin: int(pick(params, "sqft_min", "sqftMin")),
    sqftMax: int(pick(params, "sqft_max", "sqftMax")),
    yearBuiltMin: int(pick(params, "year_built_min", "yearBuiltMin")),
    garagesMin: int(pick(params, "garages_min", "garages")),
    storiesMin: int(pick(params, "stories_min", "floors")),
    basement: parseBasement(pick(params, "basement")),
    yearBuiltMax: int(pick(params, "year_built_max", "yearBuiltMax")),
    storiesMax: int(pick(params, "stories_max", "floorsMax")),
    feeMin: int(pick(params, "maintenance_fee_min", "feeMin")),
    feeMax: int(pick(params, "maintenance_fee_max", "feeMax")),
    listedSince: /^\d{4}-\d{2}-\d{2}$/.test(pick(params, "listed_since", "listedSince") ?? "")
      ? pick(params, "listed_since", "listedSince")
      : undefined,
    buildingType: pick(params, "structure_type", "building") || undefined,
    ownership: pick(params, "common_interest", "ownership") || undefined,
    keywords: parseKeywords(pick(params, "keywords")),
    postalCodes: postal.length > 0 ? postal : undefined,
    openHouse: openHouseRaw === "1" || openHouseRaw === "true" || undefined,
    polygon: polygon ?? undefined,
    schoolLabel: pick(params, "school")?.slice(0, 120) || undefined,
    schoolKm: (() => {
      const km = int(pick(params, "schoolKm"));
      return km && km >= 1 && km <= 10 ? km : undefined;
    })(),
    semantic,
    view: pick(params, "view") === "list" ? "list" : undefined,
    sort: sort === "relevance" && !semantic ? "newest" : sort,
    limit: PAGE_SIZE,
    offset: (Math.max(1, page) - 1) * PAGE_SIZE,
  };
}

/** Same as `parseListingParams`, for a URLSearchParams (client components). */
export function parseListingSearch(search: URLSearchParams | string): ListingQuery {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  return parseListingParams(Object.fromEntries(params.entries()));
}

/** Serializes a query into a bare querystring (no "?"), dropping defaults and blanks. */
export function buildListingQueryString(
  query: Partial<ListingQuery> & { page?: number },
): string {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.city) params.set("city", query.city);
  if (query.status) {
    // Keep the existing tab URL shape (`status=Active|Sold|De-listed`) so
    // ListingFilters pills and STATUS_TABS keep matching. Readers also accept
    // `status_group=active|sold|de-listed`.
    params.set("status", query.status);
  }
  // Buy is the default, so only Rent is written.
  if (query.transaction === "rent") params.set("transaction_type", "rent");
  if (query.type) {
    const home = HOME_TYPE_PARAM[query.type];
    if (home) params.set("home_type", home);
    else params.set("type", query.type); // e.g. Luxury price-band chip
  }
  if (query.priceMin) params.set("price_min", String(query.priceMin));
  if (query.priceMax) params.set("price_max", String(query.priceMax));
  if (query.bedsMin) params.set("beds_min", String(query.bedsMin));
  if (query.bathsMin) params.set("baths_min", String(query.bathsMin));
  if (query.sqftMin) params.set("sqft_min", String(query.sqftMin));
  if (query.sqftMax) params.set("sqft_max", String(query.sqftMax));
  if (query.yearBuiltMin) params.set("year_built_min", String(query.yearBuiltMin));
  if (query.garagesMin) params.set("garages_min", String(query.garagesMin));
  if (query.storiesMin) params.set("stories_min", String(query.storiesMin));
  if (query.basement) params.set("basement", query.basement);
  if (query.yearBuiltMax) params.set("year_built_max", String(query.yearBuiltMax));
  if (query.storiesMax) params.set("stories_max", String(query.storiesMax));
  if (query.feeMin) params.set("maintenance_fee_min", String(query.feeMin));
  if (query.feeMax) params.set("maintenance_fee_max", String(query.feeMax));
  if (query.listedSince) params.set("listed_since", query.listedSince);
  if (query.buildingType) params.set("structure_type", query.buildingType);
  if (query.ownership) params.set("common_interest", query.ownership);
  if (query.keywords?.length) params.set("keywords", query.keywords.join(","));
  if (query.postalCodes?.length) params.set("postal_code", query.postalCodes.join(","));
  if (query.openHouse) params.set("has_open_house", "1");
  const poly = serializePolygonParam(query.polygon);
  if (poly) params.set("poly", poly);
  // School label only makes sense with an area; drop orphans from hand-edited URLs.
  if (poly && query.schoolLabel) params.set("school", query.schoolLabel);
  if (poly && query.schoolLabel && query.schoolKm) {
    params.set("schoolKm", String(query.schoolKm));
  }
  if (query.semantic) params.set("semantic", query.semantic);
  // Omit the default sort, which depends on whether semantic preferences exist.
  const defaultSort = query.semantic ? "relevance" : "newest";
  if (query.sort && query.sort !== defaultSort) params.set("sort", query.sort);
  if (query.view === "list") params.set("view", "list");
  if (query.page && query.page > 1) params.set("page", String(query.page));
  return params.toString();
}

/** Serializes a query back into a URL. Keeps `view` so pagination and tabs don't reset it. */
export function buildListingHref(
  query: Partial<ListingQuery> & { page?: number },
  base = "/listings",
): string {
  const qs = buildListingQueryString(query);
  return qs ? `${base}?${qs}` : base;
}

export function currentPage(query: ListingQuery): number {
  return Math.floor((query.offset ?? 0) / (query.limit ?? PAGE_SIZE)) + 1;
}

export function hasActiveFilters(query: ListingQuery): boolean {
  return Boolean(
    query.search ||
      query.city ||
      query.type ||
      query.priceMin ||
      query.priceMax ||
      query.bedsMin ||
      query.bathsMin ||
      query.sqftMin ||
      query.sqftMax ||
      query.yearBuiltMin ||
      query.garagesMin ||
      query.storiesMin ||
      query.basement ||
      query.yearBuiltMax ||
      query.storiesMax ||
      query.feeMin ||
      query.feeMax ||
      query.listedSince ||
      query.buildingType ||
      query.ownership ||
      query.keywords?.length ||
      query.postalCodes?.length ||
      query.openHouse ||
      query.semantic ||
      query.polygon?.length ||
      query.schoolLabel,
  );
}

/**
 * Legacy URL keys that may still appear on old bookmarks. Writers should clear
 * these when setting the matching canonical key so both never coexist.
 */
export const LEGACY_LISTING_PARAM_KEYS = [
  "q",
  "tx",
  "priceMin",
  "priceMax",
  "beds",
  "baths",
  "sqftMin",
  "sqftMax",
  "yearBuiltMin",
  "yearBuiltMax",
  "garages",
  "floors",
  "floorsMax",
  "feeMin",
  "feeMax",
  "listedSince",
  "building",
  "ownership",
  "postal",
  "openHouse",
  "ai",
  "domMax",
  "familyRoom",
  "kitchens",
] as const;
