"use client";

import {
  featuredFiltersToListingsHref,
  hasFeaturedSearchFilters,
  LAST_SEARCH_COOKIE,
  parseLastSearchCookie,
  toFeaturedApiParams,
  type FeaturedSearchFilters,
} from "@/lib/personalize/lastSearch";
import {
  parsePlacesCookie,
  PLACES_COOKIE,
} from "@/lib/personalize/places";

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

/** Browser equivalent of getVisitorPersonalization for homepage rails. */
export function readClientVisitor(): {
  lastSearch: FeaturedSearchFilters;
  searchHistoryCities: string[];
  hasSearchHistory: boolean;
  featuredParams: Record<string, string | number | undefined>;
  listingsHref: string;
  cities: string[];
} {
  const fromPlaces = parsePlacesCookie(readCookie(PLACES_COOKIE));
  let lastSearch = parseLastSearchCookie(readCookie(LAST_SEARCH_COOKIE));
  if (!hasFeaturedSearchFilters(lastSearch) && fromPlaces.length > 0) {
    lastSearch = { city: fromPlaces[0] };
  }
  const hasSearchHistory = hasFeaturedSearchFilters(lastSearch);
  return {
    lastSearch,
    searchHistoryCities: fromPlaces.slice(0, 5),
    hasSearchHistory,
    featuredParams: hasSearchHistory ? toFeaturedApiParams(lastSearch) : {},
    listingsHref: hasSearchHistory
      ? featuredFiltersToListingsHref(lastSearch)
      : "/listings",
    cities: fromPlaces.slice(0, 5),
  };
}
