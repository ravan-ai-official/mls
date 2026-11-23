import { describe, expect, it } from "vitest";
import { toBackendParams } from "@/lib/api/properties";
import {
  CURATED_PAGES,
  DEFAULT_FIXED_PAGES,
  curatedGroups,
  getCuratedPage,
  mergeCuratedPages,
  parseCuratedDocument,
} from "./curatedPages";

describe("curated pages", () => {
  it("has unique, URL-safe slugs", () => {
    const slugs = CURATED_PAGES.map((page) => page.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("keyword pages search strictly, with phrases only", () => {
    const page = getCuratedPage("power-of-sale")!;
    const params = toBackendParams(page.query);
    expect(params.keywords).toContain("power of sale");
    expect(params.allow_fallback).toBe("false");
    // Single short tokens over-match free text ("POS" is inside "possession").
    for (const keyword of page.query.keywords!) expect(keyword.toLowerCase()).not.toBe("pos");
  });

  it("types filter server-side", () => {
    expect(toBackendParams(getCuratedPage("condos-under-500k")!.query)).toMatchObject({ home_type: "condo", price_max: 500000 });
    expect(toBackendParams(getCuratedPage("luxury-homes")!.query).price_min).toBe(2_000_000);
  });

  it("groups exclude city pages unless asked", () => {
    expect(curatedGroups().some((g) => g.group === "By city")).toBe(false);
    expect(curatedGroups({ includeCities: true }).some((g) => g.group === "By city")).toBe(true);
  });

  it("falls back to code defaults when Studio published empty pages", () => {
    const merged = mergeCuratedPages({ pages: [] });
    expect(merged.map((p) => p.slug)).toEqual(CURATED_PAGES.map((p) => p.slug));
  });

  it("uses Studio pages and skips disabled rows", () => {
    const merged = mergeCuratedPages({
      pages: [
        {
          slug: "custom-deal",
          label: "Custom deal",
          h1: "Custom deal homes",
          description: "Studio-defined search.",
          group: "Deals",
          enabled: true,
          query: { status: "Active", keywords: ["motivated seller"] },
        },
        {
          slug: "hidden",
          label: "Hidden",
          h1: "Hidden",
          description: "Off.",
          group: "Deals",
          enabled: false,
          query: { status: "Active" },
        },
      ],
    });
    expect(merged.some((p) => p.slug === "custom-deal")).toBe(true);
    expect(merged.some((p) => p.slug === "hidden")).toBe(false);
    expect(merged.some((p) => p.slug === "power-of-sale")).toBe(false);
    expect(merged.some((p) => p.group === "By city")).toBe(true);
  });

  it("parses keyword lists from the document", () => {
    const doc = parseCuratedDocument({
      pages: [
        {
          slug: "x",
          label: "X",
          h1: "X",
          description: "Y",
          group: "Deals",
          query: { keywords: ["  power of sale ", "", "bank sale"] },
        },
      ],
    });
    expect(doc.pages[0]?.query.keywords).toEqual(["power of sale", "bank sale"]);
    expect(DEFAULT_FIXED_PAGES.length).toBeGreaterThan(5);
  });

  it("parses pinned MLS® numbers and keeps order", () => {
    const doc = parseCuratedDocument({
      pages: [
        {
          slug: "staff-picks",
          label: "Staff picks",
          h1: "Staff picks",
          description: "Pinned homes.",
          group: "Deals",
          query: { status: "Active" },
          listingKeys: ["w1234567", "C7654321", "w1234567", ""],
        },
      ],
    });
    expect(doc.pages[0]?.listingKeys).toEqual(["W1234567", "C7654321"]);
  });

  it("parses the full listing filter set", () => {
    const doc = parseCuratedDocument({
      pages: [
        {
          slug: "full-filters",
          label: "Full filters",
          h1: "Full filters",
          description: "All criteria.",
          group: "By type",
          query: {
            status: "Active",
            transaction: "sale",
            type: "Condo",
            city: "Toronto",
            priceMin: 400000,
            priceMax: 800000,
            bedsMin: 2,
            bathsMin: 2,
            sqftMin: 700,
            sqftMax: 1200,
            yearBuiltMin: 2000,
            yearBuiltMax: 2020,
            garagesMin: 1,
            storiesMin: 1,
            storiesMax: 2,
            basement: "finished",
            feeMin: 200,
            feeMax: 800,
            listedSince: "2026-01-01",
            buildingType: "Apartment",
            ownership: "Condo/Strata",
            openHouse: true,
            postalCodes: ["l7a", "L6P 2K1"],
            keywords: ["waterfront"],
          },
        },
      ],
    });
    expect(doc.pages[0]?.query).toMatchObject({
      type: "Condo",
      city: "Toronto",
      bedsMin: 2,
      bathsMin: 2,
      sqftMin: 700,
      garagesMin: 1,
      basement: "finished",
      buildingType: "Apartment",
      ownership: "Condo/Strata",
      openHouse: true,
      postalCodes: ["L7A", "L6P2K1"],
      keywords: ["waterfront"],
    });
  });
});
