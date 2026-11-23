"use client";

import {
  getCatalogStats,
  getHomeTypeDistribution,
  getMarketTrends,
  getSoldTrends,
  HOME_TYPE_DISTRIBUTION,
  type CatalogStats,
  type MarketTrends,
  type SoldTrends,
} from "@/lib/api/market";
import {
  getCensusProfile,
  getNearbyAmenities,
  type AmenitiesByCategory,
  type CensusProfile,
} from "@/lib/api/neighbourhood";
import { getWpCommunityProfile } from "@/lib/api/wpCommunity";
import {
  NeighbourhoodInsightsCard,
  type InsightCategory,
  type InsightDistribution,
  type InsightMetric,
} from "@/components/property/NeighbourhoodInsightsCard";
import { AmenitiesSection } from "@/components/property/Neighbourhood";
import { TrendChart, TypeSplit } from "@/components/property/CommunityCharts";
import { SalesListingsChart } from "@/components/market/InsightCharts";
import {
  REFERENCE_DISTRIBUTIONS,
  REFERENCE_INSIGHT_METRICS,
} from "@/lib/demo/neighbourhoodInsights";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";
import { formatPrice } from "@/lib/utils/format";

/**
 * Community tab. Neighbourhood Insights matches HomeAtlasUI: 9 demographic
 * tiles + household income (and related) distribution chart. Census FSA data
 * is preferred; the reference demo profile fills gaps so the section always
 * appears. Fetches in the browser via `/api/mls/…` so Network shows JSON.
 */

type CommunityPayload = {
  stats: CatalogStats | null;
  trends: MarketTrends | null;
  census: CensusProfile | null;
  wpCommunity: Awaited<ReturnType<typeof getWpCommunityProfile>> | null;
  amenities: AmenitiesByCategory | null;
  soldTrends: SoldTrends;
  homeTypes: Array<{ name: string; count: number }>;
};

export function CommunityPanel({
  city,
  neighbourhood,
  postalCode,
  latitude,
  longitude,
}: {
  city: string | null;
  neighbourhood?: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
}) {
  const fsa = postalCode?.replace(/\s/g, "").slice(0, 3) ?? "";
  const emptyAmenities: AmenitiesByCategory = {
    groceries: [],
    cafes: [],
    parks: [],
    transit: [],
  };
  const emptySoldTrends: SoldTrends = {
    city: city ?? "",
    windowMonths: 12,
    months: [],
    communities: [],
    community: neighbourhood ?? null,
    unavailable: true,
    generatedAt: null,
    stale: false,
  };
  const fallback: CommunityPayload = {
    stats: null,
    trends: null,
    census: null,
    wpCommunity: null,
    amenities: latitude !== null && longitude !== null ? emptyAmenities : null,
    soldTrends: emptySoldTrends,
    homeTypes: [],
  };

  const { data = fallback } = useMlsQuery<CommunityPayload>(
    ["property", "community", city, neighbourhood, fsa, latitude, longitude],
    async () => {
      const [stats, trends, census, wpCommunity, amenities, soldTrends, homeTypes] =
        await Promise.all([
          city
            ? getCatalogStats({ city }).catch(() => null)
            : Promise.resolve(null),
          city
            ? getMarketTrends({ city }, 12).catch(() => null)
            : Promise.resolve(null),
          fsa ? getCensusProfile(fsa) : Promise.resolve(null),
          getWpCommunityProfile(city, neighbourhood).catch(() => null),
          latitude !== null && longitude !== null
            ? getNearbyAmenities(latitude, longitude).catch(() => emptyAmenities)
            : Promise.resolve(null),
          city
            ? getSoldTrends(city, 12, {}, { community: neighbourhood ?? undefined })
            : Promise.resolve(emptySoldTrends),
          city
            ? getHomeTypeDistribution(city, { community: neighbourhood }).catch(
                () => [] as Array<{ name: string; count: number }>,
              )
            : Promise.resolve([] as Array<{ name: string; count: number }>),
        ]);
      return { stats, trends, census, wpCommunity, amenities, soldTrends, homeTypes };
    },
    fallback,
  );

  const { stats, trends, census, wpCommunity, amenities, soldTrends, homeTypes } = data;
  const activityRows = comparisonRows(
    trends?.series ?? [],
    soldTrends.unavailable ? [] : soldTrends.months.slice(-12),
    trends?.activeCurrent ?? null,
  );

  const series = (trends?.series ?? []).filter((point) => point.medianListPrice !== null);
  // Always keep Detached / Semi-detached / townhouse / Condo apartment in the
  // pie — including zero counts — so the Community tab never hides those types.
  const countsByName = new Map(homeTypes.map((row) => [row.name, row.count]));
  const typeSlices = [
    ...HOME_TYPE_DISTRIBUTION.map((slice) => ({
      name: slice.name,
      count: countsByName.get(slice.name) ?? 0,
    })),
    ...(countsByName.get("Other") ? [{ name: "Other", count: countsByName.get("Other")! }] : []),
  ];
  const latestNew = trends?.series.at(-1)?.newListings;
  const placeLabel =
    [neighbourhood, city].filter((part): part is string => Boolean(part?.trim())).join(", ") ||
    city ||
    neighbourhood ||
    "this area";
  const { metrics, distributions, source } = insightsFromCensus(census);

  return (
    <div className="space-y-8">
      <NeighbourhoodInsightsCard
        placeLabel={placeLabel}
        metrics={metrics}
        distributions={distributions}
        source={source}
      />

      {wpCommunity?.whyFamiliesLove && (
        <p className="text-[14px] leading-relaxed text-ink-soft">{wpCommunity.whyFamiliesLove}</p>
      )}

      <div>
        <h2 className="mb-1 text-[20px] font-semibold text-ink">Community Statistics</h2>
        <p className="mb-5 text-[13px] text-ink-muted">
          {city
            ? `Active listings in ${city}. These are asking prices, not sold prices.`
            : "This listing has no city, so community figures are unavailable."}
        </p>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <Stat label="Median Price" value={stats?.medianListPrice ? formatPrice(stats.medianListPrice) : "—"} />
          <Stat label="New Listings" value={latestNew != null ? String(latestNew) : "—"} />
          <Stat label="Active Listings" value={trends?.activeCurrent != null ? String(trends.activeCurrent) : "—"} />
        </div>
        {yearChange(series) && (
          <p className="mb-2 text-[12px] font-medium text-ink">12 months: {yearChange(series)}</p>
        )}
        {stats?.disclaimer && (
          <p className="mt-3 text-[11px] text-ink-subtle">{stats.disclaimer}</p>
        )}
      </div>

      {series.length > 1 && (
        <TrendChart
          points={series.map((point) => ({
            month: point.month,
            median: point.medianListPrice!,
            mean: point.meanListPrice,
          }))}
          city={city}
        />
      )}

      {city ? (
        <div className="rounded-2xl border border-line p-4 sm:p-5">
          <h3 className="mb-1 text-[15px] font-semibold text-ink">Sold, Active and New Listing</h3>
          <p className="mb-4 text-[12px] text-ink-muted">
            Closed sales, active inventory and new listings
            {placeLabel !== "this area" ? ` in ${placeLabel}` : city ? ` in ${city}` : ""}.
          </p>
          {soldTrends.unavailable && activityRows.every((row) => row.sold === 0) ? (
            <p className="rounded-control bg-surface-alt px-4 py-8 text-center text-small text-ink-muted">
              Sold, active and new listing figures are temporarily unavailable for this area.
            </p>
          ) : (
            <SalesListingsChart rows={activityRows} />
          )}
        </div>
      ) : null}

      {city ? (
        <TypeSplit slices={typeSlices} city={placeLabel !== "this area" ? placeLabel : city} />
      ) : null}

      {amenities && <AmenitiesSection amenities={amenities} />}
    </div>
  );
}

function insightsFromCensus(census: CensusProfile | null): {
  metrics: InsightMetric[];
  distributions: Partial<Record<InsightCategory, InsightDistribution[]>>;
  source: string;
} {
  if (!census) {
    return {
      metrics: REFERENCE_INSIGHT_METRICS,
      distributions: REFERENCE_DISTRIBUTIONS,
      source: "Source: Statistics Canada — 2021 Census",
    };
  }

  const metrics: InsightMetric[] = [
    census.population > 0
      ? { label: "Population", value: census.population.toLocaleString("en-CA") }
      : null,
    census.medianAge > 0 ? { label: "Avg. Age", value: String(census.medianAge) } : null,
    census.averageHouseholdIncome
      ? { label: "Avg. HH Income", value: census.averageHouseholdIncome }
      : null,
    census.rentersPct ? { label: "Renters", value: census.rentersPct } : null,
    census.immigrantsPct ? { label: "Immigrants", value: census.immigrantsPct } : null,
    census.avgHomeValue ? { label: "Avg. Home Value", value: census.avgHomeValue } : null,
    census.condosPct ? { label: "Condos", value: census.condosPct } : null,
    census.householdsWithChildrenPct
      ? { label: "Households w/ Children", value: census.householdsWithChildrenPct }
      : null,
    census.notInLabourForcePct
      ? { label: "Not in Labour Force", value: census.notInLabourForcePct }
      : null,
  ].filter((row): row is InsightMetric => row !== null);

  const distributions: Partial<Record<InsightCategory, InsightDistribution[]>> = {
    "Household Income":
      census.incomeDistribution.length > 0
        ? census.incomeDistribution
        : REFERENCE_DISTRIBUTIONS["Household Income"],
    Age:
      census.ageDistribution.length > 0
        ? census.ageDistribution
        : REFERENCE_DISTRIBUTIONS.Age,
    Education:
      census.educationDistribution.length > 0
        ? census.educationDistribution
        : REFERENCE_DISTRIBUTIONS.Education,
    Ethnicity:
      census.ethnicityDistribution.length > 0
        ? census.ethnicityDistribution
        : REFERENCE_DISTRIBUTIONS.Ethnicity,
    Language:
      census.languageDistribution.length > 0
        ? census.languageDistribution
        : REFERENCE_DISTRIBUTIONS.Language,
    Construction:
      census.constructionDistribution.length > 0
        ? census.constructionDistribution
        : REFERENCE_DISTRIBUTIONS.Construction,
    Occupation:
      census.occupationDistribution.length > 0
        ? census.occupationDistribution
        : REFERENCE_DISTRIBUTIONS.Occupation,
  };

  return {
    metrics: metrics.length >= 6 ? metrics : REFERENCE_INSIGHT_METRICS,
    distributions,
    source: census.disclaimer?.startsWith("Source:")
      ? census.disclaimer
      : census.disclaimer || "Source: Statistics Canada — 2021 Census",
  };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-alt p-4">
      <div className="mb-1 text-[11px] text-ink-muted">{label}</div>
      <div className="text-[18px] font-semibold text-ink sm:text-[20px]">{value}</div>
    </div>
  );
}

function yearChange(points: Array<{ medianListPrice: number | null }>): string | null {
  const values = points.map((point) => point.medianListPrice).filter((value): value is number => value !== null);
  if (values.length < 2 || values[0] === 0) return null;
  const pct = ((values[values.length - 1] - values[0]) / values[0]) * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

/** Merge catalogue new-listings with sold units, then back-fill active inventory. */
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
