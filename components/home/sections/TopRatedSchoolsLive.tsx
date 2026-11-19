import { TopRatedSchools } from "@/components/home/sections/TopRatedSchools";
import { getTopSchools } from "@/lib/api/schools";
import { getVisitorPersonalization } from "@/lib/personalize/visitorContext";

function adminSchoolNames(content?: Record<string, unknown>): string[] {
  const items = content?.items;
  if (!Array.isArray(items)) return [];
  const names: string[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const name = typeof (item as { name?: unknown }).name === "string"
      ? (item as { name: string }).name.trim()
      : "";
    if (name) names.push(name.slice(0, 80));
    if (names.length >= 4) break;
  }
  return names;
}

/**
 * Public homepage schools rail.
 * Admin CMS school names (when they match the Ministry file) lead; remaining
 * slots follow search-history / IP cities, then the GTA EQAO ranking.
 */
export async function TopRatedSchoolsLive({ content }: { content?: Record<string, unknown> }) {
  const visitor = await getVisitorPersonalization();
  const names = adminSchoolNames(content);
  const schools = await getTopSchools({
    limit: 4,
    cities: visitor.cities,
    names,
    headers: visitor.headers,
    cache: "no-store",
  }).catch(() => []);
  return <TopRatedSchools content={content} schools={schools} />;
}
