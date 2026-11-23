"use client";

import { Suspense } from "react";
import { ChevronDown } from "lucide-react";
import {
  DaysOnMarketChart,
  PropertyTypeDistribution,
  SalesListingsChart,
} from "@/components/market/InsightCharts";
import { MarketFilterBar } from "@/components/market/MarketFilterBar";
import { TrendChart } from "@/components/market/TrendChart";
import { WatchAreaButton } from "@/components/market/WatchAreaButton";
import {
  PendingContent,
  PendingLink,
} from "@/components/navigation/PendingNavigation";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { cn } from "@/lib/utils/cn";
import {
  getBulkCatalogStats,
  getHomeTypeDistribution,
  getMarketTrends,
  getSoldTrends,
  MARKET_CITIES,
  MARKET_RANGES,
  SOLD_PROPERTY_TYPES,
  type MarketTrends,
  type SoldPropertyType,
  type SoldTrends,
} from "@/lib/api/market";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";
import type { CityCatalogStat } from "@/lib/types/domain";
import {
  EMPTY,
  formatDate,
  formatMonthLabel,
  formatNumber,
  formatPercent,
  formatPrice,
  formatPriceCompact,
} from "@/lib/utils/format";

export type MarketFilters = {
  city: string;
  range: (typeof MARKET_RANGES)[number];
  type: SoldPropertyType | null;
  community: string | null;
};

type Heat = "cool" | "warm" | "hot" | "very";

const HEAT_LABEL: Record<Heat, string> = {
  cool: "Cool",
  warm: "Warm",
  hot: "Hot",
  very: "Very hot",
};

const HEAT_CLASS: Record<Heat, string> = {
  cool: "bg-gold-soft text-ink",
  warm: "bg-navy-soft text-white",
  hot: "bg-navy text-white",
  very: "bg-gold text-ink",
};

/** One URL builder for every control, so filters carry over consistently. */
export function trendsHref(
  current: MarketFilters,
  next: Partial<{ city: string; range: string; type: string | null; community: string | null }>,
) {
  const query = new URLSearchParams();
  const city = next.city ?? current.city;
  query.set("city", city);
  const range = next.range ?? current.range.key;
  if (range !== MARKET_RANGES[0].key) query.set("range", range);
  const type = next.type === undefined ? current.type : next.type;
  if (type) query.set("type", type);
  const community =
    next.city && next.city !== current.city
      ? null
      : next.community === undefined
        ? current.community
        : next.community;
  if (community) query.set("community", community);
  return `/market-trends?${query}`;
}

type BoardPayload = {
  trends: MarketTrends | null;
  citySold: SoldTrends;
  viewSold: SoldTrends | null;
  cities: CityCatalogStat[];
};

const emptySold = (city: string, community: string | null): SoldTrends => ({
  city,
  windowMonths: 12,
  months: [],
  communities: [],
  community,
  unavailable: true,
  generatedAt: null,
  stale: false,
});

/**
 * Header KPI cards — sold trends fetched in the browser via `/api/mls/…`.
 */
export function HeaderKpis({ filters }: { filters: MarketFilters }) {
  const { data: sold } = useMlsQuery<SoldTrends>(
    ["market", "kpi", filters.city, filters.range.months, filters.community, filters.type],
    () =>
      getSoldTrends(filters.city, filters.range.months, {}, {
        community: filters.community || undefined,
        propertyType: (filters.type || undefined) as SoldPropertyType | undefined,
      }),
    emptySold(filters.city, filters.community),
  );

  const months = !sold || sold.unavailable
    ? []
    : monthsForPeriod(sold.months, filters.range.months);
  const latest = months.at(-1);
  const earliest = months[0];
  const priceChange =
    earliest?.medianSoldPrice && latest?.medianSoldPrice && months.length > 1
      ? ((latest.medianSoldPrice - earliest.medianSoldPrice) / earliest.medianSoldPrice) * 100
      : null;
  const domDelta =
    latest?.avgDaysOnMarket != null && earliest?.avgDaysOnMarket != null && months.length > 1
      ? Math.round(latest.avgDaysOnMarket - earliest.avgDaysOnMarket)
      : null;
  const ratio = latest?.saleToListRatio ?? null;
  const periodNote = periodSpanLabel(months) ?? `last ${filters.range.label}`;

  const cards = [
    {
      label: `Median price · ${filters.range.label}`,
      value: latest?.medianSoldPrice ? formatPriceCompact(latest.medianSoldPrice) : EMPTY,
      change: priceChange === null ? null : `${formatPercent(priceChange)} · ${periodNote}`,
      up: (priceChange ?? 0) >= 0,
    },
    {
      label: "Avg. days on market",
      value: latest?.avgDaysOnMarket == null ? EMPTY : `${Math.round(latest.avgDaysOnMarket)} days`,
      change: domDelta === null ? null : `${domDelta > 0 ? "↑" : "↓"}${Math.abs(domDelta)} days · ${periodNote}`,
      up: false,
    },
    {
      label: "Sale-to-list",
      value: ratio === null ? EMPTY : `${Math.round(ratio * 100)}%`,
      change: ratio === null ? null : ratio >= 1 ? "Sellers market" : "Buyers market",
      up: (ratio ?? 0) >= 1,
    },
  ];

  return (
    <dl className="flex flex-wrap gap-4">
      {cards.map((card) => (
        <div key={card.label} className="min-w-36 rounded-2xl bg-white/10 px-5 py-4">
          <dt className="mb-1 text-[11px] text-white/50">{card.label}</dt>
          <dd className="text-[22px] font-semibold text-white">{card.value}</dd>
          {card.change && (
            <dd className={cn("mt-0.5 text-[11px] font-medium", card.up ? "text-gold" : "text-white/50")}>
              {card.change}
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}

/**
 * Main market board — trends, sold, bulk catalog fetched in the browser.
 */
export function MarketBoard({
  filters,
  cities: cityOptions,
}: {
  filters: MarketFilters;
  cities: string[];
}) {
  const { city, range, type, community } = filters;
  const filtered = Boolean(type || community);
  const heatmapNames = (cityOptions.length > 0 ? cityOptions : [...MARKET_CITIES]).slice(0, 12);

  const { data, isPending } = useMlsQuery<BoardPayload>(
    ["market", "board", city, range.months, community, type, heatmapNames.join(",")],
    async () => {
      const [trends, citySold, viewSold, cities] = await Promise.all([
        getMarketTrends({ city }, range.months).catch(() => null),
        getSoldTrends(city, range.months, {}, {}),
        filtered
          ? getSoldTrends(city, range.months, {}, {
              community: community || undefined,
              propertyType: (type || undefined) as SoldPropertyType | undefined,
            })
          : Promise.resolve(null),
        getBulkCatalogStats({ cities: heatmapNames, includeSold: true }).catch(
          () => [] as CityCatalogStat[],
        ),
      ]);
      return { trends, citySold, viewSold, cities };
    },
    {
      trends: null,
      citySold: emptySold(city, null),
      viewSold: null,
      cities: [],
    },
  );

  if (isPending && !data) {
    return <BoardBodySkeleton />;
  }

  const trends = data?.trends ?? null;
  const citySold = data?.citySold ?? emptySold(city, null);
  const sold = data?.viewSold ?? citySold;
  const cities = data?.cities ?? [];
  const heatmapCities = buildHeatmapCities(heatmapNames, cities);

  if (!trends && sold.unavailable && cities.length === 0) {
    return <ErrorState description={`We couldn't load market data for ${city}.`} />;
  }

  const areaLabel = community ? `${community}, ${city}` : city;
  const typeLabel = SOLD_PROPERTY_TYPES.find((option) => option.key === type)?.label ?? null;
  const soldTitle = [community ?? city, typeLabel].filter(Boolean).join(" · ");

  const communities =
    community && !citySold.communities.some((row) => row.name === community)
      ? [{ name: community, unitsSold: 0 }, ...citySold.communities]
      : citySold.communities;

  const hrefFor: Record<string, string> = {};
  for (const option of cityOptions) hrefFor[`city:${option}`] = trendsHref(filters, { city: option });
  if (!hrefFor[`city:${city}`]) hrefFor[`city:${city}`] = trendsHref(filters, { city });
  hrefFor["community:"] = trendsHref(filters, { community: null });
  for (const option of communities) {
    hrefFor[`community:${option.name}`] = trendsHref(filters, { community: option.name });
  }
  if (community) hrefFor[`community:${community}`] ??= trendsHref(filters, { community });
  hrefFor["type:"] = trendsHref(filters, { type: null });
  for (const option of SOLD_PROPERTY_TYPES) {
    hrefFor[`type:${option.key}`] = trendsHref(filters, { type: option.key });
  }
  for (const option of MARKET_RANGES) {
    hrefFor[`range:${option.key}`] = trendsHref(filters, { range: option.key });
  }

  const soldMonths = sold.unavailable ? [] : monthsForPeriod(sold.months, range.months);
  const compareRows = comparisonRows(
    trends?.series ?? [],
    sold.unavailable ? [] : monthsForPeriod(sold.months, range.months, false),
    trends?.activeCurrent ?? null,
  );
  const domRows = soldMonths
    .filter((month): month is typeof month & { avgDaysOnMarket: number } => month.avgDaysOnMarket !== null)
    .map((month) => ({ month: month.month, days: month.avgDaysOnMarket }));
  const reports = [...citySold.communities].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 6);
  const periodSpan = periodSpanLabel(soldMonths);

  return (
    <div className="space-y-8">
      <MarketFilterBar
        city={city}
        cities={cityOptions}
        community={community}
        type={type}
        rangeKey={range.key}
        communities={communities}
        hrefFor={hrefFor}
      />

      <PendingContent fallback={<BoardBodySkeleton />}>
        <div className="space-y-8">
          <Heatmap cities={heatmapCities} selected={city} filters={filters} />

          <div id="market-selected" className="scroll-mt-48 space-y-6 lg:scroll-mt-52">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[1.6px] text-ink-muted">
                  Selected market
                </p>
                <h2 className="mt-1 text-[22px] font-semibold text-ink">{soldTitle}</h2>
              </div>
              <p className="text-[13px] text-ink-muted">
                Last {range.label}
                {periodSpan ? ` · ${periodSpan}` : ""}
              </p>
            </div>

            <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
              <div className="mb-3 sm:mb-4">
                <h3 className="text-[16px] font-semibold text-ink sm:text-[18px]">Median price</h3>
                <p className="mt-0.5 text-[12px] text-ink-muted sm:text-[13px]">
                  Sold price with DOM
                  {soldMonths.some((m) => m.avgPropertyDaysOnMarket != null) ? " & PDOM" : ""} ·{" "}
                  {range.label}
                  {periodSpan ? ` · ${periodSpan}` : ""}
                  {sold.generatedAt ? ` · as of ${formatDate(sold.generatedAt)}` : ""}
                  {sold.stale ? " · may be a few hours old" : ""}
                </p>
                <p className="mt-1 hidden text-[11px] text-ink-subtle sm:block">
                  Property Days on Market does not reset when a home is delisted and quickly re-listed.
                </p>
              </div>

              {sold.unavailable ? (
                <p className="text-small text-ink-muted">
                  Sold-transaction data is temporarily unavailable. Median price, days on market and
                  sale-to-list will appear here once the sold feed is back.
                </p>
              ) : soldMonths.length === 0 ? (
                <p className="text-small text-ink-muted">
                  No closed sales were recorded for {soldTitle} in the last {range.label}.
                </p>
              ) : (
                <>
                  <TrendChart
                    key={`median-${range.key}-${soldMonths.length}-${soldMonths[0]?.month}-${soldMonths.at(-1)?.month}`}
                    label="Median price"
                    detailLabel="Units sold"
                    dots="none"
                    series={soldMonths.map((month) => ({
                      month: month.month,
                      value: month.medianSoldPrice,
                      daysOnMarket: month.avgDaysOnMarket,
                      propertyDaysOnMarket:
                        month.avgPropertyDaysOnMarket ?? month.avgDaysOnMarket,
                      detail: month.unitsSold,
                    }))}
                  />
                  <details className="group mt-6" key={`monthly-${range.key}-${soldMonths.length}`}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-control border border-navy/25 bg-navy-tint px-4 py-3 text-small font-semibold text-navy transition-colors hover:border-navy hover:bg-navy/5 [&::-webkit-details-marker]:hidden">
                      <span>
                        Monthly figures · {range.label}
                        {periodSpan ? ` · ${periodSpan}` : ""}
                      </span>
                      <ChevronDown
                        className="size-4 shrink-0 text-navy transition-transform duration-200 group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
                    <MonthlyTable title={soldTitle} rows={[...soldMonths].reverse()} />
                  </details>
                  <p className="mt-4 text-[12px] text-ink-muted">
                    Source: TRREB closed transactions. Figures cover sales reported to the board and may
                    be revised.
                  </p>
                </>
              )}
            </section>

            <div className="grid gap-6 sm:grid-cols-2">
              <section className="rounded-2xl border border-line bg-surface p-6">
                <h3 className="text-[16px] font-semibold text-ink">Sold, Active and New Listing</h3>
                <p className="mb-4 mt-1 text-[13px] text-ink-muted">
                  Closed sales, active inventory and new listings in {city} · {range.label}
                  {periodSpan ? ` (${periodSpan})` : ""}.
                </p>
                <SalesListingsChart
                  key={`sales-${range.key}-${compareRows.length}`}
                  rows={compareRows}
                />
              </section>
              <section className="rounded-2xl border border-line bg-surface p-6">
                <h3 className="text-[16px] font-semibold text-ink">Avg. days on market</h3>
                <p className="mb-4 mt-1 text-[13px] text-ink-muted">
                  How long homes in this selection took to sell · {range.label}
                  {periodSpan ? ` (${periodSpan})` : ""}.
                </p>
                <DaysOnMarketChart key={`dom-${range.key}-${domRows.length}`} rows={domRows} />
              </section>
            </div>
          </div>

          <Suspense fallback={<Skeleton className="h-72" />}>
            <HomeTypeSection city={city} community={community} />
          </Suspense>

          {reports.length > 0 && (
            <section className="rounded-2xl border border-line bg-surface p-6">
              <h2 className="text-[18px] font-semibold text-ink">Community reports · {city}</h2>
              <p className="mb-5 mt-1 text-[13px] text-ink-muted">
                Neighbourhoods with the most closed sales in this window.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {reports.map((row) => (
                  <PendingLink
                    key={row.name}
                    href={trendsHref(filters, { community: row.name })}
                    scroll={false}
                    className={cn(
                      "group rounded-xl border p-4 text-left transition-colors hover:border-navy",
                      row.name === community ? "border-navy" : "border-line",
                    )}
                  >
                    <span className="text-[15px] font-semibold text-ink">{row.name}</span>
                    <span className="mt-2 block text-[22px] font-semibold text-navy">
                      {formatNumber(row.unitsSold)}
                    </span>
                    <span className="mt-1 block text-[12px] text-ink-muted">closed sales</span>
                    <span className="mt-2 block text-[12px] font-medium text-navy group-hover:underline">
                      View sold data →
                    </span>
                  </PendingLink>
                ))}
              </div>
            </section>
          )}

          <WatchAreaButton label={areaLabel} />

          {trends?.disclaimer && (
            <section className="rounded-2xl border border-gold/30 bg-gold-soft p-5">
              <h2 className="text-[16px] font-semibold text-ink">About this data</h2>
              <p className="mt-2 text-small text-ink-soft">{trends.disclaimer}</p>
            </section>
          )}
        </div>
      </PendingContent>
    </div>
  );
}

function HomeTypeSection({
  city,
  community,
}: {
  city: string;
  community: string | null;
}) {
  const { data: homeTypes = [] } = useMlsQuery<Array<{ name: string; count: number }>>(
    ["market", "home-types", city, community],
    () =>
      getHomeTypeDistribution(city, { community }).catch(
        () => [] as Array<{ name: string; count: number }>,
      ),
    [],
  );
  if (homeTypes.length === 0) return null;

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="mb-1 text-[18px] font-semibold text-ink">Property type distribution</h2>
      <p className="mb-5 text-[13px] text-ink-muted">
        Active listings in {community ? `${community}, ${city}` : city} by home type —
        Detached, Semi-detached, Freehold townhouse, Condo townhouse, Condo apartment and Other.
      </p>
      <PropertyTypeDistribution rows={homeTypes} />
    </section>
  );
}

type HeatmapCity = {
  city: string;
  activeCount: number;
  medianPrice: number | null;
  soldCountYtd: number | null;
};

function buildHeatmapCities(cityNames: string[], catalog: CityCatalogStat[]): HeatmapCity[] {
  const byCity = new Map(catalog.map((row) => [row.city.toLowerCase(), row] as const));

  return cityNames.map((name) => {
    const row = byCity.get(name.toLowerCase());
    return {
      city: name,
      activeCount: row?.activeCount ?? 0,
      medianPrice: row?.medianSoldPrice90d ?? row?.medianListPrice ?? null,
      soldCountYtd: row?.soldCount90d ?? null,
    };
  });
}

function Heatmap({
  cities,
  selected,
  filters,
}: {
  cities: HeatmapCity[];
  selected: string;
  filters: MarketFilters;
}) {
  if (cities.length === 0) return null;

  const scored = cities.map((row) => ({
    row,
    absorption:
      row.soldCountYtd !== null && row.activeCount > 0 ? row.soldCountYtd / row.activeCount : null,
  }));
  const values = scored
    .map((entry) => entry.absorption)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  const showHeat = values.length >= 2;

  function band(absorption: number | null): Heat {
    if (!showHeat || absorption === null) return "cool";
    const rank = values.filter((value) => value <= absorption).length / values.length;
    if (rank > 0.75) return "very";
    if (rank > 0.5) return "hot";
    if (rank > 0.25) return "warm";
    return "cool";
  }

  return (
    <section
      id="market-heatmap"
      className="scroll-mt-48 rounded-2xl border border-line bg-surface p-6 lg:scroll-mt-52"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[22px] font-semibold text-ink">GTA market heatmap</h2>
        {showHeat && (
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-muted">
            <span className="inline-block h-3 w-3 rounded-full bg-gold-soft ring-1 ring-line" /> Cool
            <span className="ml-1 inline-block h-3 w-3 rounded-full bg-navy-soft" /> Warm
            <span className="ml-1 inline-block h-3 w-3 rounded-full bg-navy" /> Hot
            <span className="ml-1 inline-block h-3 w-3 rounded-full bg-gold" /> Very hot
          </div>
        )}
      </div>
      <p className="mb-5 text-[13px] text-ink-muted">
        {showHeat
          ? "Median sold price (last 90 days). Colour is how many homes sold in that window compared with what is listed."
          : "Median price from recent sales. Sold totals are unavailable, so there is no heat reading."}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {scored.map(({ row, absorption }) => {
          const heat = band(absorption);
          return (
            <PendingLink
              key={row.city}
              href={trendsHref(filters, { city: row.city })}
              scroll={false}
              className={cn(
                "flex flex-col gap-1 rounded-xl p-4 transition-transform hover:scale-105",
                HEAT_CLASS[heat],
                row.city === selected && "ring-2 ring-ink ring-offset-2",
              )}
            >
              <span className="text-[13px] font-bold">{row.city}</span>
              <span className="text-[12px] font-medium opacity-90">
                {row.medianPrice ? formatPriceCompact(row.medianPrice) : EMPTY}
                <span className="font-normal"> median price</span>
              </span>
              <span className="text-[11px] opacity-80">
                {row.soldCountYtd === null
                  ? `${formatNumber(row.activeCount)} listed`
                  : `${formatNumber(row.soldCountYtd)} sales · 90d`}
              </span>
              {showHeat && (
                <span
                  className={cn(
                    "mt-1 rounded-full px-2 py-0.5 text-center text-[10px] font-semibold",
                    heat === "cool" || heat === "very" ? "bg-ink/10" : "bg-white/30",
                  )}
                >
                  {HEAT_LABEL[heat]}
                </span>
              )}
            </PendingLink>
          );
        })}
      </div>
    </section>
  );
}

function monthKey(value: string) {
  return value.slice(0, 7);
}

function monthsForPeriod(
  months: SoldTrends["months"],
  rangeMonths: number,
  requireSales = true,
): SoldTrends["months"] {
  const sorted = [...months].sort((a, b) => monthKey(a.month).localeCompare(monthKey(b.month)));
  const scoped = requireSales ? sorted.filter((month) => month.unitsSold > 0) : sorted;
  return scoped.slice(-rangeMonths);
}

function periodSpanLabel(months: SoldTrends["months"]): string | null {
  if (months.length === 0) return null;
  const firstLabel = formatMonthLabel(months[0]?.month);
  const lastLabel = formatMonthLabel(months.at(-1)?.month);
  if (!firstLabel || firstLabel === EMPTY || !lastLabel || lastLabel === EMPTY) return null;
  return firstLabel === lastLabel ? firstLabel : `${firstLabel} – ${lastLabel}`;
}

function comparisonRows(
  series: Array<{ month: string; newListings: number }>,
  sold: SoldTrends["months"],
  activeCurrent: number | null,
) {
  const rows = new Map<
    string,
    { month: string; sold: number; active: number; newListings: number }
  >();
  for (const point of series) {
    rows.set(point.month.slice(0, 7), {
      month: point.month,
      sold: 0,
      active: 0,
      newListings: point.newListings,
    });
  }
  for (const month of sold) {
    const key = month.month.slice(0, 7);
    const current = rows.get(key) ?? {
      month: month.month,
      sold: 0,
      active: 0,
      newListings: 0,
    };
    current.sold = month.unitsSold;
    rows.set(key, current);
  }
  const ordered = [...rows.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, row]) => row);
  if (ordered.length === 0) return ordered;

  if (activeCurrent != null && activeCurrent > 0) {
    ordered[ordered.length - 1]!.active = Math.round(activeCurrent);
    for (let i = ordered.length - 1; i >= 1; i--) {
      const newer = ordered[i]!;
      const older = ordered[i - 1]!;
      older.active = Math.max(0, Math.round(newer.active - newer.newListings + newer.sold));
    }
  }
  return ordered;
}

function MonthlyTable({
  title,
  rows,
}: {
  title: string;
  rows: SoldTrends["months"];
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-small">
        <caption className="sr-only">Monthly closed-sale statistics for {title}</caption>
        <thead>
          <tr className="border-b border-line text-left text-[12px] text-ink-muted">
            <th scope="col" className="py-2 pr-4 font-medium">
              Month
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Median price
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Days on market
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              PDOM
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Sale-to-list
            </th>
            <th scope="col" className="py-2 font-medium">
              Units sold
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const pdom = row.avgPropertyDaysOnMarket ?? row.avgDaysOnMarket;
            return (
              <tr key={row.month} className="border-b border-line/60 last:border-0">
                <th scope="row" className="py-2 pr-4 font-normal text-ink">
                  {formatMonthLabel(row.month)}
                </th>
                <td className="py-2 pr-4 text-ink">
                  {row.medianSoldPrice ? formatPrice(row.medianSoldPrice) : EMPTY}
                </td>
                <td className="py-2 pr-4 text-ink-soft">
                  {row.avgDaysOnMarket === null ? EMPTY : Math.round(row.avgDaysOnMarket)}
                </td>
                <td className="py-2 pr-4 text-ink-soft">
                  {pdom === null ? EMPTY : Math.round(pdom)}
                </td>
                <td className="py-2 pr-4 text-ink-soft">
                  {row.saleToListRatio === null
                    ? EMPTY
                    : `${(row.saleToListRatio * 100).toFixed(1)}%`}
                </td>
                <td className="py-2 text-ink-soft">{formatNumber(row.unitsSold)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="flex gap-4" role="status" aria-label="Loading market summary">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-[92px] w-36 bg-white/10" />
      ))}
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div className="space-y-8" role="status" aria-label="Loading market data">
      <Skeleton className="h-[5.5rem] sm:h-[6.5rem]" />
      <BoardBodySkeleton />
    </div>
  );
}

function BoardBodySkeleton() {
  return (
    <div className="space-y-8" role="status" aria-label="Loading market data">
      <Skeleton className="h-64" />
      <Skeleton className="h-80" />
      <div className="grid gap-6 sm:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
