"use client";

import { PreconCard } from "@/components/precon/PreconCard";
import { Section } from "@/components/ui/Section";
import {
  buildPreconDealsHref,
  getPreconDeals,
  type PreconDealsQuery,
  type PreconProject,
} from "@/lib/api/preconstruction";
import { schoolSearchHistoryCities } from "@/lib/api/schools";
import { readClientVisitor } from "@/lib/personalize/clientVisitor";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";
import { textOf } from "@/lib/site/read";

const PRECON_DEALS_LIMIT = 8;

type PreconPayload = {
  items: PreconProject[];
  description?: string;
  viewAllHref: string;
};

/**
 * Homepage Pre-construction deals rail.
 * Live staged feed: GET /api/mls/precon-properties/deals/ (pins → history/IP → newest).
 * Never invents IP city — only forwards real search-history filters.
 */
export function NewPrecon({ content }: { content?: Record<string, unknown> }) {
  const { data, isPending } = useMlsQuery<PreconPayload | null>(
    ["home", "precon-deals"],
    async () => {
      const visitor = readClientVisitor();
      const historyCities = schoolSearchHistoryCities(
        visitor.searchHistoryCities,
        visitor.lastSearch.city,
      );
      const last = visitor.lastSearch;
      const hasHistory =
        historyCities.length > 0 ||
        Boolean(last.bedsMin || last.bathsMin || last.priceMin || last.priceMax);

      // History filters only. No history → call with limit/fill so backend can IP-fill.
      const deals: PreconDealsQuery = hasHistory
        ? {
            cities: historyCities.length > 0 ? historyCities : undefined,
            bedsMin: last.bedsMin,
            bathsMin: last.bathsMin,
            priceMin: last.priceMin,
            priceMax: last.priceMax,
          }
        : {};

      const feed = await getPreconDeals({
        limit: PRECON_DEALS_LIMIT,
        fill: true,
        deals: hasHistory ? deals : undefined,
        cache: "no-store",
      }).catch(() => null);

      if (!feed || feed.items.length === 0) return null;

      const citiesLabel = (feed.cities.length > 0 ? feed.cities : historyCities).join(", ");
      const description =
        feed.hasSearchHistory && citiesLabel
          ? `Featured projects matching your search in ${citiesLabel}.`
          : feed.hasSearchHistory
            ? "Featured projects matching what you’ve been searching for."
            : undefined;

      return {
        items: feed.items,
        description,
        viewAllHref: buildPreconDealsHref(deals),
      };
    },
    null,
  );

  if (isPending && data === undefined) return null;
  if (!data || data.items.length === 0) return null;

  return (
    <Section
      eyebrow={textOf(content, "eyebrow", "Invest ahead")}
      title={textOf(content, "title", "Pre-construction deals")}
      description={data.description}
      action={{
        label: "View all",
        href: data.viewAllHref,
      }}
    >
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {data.items.slice(0, PRECON_DEALS_LIMIT).map((project) => (
          <li key={project.id} className="h-full">
            <PreconCard project={project} headingLevel="h3" />
          </li>
        ))}
      </ul>
    </Section>
  );
}
