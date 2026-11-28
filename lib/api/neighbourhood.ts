/**
 * Neighbourhood context for the property detail page.
 *
 * Backed by mls-v2's OpenStreetMap-derived endpoints:
 *   nearest-school/   → Overpass schools within a radius (cached server-side)
 *   nearby-amenities/ → groceries / cafes / parks / transit, grouped
 *   census/fsa/<fsa>/ → StatCan census profile for the forward sortation area
 *
 * These power the reference's "Catchment Schools" and "Neighbourhood Insights"
 * sections. Note the school records carry NO rating — the reference showed
 * "8.6 / 10" scores that OSM does not provide (see API_GAPS G13).
 */

import { apiFetch, type RequestOptions } from "@/lib/api/client";

const MLS = "/api/mls";

export interface NearbySchool {
  name: string;
  operator: string | null;
  /** OSM `amenity` tag: "school", "college", "university". */
  kind: string | null;
  address: string | null;
  distanceKm: number | null;
  website: string | null;
}

interface RawSchool {
  name?: string;
  operator?: string | null;
  amenity?: string | null;
  address?: string | null;
  distance_km?: number | null;
  distance_meters?: number | null;
  website?: string | null;
}

export async function getNearbySchools(
  lat: number,
  lon: number,
  options: RequestOptions & { radius?: number } = {},
): Promise<NearbySchool[]> {
  const { radius = 3000, ...rest } = options;
  const data = await apiFetch<{ nearest_schools?: RawSchool[] }>(
    `${MLS}/nearest-school/`,
    { revalidate: 86_400, ...rest, params: { lat, lon, radius } },
  );

  return (data.nearest_schools ?? [])
    .map((school) => ({
      name: school.name?.trim() || "Unnamed school",
      operator: school.operator?.trim() || null,
      kind: school.amenity?.trim() || null,
      address: school.address?.trim() || null,
      distanceKm:
        typeof school.distance_km === "number"
          ? school.distance_km
          : typeof school.distance_meters === "number"
            ? school.distance_meters / 1000
            : null,
      website: school.website?.trim() || null,
    }))
    .filter((school) => school.name !== "Unnamed school" || school.address);
}

export type AmenityCategory = "groceries" | "cafes" | "parks" | "transit";

export interface Amenity {
  name: string;
  address: string | null;
}

export type AmenitiesByCategory = Record<AmenityCategory, Amenity[]>;

export const AMENITY_LABELS: Record<AmenityCategory, string> = {
  groceries: "Groceries",
  cafes: "Cafés & restaurants",
  parks: "Parks & recreation",
  transit: "Transit",
};

export async function getNearbyAmenities(
  lat: number,
  lon: number,
  options: RequestOptions & { radius?: number } = {},
): Promise<AmenitiesByCategory> {
  const { radius = 1500, ...rest } = options;
  const data = await apiFetch<{
    categories?: Partial<Record<AmenityCategory, Array<{ name?: string; address?: string }>>>;
  }>(`${MLS}/nearby-amenities/`, {
    revalidate: 86_400,
    ...rest,
    params: { lat, lon, radius },
  });

  const empty: AmenitiesByCategory = {
    groceries: [],
    cafes: [],
    parks: [],
    transit: [],
  };

  for (const key of Object.keys(empty) as AmenityCategory[]) {
    empty[key] = (data.categories?.[key] ?? [])
      .map((item) => ({
        name: item.name?.trim() || "",
        address: item.address?.trim() || null,
      }))
      .filter((item) => item.name.length > 0 && item.name !== "Unnamed")
      .slice(0, 6);
  }

  return empty;
}

/**
 * Listing History row for the Buy/Sell History table.
 * Prefer API `history[]` (date_start / date_end / price / event / listing_id).
 */
export interface PriceSnapshot {
  dateStart: string | null;
  dateEnd: string | null;
  listPrice: number | null;
  event: string | null;
  listingId: string | null;
  /** @deprecated Prefer `event` — kept for older snapshot payloads. */
  status: string | null;
  /** @deprecated Prefer `dateStart`. */
  recordedAt: string | null;
}

function toHistoryPrice(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function getPropertySnapshots(
  listingKey: string,
  options: RequestOptions = {},
): Promise<PriceSnapshot[]> {
  const data = await apiFetch<{
    history?: Array<{
      date_start?: string | null;
      date_end?: string | null;
      price?: number | string | null;
      event?: string | null;
      listing_id?: string | null;
    }>;
    snapshots?: Array<{
      list_price?: number | null;
      standard_status?: string | null;
      source_modification_timestamp?: string | null;
      created_at?: string | null;
      listing_id?: string | null;
    }>;
  }>(`${MLS}/properties/${encodeURIComponent(listingKey)}/snapshots/`, {
    revalidate: 600,
    ...options,
  });

  if (Array.isArray(data.history) && data.history.length > 0) {
    return data.history
      .map((row) => {
        const dateStart =
          typeof row.date_start === "string" && row.date_start.trim()
            ? row.date_start.trim()
            : null;
        const dateEnd =
          typeof row.date_end === "string" && row.date_end.trim()
            ? row.date_end.trim()
            : null;
        const event =
          typeof row.event === "string" && row.event.trim() ? row.event.trim() : null;
        const listingId =
          typeof row.listing_id === "string" && row.listing_id.trim()
            ? row.listing_id.trim()
            : null;
        return {
          dateStart,
          dateEnd,
          listPrice: toHistoryPrice(row.price),
          event,
          listingId,
          status: event,
          recordedAt: dateStart,
        };
      })
      .filter((row) => row.dateStart !== null || row.listPrice !== null)
      .sort((a, b) => ((a.dateStart ?? "") < (b.dateStart ?? "") ? -1 : 1));
  }

  // Legacy PropertySnapshot rows — never put status/event into Date End.
  return (data.snapshots ?? [])
    .map((row) => {
      const recordedAt = row.source_modification_timestamp ?? row.created_at ?? null;
      const status = row.standard_status ?? null;
      return {
        dateStart: recordedAt,
        dateEnd: null,
        listPrice: typeof row.list_price === "number" ? row.list_price : null,
        event: status,
        listingId:
          typeof row.listing_id === "string" && row.listing_id.trim()
            ? row.listing_id.trim()
            : null,
        status,
        recordedAt,
      };
    })
    .filter((row) => row.dateStart !== null)
    .sort((a, b) => ((a.dateStart ?? "") < (b.dateStart ?? "") ? -1 : 1));
}

export interface ListingEngagement {
  views7d: number;
  views30d: number;
  /** Site traffic for this listing over 7 days: low under 5 views, high at 15+. */
  band: "low" | "medium" | "high";
}

/** Views of this listing on HomeAtlas. Not a board-wide market index. */
export async function getListingEngagement(
  listingKey: string,
  options: RequestOptions = {},
): Promise<ListingEngagement | null> {
  try {
    const data = await apiFetch<{
      views_7d?: number;
      views_30d?: number;
      activity_band?: string;
    }>(`${MLS}/listing-engagement/`, {
      revalidate: 60,
      ...options,
      params: { listing_key: listingKey },
    });
    const band = data.activity_band;
    return {
      views7d: data.views_7d ?? 0,
      views30d: data.views_30d ?? 0,
      band: band === "high" || band === "medium" || band === "low" ? band : "low",
    };
  } catch {
    return null;
  }
}

export interface CensusDistributionRow {
  range: string;
  value: number;
}

export interface CensusProfile {
  population: number;
  medianAge: number;
  averageHouseholdSize: number;
  averageHouseholdIncome: string | null;
  rentersPct: string | null;
  immigrantsPct: string | null;
  avgHomeValue: string | null;
  condosPct: string | null;
  householdsWithChildrenPct: string | null;
  notInLabourForcePct: string | null;
  incomeDistribution: CensusDistributionRow[];
  ageDistribution: CensusDistributionRow[];
  educationDistribution: CensusDistributionRow[];
  ethnicityDistribution: CensusDistributionRow[];
  languageDistribution: CensusDistributionRow[];
  constructionDistribution: CensusDistributionRow[];
  occupationDistribution: CensusDistributionRow[];
  disclaimer: string | null;
}

/** Census profile for a forward sortation area (first 3 chars of a postal code). */
export async function getCensusProfile(
  fsa: string,
  options: RequestOptions = {},
): Promise<CensusProfile | null> {
  const code = fsa.replace(/\s/g, "").slice(0, 3).toUpperCase();
  if (code.length !== 3) return null;
  try {
    const data = await apiFetch<{ profile?: Record<string, unknown> | null }>(
      `${MLS}/census/fsa/${encodeURIComponent(code)}/`,
      { revalidate: 86_400, ...options },
    );
    return parseCensus(data.profile);
  } catch {
    // Census coverage is partial; absence is normal, not an error.
    return null;
  }
}

function distributionRows(value: unknown): CensusDistributionRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const range = "range" in row && typeof row.range === "string" ? row.range : "";
      const amount = "value" in row && typeof row.value === "number" ? row.value : null;
      return range && amount !== null ? { range, value: amount } : null;
    })
    .filter((row): row is CensusDistributionRow => row !== null);
}

function textField(profile: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = profile[key];
    if (typeof value === "string" && value.trim() && value !== "—" && value !== "Placeholder") {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

function parseCensus(profile: Record<string, unknown> | null | undefined): CensusProfile | null {
  if (!profile) return null;
  const disclaimer = typeof profile.disclaimer === "string" ? profile.disclaimer : null;
  const population = typeof profile.population === "number" ? profile.population : 0;
  // The seed file is a placeholder (population 0, "Import census profile").
  if (population <= 0 || (disclaimer ?? "").toLowerCase().includes("placeholder")) return null;

  return {
    population,
    medianAge: typeof profile.medianAge === "number" ? profile.medianAge : 0,
    averageHouseholdSize:
      typeof profile.averageHouseholdSize === "number" ? profile.averageHouseholdSize : 0,
    averageHouseholdIncome: textField(profile, "averageHouseholdIncome", "avgHouseholdIncome"),
    rentersPct: textField(profile, "rentersPct", "renters"),
    immigrantsPct: textField(profile, "immigrantsPct", "immigrants"),
    avgHomeValue: textField(profile, "avgHomeValue", "averageHomeValue"),
    condosPct: textField(profile, "condosPct", "condos"),
    householdsWithChildrenPct: textField(
      profile,
      "householdsWithChildrenPct",
      "householdsWithChildren",
    ),
    notInLabourForcePct: textField(profile, "notInLabourForcePct", "notInLabourForce"),
    incomeDistribution: distributionRows(profile.incomeDistribution),
    ageDistribution: distributionRows(profile.ageDistribution),
    educationDistribution: distributionRows(profile.educationDistribution),
    ethnicityDistribution: distributionRows(profile.ethnicityDistribution),
    languageDistribution: distributionRows(profile.languageDistribution),
    constructionDistribution: distributionRows(
      profile.constructionDistribution ?? profile.periodOfConstructionDistribution,
    ),
    occupationDistribution: distributionRows(profile.occupationDistribution),
    disclaimer,
  };
}
