import { describe, expect, it } from "vitest";
import { toBackendParams } from "@/lib/api/properties";
import { fromBackendParams, toSavedFilters } from "@/lib/api/savedSearches";
import { aiFiltersToQuery, applyLocalSearch, queryToAiFilters } from "@/lib/api/aiSearch";
import { buildListingQueryString, parseListingParams } from "@/lib/utils/searchParams";

describe("aiFiltersToQuery", () => {
  it("maps backend filters onto the listing query", () => {
    const query = aiFiltersToQuery({
      transaction: "rent",
      property_type: "Condo",
      city: "Toronto",
      price_max: 3000,
      beds_min: 2,
      postal_codes: ["M5V"],
      keywords: "Liberty Village",
      semantic_text: "parking, near transit",
      sort: null,
    });
    expect(query).toMatchObject({
      transaction: "rent",
      type: "Condo",
      city: "Toronto",
      priceMax: 3000,
      bedsMin: 2,
      postalCodes: ["M5V"],
      search: "Liberty Village",
      semantic: "parking, near transit",
      sort: "relevance",
    });
  });

  it("drops unknown types, zero and junk values", () => {
    const query = aiFiltersToQuery({
      property_type: "Castle",
      price_min: 0,
      beds_min: -1,
      city: "  ",
      sort: "random" as never,
    });
    expect(query.type).toBeUndefined();
    expect(query.priceMin).toBeUndefined();
    expect(query.bedsMin).toBeUndefined();
    expect(query.city).toBeUndefined();
    expect(query.sort).toBe("newest");
  });

  it("maps a sold request to the Sold tab", () => {
    expect(aiFiltersToQuery({ listing_status: "sold" }).status).toBe("Sold");
  });

  it("round-trips through queryToAiFilters for refinement", () => {
    const filters = queryToAiFilters({ city: "Vaughan", type: "Townhome", priceMax: 1_000_000, semantic: "garage", sort: "relevance" });
    expect(filters).toEqual({ city: "Vaughan", property_type: "Townhome", price_max: 1_000_000, semantic_text: "garage" });
  });
});

describe("ai URL param", () => {
  it("defaults the sort to Best match and omits it from the URL", () => {
    const query = parseListingParams({ ai: "big backyard", city: "Oakville" });
    expect(query.semantic).toBe("big backyard");
    expect(query.sort).toBe("relevance");
    expect(buildListingQueryString(query)).toBe("city=Oakville&semantic=big+backyard");
  });

  it("keeps an explicit Newest sort alongside ai", () => {
    const query = parseListingParams({ ai: "pool", sort: "newest" });
    expect(query.sort).toBe("newest");
    expect(buildListingQueryString(query)).toContain("sort=newest");
  });

  it("falls back to newest when relevance has nothing to rank by", () => {
    expect(parseListingParams({ sort: "relevance" }).sort).toBe("newest");
    expect(toBackendParams({ sort: "relevance" }).orderby).toBeUndefined();
  });

  it("sends semantic + relevance to the backend", () => {
    const params = toBackendParams(parseListingParams({ ai: "near subway" }));
    expect(params.orderby).toBe("relevance");
    expect(params.semantic).toBe("near subway");
  });

  it("survives a saved-search round trip", () => {
    const query = parseListingParams({ ai: "renovated kitchen", city: "Toronto" });
    const restored = fromBackendParams(toSavedFilters(query));
    expect(restored.semantic).toBe("renovated kitchen");
    expect(restored.sort).toBe("relevance");
  });
});

describe("applyLocalSearch", () => {
  it("turns a plain sentence into filters when the model falls back", () => {
    const result = applyLocalSearch("i want a big 3 bedroom condo", {
      filters: { keywords: "i want a big 3 bedroom condo" },
      unsupported: [],
      fallback: true,
      cached: false,
    });
    expect(result.fallback).toBe(false);
    expect(result.filters).toMatchObject({
      property_type: "Condo",
      beds_min: 3,
      semantic_text: "large",
      keywords: null,
    });
  });
});
