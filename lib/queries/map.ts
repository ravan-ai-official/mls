import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  type InfiniteData,
  type Query,
} from "@tanstack/react-query";
import { getMapAggregates, type MapCluster } from "@/lib/api/geo";
import { searchProperties } from "@/lib/api/properties";
import { mapViewKey, qk, type MapViewKey } from "@/lib/queries/keys";
import type { ListingQuery, PropertySummary } from "@/lib/types/domain";
import { parseListingSearch } from "@/lib/utils/searchParams";

/** Same For-sale → Active default the listings page applies. */
function withMapListingDefaults(query: ListingQuery): ListingQuery {
  const transaction = query.transaction ?? "sale";
  if (transaction === "sold") {
    return {
      ...query,
      transaction: "sold",
      status: query.status ?? "Sold",
      openHouse: undefined,
    };
  }
  if (query.status || query.openHouse) return { ...query, transaction };
  return { ...query, transaction, status: "Active" };
}

/**
 * Map search reads: listing rows for the viewport (or a drawn area) and H3
 * cluster counts for zoomed-out, unfiltered views.
 *
 * The component owns only "where the map is" (debounced); these options own
 * fetching, caching and cancellation. Panning back to a viewport seen in the
 * last minute is served from cache.
 */

/** Rows per request; the backend's page limit is 100. */
export const MAP_PAGE_SIZE = 100;

/**
 * Most rows the list will page through for one view. Every loaded row is also
 * a pin, and past ~1,000 DOM markers panning stutters; by then the area or the
 * filters are too broad to browse row by row anyway, and the list says so.
 */
export const MAP_MAX_ROWS = 1000;

const MAP_STALE_TIME = 3 * 60_000;
const MAP_GC_TIME = 30 * 60_000;

export interface MapListings {
  items: PropertySummary[];
  total: number;
}

export interface MapAggregatesResponse {
  mode?: string;
  clusters?: MapCluster[];
}

export interface MapViewport {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
  zoom: number;
}

/**
 * The query view for the map, or null while there is nothing to ask for yet
 * (no viewport reported and no drawn area).
 *
 * A drawn area IS the query: its view carries no bounds, so panning around the
 * shape keeps the same key and never refetches — otherwise the results would
 * silently switch back to "whatever is in view".
 */
export function mapQueryView(input: {
  viewport: MapViewport | null;
  filters: string;
  poly: string;
}): MapViewKey | null {
  if (input.poly) {
    return mapViewKey({
      south: 0,
      west: 0,
      north: 0,
      east: 0,
      zoom: 0,
      filters: input.filters,
      poly: input.poly,
    });
  }
  if (!input.viewport) return null;
  const { latMin, latMax, lngMin, lngMax, zoom } = input.viewport;
  return mapViewKey({
    south: latMin,
    west: lngMin,
    north: latMax,
    east: lngMax,
    zoom,
    filters: input.filters,
  });
}

function boxParams(view: MapViewKey): Record<string, string> {
  const [south, west, north, east] = view.bounds;
  return {
    lat_min: String(south),
    lat_max: String(north),
    lng_min: String(west),
    lng_max: String(east),
  };
}

/**
 * ListingQuery for a map view — hits mls-backend `GET /api/mls/properties/filter/`
 * via the same-origin proxy (not a Next-only `/api/properties/map` BFF).
 */
export function mapListingsQueryInput(view: MapViewKey, offset = 0): ListingQuery {
  const params = new URLSearchParams(view.filters);
  if (view.poly) params.set("poly", view.poly);
  const query = withMapListingDefaults(parseListingSearch(params));
  const [south, west, north, east] = view.bounds;
  return {
    ...query,
    bounds: view.poly
      ? undefined
      : { latMin: south, latMax: north, lngMin: west, lngMax: east },
    limit: MAP_PAGE_SIZE,
    offset: offset > 0 ? offset : 0,
  };
}

/** @deprecated Test helper — prefer `mapListingsQueryInput`. */
export function mapListingsUrl(view: MapViewKey, offset = 0): string {
  const qs = new URLSearchParams(view.filters);
  const area: Record<string, string> = view.poly ? { poly: view.poly } : boxParams(view);
  for (const [key, value] of Object.entries(area)) qs.set(key, value);
  qs.set("limit", String(MAP_PAGE_SIZE));
  if (offset > 0) qs.set("offset", String(offset));
  return `/api/mls/properties/filter?${qs.toString()}`;
}

/**
 * Offset of the page after `last`, or undefined when there is none: the view
 * is exhausted, a page came back empty, or the row cap is reached.
 */
export function nextMapOffset(last: MapListings, lastOffset: number): number | undefined {
  const next = lastOffset + last.items.length;
  if (last.items.length === 0 || next >= last.total || next >= MAP_MAX_ROWS) return undefined;
  return next;
}

/**
 * Loaded pages → one list. A row can move between pages if the feed updates
 * mid-scroll (offset paging), so later duplicates are dropped by id; `total`
 * is the newest page's, the freshest count.
 */
export function flattenMapPages(data: InfiniteData<MapListings, number>): MapListings {
  const seen = new Set<string>();
  const items: PropertySummary[] = [];
  for (const page of data.pages) {
    for (const item of page.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
  }
  return { items, total: data.pages.at(-1)?.total ?? 0 };
}

/** @deprecated Test helper — aggregates load via `getMapAggregates`. */
export function mapAggregatesUrl(view: MapViewKey): string {
  const qs = new URLSearchParams({ ...boxParams(view), zoom: String(view.zoom) });
  return `/api/mls/properties/map-aggregates?${qs.toString()}`;
}

/**
 * Listing rows for a view, a page at a time: the first page on load, the rest
 * as the list is scrolled (`fetchNextPage`). A new viewport or filter set is a
 * new key, so it starts again from the first page.
 */
export function mapListingsQuery(view: MapViewKey) {
  return infiniteQueryOptions({
    queryKey: qk.map.listings(view),
    queryFn: async ({ pageParam }): Promise<MapListings> => {
      const result = await searchProperties(mapListingsQueryInput(view, pageParam), {
        cache: "no-store",
      });
      return { items: result.items, total: result.total };
    },
    initialPageParam: 0,
    getNextPageParam: (last, _all, lastOffset) => nextMapOffset(last, lastOffset),
    select: flattenMapPages,
    staleTime: MAP_STALE_TIME,
    gcTime: MAP_GC_TIME,
    // Pins stay on screen while the next viewport loads.
    placeholderData: keepIfNearby(view),
  });
}

export function mapAggregatesQuery(view: MapViewKey) {
  return queryOptions({
    queryKey: qk.map.aggregates(view),
    queryFn: async (): Promise<MapAggregatesResponse> => {
      const [south, west, north, east] = view.bounds;
      return getMapAggregates(
        { latMin: south, latMax: north, lngMin: west, lngMax: east },
        view.zoom,
        { cache: "no-store" },
      );
    },
    staleTime: MAP_STALE_TIME,
    gcTime: MAP_GC_TIME,
    placeholderData: keepPreviousData,
  });
}

/** True when an aggregates reply means "draw clusters, not pins". */
export function isClusterReply(reply: MapAggregatesResponse | undefined): boolean {
  return reply?.mode === "aggregates" && (reply.clusters?.length ?? 0) > 0;
}

/** [south, west, north, east] boxes share any area. */
export function boundsOverlap(
  a: MapViewKey["bounds"],
  b: MapViewKey["bounds"],
): boolean {
  return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
}

/**
 * keepPreviousData, but only when the previous result was for an overlapping
 * area under the same criteria. Plain keepPreviousData showed the pins of the
 * last marker-mode view — possibly a different part of the city — after
 * zooming in from clusters, until the new rows arrived.
 */
function keepIfNearby(view: MapViewKey) {
  return <T>(previous: T | undefined, previousQuery: Query<T, Error, T, readonly unknown[]> | undefined) => {
    const prior = previousQuery?.queryKey[2] as MapViewKey | undefined;
    if (!previous || !prior) return undefined;
    const sameCriteria = prior.filters === view.filters && prior.poly === view.poly;
    return sameCriteria && boundsOverlap(prior.bounds, view.bounds) ? previous : undefined;
  };
}
