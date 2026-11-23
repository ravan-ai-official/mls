"use client";

import { TopRatedSchools } from "@/components/home/sections/TopRatedSchools";
import { getTopSchools, schoolSearchHistoryCities, type OfficialSchool } from "@/lib/api/schools";
import { readClientVisitor } from "@/lib/personalize/clientVisitor";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";

function adminSchoolNames(content?: Record<string, unknown>): string[] {
  const items = content?.items;
  if (!Array.isArray(items)) return [];
  const names: string[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const name =
      typeof (item as { name?: unknown }).name === "string"
        ? (item as { name: string }).name.trim()
        : "";
    if (name) names.push(name.slice(0, 80));
    if (names.length >= 4) break;
  }
  return names;
}

export function TopRatedSchoolsLive({ content }: { content?: Record<string, unknown> }) {
  const { data: schools = [] } = useMlsQuery<OfficialSchool[]>(
    ["home", "top-schools", adminSchoolNames(content).join("|")],
    async () => {
      const visitor = readClientVisitor();
      const historyCities = schoolSearchHistoryCities(
        visitor.searchHistoryCities,
        visitor.lastSearch.city,
      );
      const names = adminSchoolNames(content);
      return getTopSchools({
        limit: 4,
        cities: historyCities.length > 0 ? historyCities : undefined,
        names: names.length > 0 ? names : undefined,
        cache: "no-store",
      }).catch(() => [] as OfficialSchool[]);
    },
    [],
  );

  return <TopRatedSchools content={content} schools={schools} />;
}
