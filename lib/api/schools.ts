/**
 * Ontario Ministry of Education school file, via mls-v2, plus name search.
 *
 * Percentages are the published share of students who met the EQAO provincial
 * standard, averaged across the subjects the file reports for that level.
 * The file has school locations, not attendance boundaries — living near a
 * school does not guarantee admission; boards assign by catchment.
 */

import { ApiError, apiFetch, type RequestOptions } from "@/lib/api/client";
import { geocodePlace } from "@/lib/api/geo";
import { serializePolygonParam } from "@/lib/map/polygon";

const MLS = "/api/mls";

export const SCHOOL_SEARCH_MIN_CHARS = 2;
export const DEFAULT_SCHOOL_RADIUS_KM = 2;
export const SCHOOL_RADIUS_OPTIONS_KM = [1, 2, 3] as const;

export interface OfficialSchool {
  id: string;
  name: string;
  board: string;
  kind: string;
  level: string;
  city: string;
  distanceKm: number | null;
  website: string | null;
  eqaoPercent: number | null;
  eqaoLabel: string;
  latitude: number | null;
  longitude: number | null;
  /** Always null — Ministry file has no school photos; UI stays text-first. */
  imageUrl: string | null;
}

/** A school a buyer can search homes near — Ministry record when matched. */
export interface SchoolSearchHit {
  id: string;
  name: string;
  /** Short line for the suggestion list: name · city. */
  label: string;
  city: string;
  board: string;
  kind: string;
  level: string;
  latitude: number;
  longitude: number;
  eqaoPercent: number | null;
  eqaoLabel: string;
  /** Ministry match carries EQAO; place-only is geocode without a file match. */
  source: "ministry" | "place";
}

interface RawSchool {
  id?: string;
  name?: string;
  board?: string;
  kind?: string;
  level?: string;
  city?: string;
  distance_km?: number | null;
  website?: string;
  eqao_percent?: number | null;
  eqao_label?: string;
  latitude?: number | null;
  longitude?: number | null;
}

function mapSchool(school: RawSchool): OfficialSchool | null {
  const name = school.name?.trim() || "";
  if (!name) return null;
  const latitude = typeof school.latitude === "number" ? school.latitude : null;
  const longitude = typeof school.longitude === "number" ? school.longitude : null;
  return {
    id: school.id?.trim() || name,
    name,
    board: school.board?.trim() || "",
    kind: school.kind?.trim() || "",
    level: school.level?.trim() || "",
    city: school.city?.trim() || "",
    distanceKm: typeof school.distance_km === "number" ? school.distance_km : null,
    website: school.website?.trim() || null,
    eqaoPercent: typeof school.eqao_percent === "number" ? school.eqao_percent : null,
    eqaoLabel: school.eqao_label?.trim() || "",
    latitude,
    longitude,
    imageUrl: null,
  };
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function looksLikeSchoolLabel(label: string): boolean {
  return /\b(school|academy|collegiate|secondary|elementary|intermediate|high school|public school|catholic|ps|ss)\b/i.test(
    label,
  );
}

/** How well a Ministry name matches the place the user picked. */
function nameScore(query: string, candidate: string): number {
  const q = normalizeName(query);
  const c = normalizeName(candidate);
  if (!q || !c) return 0;
  if (q === c) return 1;
  if (c.includes(q) || q.includes(c)) return 0.85;
  const qTokens = new Set(q.split(" ").filter((t) => t.length > 1));
  const cTokens = c.split(" ").filter((t) => t.length > 1);
  if (qTokens.size === 0 || cTokens.length === 0) return 0;
  let hit = 0;
  for (const token of cTokens) if (qTokens.has(token)) hit += 1;
  return hit / Math.max(qTokens.size, cTokens.length);
}

function shortSchoolName(label: string): string {
  const beforeComma = label.split(",")[0]?.trim() || label.trim();
  return beforeComma.replace(/\s+/g, " ");
}

function cityFromLabel(label: string): string {
  // Nominatim: "Name, number, road, neighbourhood, City, Region, Ontario…"
  const parts = label.split(",").map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    if (
      /^(ontario|canada|peel|york|durham|halton|toronto|gta)$/i.test(part) ||
      /^\d/.test(part) ||
      /region|county|boulevard|street|road|avenue|drive|crescent|way|court/i.test(part)
    ) {
      continue;
    }
    if (looksLikeSchoolLabel(part)) continue;
    if (/^[A-Z]/.test(part) && part.length < 40) return part;
  }
  return "";
}

/** ~km axis-aligned box around a school pin. Proxy for catchment, not a board boundary. */
export function schoolSearchArea(
  lat: number,
  lng: number,
  km = DEFAULT_SCHOOL_RADIUS_KM,
): Array<{ lat: number; lng: number }> {
  const latDelta = km / 111;
  const lngDelta = km / (111 * Math.cos((lat * Math.PI) / 180));
  return [
    { lat: lat - latDelta, lng: lng - lngDelta },
    { lat: lat - latDelta, lng: lng + lngDelta },
    { lat: lat + latDelta, lng: lng + lngDelta },
    { lat: lat + latDelta, lng: lng - lngDelta },
  ];
}

export async function getSchoolsNear(
  lat: number,
  lon: number,
  options: RequestOptions & { radiusKm?: number } = {},
): Promise<OfficialSchool[]> {
  const { radiusKm = 8, ...rest } = options;
  const data = await apiFetch<{ schools?: RawSchool[] }>(`${MLS}/schools/near/`, {
    revalidate: 86_400,
    ...rest,
    params: { lat, lon, radius: radiusKm },
  });
  return (data.schools ?? [])
    .map((school) => mapSchool(school))
    .filter((school): school is OfficialSchool => school !== null);
}

export async function getTopSchools(
  options: RequestOptions & { limit?: number; cities?: string[]; names?: string[] } = {},
): Promise<OfficialSchool[]> {
  const { limit = 4, cities, names, ...rest } = options;
  const personalized = Boolean(cities?.length || names?.length);
  const data = await apiFetch<{ schools?: RawSchool[] }>(`${MLS}/schools/top/`, {
    revalidate: personalized ? 3_600 : 86_400,
    ...rest,
    params: {
      limit,
      cities: cities?.length ? cities.join(",") : undefined,
      names: names?.length ? names.join(",") : undefined,
    },
  });
  return (data.schools ?? [])
    .map((school) => mapSchool(school))
    .filter((school): school is OfficialSchool => school !== null);
}

/**
 * Name search for “homes near this school”.
 *
 * Prefers mls-v2 `GET /schools/search/`; falls back to geocode + nearby Ministry
 * enrichment when that endpoint is unavailable.
 */
export async function searchSchools(
  q: string,
  options: RequestOptions & { limit?: number } = {},
): Promise<SchoolSearchHit[]> {
  const term = q.trim();
  if (term.length < SCHOOL_SEARCH_MIN_CHARS) return [];
  const { limit = 8, ...rest } = options;

  try {
    const data = await apiFetch<{ schools?: RawSchool[] }>(`${MLS}/schools/search/`, {
      revalidate: 86_400,
      ...rest,
      params: { q: term, limit },
    });
    const mapped = (data.schools ?? [])
      .map((school) => mapSchool(school))
      .filter((school): school is OfficialSchool => school !== null)
      .filter((school) => school.latitude !== null && school.longitude !== null)
      .slice(0, limit)
      .map((school) => officialToHit(school));
    if (mapped.length > 0) return mapped;
  } catch (error) {
    if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 405)) {
      // Non-404 failures still fall through to geocode.
    }
  }

  // Geocode fallback — one round-trip; Ontario bias helps Nominatim.
  const geocodeQuery = looksLikeSchoolLabel(term) ? `${term} Ontario` : `${term} school Ontario`;
  const results = await geocodePlace(geocodeQuery, rest).catch(() => []);
  const places: Array<{ label: string; latitude: number; longitude: number }> = [];
  const seen = new Set<string>();
  for (const result of results) {
    const key = `${result.latitude.toFixed(4)},${result.longitude.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    places.push(result);
  }

  const ranked = places
    .map((place) => {
      const name = shortSchoolName(place.label);
      const schoolish = looksLikeSchoolLabel(place.label) || looksLikeSchoolLabel(name);
      // Bus stops / roads named after a school are noisy; prefer real school labels.
      const transitish = /\b(at|stop|station|boulevard|street|road|avenue)\b/i.test(name);
      const score =
        nameScore(term, name) + (schoolish ? 0.35 : 0) - (transitish && !schoolish ? 0.4 : 0);
      return { place, name, score, schoolish };
    })
    .filter((row) => row.schoolish && row.score >= 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(limit, 4));

  const enriched = await Promise.all(
    ranked.map(async (row) => {
      const ministry = await matchMinistrySchool(
        row.name,
        row.place.latitude,
        row.place.longitude,
        rest,
      );
      if (ministry) return ministry;
      const city = cityFromLabel(row.place.label);
      return {
        id: `place:${row.place.latitude.toFixed(5)},${row.place.longitude.toFixed(5)}`,
        name: row.name,
        label: city ? `${row.name} · ${city}` : row.name,
        city,
        board: "",
        kind: "",
        level: "",
        latitude: row.place.latitude,
        longitude: row.place.longitude,
        eqaoPercent: null,
        eqaoLabel: "",
        source: "place" as const,
      } satisfies SchoolSearchHit;
    }),
  );

  const hits: SchoolSearchHit[] = [];
  const hitIds = new Set<string>();
  const ministryNames = new Set<string>();
  for (const hit of enriched) {
    if (hitIds.has(hit.id)) continue;
    if (hit.source === "ministry") ministryNames.add(normalizeName(hit.name));
    hitIds.add(hit.id);
    hits.push(hit);
  }

  // Drop place-only rows that are just a street/stop for a Ministry school we already have.
  return hits
    .filter((hit) => {
      if (hit.source === "ministry") return true;
      const normalized = normalizeName(hit.name);
      for (const ministry of ministryNames) {
        if (normalized.includes(ministry) || ministry.includes(normalized)) return false;
      }
      return true;
    })
    .slice(0, limit);
}

async function matchMinistrySchool(
  placeName: string,
  lat: number,
  lon: number,
  options: RequestOptions,
): Promise<SchoolSearchHit | null> {
  const nearby = await getSchoolsNear(lat, lon, { ...options, radiusKm: 3 }).catch(() => []);
  let best: OfficialSchool | null = null;
  let bestScore = 0;
  for (const school of nearby) {
    if (school.latitude === null || school.longitude === null) continue;
    const score = nameScore(placeName, school.name);
    if (score > bestScore) {
      best = school;
      bestScore = score;
    }
  }
  if (!best || bestScore < 0.45) return null;
  return officialToHit(best);
}

function officialToHit(school: OfficialSchool): SchoolSearchHit {
  const latitude = school.latitude as number;
  const longitude = school.longitude as number;
  return {
    id: school.id,
    name: school.name,
    label: [school.name, school.city].filter(Boolean).join(" · "),
    city: school.city,
    board: school.board,
    kind: school.kind,
    level: school.level,
    latitude,
    longitude,
    eqaoPercent: school.eqaoPercent,
    eqaoLabel: school.eqaoLabel,
    source: "ministry",
  };
}

/** Map search for listings inside a km box around a school. Not an attendance boundary. */
export function homesNearSchoolHref(
  lat: number,
  lng: number,
  options: { km?: number; name?: string; base?: "/map-search" | "/listings" } = {},
): string {
  const km = options.km ?? DEFAULT_SCHOOL_RADIUS_KM;
  const params = new URLSearchParams();
  const poly = serializePolygonParam(schoolSearchArea(lat, lng, km));
  if (poly) params.set("poly", poly);
  const name = options.name?.trim();
  if (name) {
    params.set("school", name.slice(0, 120));
    params.set("schoolKm", String(km));
  }
  const qs = params.toString();
  const base = options.base ?? "/map-search";
  return qs ? `${base}?${qs}` : base;
}

/** Pull a likely school name out of a free-text AI / hero prompt. */
export function extractSchoolQuery(prompt: string): string | null {
  const text = prompt.trim();
  if (!text || !/\bschool\b/i.test(text)) return null;

  const patterns = [
    /(?:near|around|by|at|for|in)\s+([A-Za-z0-9][^,.]{2,80}?\b(?:secondary school|public school|high school|elementary school|catholic school|school|collegiate|academy)\b)/i,
    /\b([A-Za-z][^,.]{2,80}?\b(?:secondary school|public school|high school|elementary school|catholic school)\b)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const name = match?.[1]?.trim();
    if (name && name.length >= SCHOOL_SEARCH_MIN_CHARS) return name.slice(0, 120);
  }
  return null;
}
