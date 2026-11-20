import { describe, expect, it } from "vitest";
import { parseListingSearch } from "@/lib/utils/searchParams";
import {
  defaultSearchName,
  fromBackendParams,
  searchIdentity,
  toAlertCadence,
  toSavedFilters,
} from "./savedSearches";

describe("saved search filters codec", () => {
  it("stores backend params, not UI params", () => {
    const query = parseListingSearch("q=King&city=Vaughan&priceMax=900000&beds=2&postal=L7A,l6p2k1&openHouse=1&sort=price-asc&page=3");
    const filters = toSavedFilters(query);
    expect(filters).toMatchObject({
      search: "King",
      city: "Vaughan",
      price_max: "900000",
      beds_min: "2",
      postal_code: "L7A,L6P2K1",
      has_open_house: "1",
      allow_fallback: "false",
      orderby: "list_price",
    });
    expect(filters).not.toHaveProperty("limit");
    expect(filters).not.toHaveProperty("offset");
  });

  it("keeps text search and city filters strict so empty matches stay empty", () => {
    expect(toSavedFilters(parseListingSearch("q=brampton&status=Active"))).toMatchObject({
      search: "brampton",
      status_group: "active",
      allow_fallback: "false",
    });
    expect(toSavedFilters(parseListingSearch("city=Brampton&status=Active"))).toMatchObject({
      city: "Brampton",
      status_group: "active",
      allow_fallback: "false",
    });
  });

  it("sends status tabs as a strict status_group", () => {
    expect(toSavedFilters(parseListingSearch("status=Sold"))).toMatchObject({
      status_group: "sold",
      allow_fallback: "false",
    });
    const active = toSavedFilters(parseListingSearch("status=Active"));
    expect(active).toMatchObject({ status_group: "active" });
    expect(active).not.toHaveProperty("status");
    expect(active).not.toHaveProperty("allow_fallback");
    // A raw feed word is still an exact status filter.
    expect(toSavedFilters(parseListingSearch("status=Terminated"))).toMatchObject({
      status: "Terminated",
    });
  });

  it("restores searches saved before status_group existed", () => {
    expect(fromBackendParams({ status: "Active" }).status).toBe("Active");
  });

  it("splits Buy and Rent via transaction_type", () => {
    expect(toSavedFilters(parseListingSearch("city=Toronto"))).toMatchObject({
      transaction_type: "sale",
    });
    const rent = toSavedFilters(parseListingSearch("tx=rent&priceMax=3000"));
    expect(rent).toMatchObject({ transaction_type: "rent", price_max: "3000" });
    // Rent is server-side now, not a client-matched UI type.
    expect(rent).not.toHaveProperty("ui_type");
  });

  it("reads the legacy type=Rental spelling as Rent", () => {
    const query = parseListingSearch("type=Rental&city=Toronto");
    expect(query.transaction).toBe("rent");
    expect(query.type).toBeUndefined();
    expect(searchIdentity(query)).toBe(searchIdentity(parseListingSearch("tx=rent&city=Toronto")));
    // A search saved when Rent was a UI type restores as Rent.
    const restored = fromBackendParams({ ui_type: "Rental", city: "Toronto" });
    expect(restored.transaction).toBe("rent");
    expect(restored.type).toBeUndefined();
  });

  it("keeps a property type alongside Rent", () => {
    const query = parseListingSearch("tx=rent&type=Condo");
    expect(query).toMatchObject({ transaction: "rent", type: "Condo" });
    expect(searchIdentity(fromBackendParams(toSavedFilters(query)))).toBe(searchIdentity(query));
  });

  it("round-trips a /listings URL through filters_json", () => {
    const urls = [
      "city=Vaughan&type=Condo&priceMax=900000",
      "postal=L7A,L6P2K1&openHouse=1&beds=3&baths=2",
      "q=King&status=Sold&priceMin=500000&sqftMin=1200&sort=price-desc",
      "tx=rent&city=Toronto&priceMax=3000&beds=2",
      "poly=43.65,-79.38;43.7,-79.4;43.68,-79.35&type=Townhome",
      "",
    ];
    for (const url of urls) {
      const query = parseListingSearch(url);
      const restored = fromBackendParams(toSavedFilters(query));
      expect(searchIdentity(restored)).toBe(searchIdentity(query));
    }
  });

  it("ignores paging and view when comparing", () => {
    expect(searchIdentity(parseListingSearch("city=Toronto&page=4&view=list"))).toBe(
      searchIdentity(parseListingSearch("city=Toronto")),
    );
  });

  it("survives backend stringification", () => {
    const restored = fromBackendParams({ price_min: "100", has_open_house: "true", bogus: "x" });
    expect(restored.priceMin).toBe(100);
    expect(restored.openHouse).toBe(true);
  });
});

describe("defaultSearchName", () => {
  it("describes the criteria", () => {
    expect(defaultSearchName(parseListingSearch("type=Condo&city=Vaughan&priceMax=900000"))).toBe(
      "Condos in Vaughan under $900K",
    );
    expect(defaultSearchName(parseListingSearch("postal=L7A"))).toBe("Homes in L7A");
    expect(defaultSearchName(parseListingSearch(""))).toBe("Homes");
  });
});

describe("toAlertCadence", () => {
  it("passes through the cadences the UI offers", () => {
    expect(toAlertCadence("daily")).toBe("daily");
    expect(toAlertCadence("weekly")).toBe("weekly");
    expect(toAlertCadence("off")).toBe("off");
  });

  it("shows instant as daily, because the backend runs it daily", () => {
    expect(toAlertCadence("instant")).toBe("daily");
  });

  it("treats missing or unknown values as off", () => {
    expect(toAlertCadence(undefined)).toBe("off");
    expect(toAlertCadence("hourly")).toBe("off");
  });
});
