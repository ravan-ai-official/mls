import { describe, expect, it } from "vitest";
import {
  buildPreconDealsHref,
  toPreconDealsApiParams,
  toPreconDealsParams,
} from "@/lib/api/preconstruction";

describe("precon deals params", () => {
  it("catalog View all keeps featured ordering without inventing cities", () => {
    expect(toPreconDealsParams({}, { pageSize: 8 })).toEqual({
      ordering: "featured",
      exclude_stage: "sold_out",
      page_size: 8,
      page: undefined,
      beds_min: undefined,
      baths_min: undefined,
      price_min: undefined,
      price_max: undefined,
    });
  });

  it("deals API sends limit+fill and history filters only", () => {
    expect(toPreconDealsApiParams({}, { limit: 8 })).toEqual({
      limit: 8,
      fill: true,
      beds_min: undefined,
      baths_min: undefined,
      price_min: undefined,
      price_max: undefined,
    });
    expect(
      toPreconDealsApiParams(
        { cities: ["Oakville"], bedsMin: 2 },
        { limit: 8, fill: true },
      ),
    ).toMatchObject({
      limit: 8,
      fill: true,
      city: "Oakville",
      beds_min: 2,
    });
  });

  it("uses city= for one city and cities= CSV for several", () => {
    expect(toPreconDealsParams({ cities: ["Oakville"] }).city).toBe("Oakville");
    expect(toPreconDealsParams({ cities: ["Oakville"] }).cities).toBeUndefined();
    expect(
      toPreconDealsParams({
        cities: ["Oakville", "Mississauga"],
        bedsMin: 2,
        priceMin: 500_000,
        priceMax: 900_000,
      }),
    ).toMatchObject({
      cities: "Oakville,Mississauga",
      beds_min: 2,
      price_min: 500_000,
      price_max: 900_000,
    });
  });

  it("builds View all href with the same filters", () => {
    expect(buildPreconDealsHref({})).toBe(
      "/preconstruction?ordering=featured&exclude_stage=sold_out",
    );
    expect(buildPreconDealsHref({ cities: ["Brampton"], bedsMin: 3 })).toBe(
      "/preconstruction?ordering=featured&exclude_stage=sold_out&city=Brampton&beds_min=3",
    );
  });
});
