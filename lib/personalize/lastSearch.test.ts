import { describe, expect, it } from "vitest";
import {
  featuredFiltersFromListingQuery,
  featuredFiltersToListingsHref,
  hasFeaturedSearchFilters,
  parseLastSearchCookie,
  serializeLastSearchCookie,
  toFeaturedApiParams,
} from "@/lib/personalize/lastSearch";

describe("lastSearch / featured filters", () => {
  it("maps listing query fields to featured API params", () => {
    const filters = featuredFiltersFromListingQuery({
      city: "Oakville",
      priceMin: 500_000,
      priceMax: 1_200_000,
      bedsMin: 3,
      bathsMin: 2,
      type: "Detached",
      sqftMin: 2000,
      garagesMin: 2,
      basement: "finished",
      yearBuiltMin: 2010,
      postalCodes: ["L6J", "L6H"],
    });
    expect(hasFeaturedSearchFilters(filters)).toBe(true);
    expect(toFeaturedApiParams(filters)).toEqual({
      city: "Oakville",
      price_min: 500_000,
      price_max: 1_200_000,
      beds_min: 3,
      baths_min: 2,
      postal_code: "L6J,L6H",
      home_type: "detached",
      structure_type: undefined,
      sqft_min: 2000,
      sqft_max: undefined,
      basement: "finished",
      year_built_min: 2010,
      year_built_max: undefined,
      garages_min: 2,
    });
  });

  it("round-trips through the cookie payload", () => {
    const filters = featuredFiltersFromListingQuery({
      city: "Brampton",
      bedsMin: 4,
      type: "Townhome",
    });
    const cookie = serializeLastSearchCookie(filters);
    expect(parseLastSearchCookie(encodeURIComponent(cookie))).toEqual(filters);
    expect(featuredFiltersToListingsHref(filters)).toBe(
      "/listings?city=Brampton&home_type=townhouse&beds_min=4",
    );
  });

  it("treats empty filters as no search history", () => {
    expect(hasFeaturedSearchFilters({})).toBe(false);
    expect(featuredFiltersToListingsHref({})).toBe("/listings");
  });
});
