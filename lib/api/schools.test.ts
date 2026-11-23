import { describe, expect, it } from "vitest";
import {
  extractSchoolQuery,
  homesNearSchoolHref,
  schoolSearchArea,
  schoolSearchHistoryCities,
} from "@/lib/api/schools";

describe("schoolSearchArea", () => {
  it("returns a 4-point box around the school", () => {
    const ring = schoolSearchArea(43.56, -79.72, 2);
    expect(ring).toHaveLength(4);
    expect(ring[0].lat).toBeLessThan(43.56);
    expect(ring[2].lat).toBeGreaterThan(43.56);
  });
});

describe("homesNearSchoolHref", () => {
  it("includes poly and school label", () => {
    const href = homesNearSchoolHref(43.56, -79.72, { km: 2, name: "John Fraser Secondary School" });
    expect(href.startsWith("/map-search?")).toBe(true);
    expect(href).toContain("poly=");
    expect(href).toContain("school=John");
    expect(href).toContain("schoolKm=2");
  });
});

describe("extractSchoolQuery", () => {
  it("pulls a school name from a buyer prompt", () => {
    expect(
      extractSchoolQuery("3 bed near John Fraser Secondary School under $1.2M"),
    ).toBe("John Fraser Secondary School");
  });

  it("returns null when no school is named", () => {
    expect(extractSchoolQuery("condo near subway in Toronto")).toBeNull();
  });
});

describe("schoolSearchHistoryCities", () => {
  it("prefers last-search city and dedupes places history", () => {
    expect(schoolSearchHistoryCities(["Mississauga", "Oakville"], "Oakville")).toEqual([
      "Oakville",
      "Mississauga",
    ]);
  });

  it("returns empty when there is no search history (IP must not fill this)", () => {
    expect(schoolSearchHistoryCities([])).toEqual([]);
    expect(schoolSearchHistoryCities([], null)).toEqual([]);
  });
});
