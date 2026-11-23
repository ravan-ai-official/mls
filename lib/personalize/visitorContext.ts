import { cookies, headers } from "next/headers";
import { cache } from "react";
import {
  featuredFiltersToListingsHref,
  hasFeaturedSearchFilters,
  LAST_SEARCH_COOKIE,
  parseLastSearchCookie,
  toFeaturedApiParams,
  type FeaturedSearchFilters,
} from "@/lib/personalize/lastSearch";
import {
  canonicalizePlace,
  parsePlacesCookie,
  PLACES_COOKIE,
} from "@/lib/personalize/places";

export interface VisitorPersonalization {
  /**
   * Cities from the ha_places cookie only. Used when ha_last_search is empty
   * so a city-only browse still counts as search history for Featured.
   */
  searchHistoryCities: string[];
  /** Last-search filters for FeaturedPropertiesAPIView (empty → no history). */
  lastSearch: FeaturedSearchFilters;
  /** True when Featured should send history params (skip curated). */
  hasSearchHistory: boolean;
  /** Query params to forward to featured-properties/ when hasSearchHistory. */
  featuredParams: Record<string, string | number | undefined>;
  /** Featured CTA href: /listings or /listings?… from last search. */
  listingsHref: string;
  /** Search-history cities first, then IP-derived city when distinct. */
  cities: string[];
  /** Headers to forward so the API can also resolve IP city as a fallback. */
  headers: Record<string, string>;
}

/**
 * SSR visitor context for homepage rails. Uses ha_last_search + ha_places and
 * platform IP-city headers — never browser geolocation, never invents cities.
 * Cached per request so every homepage rail shares one cookie/header read.
 */
export const getVisitorPersonalization = cache(async function getVisitorPersonalization(): Promise<VisitorPersonalization> {
  const jar = await cookies();
  const hdrs = await headers();
  const fromPlaces = parsePlacesCookie(jar.get(PLACES_COOKIE)?.value);
  let lastSearch = parseLastSearchCookie(jar.get(LAST_SEARCH_COOKIE)?.value);

  // City-only history from ha_places still counts when the richer cookie is empty.
  if (!hasFeaturedSearchFilters(lastSearch) && fromPlaces.length > 0) {
    lastSearch = { city: fromPlaces[0] };
  }

  const hasSearchHistory = hasFeaturedSearchFilters(lastSearch);
  const featuredParams = hasSearchHistory ? toFeaturedApiParams(lastSearch) : {};
  const listingsHref = hasSearchHistory
    ? featuredFiltersToListingsHref(lastSearch)
    : "/listings";

  const ipCity = canonicalizePlace(
    hdrs.get("x-vercel-ip-city") ||
      hdrs.get("cf-ipcity") ||
      hdrs.get("x-appengine-city") ||
      hdrs.get("x-geo-city"),
  );

  const cities: string[] = [...fromPlaces];
  if (ipCity && !cities.some((city) => city.toLowerCase() === ipCity.toLowerCase())) {
    cities.push(ipCity);
  }

  const forward: Record<string, string> = {};
  const forwarded = hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip");
  if (forwarded) forward["X-Forwarded-For"] = forwarded;
  if (ipCity) forward["X-Visitor-City"] = ipCity;
  const agent = hdrs.get("user-agent");
  if (agent) forward["User-Agent"] = agent.slice(0, 512);

  return {
    searchHistoryCities: fromPlaces.slice(0, 5),
    lastSearch,
    hasSearchHistory,
    featuredParams,
    listingsHref,
    cities: cities.slice(0, 5),
    headers: forward,
  };
});
