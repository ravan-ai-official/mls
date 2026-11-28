import { describe, expect, it, vi } from "vitest";
import { mapAvmDetails } from "./valuation";
import {
  deriveCondoLevel,
  deriveDaysOnMarket,
  deriveLocker,
  deriveRentalItems,
  deriveRoomSignals,
  deriveUnitNumber,
  collectFeatures,
  collectInclusions,
  deriveWashrooms,
  deriveYearBuiltFromRemarks,
  formatRoomDimensions,
  mapPropertyDetail,
  mapWashroomInfo,
  mapWashrooms,
  mapPropertySummary,
  normalizeStatus,
  parseCityAndCommunity,
  resolvePropertyType,
  resolveSqft,
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

describe("mapPropertySummary Featured badge", () => {
  it("uses API badge Featured", () => {
    const summary = mapPropertySummary(row({ list_price: "899000", badge: "Featured" }));
    expect(summary.isFeatured).toBe(true);
    expect(summary.badge).toEqual({ label: "Featured", tone: "featured" });
  });

  it("uses is_featured when badge is absent", () => {
    const summary = mapPropertySummary(row({ list_price: "899000", is_featured: true }));
    expect(summary.isFeatured).toBe(true);
    expect(summary.badge).toEqual({ label: "Featured", tone: "featured" });
  });

  it("prefers Featured over New when is_featured", () => {
    const summary = mapPropertySummary(
      row({
        list_price: "899000",
        is_featured: true,
        original_entry_timestamp: new Date().toISOString(),
      }),
    );
    expect(summary.badge?.tone).toBe("featured");
  });

  it("does not invent Featured without API signals", () => {
    const summary = mapPropertySummary(row({ list_price: "899000" }));
    expect(summary.isFeatured).toBe(false);
    expect(summary.badge?.tone === "featured").toBe(false);
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

describe("resolveSqft", () => {
  it("uses the DDF living-area band when exact sqft is missing", () => {
    expect(
      resolveSqft({ living_area_minimum: "800", living_area_maximum: "899" }),
    ).toEqual({ sqft: 800, sqftLabel: "800–899 sq ft" });
  });

  it("reads sqft from public remarks as a last resort", () => {
    expect(
      resolveSqft({ public_remarks: "One Bedroom + 1 Locker, 560 Sqft Condo With Balcony" }),
    ).toEqual({ sqft: 560, sqftLabel: "560 sq ft" });
  });
});

describe("normalizeStatus", () => {
  it("treats terminated and expired as off-market", () => {
    expect(normalizeStatus("Terminated")).toBe("other");
    expect(normalizeStatus("Expired")).toBe("other");
    expect(normalizeStatus("Active")).toBe("active");
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
    expect(facts["Property tax/year"]).toBe("$3,200");
    expect(facts["Maintenance"]).toMatch(/\$650/);
    expect(facts["Included in maintenance cost"]).toMatch(/Heat/i);
    expect(facts["CDOM"]).toBe("14 days");
    expect(facts["Under contract"]).toBe("Hot Water Tank");
    expect(detail.rentalItems).toBe("Hot Water Tank");
    // Features come from features[] / interior_features — not building/appliances.
    expect(detail.features).toEqual([]);
    expect(detail.inclusionsList).toEqual(expect.arrayContaining(["Fridge", "Stove"]));
    expect(detail.propertySubType).toBe("Condo Apartment");
    // Missing MLS fields currently render as "-" (temporary).
    expect(facts["POTL monthly fee"]).toBe("-");
    expect(facts["Lot depth"]).toBe("-");
    expect(facts["Listing brokerage"]).toBe("-");
    vi.useRealTimers();
  });

  it("derives year built from '4-year-new' remarks when YearBuilt is blank", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T12:00:00Z"));
    expect(deriveYearBuiltFromRemarks("stunning 4-year-new executive home")).toBe(2022);
    const detail = mapPropertyDetail({
      listing_key: "R1",
      listing_id: "40872102",
      list_price: null,
      total_actual_rent: "3099",
      standard_status: "Active",
      property_sub_type: "Single Family",
      structure_type: "House",
      city: "Caledonia",
      unparsed_address: "35 SANTOS Drive",
      public_remarks: "stunning 4-year-new executive detached home",
      media: [],
      rooms: [],
    } as unknown as BackendPropertyDetail);
    const facts = Object.fromEntries(
      detail.factGroups.flatMap((g) => g.facts.map((f) => [f.label, f.value])),
    );
    expect(facts["Year built"]).toBe("2022");
    expect(facts["Approx. age"]).toBe("4 years");
    expect(facts["Unit #"]).toBe("-");
    expect(facts["Maintenance"]).toBe("-");
    vi.useRealTimers();
  });

  it("formats room dimensions in metres (never invents feet/inches)", () => {
    expect(
      formatRoomDimensions({
        room_type: "Living",
        room_level: "Main",
        room_length: "5.40",
        room_width: "5.10",
        room_dimensions: null,
        dimensions_m: "5.4 × 5.1 m",
        dimensions_ft: `17'9" × 16'9"`,
      }),
    ).toBe("5.4 × 5.1 m");
    expect(
      formatRoomDimensions({
        room_type: "Dining",
        room_level: "Main",
        room_length: "5.4",
        room_width: "5.1",
        room_dimensions: null,
        room_length_width_units: "Meters",
      }),
    ).toBe("5.4 × 5.1 m");
    expect(
      formatRoomDimensions({
        room_type: "Bedroom",
        room_level: "2nd",
        room_length: "4.2",
        room_width: "3.5",
        room_dimensions: null,
      }),
    ).toBe("4.2 × 3.5 m");
  });

  it("maps Key Facts aliases for brokerage, garage, style, exterior, size", () => {
    const detail = mapPropertyDetail({
      listing_key: "30292595",
      listing_id: "X13796598",
      list_price: "1899000",
      lease_amount: null,
      standard_status: "Active",
      property_sub_type: "Detached",
      structure_type: "House",
      city: "Mississauga",
      unparsed_address: "123 Sample Rd",
      listing_brokerage: "Royal LePage Sample",
      garage_spaces: 2,
      garage_type: "Attached",
      style: "2-Storey",
      exterior: "Brick",
      original_list_price: "1999000",
      living_area_range: "2500-3000",
      square_feet_above_ground: 2750,
      media: [],
      rooms: [
        {
          room_type: "Living",
          room_level: "Main",
          room_length: "5.40",
          room_width: "5.10",
          room_dimensions: null,
          room_length_width_units: "Meters",
          dimensions_m: "5.4 × 5.1 m",
          dimensions_display: "5.4 × 5.1 m",
          dimensions_ft: `17'9" × 16'9"`,
        },
      ],
    } as unknown as BackendPropertyDetail);
    const facts = Object.fromEntries(
      detail.factGroups.flatMap((g) => g.facts.map((f) => [f.label, f.value])),
    );
    expect(facts["Listing brokerage"]).toBe("Royal LePage Sample");
    expect(facts["Garage parking spaces"]).toBe("2");
    expect(facts["Garage type"]).toBe("Attached");
    expect(facts["Style"]).toBe("2-Storey");
    expect(facts["Exterior"]).toBe("Brick");
    expect(facts["Original list price"]).toBe("$1,999,000");
    expect(facts["Size"]).toBe("2500-3000 sq ft");
    expect(facts["Square feet above ground"]).toBe("2,750 sq ft");
    expect(detail.rooms[0]?.dimensionsM).toBe("5.4 × 5.1 m");
    expect(detail.rooms[0]?.dimensionsFt).toBe(`17'9" × 16'9"`);
    expect(detail.rooms[0]?.dimensionsDisplay).toBe("5.4 × 5.1 m");
  });

  it("maps washroom_info count/pieces/level and washrooms[] room rows", () => {
    expect(
      mapWashroomInfo([
        { count: 1, pieces: 2, level: "Main" },
        { count: 2, pieces: "4", level: "2nd" },
      ]),
    ).toEqual([
      { count: 1, pieces: "2", level: "Main" },
      { count: 2, pieces: "4", level: "2nd" },
    ]);
    const fromApi = mapWashrooms(
      [
        {
          room_type: "Bathroom",
          room_level: "Main",
          room_description: "2 Pc",
          dimensions_m: "1.5 × 1.2 m",
          dimensions_ft: `4'11" × 3'11"`,
        },
        {
          room_type: "Bathroom",
          room_level: "2nd",
          room_description: "4 Pc",
          dimensions_m: "2.4 × 1.8 m",
          dimensions_ft: null,
        },
      ],
      [],
    );
    expect(fromApi).toHaveLength(2);
    expect(fromApi[0]).toMatchObject({
      type: "Bathroom",
      level: "Main",
      description: "2 Pc",
      dimensionsM: "1.5 × 1.2 m",
      dimensionsFt: `4'11" × 3'11"`,
    });
    expect(mapWashrooms(null, null)).toEqual([]);
    expect(mapWashrooms([], [])).toEqual([]);
  });

  it("falls back to bath/washroom room rows when washrooms[] is empty", () => {
    expect(
      deriveWashrooms([
        {
          room_type: "Bathroom",
          room_level: "Main",
          room_length: null,
          room_width: null,
          room_dimensions: null,
          room_description: "2 Pc",
        },
        {
          room_type: "5 Pc Bath",
          room_level: "2nd",
          room_length: null,
          room_width: null,
          room_dimensions: null,
        },
        {
          room_type: "Bedroom",
          room_level: "2nd",
          room_length: null,
          room_width: null,
          room_dimensions: null,
        },
      ]),
    ).toEqual([
      expect.objectContaining({ type: "Bathroom", level: "Main", description: "2 Pc" }),
      expect.objectContaining({ type: "5 Pc Bath", level: "2nd", description: "5 Pc" }),
    ]);
  });

  it("prefers features[] and inclusions_list over mixed RESO columns", () => {
    const raw = {
      listing_key: "F1",
      listing_id: "X1",
      list_price: "1",
      lease_amount: null,
      standard_status: "Active",
      property_sub_type: "Detached",
      city: "Toronto",
      unparsed_address: "1 Main",
      features: ["Family Room", "Fireplace/Stove"],
      interior_features: "Should Not Win",
      interior_features_list: ["Should Not Win Either"],
      building_features: "Locker",
      appliances: "Fridge, Stove",
      inclusions_list: ["Washer", "Dryer"],
      inclusions: "Washer, Refrigerator, Water softener.",
      media: [],
      rooms: [],
      bathrooms_total_integer: 3,
      bathrooms_partial: 1,
      bathrooms_full: 2,
      washroom_info: [{ count: 1, pieces: 2, level: "Main" }],
    } as unknown as BackendPropertyDetail;
    expect(collectFeatures(raw)).toEqual(["Family Room", "Fireplace/Stove"]);
    expect(collectInclusions(raw)).toEqual(["Washer", "Dryer"]);
    const detail = mapPropertyDetail(raw);
    expect(detail.features).toEqual(["Family Room", "Fireplace/Stove"]);
    expect(detail.inclusionsList).toEqual(["Washer", "Dryer"]);
    expect(detail.inclusionsText).toBe("Washer, Refrigerator, Water softener.");
    expect(detail.washroomInfo).toEqual([{ count: 1, pieces: "2", level: "Main" }]);
    expect(detail.washrooms).toEqual([]);
    expect(detail.bathroomsTotal).toBe(3);
    expect(detail.bathroomsPartial).toBe(1);
    expect(detail.bathroomsFull).toBe(2);
  });

  it("falls back features to interior_features_list then interior_features", () => {
    expect(
      collectFeatures({
        interior_features_list: ["Open Concept", "Pot Lights"],
        interior_features: "Ignore",
        appliances: "Fridge",
      } as unknown as BackendPropertyDetail),
    ).toEqual(["Open Concept", "Pot Lights"]);
    expect(
      collectFeatures({
        interior_features: "Open Concept, Pot Lights",
        appliances: "Fridge, Stove",
      } as unknown as BackendPropertyDetail),
    ).toEqual(["Open Concept", "Pot Lights"]);
    expect(
      collectInclusions({
        appliances: "Fridge, Stove",
      } as unknown as BackendPropertyDetail),
    ).toEqual(["Fridge", "Stove"]);
  });

  it("binds REALM-style Key Facts aliases for X13796598-like payload", () => {
    const detail = mapPropertyDetail({
      listing_key: "30292595",
      listing_id: "X13796598",
      list_price: "930000",
      lease_amount: null,
      standard_status: "Active",
      property_sub_type: "Detached",
      structure_type: "House",
      city: "Brant",
      city_region: "Paris",
      unparsed_address: "15 Moriarity Drive",
      style: "2-Storey",
      exterior: "Stucco, Vinyl siding",
      fronting_on: "North",
      living_area_range: "3000-3500",
      square_feet_above_ground: 3000,
      garage_yn: true,
      garage_type: "Attached",
      garage_spaces: 2,
      parking_drive_spaces: 2,
      parking_total: 4,
      family_room: true,
      fireplace_yn: true,
      link: false,
      laundry_level: "Main",
      locker: false,
      rooms_count: 10,
      kitchens: 1,
      listing_brokerage: "Royal LePage",
      original_list_price: "949000",
      lot_size_dimensions: "40 x 98.5 FT",
      frontage_length_numeric: "40.00",
      cross_street: "Rest Acres Rd",
      possession: "Immediate",
      tax_legal_description: "PLAN 123 LOT 4",
      parcel_number: "12345-6789",
      features: ["Family Room", "Fireplace/Stove"],
      inclusions: "Washer, Refrigerator, Dishwasher, Stove, Dryer.",
      media: [],
      rooms: [
        {
          room_type: "Living room",
          room_level: "Main level",
          room_length: "5.40",
          room_width: "5.10",
          room_dimensions: null,
          room_description: "Laminate",
          dimensions_m: "5.4 × 5.1 m",
          dimensions_ft: `17'9" × 16'9"`,
        },
      ],
      washroom_info: [
        { count: 1, pieces: 2, level: "Main" },
        { count: 3, pieces: 4, level: "2nd" },
      ],
    } as unknown as BackendPropertyDetail);
    const facts = Object.fromEntries(
      detail.factGroups.flatMap((g) => g.facts.map((f) => [f.label, f.value])),
    );
    expect(facts["Style"]).toBe("2-Storey");
    expect(facts["Exterior"]).toBe("Stucco, Vinyl siding");
    expect(facts["Fronting on"]).toBe("North");
    expect(facts["Size"]).toBe("3000-3500 sq ft");
    expect(facts["Garage"]).toBe("Yes");
    expect(facts["Garage type"]).toBe("Attached");
    expect(facts["Garage parking spaces"]).toBe("2");
    expect(facts["Parking drive spaces"]).toBe("2");
    expect(facts["Total parking spaces"]).toBe("4");
    expect(facts["Family room"]).toBe("Yes");
    expect(facts["Fireplace"]).toBe("Yes");
    expect(facts["Link"]).toBe("No");
    expect(facts["Laundry level"]).toBe("Main");
    expect(facts["Locker"]).toBe("No");
    expect(facts["Rooms"]).toBe("10");
    expect(facts["Number of kitchens"]).toBe("1");
    expect(facts["Listing brokerage"]).toBe("Royal LePage");
    expect(facts["Original list price"]).toBe("$949,000");
    expect(facts["Lot"]).toBe("40 x 98.5 FT");
    expect(facts["Cross street"]).toBe("Rest Acres Rd");
    expect(facts["Possession"]).toBe("Immediate");
    expect(facts["Legal description"]).toBe("PLAN 123 LOT 4");
    expect(facts["PIN"]).toBe("12345-6789");
    expect(detail.features).toEqual(["Family Room", "Fireplace/Stove"]);
    expect(detail.inclusionsText).toMatch(/Washer/);
    expect(detail.rooms[0]?.notes).toBe("Laminate");
    expect(detail.rooms[0]?.dimensionsM).toBe("5.4 × 5.1 m");
    expect(detail.washroomInfo).toHaveLength(2);
  });

  it("derives living_area_range from min/max when alias is blank", () => {
    const detail = mapPropertyDetail({
      listing_key: "30292595",
      listing_id: "X13796598",
      list_price: "930000",
      lease_amount: null,
      standard_status: "Active",
      property_sub_type: "Detached",
      city: "Brant",
      unparsed_address: "15 Moriarity Drive",
      living_area_minimum: "3000.00",
      living_area_maximum: "3500.00",
      media: [],
      rooms: [],
    } as unknown as BackendPropertyDetail);
    const facts = Object.fromEntries(
      detail.factGroups.flatMap((g) => g.facts.map((f) => [f.label, f.value])),
    );
    expect(facts["Size"]).toBe("3000-3500 sq ft");
  });
});
