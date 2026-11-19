/**
 * Property climate hazard projections (heat / precip / flood) for ~2050.
 * Backed by mls-v2 → Open-Meteo CMIP6 models for the listing coordinate.
 */

import { apiFetch, type RequestOptions } from "@/lib/api/client";

const MLS = "/api/mls";

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

export async function getClimateRisk(
  latitude: number,
  longitude: number,
  options: RequestOptions = {},
): Promise<ClimateRiskPayload> {
  const data = await apiFetch<BackendClimateRisk>(`${MLS}/climate-risk/`, {
    revalidate: 60 * 60 * 24,
    timeoutMs: 35_000,
    ...options,
    params: { lat: latitude, lng: longitude, ...options.params },
  });

  const risks = (data.risks ?? [])
    .filter((row): row is { risk: string; level: string; desc: string } =>
      Boolean(row.risk && row.level && row.desc),
    )
    .map((row) => ({
      risk: row.risk,
      level: asLevel(row.level),
      desc: row.desc,
    }));

  return {
    latitude: data.latitude ?? latitude,
    longitude: data.longitude ?? longitude,
    elevationM: data.elevation_m ?? null,
    horizon: data.horizon ?? "2050",
    model: data.model ?? "",
    risks,
    source: data.source ?? "Open-Meteo CMIP6 climate projections",
  };
}
