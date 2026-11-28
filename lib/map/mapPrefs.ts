/**
 * Client prefs for /map-search: search-as-I-move, list chrome, basemap, pins.
 * localStorage only — never blocks SSR.
 */

import type { BasemapId, PinColorMode } from "@/lib/map/basemap";
import type { MapViewport } from "@/lib/queries/map";

const PREFS_KEY = "ha_map_prefs_v2";
const VIEWPORT_KEY = "ha_map_viewport_v1";

export type MapUiPrefs = {
  /** When true, pan/zoom immediately refreshes results. */
  searchAsMove: boolean;
  /** Desktop: hide the results column for a full-bleed map. */
  listCollapsed: boolean;
  /** Desktop list width as a fraction of the row (0.28–0.5). */
  listWidthPct: number;
  basemap: BasemapId;
  pinMode: PinColorMode;
};

const DEFAULTS: MapUiPrefs = {
  searchAsMove: true,
  listCollapsed: false,
  listWidthPct: 0.4,
  basemap: "streets",
  pinMode: "status",
};

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota / private mode — ignore.
  }
}

function asBasemap(value: unknown): BasemapId {
  return value === "satellite" ? "satellite" : "streets";
}

function asPinMode(value: unknown): PinColorMode {
  if (value === "price" || value === "dom") return value;
  return "status";
}

export function readMapUiPrefs(): MapUiPrefs {
  const stored = readJson<Partial<MapUiPrefs>>(PREFS_KEY) ?? readJson<Partial<MapUiPrefs>>("ha_map_prefs_v1");
  if (!stored) return { ...DEFAULTS };
  return {
    searchAsMove: stored.searchAsMove ?? DEFAULTS.searchAsMove,
    listCollapsed: stored.listCollapsed ?? DEFAULTS.listCollapsed,
    listWidthPct: clampWidth(stored.listWidthPct ?? DEFAULTS.listWidthPct),
    basemap: asBasemap(stored.basemap),
    pinMode: asPinMode(stored.pinMode),
  };
}

export function writeMapUiPrefs(patch: Partial<MapUiPrefs>) {
  const next = { ...readMapUiPrefs(), ...patch };
  next.listWidthPct = clampWidth(next.listWidthPct);
  next.basemap = asBasemap(next.basemap);
  next.pinMode = asPinMode(next.pinMode);
  writeJson(PREFS_KEY, next);
  return next;
}

function clampWidth(value: number) {
  if (!Number.isFinite(value)) return DEFAULTS.listWidthPct;
  return Math.min(0.5, Math.max(0.28, value));
}

export function rememberMapViewport(viewport: MapViewport) {
  writeJson(VIEWPORT_KEY, viewport);
}

export function readMapViewport(): MapViewport | null {
  const stored = readJson<MapViewport>(VIEWPORT_KEY);
  if (!stored) return null;
  if (
    ![stored.latMin, stored.latMax, stored.lngMin, stored.lngMax, stored.zoom].every(
      (n) => typeof n === "number" && Number.isFinite(n),
    )
  ) {
    return null;
  }
  return stored;
}

/** Encode camera for shareable deep links (`lat` / `lng` / `z`). */
export function viewportToSearchParams(viewport: MapViewport): Record<string, string> {
  const lat = ((viewport.latMin + viewport.latMax) / 2).toFixed(5);
  const lng = ((viewport.lngMin + viewport.lngMax) / 2).toFixed(5);
  const z = String(Math.round(viewport.zoom));
  return { lat, lng, z };
}

export function parseViewportParams(
  params: URLSearchParams,
): { center: [number, number]; zoom: number } | null {
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const z = Number(params.get("z"));
  if (![lat, lng, z].every((n) => Number.isFinite(n))) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (z < 1 || z > 20) return null;
  return { center: [lat, lng], zoom: z };
}
