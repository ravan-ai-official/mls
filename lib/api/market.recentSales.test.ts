import { describe, expect, it } from "vitest";
import {
  filterRecentSalesClient,
  normalizeRecentSalesPropertyType,
  type RecentSale,
} from "./market";

function sale(partial: Partial<RecentSale>): RecentSale {
  return {
    listingKey: "L1",
    address: "1 Main St",
    city: "Toronto",
    propertyType: "Detached",
    beds: 3,
    baths: 2,
    garageSpaces: 2,
    lotFrontage: 40,
    closePrice: 1_000_000,
    listPrice: 950_000,
    closeDate: "2026-11-01",
    daysOnMarket: 20,
    overUnderAskingPct: 5.3,
    ...partial,
  };
}

describe("normalizeRecentSalesPropertyType", () => {
  it("maps sell-page labels to backend aliases", () => {
    expect(normalizeRecentSalesPropertyType("Detached")).toBe("detached");
    expect(normalizeRecentSalesPropertyType("Semi-Detached")).toBe("semi-detached");
    expect(normalizeRecentSalesPropertyType("Townhome")).toBe("townhome");
    expect(normalizeRecentSalesPropertyType("Condo")).toBe("condo");
    expect(normalizeRecentSalesPropertyType("Luxury")).toBe("luxury");
    expect(normalizeRecentSalesPropertyType("")).toBeUndefined();
    expect(normalizeRecentSalesPropertyType("Castle")).toBeUndefined();
  });
});

describe("filterRecentSalesClient", () => {
  const rows = [
    sale({ listingKey: "D", propertyType: "Detached", beds: 4, baths: 3, garageSpaces: 2, lotFrontage: 45 }),
    sale({ listingKey: "S", propertyType: "Semi-Detached", beds: 3, baths: 2, garageSpaces: 1, lotFrontage: 30 }),
    sale({
      listingKey: "C",
      propertyType: "Condo Apartment",
      beds: 2,
      baths: 1,
      closePrice: 700_000,
      garageSpaces: 0,
      lotFrontage: null,
    }),
    sale({
      listingKey: "X",
      propertyType: "Detached",
      beds: 5,
      baths: 4,
      closePrice: 2_000_000,
      garageSpaces: 3,
      lotFrontage: 50,
    }),
  ];

  it("filters by type, beds, baths, garage and lot width", () => {
    expect(filterRecentSalesClient(rows, { propertyType: "detached" }).map((r) => r.listingKey)).toEqual([
      "D",
      "X",
    ]);
    expect(filterRecentSalesClient(rows, { propertyType: "condo" }).map((r) => r.listingKey)).toEqual([
      "C",
    ]);
    expect(filterRecentSalesClient(rows, { bedsMin: 4 }).map((r) => r.listingKey)).toEqual(["D", "X"]);
    expect(
      filterRecentSalesClient(rows, { propertyType: "detached", bathsMin: 4 }).map((r) => r.listingKey),
    ).toEqual(["X"]);
    expect(filterRecentSalesClient(rows, { propertyType: "luxury" }).map((r) => r.listingKey)).toEqual([
      "X",
    ]);
    expect(filterRecentSalesClient(rows, { garagesMin: 2 }).map((r) => r.listingKey)).toEqual([
      "D",
      "X",
    ]);
    expect(filterRecentSalesClient(rows, { garagesMax: 0 }).map((r) => r.listingKey)).toEqual(["C"]);
    expect(filterRecentSalesClient(rows, { lotWidthMin: 45 }).map((r) => r.listingKey)).toEqual([
      "D",
      "X",
    ]);
  });
});
