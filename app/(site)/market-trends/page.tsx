import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import {
  BoardSkeleton,
  HeaderKpis,
  KpiSkeleton,
  MarketBoard,
  type MarketFilters,
} from "@/components/market/MarketTrendsBoard";
import { PendingContent, PendingNavigationProvider } from "@/components/navigation/PendingNavigation";
import {
  getMarketCities,
  MARKET_CITIES,
  MARKET_RANGES,
  SOLD_PROPERTY_TYPES,
} from "@/lib/api/market";

export const metadata: Metadata = {
  title: "Market insights",
  description:
    "GTA market intelligence: median sold prices, days on market, sale-to-list ratios and community reports.",
  alternates: { canonical: "/market-trends" },
};

export const revalidate = 1800;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function selectionLabel(filters: MarketFilters) {
  return [
    filters.community ? `${filters.community}, ${filters.city}` : filters.city,
    SOLD_PROPERTY_TYPES.find((option) => option.key === filters.type)?.label,
    filters.range.label,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Market Insights shell: city options load on the server for the initial
 * select; KPI cards and board charts fetch in the browser via `/api/mls/…`.
 */
export default async function MarketTrendsPage({ searchParams }: PageProps<"/market-trends">) {
  const params = await searchParams;
  const marketCities = await getMarketCities();
  const requested = first(params.city)?.trim() ?? "";
  const city =
    marketCities.find((name) => name.toLowerCase() === requested.toLowerCase()) ??
    (requested.length >= 2 && requested.length <= 60 ? requested : null) ??
    marketCities[0] ??
    MARKET_CITIES[0];
  const filters: MarketFilters = {
    city,
    range: MARKET_RANGES.find((r) => r.key === first(params.range)) ?? MARKET_RANGES[0],
    type: SOLD_PROPERTY_TYPES.find((t) => t.key === first(params.type))?.key ?? null,
    community: first(params.community)?.trim().slice(0, 120) || null,
  };
  const scope = selectionLabel(filters);
  const filterKey = [
    filters.city,
    filters.range.key,
    filters.type ?? "",
    filters.community ?? "",
  ].join("|");

  return (
    <PendingNavigationProvider>
      <header className="bg-ink py-12">
        <div className="container-page">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-white/60 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Home
          </Link>
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="mb-2 text-[11px] font-semibold tracking-[2.5px] text-gold">
                GTA MARKET INTELLIGENCE
              </p>
              <h1 className="mb-3 text-[40px] font-semibold leading-none text-white sm:text-[56px]">
                Market Trends
              </h1>
              <p className="text-[15px] text-white/60">
                Real-time data and community insights for smarter decisions.
              </p>
              <p className="mt-3 text-[13px] font-medium text-white/80">{scope}</p>
            </div>
            <PendingContent fallback={<KpiSkeleton />}>
              <Suspense key={`kpi-${filterKey}`} fallback={<KpiSkeleton />}>
                <HeaderKpis filters={filters} />
              </Suspense>
            </PendingContent>
          </div>
        </div>
      </header>

      <div className="container-page space-y-8 py-12">
        <Suspense key={`board-${filterKey}`} fallback={<BoardSkeleton />}>
          <MarketBoard filters={filters} cities={marketCities} />
        </Suspense>
      </div>
    </PendingNavigationProvider>
  );
}
