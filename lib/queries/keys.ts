/**
 * Every TanStack Query key in the app comes from here — no inline arrays.
 *
 * Two rules the shape encodes:
 *
 * 1. Per-user data lives under `["me", userId, …]`. The user id in the key means
 *    a different account can never be served another's cached rows, and the
 *    shared `["me"]` root lets AuthProvider drop all of it in one call on
 *    sign-out or an account switch.
 *
 * 2. Inputs are normalised before they reach a key (ids sorted, text trimmed
 *    and lower-cased, map bounds rounded) so equivalent requests share one
 *    cache entry instead of fragmenting it.
 */

/** Map viewport + criteria, normalised for use in a key. */
export interface MapViewKey {
  /** [south, west, north, east], rounded — see `mapViewKey`. */
  bounds: [number, number, number, number];
  zoom: number;
  /** Listing filters as a stable, sorted query string ("" when none). */
  filters: string;
  /** Serialized polygon param, or "" when no shape is drawn. */
  poly: string;
}

/** 3 decimals ≈ 100 m: pan jitter reuses the cached viewport. */
const round3 = (value: number) => Math.round(value * 1000) / 1000;

export function mapViewKey(input: {
  south: number;
  west: number;
  north: number;
  east: number;
  zoom: number;
  filters?: URLSearchParams | string;
  poly?: string | null;
}): MapViewKey {
  const params = new URLSearchParams(input.filters ?? "");
  params.sort();
  return {
    bounds: [round3(input.south), round3(input.west), round3(input.north), round3(input.east)],
    zoom: Math.round(input.zoom),
    filters: params.toString(),
    poly: input.poly ?? "",
  };
}

const normText = (value: string) => value.trim().toLowerCase();

export const qk = {
  properties: {
    all: ["properties"] as const,
    byId: (id: string) => ["properties", "byId", id] as const,
    byIds: (ids: string[]) => ["properties", "byIds", [...ids].sort()] as const,
    /** Normalised listings query string (sorted) so equivalent filters share a cache entry. */
    search: (filters: string) => ["properties", "search", filters] as const,
  },
  map: {
    listings: (view: MapViewKey) => ["map", "listings", view] as const,
    aggregates: (view: MapViewKey) => ["map", "aggregates", view] as const,
  },
  geo: {
    place: (q: string) => ["geo", "place", normText(q)] as const,
  },
  schools: {
    search: (q: string) => ["schools", "search", normText(q)] as const,
  },
  home: {
    /** Point rounded to 3 decimals (≈100 m) so nearby picks share an entry. */
    nearbyActivity: (lat: number, lng: number, radiusKm: number, limit: number) =>
      ["home", "nearby-activity", round3(lat), round3(lng), radiusKm, limit] as const,
  },
  valuation: {
    autocomplete: (q: string) => ["valuation", "autocomplete", normText(q)] as const,
  },
  auth: {
    me: ["auth", "me"] as const,
  },
  /** Root of every per-user key; see rule 1 above. */
  meRoot: ["me"] as const,
  me: (userId: number) => ({
    all: ["me", userId] as const,
    overview: ["me", userId, "watched", "overview"] as const,
    notes: ["me", userId, "notes", "list"] as const,
    note: (listingKey: string) => ["me", userId, "notes", "one", listingKey] as const,
    savedSearches: ["me", userId, "saved-searches"] as const,
    submissions: ["me", userId, "listing-submissions", "mine"] as const,
    submission: (id: number) => ["me", userId, "listing-submissions", "one", id] as const,
    nearbyAlerts: ["me", userId, "home", "nearby-alerts"] as const,
    siteDocument: (key: string) => ["me", userId, "studio", "site", key] as const,
    siteRevisions: (key: string) => ["me", userId, "studio", "site", key, "revisions"] as const,
    featured: (q: string) => ["me", userId, "studio", "featured", normText(q)] as const,
    featuredAll: ["me", userId, "studio", "featured"] as const,
    highReturn: (q: string) => ["me", userId, "studio", "high-return", normText(q)] as const,
    highReturnAll: ["me", userId, "studio", "high-return"] as const,
    editorial: (resource: string) => ["me", userId, "studio", "editorial", resource] as const,
    /** Under "me" only because sold data is sign-in gated: sign-out drops it. */
    recentSales: (
      city: string,
      days: number,
      page: number,
      filters: { propertyType?: string; bedsMin?: number; bathsMin?: number } = {},
    ) =>
      [
        "me",
        userId,
        "market",
        "recent-sales",
        normText(city),
        days,
        page,
        normText(filters.propertyType ?? ""),
        filters.bedsMin ?? null,
        filters.bathsMin ?? null,
      ] as const,
  }),
};

export type UserKeys = ReturnType<typeof qk.me>;
