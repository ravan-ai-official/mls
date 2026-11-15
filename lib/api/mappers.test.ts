import { describe, expect, it, vi } from "vitest";
import { mapAvmDetails } from "./valuation";
import {
  deriveCondoLevel,
  deriveDaysOnMarket,
  deriveLocker,
  deriveRentalItems,
  deriveRoomSignals,
  deriveUnitNumber,
  mapPropertyDetail,
  mapPropertySummary,
  parseCityAndCommunity,
  resolvePropertyType,
} from "./mappers";
import type { BackendPropertyDetail, BackendPropertySummary } from "@/lib/types/backend";

const row = (overrides: Partial<BackendPropertySummary>) =>
  ({
    listing_key: "k",
    list_price: null,
    lease_amount: null,
    standard_status: "Active",
    ...overrides,
  }) as unknown as BackendPropertySummary;

describe("mapPropertySummary rent", () => {
  it("reads the rent from total_actual_rent, where most DDF rentals keep it", () => {
    const summary = mapPropertySummary(row({ total_actual_rent: "1500.00" }));
    expect(summary.isLease).toBe(true);
    expect(summary.price).toBe(1500);
  });

  it("prefers lease_amount when both are set", () => {
    const summary = mapPropertySummary(row({ lease_amount: "2800.00", total_actual_rent: "1500.00" }));
    expect(summary.price).toBe(2800);
  });

  it("keeps a sale listing as a sale", () => {
    const summary = mapPropertySummary(row({ list_price: "899000" }));
    expect(summary.isLease).toBe(false);
    expect(summary.price).toBe(899000);
  });
});

describe("mapAvmDetails", () => {
  it("maps snake_case, keeps false booleans, nulls blanks", () => {
    const details = mapAvmDetails({
      roll_number: "316030180",
      community: "Lakeshore",
      unit_number: "17",
      locker: true,
      potl_monthly_fees: null,
      maintenance: "170.00",
      maintenance_includes: "Water, Insurance",
      list_price: 935000,
      last_sold_price: 880000,
      days_on_market: 21,
      above_grade_sqft: 1850,
      garage_spaces: 2,
      family_room: false,
      kitchens: 1,
      frontage_ft: "38.93",
      air_conditioning: false,
      pool: null,
      basement: "  ",
      basement_total_sqft: 747,
      basement_finished_sqft: 280,
      structure_condition: "Average",
      garage_type: "Attached Garage",
      garage_area: 480,
      renovation_year: 2015,
      renovation_type: "Exterior",
      year_built: 1995,
    });
    expect(details.rollNumber).toBe("316030180");
    expect(details.community).toBe("Lakeshore");
    expect(details.unitNumber).toBe("17");
    expect(details.locker).toBe(true);
    expect(details.potlMonthlyFees).toBeNull();
    expect(details.maintenance).toBe(170);
    expect(details.maintenanceIncludes).toBe("Water, Insurance");
    expect(details.listPrice).toBe(935000);
    expect(details.lastSoldPrice).toBe(880000);
    expect(details.daysOnMarket).toBe(21);
    expect(details.aboveGradeSqft).toBe(1850);
    expect(details.garageSpaces).toBe(2);
    expect(details.familyRoom).toBe(false);
    expect(details.kitchens).toBe(1);
    expect(details.frontageFt).toBe(38.93);
    expect(details.airConditioning).toBe(false);
    expect(details.pool).toBeNull();
    expect(details.basement).toBeNull();
    expect(details.basementTotalSqft).toBe(747);
    expect(details.basementFinishedSqft).toBe(280);
    expect(details.structureCondition).toBe("Average");
    expect(details.garageType).toBe("Attached Garage");
    expect(details.garageArea).toBe(480);
    expect(details.renovationYear).toBe(2015);
    expect(details.renovationType).toBe("Exterior");
    expect(details.yearBuilt).toBe(1995);
  });

  it("returns an all-null column for a missing payload", () => {
    expect(Object.values(mapAvmDetails(undefined)).every((value) => value === null)).toBe(true);
  });
});

describe("resolvePropertyType", () => {
  it("uses structure type over the generic Single Family sub-type", () => {
    expect(resolvePropertyType("Single Family", "Apartment", true).uiType).toBe("Condo");
    expect(resolvePropertyType("Single Family", "Row / Townhouse", true).uiType).toBe("Townhome");
    expect(resolvePropertyType("Single Family", "House", false).uiType).toBe("Detached");
    expect(resolvePropertyType("Single Family", "House", true).uiType).toBe("Semi-Detached");
  });

  it("falls back to the sub-type when structure is missing", () => {
    expect(resolvePropertyType("Condo Apartment", null, null).uiType).toBe("Condo");
  });
});

describe("listing key-fact helpers", () => {
  it("derives kitchens and family room from room rows", () => {
    expect(
      deriveRoomSignals([
        { room_type: "Kitchen", room_level: "Main", room_length: null, room_width: null, room_dimensions: null },
        { room_type: "Family Room", room_level: "Main", room_length: null, room_width: null, room_dimensions: null },
        { room_type: "Kitchen", room_level: "Basement", room_length: null, room_width: null, room_dimensions: null },
      ]),
    ).toEqual({ kitchens: 2, familyRoom: true });
    expect(
      deriveRoomSignals([
        { room_type: "Kitchen", room_level: "Main", room_length: null, room_width: null, room_dimensions: null },
      ]),
    ).toEqual({ kitchens: 1, familyRoom: false });
    expect(deriveRoomSignals([])).toEqual({ kitchens: null, familyRoom: null });
  });

  it("derives condo level and skips house-style room levels", () => {
    expect(
      deriveCondoLevel([
        { room_type: "Kitchen", room_level: "Main", room_length: null, room_width: null, room_dimensions: null },
        { room_type: "Bedroom", room_level: "12", room_length: null, room_width: null, room_dimensions: null },
      ]),
    ).toBe("12");
    expect(
      deriveCondoLevel([
        { room_type: "Kitchen", room_level: "Main", room_length: null, room_width: null, room_dimensions: null },
      ]),
    ).toBeNull();
  });

  it("detects locker from building/parking text", () => {
    expect(deriveLocker("Balcony, Locker", null)).toBe(true);
    expect(deriveLocker("Storage - Locker, Party Room", null)).toBe(true);
    expect(deriveLocker("Balcony", "Underground")).toBe(false);
    expect(deriveLocker("No locker", null)).toBe(false);
    expect(deriveLocker("Without locker", "Underground")).toBe(false);
    expect(deriveLocker(null, null)).toBeNull();
  });

  it("splits City (Community) for municipality / community Key Facts", () => {
    expect(parseCityAndCommunity("Toronto (Casa Loma)", null, null)).toEqual({
      municipality: "Toronto",
      community: "Casa Loma",
    });
    expect(parseCityAndCommunity("Toronto (Lambton Baby Point)", "Lambton Baby Point", null)).toEqual({
      municipality: "Toronto",
      community: "Lambton Baby Point",
    });
    expect(parseCityAndCommunity("Ingersoll", null, "Ingersoll - South")).toEqual({
      municipality: "Ingersoll",
      community: "Ingersoll - South",
    });
    expect(parseCityAndCommunity("Burlington", null, null)).toEqual({
      municipality: "Burlington",
      community: null,
    });
  });

  it("derives unit number from address when the column is empty", () => {
    expect(deriveUnitNumber("1217", "700 Dynes")).toBe("1217");
    expect(deriveUnitNumber(null, "507 - 2450 BLOOR STREET W")).toBe("507");
    expect(deriveUnitNumber("", "700 DYNES Road Unit# 1217")).toBe("1217");
    expect(deriveUnitNumber(null, "11 ELLINGTON DRIVE")).toBeNull();
  });

  it("counts days on market from list entry to close or now", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T12:00:00Z"));
    expect(deriveDaysOnMarket("2026-10-07T00:00:00Z", null)).toBe(21);
    expect(deriveDaysOnMarket("2026-10-01T00:00:00Z", "2026-10-11T00:00:00Z")).toBe(10);
    expect(deriveDaysOnMarket(null, null)).toBeNull();
    vi.useRealTimers();
  });

  it("prefers OtherEquipment for rental items under contract", () => {
    expect(deriveRentalItems("Hot Water Tank", "Fridge, Stove")).toBe("Hot Water Tank");
    expect(deriveRentalItems(null, "Fridge, Stove")).toBeNull();
    expect(deriveRentalItems(null, "HWT rental")).toMatch(/hwt rental/i);
  });
});

describe("mapPropertyDetail listing fields", () => {
  it("surfaces Level, Unit #, Locker, taxes, fees, DOM, and rental items", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T12:00:00Z"));
    const detail = mapPropertyDetail({
      listing_key: "X123",
      listing_id: "W1234567",
      list_price: "750000",
      lease_amount: null,
      standard_status: "Active",
      property_sub_type: "Condo Apartment",
      structure_type: "Apartment",
      city: "Toronto (CityPlace)",
      city_region: "",
      unparsed_address: "100 Harbour St",
      unit_number: "1712",
      building_features: "Locker, Party Room",
      parking_features: null,
      appliances: "Fridge, Stove",
      tax_annual_amount: "3200.00",
      association_fee: "650.00",
      association_fee_frequency: "Monthly",
      association_fee_includes: "Heat, Water, Insurance",
      other_equipment: "Hot Water Tank",
      original_entry_timestamp: "2026-10-14T00:00:00Z",
      media: [],
      rooms: [
        {
          room_type: "Living",
          room_level: "17",
          room_length: null,
          room_width: null,
          room_dimensions: null,
        },
      ],
    } as unknown as BackendPropertyDetail);

    const facts = Object.fromEntries(
      detail.factGroups.flatMap((g) => g.facts.map((f) => [f.label, f.value])),
    );
    expect(detail.community).toBe("Toronto");
    expect(detail.neighbourhood).toBe("CityPlace");
    expect(facts["Municipality"]).toBe("Toronto");
    expect(facts["Community"]).toBe("CityPlace");
    expect(facts["Level"]).toBe("17");
    expect(facts["Unit #"]).toBe("1712");
    expect(facts["Locker"]).toBe("Yes");
    expect(facts["Property taxes"]).toBe("$3,200");
    expect(facts["Maintenance"]).toMatch(/\$650/);
    expect(facts["Included in maintenance costs"]).toMatch(/Heat/i);
    expect(facts["Days on market"]).toBe("14 days");
    expect(facts["Rental items under contract"]).toBe("Hot Water Tank");
    expect(detail.features).toEqual(expect.arrayContaining(["Locker", "Party Room", "Fridge", "Stove"]));
    expect(detail.propertySubType).toBe("Condo Apartment");

    for (const label of [
      "Municipality",
      "Community",
      "Address",
      "Level",
      "Unit #",
      "Locker",
      "POTL monthly fees",
      "Maintenance",
      "Included in maintenance costs",
      "Property type",
      "Style",
      "Lot frontage",
      "Lot depth",
      "List price",
      "Last sold price",
      "Property taxes",
      "Days on market",
      "Square feet above ground",
      "Garage parking spaces",
      "Total parking spaces",
      "Year built",
      "Number of bedrooms",
      "Number of washrooms",
      "Family room",
      "Basement (finished/unfinished)",
      "Number of kitchens",
      "Rental items under contract",
    ]) {
      expect(facts).toHaveProperty(label);
    }
    vi.useRealTimers();
  });
});
