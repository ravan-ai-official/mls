import { describe, expect, it } from "vitest";
import {
  connectionIconFor,
  formatDay,
  dealHref,
  isOptimizableImage,
  mapCommunityImages,
  mapDeals,
  mapIncentives,
  mapInvestorPicks,
  mapMarketSnapshot,
  mapPartners,
  mapSoldBelow,
  safeUrl,
  snapshotStats,
} from "./homeMappers";

describe("mapInvestorPicks", () => {
  it("maps rows to camelCase and keeps the basis note", () => {
    const feed = mapInvestorPicks({
      results: [
        {
          listing_key: "X1",
          address: "1 Main St",
          city: "Toronto",
          bedrooms: 2,
          bathrooms: "2",
          list_price: "650000.00",
          image_url: "https://ddfcdn.realtor.ca/a.jpg",
          estimated_monthly_rent: 2900,
          gross_yield_pct: 5.35,
          cap_rate_pct: 3.1,
          comps_used: 7,
        },
        { listing_key: "", list_price: 1 },
        { listing_key: "X2", list_price: null },
      ],
      calc_basis: { note: "Estimates from asking rents; excludes financing." },
      generated_at: "2026-09-24T10:00:00Z",
      pinned_count: 1,
    });
    expect(feed.picks).toHaveLength(1);
    expect(feed.picks[0]).toMatchObject({
      listingKey: "X1",
      bathrooms: 2,
      listPrice: 650000,
      grossYieldPct: 5.35,
      estimatedMonthlyRent: 2900,
      compsUsed: 7,
    });
    expect(feed.pinnedCount).toBe(1);
    expect(feed.basisNote).toBe(
      "Estimates from asking rents; excludes financing.",
    );
  });

  it("tolerates garbage", () => {
    expect(mapInvestorPicks(null)).toEqual({
      picks: [],
      pinnedCount: 0,
      basisNote: null,
      generatedAt: null,
    });
    expect(mapInvestorPicks({ results: "nope" }).picks).toEqual([]);
  });
});

describe("mapDeals / dealHref", () => {
  const row = {
    mls_number: "W123",
    address: "5 King St W",
    city: "Toronto",
    property_sub_type: "Detached",
    bedrooms: 3,
    bathrooms: 2,
    list_price: 900000,
    original_price: 1000000,
    drop_amount: 100000,
    drop_pct: 10,
    changed_on: "2026-09-20",
    listing_key: null,
    image_url: null,
  };

  it("keeps real drops and drops rows that are not", () => {
    const deals = mapDeals({
      results: [row, { ...row, mls_number: "W9", list_price: 1000000 }],
    });
    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({
      mlsNumber: "W123",
      dropPct: 10,
      listingKey: null,
      imageUrl: null,
    });
  });

  it("derives the drop when the backend omits it", () => {
    const [deal] = mapDeals({
      results: [{ ...row, drop_amount: null, drop_pct: null }],
    });
    expect(deal.dropAmount).toBe(100000);
    expect(deal.dropPct).toBe(10);
  });

  it("links to the property when matched, else to an address search", () => {
    expect(dealHref({ listingKey: "K 1", address: "x", mlsNumber: "m" })).toBe(
      "/property/K%201",
    );
    expect(
      dealHref({ listingKey: null, address: "5 King St W", mlsNumber: "m" }),
    ).toBe("/listings?search=5%20King%20St%20W");
    expect(dealHref({ listingKey: null, address: "", mlsNumber: "W1" })).toBe(
      "/listings?search=W1",
    );
  });
});

describe("mapSoldBelow", () => {
  const valid = {
    listing_key: "S1",
    address: "9 Elm",
    city: "Vaughan",
    close_price: 1000000,
    close_date: "2026-09-01",
    previous_close_price: 1100000,
    previous_close_date: "2021-04-01",
    loss_amount: 100000,
  };

  it("maps complete rows and skips incomplete ones", () => {
    const rows = mapSoldBelow({
      results: [
        valid,
        { listing_key: "S2", close_price: null, previous_close_price: 5 },
        { ...valid, listing_key: "S3", address: "" },
        { ...valid, listing_key: "S4", loss_amount: 0 },
        { ...valid, listing_key: "S5", previous_close_price: 900000 },
      ],
      count: 5,
      empty: false,
      computed_at: null,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      listingKey: "S1",
      lossAmount: 100000,
      previousCloseDate: "2021-04-01",
      imageUrl: null,
    });
  });

  it("returns no rows when the envelope is empty", () => {
    expect(mapSoldBelow({ results: [], count: 0, empty: true, source: "none" })).toEqual([]);
    expect(mapSoldBelow({ results: [valid], count: 0, empty: false })).toEqual([]);
    expect(mapSoldBelow({ empty: true, results: [valid], count: 1 })).toEqual([]);
  });
});

describe("mapMarketSnapshot / snapshotStats", () => {
  const payload = {
    window_days: 30,
    median_sold_price: 1_050_000,
    median_sold_price_change_pct: -1.2,
    avg_days_on_market: 21.4,
    sale_to_list_ratio: 1.0234,
    over_asking_share: 0.41,
    units_sold: 5123,
    units_sold_change_pct: 4.5,
    active_listings: 20000,
    scope: "gta",
    as_of: "2026-09-24T06:00:00Z",
    stale: false,
  };

  it("maps and formats stats", () => {
    const snap = mapMarketSnapshot(payload);
    expect(snap).not.toBeNull();
    const stats = snapshotStats(snap!);
    expect(stats.map((s) => s.value)).toEqual([
      "$1.05M",
      "21 days",
      "102.3%",
      "41%",
      "5,123",
    ]);
    expect(stats[0]).toMatchObject({ change: "-1.2% MoM", up: false });
    expect(stats[4]).toMatchObject({
      label: "Sold (30 days)",
      change: "+4.5% MoM",
      up: true,
    });
  });

  it("omits missing stats and returns null for an empty window", () => {
    const partial = mapMarketSnapshot({
      ...payload,
      sale_to_list_ratio: null,
      median_sold_price_change_pct: null,
    });
    const stats = snapshotStats(partial!);
    expect(stats.find((s) => s.label === "Sale-to-List")).toBeUndefined();
    expect(stats[0].change).toBeUndefined();
    expect(
      mapMarketSnapshot({ median_sold_price: null, units_sold: 0 }),
    ).toBeNull();
    expect(mapMarketSnapshot(null)).toBeNull();
  });
});

describe("content mappers", () => {
  it("validates incentive icons and URLs", () => {
    const [item] = mapIncentives({
      results: [
        {
          id: 3,
          title: "FHSA",
          label: "TAX",
          icon: "rocket",
          amount_text: "$40K",
          source_url: "javascript:alert(1)",
          reviewed_at: "2026-09-01",
        },
        { id: 4, title: "" },
      ],
    });
    expect(item).toMatchObject({
      id: "3",
      icon: "home",
      sourceUrl: null,
      reviewedAt: "2026-09-01",
    });
  });

  it("maps partners and picks a glyph by category", () => {
    const [p] = mapPartners({
      results: [
        {
          id: 1,
          name: "Acme Law",
          category: "Legal",
          website_url: "https://acme.ca",
        },
      ],
    });
    expect(p).toMatchObject({
      name: "Acme Law",
      websiteUrl: "https://acme.ca/",
      logoUrl: null,
    });
    expect(connectionIconFor("Mortgage")).toBe("mortgage");
    expect(connectionIconFor("Home Inspection")).toBe("inspection");
    expect(connectionIconFor("Something else")).toBe("planning");
  });

  it("keys community images by lower-cased city", () => {
    expect(
      mapCommunityImages({
        results: [
          {
            city_key: "Toronto",
            image_url: "https://images.unsplash.com/t.jpg",
          },
          { city_key: "oakville", image_url: "not a url" },
        ],
      }),
    ).toEqual({ toronto: "https://images.unsplash.com/t.jpg" });
  });
});

describe("url helpers", () => {
  it("accepts only http(s)", () => {
    expect(safeUrl("data:image/png;base64,xx")).toBeNull();
    expect(safeUrl(" https://x.com/a ")).toBe("https://x.com/a");
  });

  it("only optimises Cloudinary / Unsplash / estate hosts — MLS CDNs load raw", () => {
    // ddfcdn goes through the browser directly; the Next optimizer was blanking
    // every listing gallery on Vercel.
    expect(isOptimizableImage("https://ddfcdn.realtor.ca/listings/a.jpg")).toBe(
      false,
    );
    expect(isOptimizableImage("https://res.cloudinary.com/x/a.jpg")).toBe(true);
    expect(isOptimizableImage("https://images.unsplash.com/photo.jpg")).toBe(true);
    expect(
      isOptimizableImage("https://evil-realtor.ca.example.com/a.jpg"),
    ).toBe(false);
    expect(isOptimizableImage("http://ddfcdn.realtor.ca/a.jpg")).toBe(false);
    expect(isOptimizableImage("/images/a.jpg")).toBe(true);
    expect(isOptimizableImage("//evil.com/a.jpg")).toBe(false);
  });
});

describe("formatDay", () => {
  it("keeps date-only values on their calendar day", () => {
    expect(formatDay("2026-09-01")).toMatch(/Sep\.? 1, 2026/);
    expect(formatDay(null)).toBe("—");
  });
});
