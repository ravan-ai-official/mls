import { PreconCard } from "@/components/precon/PreconCard";
import { Section } from "@/components/ui/Section";
import { safeFetch } from "@/lib/api/client";
import {
  buildPreconDealsHref,
  getPreconProjects,
  type PreconDealsQuery,
} from "@/lib/api/preconstruction";
import { schoolSearchHistoryCities } from "@/lib/api/schools";
import { getVisitorPersonalization } from "@/lib/personalize/visitorContext";
import { textOf } from "@/lib/site/read";

const PRECON_DEALS_LIMIT = 8;

/**
 * Pre-construction deals rail.
 *
 * GET /api/mls/precon-properties/?ordering=featured&exclude_stage=sold_out&page_size=8
 * With last-search history: cities (+ beds/baths/price when remembered).
 * Without history: no city/IP/search params — pinned then newest in API order.
 */
export async function NewPrecon({ content }: { content?: Record<string, unknown> }) {
  const visitor = await getVisitorPersonalization();
  const historyCities = schoolSearchHistoryCities(
    visitor.searchHistoryCities,
    visitor.lastSearch.city,
  );
  const last = visitor.lastSearch;
  const hasHistory =
    historyCities.length > 0 ||
    Boolean(last.bedsMin || last.bathsMin || last.priceMin || last.priceMax);

  const deals: PreconDealsQuery = hasHistory
    ? {
        cities: historyCities.length > 0 ? historyCities : undefined,
        bedsMin: last.bedsMin,
        bathsMin: last.bathsMin,
        priceMin: last.priceMin,
        priceMax: last.priceMax,
      }
    : {};

  const feed = await safeFetch(
    getPreconProjects({
      limit: PRECON_DEALS_LIMIT,
      deals,
      cache: "no-store",
    }),
    { items: [], total: 0, hasSearchHistory: false, cities: [] },
    "home:precon-deals",
  );
  if (feed.items.length === 0) return null;

  const viewAllHref = buildPreconDealsHref(deals);
  const citiesLabel = (feed.cities.length > 0 ? feed.cities : historyCities).join(", ");
  const description =
    feed.hasSearchHistory && citiesLabel
      ? `Featured projects matching your search in ${citiesLabel}.`
      : feed.hasSearchHistory
        ? "Featured projects matching what you’ve been searching for."
        : undefined;

  return (
    <Section
      eyebrow={textOf(content, "eyebrow", "Invest ahead")}
      title={textOf(content, "title", "Pre-construction deals")}
      description={description}
      action={{
        label: "View all",
        href: viewAllHref,
      }}
    >
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {feed.items.slice(0, PRECON_DEALS_LIMIT).map((project) => (
          <li key={project.id} className="h-full">
            <PreconCard project={project} headingLevel="h3" />
          </li>
        ))}
      </ul>
    </Section>
  );
}
