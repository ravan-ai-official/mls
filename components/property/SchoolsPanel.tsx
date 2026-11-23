"use client";

import { SchoolsSection } from "@/components/property/Neighbourhood";
import { getSchoolsNear, type OfficialSchool } from "@/lib/api/schools";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";

/**
 * Schools tab — nearby schools fetched in the browser via `/api/mls/…`.
 */
export function SchoolsPanel({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const { data: schools = [] } = useMlsQuery<OfficialSchool[]>(
    ["property", "schools", latitude, longitude],
    () =>
      getSchoolsNear(latitude, longitude, { radiusKm: 8 }).catch(
        () => [] as OfficialSchool[],
      ),
    [],
  );
  return <SchoolsSection schools={schools} />;
}
