/**
 * Last listing search for homepage Featured personalization.
 *
 * Written when the visitor applies filters (listings / map / hero / AI).
 * Read on SSR and forwarded to FeaturedPropertiesAPIView — never invent
 * cities or curated rules on the client.
 */

import type { ListingQuery } from "@/lib/types/domain";
import { buildListingQueryString, parseListingSearch } from "@/lib/utils/searchParams";

export const LAST_SEARCH_COOKIE = "ha_last_search";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

/** UI type → Featured / filter `home_type` (same as lib/api/properties HOME_TYPE_PARAM). */
const HOME_TYPE_PARAM: Readonly<Record<string, string>> = {
  Detached: "detached",
  "Semi-Detached": "semi",
  Townhome: "townhouse",
  Condo: "condo",
};

/** Subset of ListingQuery that FeaturedPropertiesAPIView accepts as history. */
export type FeaturedSearchFilters = {
  city?: string;
  priceMin?: number;
  priceMax?: number;
  bedsMin?: number;
  bathsMin?: number;
  postalCodes?: string[];
  type?: string;
  buildingType?: string;
  sqftMin?: number;
  sqftMax?: number;
  basement?: ListingQuery["basement"];
  yearBuiltMin?: number;
  yearBuiltMax?: number;
  garagesMin?: number;
};

/** Pull featured-relevant fields from a listing query (sale-oriented). */
export function featuredFiltersFromListingQuery(
  query: Partial<ListingQuery>,
): FeaturedSearchFilters {
  const filters: FeaturedSearchFilters = {};
  if (query.city?.trim()) filters.city = query.city.trim();
  if (query.priceMin) filters.priceMin = query.priceMin;
  if (query.priceMax) filters.priceMax = query.priceMax;
  if (query.bedsMin) filters.bedsMin = query.bedsMin;
  if (query.bathsMin) filters.bathsMin = query.bathsMin;
  if (query.postalCodes?.length) filters.postalCodes = query.postalCodes.slice(0, 5);
  if (query.type?.trim()) filters.type = query.type.trim();
  if (query.buildingType?.trim()) filters.buildingType = query.buildingType.trim();
  if (query.sqftMin) filters.sqftMin = query.sqftMin;
  if (query.sqftMax) filters.sqftMax = query.sqftMax;
  if (query.basement) filters.basement = query.basement;
  if (query.yearBuiltMin) filters.yearBuiltMin = query.yearBuiltMin;
  if (query.yearBuiltMax) filters.yearBuiltMax = query.yearBuiltMax;
  if (query.garagesMin) filters.garagesMin = query.garagesMin;
  return filters;
}

export function hasFeaturedSearchFilters(filters: FeaturedSearchFilters): boolean {
  return Boolean(
    filters.city ||
      filters.priceMin ||
      filters.priceMax ||
      filters.bedsMin ||
      filters.bathsMin ||
      filters.postalCodes?.length ||
      filters.type ||
      filters.buildingType ||
      filters.sqftMin ||
      filters.sqftMax ||
      filters.basement ||
      filters.yearBuiltMin ||
      filters.yearBuiltMax ||
      filters.garagesMin,
  );
}

/** ListingQuery-shaped object → featured API query params (snake_case). */
export function toFeaturedApiParams(
  filters: FeaturedSearchFilters,
): Record<string, string | number | undefined> {
  const homeType = filters.type ? HOME_TYPE_PARAM[filters.type] : undefined;
  return {
    city: filters.city,
    price_min: filters.priceMin,
    price_max: filters.priceMax,
    beds_min: filters.bedsMin,
    baths_min: filters.bathsMin,
    postal_code: filters.postalCodes?.length ? filters.postalCodes.join(",") : undefined,
    home_type: homeType,
    structure_type: filters.buildingType,
    sqft_min: filters.sqftMin,
    sqft_max: filters.sqftMax,
    basement: filters.basement,
    year_built_min: filters.yearBuiltMin,
    year_built_max: filters.yearBuiltMax,
    garages_min: filters.garagesMin,
  };
}

/** /listings query string for the Featured “View all” CTA. */
export function featuredFiltersToListingsHref(filters: FeaturedSearchFilters): string {
  const qs = buildListingQueryString({
    city: filters.city,
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
    bedsMin: filters.bedsMin,
    bathsMin: filters.bathsMin,
    postalCodes: filters.postalCodes,
    type: filters.type,
    buildingType: filters.buildingType,
    sqftMin: filters.sqftMin,
    sqftMax: filters.sqftMax,
    basement: filters.basement,
    yearBuiltMin: filters.yearBuiltMin,
    yearBuiltMax: filters.yearBuiltMax,
    garagesMin: filters.garagesMin,
  });
  return qs ? `/listings?${qs}` : "/listings";
}

export function serializeLastSearchCookie(filters: FeaturedSearchFilters): string {
  return buildListingQueryString({
    city: filters.city,
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
    bedsMin: filters.bedsMin,
    bathsMin: filters.bathsMin,
    postalCodes: filters.postalCodes,
    type: filters.type,
    buildingType: filters.buildingType,
    sqftMin: filters.sqftMin,
    sqftMax: filters.sqftMax,
    basement: filters.basement,
    yearBuiltMin: filters.yearBuiltMin,
    yearBuiltMax: filters.yearBuiltMax,
    garagesMin: filters.garagesMin,
  });
}

export function parseLastSearchCookie(value: string | null | undefined): FeaturedSearchFilters {
  if (!value) return {};
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.trim()) return {};
    return featuredFiltersFromListingQuery(parseListingSearch(decoded));
  } catch {
    return {};
  }
}

/** Persist the visitor’s last search. Safe in client components. */
export function rememberLastSearch(query: Partial<ListingQuery>) {
  if (typeof document === "undefined") return;
  const filters = featuredFiltersFromListingQuery(query);
  if (!hasFeaturedSearchFilters(filters)) return;
  try {
    const payload = encodeURIComponent(serializeLastSearchCookie(filters));
    const secure =
      typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${LAST_SEARCH_COOKIE}=${payload}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  } catch {
    // Cookie blocked — Featured stays on IP / curated defaults.
  }
}
