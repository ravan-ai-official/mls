import type { Metadata } from "next";
import Link from "next/link";
import { cache, Suspense } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { DaysOnMarketChart, PropertyTypeDistribution, SalesListingsChart } from "@/components/market/InsightCharts";
import { MarketFilterBar } from "@/components/market/MarketFilterBar";
import { TrendChart } from "@/components/market/TrendChart";
import { WatchAreaButton } from "@/components/market/WatchAreaButton";
import { PendingContent, PendingLink, PendingNavigationProvider } from "@/components/navigation/PendingNavigation";
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
  type SoldPropertyType,
  type SoldTrends,
} from "@/lib/api/market";
import type { CityCatalogStat } from "@/lib/types/domain";
import { EMPTY, formatDate, formatMonthLabel, formatNumber, formatPercent, formatPrice, formatPriceCompact } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "Market insights",
  description:
    "GTA market intelligence: median sold prices, days on market, sale-to-list ratios and community reports.",
  alternates: { canonical: "/market-trends" },
};

export const revalidate = 1800;

type Filters = {
  city: (typeof MARKET_CITIES)[number];
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

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** One URL builder for every control, so filters carry over consistently. */
function trendsHref(current: Filters, next: Partial<{ city: string; range: string; type: string | null; community: string | null }>) {
  const query = new URLSearchParams();
  const city = next.city ?? current.city;
  query.set("city", city);
  const range = next.range ?? current.range.key;
  if (range !== MARKET_RANGES[0].key) query.set("range", range);
  const type = next.type === undefined ? current.type : next.type;
  if (type) query.set("type", type);
  // A community belongs to one city: changing city drops it.
  const community = next.city && next.city !== current.city ? null : next.community === undefined ? current.community : next.community;
  if (community) query.set("community", community);
  return `/market-trends?${query}`;
}

const loadSold = cache((city: string, months: number, community: string, type: string) =>
  getSoldTrends(city, months, {}, {
    community: community || undefined,
    propertyType: (type || undefined) as SoldPropertyType | undefined,
  }),
);

const loadTrends = cache((city: string, months: number) =>
  getMarketTrends({ city }, months).catch(() => null),
);

/**
 * Market Insights: dark summary, sticky filter bar (city → community →
 * property type → period), then heatmap, sold-price chart, activity charts,
 * property-type distribution and community reports. Figures are live.
 */
export default async function MarketTrendsPage({ searchParams }: PageProps<"/market-trends">) {
  const params = await searchParams;
  const filters: Filters = {
    city: MARKET_CITIES.find((c) => c.toLowerCase() === first(params.city)?.toLowerCase()) ?? MARKET_CITIES[0],
    range: MARKET_RANGES.find((r) => r.key === first(params.range)) ?? MARKET_RANGES[0],
    type: SOLD_PROPERTY_TYPES.find((t) => t.key === first(params.type))?.key ?? null,
    community: first(params.community)?.trim().slice(0, 120) || null,
  };
  const scope = selectionLabel(filters);
  // Soft navigations that only change searchParams reuse Suspense slots unless
  // the key changes — without this, Period (and other filters) kept old charts.
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
          <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-white/60 transition-colors hover:text-white">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Home
          </Link>
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="mb-2 text-[11px] font-semibold tracking-[2.5px] text-gold">GTA MARKET INTELLIGENCE</p>
              <h1 className="mb-3 text-[40px] font-semibold leading-none text-white sm:text-[56px]">Market Trends</h1>
              <p className="text-[15px] text-white/60">Real-time data and community insights for smarter decisions.</p>
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
          <MarketBoard filters={filters} />
        </Suspense>
      </div>
    </PendingNavigationProvider>
  );
}

async function HeaderKpis({ filters }: { filters: Filters }) {
  const sold = await loadSold(filters.city, filters.range.months, filters.community ?? "", filters.type ?? "");
  const months = sold.unavailable
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
            <dd className={cn("mt-0.5 text-[11px] font-medium", card.up ? "text-gold" : "text-white/50")}>{card.change}</dd>
          )}
        </div>
      ))}
    </dl>
  );
}

async function MarketBoard({ filters }: { filters: Filters }) {
  const { city, range, type, community } = filters;
  const filtered = Boolean(type || community);
  // 12m covers Jan→now for the YTD heatmap; selected-city charts still use `range`.
  const [trends, citySold, viewSold, cities, heatmapSold, homeTypes] = await Promise.all([
    loadTrends(city, range.months),
    loadSold(city, range.months, "", ""),
    filtered ? loadSold(city, range.months, community ?? "", type ?? "") : Promise.resolve(null),
    getBulkCatalogStats({ cities: [...MARKET_CITIES] }).catch(() => [] as CityCatalogStat[]),
    Promise.all(MARKET_CITIES.map((name) => loadSold(name, 12, "", ""))),
    getHomeTypeDistribution(city).catch(() => [] as Array<{ name: string; count: number }>),
  ]);
  const sold = viewSold ?? citySold;
  const heatmapCities = buildHeatmapCities(cities, heatmapSold);

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
  for (const option of MARKET_CITIES) hrefFor[`city:${option}`] = trendsHref(filters, { city: option });
  hrefFor["community:"] = trendsHref(filters, { community: null });
  for (const option of communities) hrefFor[`community:${option.name}`] = trendsHref(filters, { community: option.name });
  if (community) hrefFor[`community:${community}`] ??= trendsHref(filters, { community });
  hrefFor["type:"] = trendsHref(filters, { type: null });
  for (const option of SOLD_PROPERTY_TYPES) hrefFor[`type:${option.key}`] = trendsHref(filters, { type: option.key });
  for (const option of MARKET_RANGES) hrefFor[`range:${option.key}`] = trendsHref(filters, { range: option.key });

  const soldMonths = sold.unavailable ? [] : monthsForPeriod(sold.months, range.months);
  const compareRows = comparisonRows(
    trends?.series ?? [],
    sold.unavailable ? [] : monthsForPeriod(sold.months, range.months, false),
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
              <p className="text-[11px] font-semibold uppercase tracking-[1.6px] text-ink-muted">Selected market</p>
              <h2 className="mt-1 text-[22px] font-semibold text-ink">{soldTitle}</h2>
            </div>
            <p className="text-[13px] text-ink-muted">
              Last {range.label}
              {periodSpan ? ` · ${periodSpan}` : ""}
            </p>
          </div>

          <section className="rounded-2xl border border-line bg-surface p-6">
            <div className="mb-6">
              <h3 className="text-[20px] font-semibold text-ink">Median price</h3>
              <p className="mt-1 text-[13px] text-ink-muted">
                Closed transactions with days on market · {range.label}
                {periodSpan ? ` (${periodSpan})` : ` · last ${range.months} months`}
                {sold.generatedAt ? ` · as of ${formatDate(sold.generatedAt)}` : ""}
                {sold.stale ? " · these may be a few hours old" : ""}
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
                  secondaryLabel="Days on market"
                  detailLabel="Units sold"
                  dots="none"
                  series={soldMonths.map((month) => ({
                    month: month.month,
                    value: month.medianSoldPrice,
                    secondary: month.avgDaysOnMarket,
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
                  Source: TRREB closed transactions. Figures cover sales reported to the board and may be revised.
                </p>
              </>
            )}
          </section>

          <div className="grid gap-6 sm:grid-cols-2">
            <section className="rounded-2xl border border-line bg-surface p-6">
              <h3 className="text-[16px] font-semibold text-ink">Sales vs. new listings</h3>
              <p className="mb-4 mt-1 text-[13px] text-ink-muted">
                Closed sales beside new listings in {city} · {range.label}
                {periodSpan ? ` (${periodSpan})` : ""}.
              </p>
              <SalesListingsChart key={`sales-${range.key}-${compareRows.length}`} rows={compareRows} />
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

        {homeTypes.length > 0 && (
          <section className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="mb-1 text-[18px] font-semibold text-ink">Property type distribution</h2>
            <p className="mb-5 text-[13px] text-ink-muted">
              Active listings in {city} by home type — Detached, Semi-Detached, Townhome and Condo.
            </p>
            <PropertyTypeDistribution rows={homeTypes} />
          </section>
        )}

        {reports.length > 0 && (
          <section className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="text-[18px] font-semibold text-ink">Community reports · {city}</h2>
            <p className="mb-5 mt-1 text-[13px] text-ink-muted">Neighbourhoods with the most closed sales in this window.</p>
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
                  <span className="mt-2 block text-[22px] font-semibold text-navy">{formatNumber(row.unitsSold)}</span>
                  <span className="mt-1 block text-[12px] text-ink-muted">closed sales</span>
                  <span className="mt-2 block text-[12px] font-medium text-navy group-hover:underline">View sold data →</span>
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

function selectionLabel(filters: Filters) {
  return [
    filters.community ? `${filters.community}, ${filters.city}` : filters.city,
    SOLD_PROPERTY_TYPES.find((option) => option.key === filters.type)?.label,
    filters.range.label,
  ]
    .filter(Boolean)
    .join(" · ");
}

function monthKey(value: string) {
  return value.slice(0, 7);
}

/** Keep the trailing N months so 1y / 2y / 3y always bind to the Period control. */
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

/** e.g. "Jan–Nov 2026" — YTD with the months covered so far. */
function ytdMonthRangeLabel(now = new Date()): string {
  const year = now.getFullYear();
  const start = new Date(year, 0, 1).toLocaleDateString("en-CA", { month: "short" });
  const end = now.toLocaleDateString("en-CA", { month: "short" });
  return start === end ? `${start} ${year}` : `${start}–${end} ${year}`;
}

function medianOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Calendar year-to-date rows from a sold-trends series (updates as months land). */
function ytdSoldMonths(months: SoldTrends["months"], now = new Date()) {
  const start = `${now.getFullYear()}-01`;
  return months.filter((month) => monthKey(month.month) >= start && month.unitsSold > 0);
}

/** One heatmap tile: YTD sold figures + current active listings for heat colour. */
type HeatmapCity = {
  city: (typeof MARKET_CITIES)[number];
  activeCount: number;
  medianPrice: number | null;
  /** Null when the sold feed was unavailable for this city. */
  soldCountYtd: number | null;
};

function buildHeatmapCities(catalog: CityCatalogStat[], soldByCity: SoldTrends[]): HeatmapCity[] {
  const activeByCity = new Map(
    catalog.map((row) => [row.city.toLowerCase(), row] as const),
  );
  const listFallback = (city: string) =>
    activeByCity.get(city.toLowerCase())?.medianListPrice ?? null;

  return MARKET_CITIES.map((name, index) => {
    const sold = soldByCity[index];
    const catalogRow = activeByCity.get(name.toLowerCase());
    const activeCount = catalogRow?.activeCount ?? 0;
    if (!sold || sold.unavailable) {
      return {
        city: name,
        activeCount,
        medianPrice: listFallback(name),
        soldCountYtd: null,
      };
    }
    const ytd = ytdSoldMonths(sold.months);
    const prices = ytd
      .map((month) => month.medianSoldPrice)
      .filter((price): price is number => price !== null);
    return {
      city: name,
      activeCount,
      medianPrice: medianOf(prices) ?? listFallback(name),
      soldCountYtd: ytd.reduce((sum, month) => sum + month.unitsSold, 0),
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
  filters: Filters;
}) {
  if (cities.length === 0) return null;

  const ytdMonthsLabel = ytdMonthRangeLabel();
  const ytdLabel = `YTD · ${ytdMonthsLabel}`;
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
    <section id="market-heatmap" className="scroll-mt-48 rounded-2xl border border-line bg-surface p-6 lg:scroll-mt-52">
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
          ? `Median price year to date (${ytdMonthsLabel}). Colour is how many homes sold this year compared with what is listed. The month range grows as each month's sold data lands.`
          : `Median price year to date (${ytdMonthsLabel}). Sold totals are unavailable, so there is no heat reading.`}
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
                  : `${formatNumber(row.soldCountYtd)} sales · ${ytdLabel}`}
              </span>
              {showHeat && (
                <span className={cn("mt-1 rounded-full px-2 py-0.5 text-center text-[10px] font-semibold", heat === "cool" || heat === "very" ? "bg-ink/10" : "bg-white/30")}>
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

function comparisonRows(
  series: Array<{ month: string; newListings: number }>,
  sold: SoldTrends["months"],
) {
  const rows = new Map<string, { month: string; sales: number; listings: number }>();
  for (const point of series) {
    rows.set(point.month.slice(0, 7), { month: point.month, sales: 0, listings: point.newListings });
  }
  for (const month of sold) {
    const key = month.month.slice(0, 7);
    const current = rows.get(key) ?? { month: month.month, sales: 0, listings: 0 };
    current.sales = month.unitsSold;
    rows.set(key, current);
  }
  return [...rows.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, row]) => row);
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
            <th scope="col" className="py-2 pr-4 font-medium">Month</th>
            <th scope="col" className="py-2 pr-4 font-medium">Median price</th>
            <th scope="col" className="py-2 pr-4 font-medium">Days on market</th>
            <th scope="col" className="py-2 pr-4 font-medium">Sale-to-list</th>
            <th scope="col" className="py-2 font-medium">Units sold</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.month} className="border-b border-line/60 last:border-0">
              <th scope="row" className="py-2 pr-4 font-normal text-ink">{formatMonthLabel(row.month)}</th>
              <td className="py-2 pr-4 text-ink">{row.medianSoldPrice ? formatPrice(row.medianSoldPrice) : EMPTY}</td>
              <td className="py-2 pr-4 text-ink-soft">{row.avgDaysOnMarket === null ? EMPTY : Math.round(row.avgDaysOnMarket)}</td>
              <td className="py-2 pr-4 text-ink-soft">
                {row.saleToListRatio === null ? EMPTY : `${(row.saleToListRatio * 100).toFixed(1)}%`}
              </td>
              <td className="py-2 text-ink-soft">{formatNumber(row.unitsSold)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="flex gap-4" role="status" aria-label="Loading market summary">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-[92px] w-36 bg-white/10" />
      ))}
    </div>
  );
}

function BoardSkeleton() {
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
