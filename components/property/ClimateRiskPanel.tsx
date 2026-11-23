"use client";

import { ClimateRisk } from "@/components/property/ClimateRisk";
import { getClimateRisk, type ClimateRiskPayload } from "@/lib/api/climate";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";

/**
 * Climate risk block — fetched in the browser via `/api/mls/…`.
 */
export function ClimateRiskPanel({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const { data: payload = null } = useMlsQuery<ClimateRiskPayload | null>(
    ["property", "climate-risk", latitude, longitude],
    () => getClimateRisk(latitude, longitude).catch(() => null),
    null,
  );
  if (!payload?.risks?.length) {
    return <ClimateRisk risks={[]} unavailable />;
  }
  return <ClimateRisk risks={payload.risks} source={payload.source} />;
}
