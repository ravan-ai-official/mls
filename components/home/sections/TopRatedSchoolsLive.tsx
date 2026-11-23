import { TopRatedSchools } from "@/components/home/sections/TopRatedSchools";
import { getTopSchools, schoolSearchHistoryCities } from "@/lib/api/schools";
import { getVisitorPersonalization } from "@/lib/personalize/visitorContext";

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

/**
 * Homepage GTA Secondary Schools rail → GET /api/mls/schools/top/?limit=4
 * Appends cities= only when search history exists (never IP city).
 */
export async function TopRatedSchoolsLive({ content }: { content?: Record<string, unknown> }) {
  const visitor = await getVisitorPersonalization();
  const historyCities = schoolSearchHistoryCities(
    visitor.searchHistoryCities,
    visitor.lastSearch.city,
  );
  const names = adminSchoolNames(content);
  const schools = await getTopSchools({
    limit: 4,
    cities: historyCities.length > 0 ? historyCities : undefined,
    names: names.length > 0 ? names : undefined,
    cache: "no-store",
  }).catch(() => []);
  return <TopRatedSchools content={content} schools={schools} />;
}
