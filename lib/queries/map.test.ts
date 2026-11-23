import { describe, expect, it } from "vitest";
import {
  boundsOverlap,
  isClusterReply,
  flattenMapPages,
  MAP_MAX_ROWS,
  MAP_PAGE_SIZE,
  mapAggregatesUrl,
  mapListingsUrl,
  mapQueryView,
  nextMapOffset,
  type MapListings,
} from "./map";
import { valuationLookupUrl } from "./valuation";

const viewport = { latMin: 43.61234, latMax: 43.70001, lngMin: -79.45678, lngMax: -79.3, zoom: 12.4 };

describe("mapQueryView", () => {
  it("is null until a viewport is known", () => {
    expect(mapQueryView({ viewport: null, filters: "", poly: "" })).toBeNull();
  });

  it("rounds the viewport and sorts filters", () => {
    const view = mapQueryView({ viewport, filters: "type=condo&city=Toronto", poly: "" });
    expect(view).toEqual({
      bounds: [43.612, -79.457, 43.7, -79.3],
      zoom: 12,
      filters: "city=Toronto&type=condo",
      poly: "",
    });
  });

  it("ignores the viewport when an area is drawn, so panning keeps the key", () => {
    const a = mapQueryView({ viewport, filters: "", poly: "1,2;3,4;5,6" });
    const b = mapQueryView({ viewport: null, filters: "", poly: "1,2;3,4;5,6" });
    expect(a).toEqual(b);
  });
});

describe("map urls", () => {
  it("sends the box, filters and limit for a viewport", () => {
    const view = mapQueryView({ viewport, filters: "city=Toronto", poly: "" })!;
    const url = new URL(mapListingsUrl(view), "http://x");
    expect(url.pathname).toBe("/api/mls/properties/filter");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      city: "Toronto",
      lat_min: "43.612",
      lat_max: "43.7",
      lng_min: "-79.457",
      lng_max: "-79.3",
      limit: String(MAP_PAGE_SIZE),
    });
  });

  it("sends the shape instead of the box for a drawn area", () => {
    const view = mapQueryView({ viewport, filters: "", poly: "1,2;3,4;5,6" })!;
    const url = new URL(mapListingsUrl(view), "http://x");
    expect(url.searchParams.get("poly")).toBe("1,2;3,4;5,6");
    expect(url.searchParams.has("lat_min")).toBe(false);
  });

  it("builds the aggregates url from bounds and zoom only", () => {
    const view = mapQueryView({ viewport, filters: "city=Toronto", poly: "" })!;
    const url = new URL(mapAggregatesUrl(view), "http://x");
    expect(url.pathname).toBe("/api/mls/properties/map-aggregates");
    expect(url.searchParams.get("zoom")).toBe("12");
    expect(url.searchParams.has("city")).toBe(false);
  });
});

describe("isClusterReply", () => {
  it("needs aggregates mode and at least one cluster", () => {
    expect(isClusterReply({ mode: "aggregates", clusters: [{ latitude: 1, longitude: 1, count: 3 }] })).toBe(true);
    expect(isClusterReply({ mode: "aggregates", clusters: [] })).toBe(false);
    expect(isClusterReply({ mode: "listings", clusters: [] })).toBe(false);
    expect(isClusterReply(undefined)).toBe(false);
  });
});

describe("valuationLookupUrl", () => {
  it("encodes the listing key and address", () => {
    const url = new URL(valuationLookupUrl({ listingKey: null, label: "1 Main St, Toronto" }), "http://x");
    expect(url.searchParams.get("listing_key")).toBe("");
    expect(url.searchParams.get("address")).toBe("1 Main St, Toronto");
  });
});

describe("boundsOverlap", () => {
  it("detects shared area and disjoint boxes", () => {
    expect(boundsOverlap([43.6, -79.5, 43.7, -79.3], [43.65, -79.4, 43.8, -79.2])).toBe(true);
    expect(boundsOverlap([43.6, -79.5, 43.7, -79.3], [43.8, -79.5, 43.9, -79.3])).toBe(false);
  });
});

describe("map paging", () => {
  const rows = (ids: string[]) => ids.map((id) => ({ id }) as MapListings["items"][number]);
  const page = (ids: string[], total: number): MapListings => ({ items: rows(ids), total });

  it("sends the offset only after the first page", () => {
    const view = mapQueryView({ viewport, filters: "", poly: "" })!;
    expect(new URL(mapListingsUrl(view), "http://x").searchParams.has("offset")).toBe(false);
    expect(new URL(mapListingsUrl(view, 200), "http://x").searchParams.get("offset")).toBe("200");
  });

  it("pages on until the view is exhausted", () => {
    const full = page(Array.from({ length: MAP_PAGE_SIZE }, (_, i) => `r${i}`), 685);
    expect(nextMapOffset(full, 0)).toBe(MAP_PAGE_SIZE);
    expect(nextMapOffset(page(["a", "b"], 602), 600)).toBeUndefined();
    // An empty page stops paging even if the count claims more.
    expect(nextMapOffset(page([], 685), 300)).toBeUndefined();
  });

  it("stops at the row cap", () => {
    const full = page(Array.from({ length: MAP_PAGE_SIZE }, (_, i) => `r${i}`), 50_000);
    expect(nextMapOffset(full, MAP_MAX_ROWS - MAP_PAGE_SIZE)).toBeUndefined();
  });

  it("flattens pages, dropping rows repeated across pages, with the newest total", () => {
    const flat = flattenMapPages({
      pages: [page(["a", "b"], 5), page(["b", "c"], 4)],
      pageParams: [0, 2],
    });
    expect(flat.items.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(flat.total).toBe(4);
  });
});
