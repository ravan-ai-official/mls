/**
 * Property climate hazard projections (heat / precip / flood) for ~2050.
 *
 * Prefers mls-v2 `/climate-risk/` when deployed; otherwise computes the same
 * payload from Open-Meteo CMIP6 so the PDP card stays visible and dynamic.
 */

import { ApiError, apiFetch, type RequestOptions } from "@/lib/api/client";

const MLS = "/api/mls";
const CLIMATE_URL = "https://climate-api.open-meteo.com/v1/climate";
const ELEVATION_URL = "https://api.open-meteo.com/v1/elevation";
const MODEL = "EC_Earth3P_HR";
const HOT_DAY_C = 31;
const EXTREME_PRECIP_MM = 25;

/** Representative shoreline / open-water points for southern Ontario flood proximity. */
const WATER_POINTS: Array<[number, number]> = [
  [43.63, -79.35],
  [43.45, -79.67],
  [43.25, -79.85],
  [43.15, -79.2],
  [42.88, -78.95],
  [42.98, -82.4],
  [44.75, -79.9],
  [44.15, -77.35],
];

export type ClimateRiskLevel = "Low" | "Medium" | "High";

export interface ClimateRiskItem {
  risk: string;
  level: ClimateRiskLevel;
  desc: string;
}

export interface ClimateRiskPayload {
  latitude: number;
  longitude: number;
  elevationM: number | null;
  horizon: string;
  model: string;
  risks: ClimateRiskItem[];
  source: string;
}

interface BackendClimateRisk {
  latitude?: number;
  longitude?: number;
  elevation_m?: number | null;
  horizon?: string;
  model?: string;
  risks?: Array<{ risk?: string; level?: string; desc?: string }>;
  source?: string;
}

function asLevel(value: string | undefined): ClimateRiskLevel {
  if (value === "High" || value === "Medium" || value === "Low") return value;
  return "Medium";
}

function mapBackend(data: BackendClimateRisk, latitude: number, longitude: number): ClimateRiskPayload | null {
  const risks = (data.risks ?? [])
    .filter((row): row is { risk: string; level: string; desc: string } =>
      Boolean(row.risk && row.level && row.desc),
    )
    .map((row) => ({
      risk: row.risk,
      level: asLevel(row.level),
      desc: row.desc,
    }));
  if (!risks.length) return null;
  return {
    latitude: data.latitude ?? latitude,
    longitude: data.longitude ?? longitude,
    elevationM: data.elevation_m ?? null,
    horizon: data.horizon ?? "2050",
    model: data.model ?? MODEL,
    risks,
    source: data.source ?? "Open-Meteo CMIP6 climate projections",
  };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dlmb = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dphi / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dlmb / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
}

function nearestWaterKm(lat: number, lng: number): number {
  return Math.min(...WATER_POINTS.map(([wlat, wlng]) => haversineKm(lat, lng, wlat, wlng)));
}

function levelFromScore(score: number): ClimateRiskLevel {
  if (score >= 0.66) return "High";
  if (score >= 0.33) return "Medium";
  return "Low";
}

interface WindowStats {
  hotDays: number;
  annualPrecip: number;
  extremeDays: number;
  p95Precip: number;
  elevation: number | null;
}

async function fetchClimateWindow(
  lat: number,
  lng: number,
  start: string,
  end: string,
): Promise<{ daily?: { temperature_2m_max?: Array<number | null>; precipitation_sum?: Array<number | null> }; elevation?: number }> {
  const params = new URLSearchParams({
    latitude: String(Number(lat.toFixed(4))),
    longitude: String(Number(lng.toFixed(4))),
    start_date: start,
    end_date: end,
    models: MODEL,
    daily: "temperature_2m_max,precipitation_sum",
    temperature_unit: "celsius",
    precipitation_unit: "mm",
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${CLIMATE_URL}?${params}`, {
      next: { revalidate: 60 * 60 * 24 * 7 },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Open-Meteo climate ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchElevation(lat: number, lng: number): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const params = new URLSearchParams({
      latitude: String(Number(lat.toFixed(4))),
      longitude: String(Number(lng.toFixed(4))),
    });
    const response = await fetch(`${ELEVATION_URL}?${params}`, {
      next: { revalidate: 60 * 60 * 24 * 30 },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { elevation?: Array<number | null> };
    const elev = data.elevation?.[0];
    return elev == null ? null : Number(elev);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function windowStats(
  payload: {
    daily?: { temperature_2m_max?: Array<number | null>; precipitation_sum?: Array<number | null> };
    elevation?: number;
  },
  years: number,
): WindowStats {
  const tmax = payload.daily?.temperature_2m_max ?? [];
  const precip = payload.daily?.precipitation_sum ?? [];
  const span = Math.max(years, 1);
  const hotDays = tmax.filter((t) => t != null && t >= HOT_DAY_C).length / span;
  const annualPrecip = precip.reduce<number>((sum, p) => sum + (p ?? 0), 0) / span;
  const extremeDays =
    precip.filter((p) => p != null && p >= EXTREME_PRECIP_MM).length / span;
  const wet = precip.filter((p): p is number => p != null && p > 0).sort((a, b) => a - b);
  const p95 = wet.length ? wet[Math.floor(0.95 * (wet.length - 1))]! : 0;
  return {
    hotDays,
    annualPrecip,
    extremeDays,
    p95Precip: p95,
    elevation: payload.elevation ?? null,
  };
}

function heatItem(futureHot: number): ClimateRiskItem {
  const level: ClimateRiskLevel = futureHot >= 15 ? "High" : futureHot >= 5 ? "Medium" : "Low";
  const days = Math.max(0, Math.round(futureHot));
  return {
    risk: "Heat Risk",
    level,
    desc: `Around 2050, projected ${days} extremely hot day${days === 1 ? "" : "s"}/year above ${HOT_DAY_C}°C.`,
  };
}

function precipItem(hist: WindowStats, future: WindowStats): ClimateRiskItem {
  const deltaAnnual = future.annualPrecip - hist.annualPrecip;
  const deltaExtreme = future.p95Precip - hist.p95Precip;
  const intensity = Math.max(
    future.extremeDays / 10,
    future.p95Precip / 40,
    Math.abs(deltaAnnual) / 120,
  );
  const level = levelFromScore(Math.min(1, intensity));
  const spanLow = Math.max(5, Math.round(Math.abs(deltaAnnual) * 0.3));
  const spanHigh = Math.max(spanLow + 10, Math.round(Math.abs(deltaAnnual)));

  let desc: string;
  if (deltaAnnual > 8) {
    desc = `Heavy rainfall projected to increase by ${spanLow}mm to ${spanHigh}mm annually by 2050.`;
  } else if (deltaAnnual < -8) {
    desc = `Total annual rainfall may drop by about ${spanLow}mm to ${spanHigh}mm by 2050, while storm intensity remains a factor.`;
  } else {
    const days = Math.max(1, Math.round(future.extremeDays));
    const intensityMm = Math.max(1, Math.round(future.p95Precip));
    const direction = deltaExtreme >= 0 ? "rising" : "elevated";
    desc = `About ${days} heavy rainfall days/year (≥${EXTREME_PRECIP_MM}mm) projected around 2050, with ${direction} storm totals near ${intensityMm}mm.`;
  }
  return { risk: "Precipitation Risk", level, desc };
}

function floodItem(lat: number, lng: number, elevation: number | null): ClimateRiskItem {
  const waterKm = nearestWaterKm(lat, lng);
  const elev = elevation ?? 120;
  const elevFactor = Math.max(0, Math.min(1, (140 - elev) / 120));
  const waterFactor = Math.max(0, Math.min(1, (18 - waterKm) / 18));
  const score = 0.55 * elevFactor + 0.45 * waterFactor;
  const chance = Math.round(1 + score * 27);
  const level: ClimateRiskLevel = chance >= 15 ? "High" : chance >= 7 ? "Medium" : "Low";
  return {
    risk: "Flood Risk",
    level,
    desc: `This property has a ${chance}% chance of flooding over the next 25 years.`,
  };
}

/** Direct Open-Meteo projection — used when the MLS climate endpoint is unavailable. */
export async function computeClimateRisk(
  latitude: number,
  longitude: number,
): Promise<ClimateRiskPayload> {
  const [futurePayload, histPayload] = await Promise.all([
    fetchClimateWindow(latitude, longitude, "2048-01-01", "2050-12-31"),
    fetchClimateWindow(latitude, longitude, "1998-01-01", "2000-12-31"),
  ]);
  const future = windowStats(futurePayload, 3);
  const hist = windowStats(histPayload, 3);
  let elevation = future.elevation;
  if (elevation == null) elevation = await fetchElevation(latitude, longitude);

  return {
    latitude: Number(latitude.toFixed(5)),
    longitude: Number(longitude.toFixed(5)),
    elevationM: elevation == null ? null : Number(elevation.toFixed(1)),
    horizon: "2050",
    model: MODEL,
    risks: [heatItem(future.hotDays), precipItem(hist, future), floodItem(latitude, longitude, elevation)],
    source: "Open-Meteo CMIP6 climate projections",
  };
}

export async function getClimateRisk(
  latitude: number,
  longitude: number,
  options: RequestOptions = {},
): Promise<ClimateRiskPayload> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new ApiError("A valid latitude and longitude are required.", 400);
  }

  try {
    const data = await apiFetch<BackendClimateRisk>(`${MLS}/climate-risk/`, {
      revalidate: 60 * 60 * 24,
      timeoutMs: 12_000,
      ...options,
      params: { lat: latitude, lng: longitude, ...options.params },
    });
    const mapped = mapBackend(data, latitude, longitude);
    if (mapped) return mapped;
  } catch {
    // Production may not have deployed /climate-risk/ yet — fall through.
  }

  return computeClimateRisk(latitude, longitude);
}
