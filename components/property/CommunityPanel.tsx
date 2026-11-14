import { safeFetch } from "@/lib/api/client";
import { getCatalogStats, getHomeTypeDistribution, getMarketTrends } from "@/lib/api/market";
import {
  getCensusProfile,
  getNearbyAmenities,
  type AmenitiesByCategory,
  type CensusProfile,
} from "@/lib/api/neighbourhood";
import { searchProperties } from "@/lib/api/properties";
import { getWpCommunityProfile } from "@/lib/api/wpCommunity";
import {
  NeighbourhoodInsightsCard,
  type InsightCategory,
  type InsightDistribution,
  type InsightMetric,
} from "@/components/property/NeighbourhoodInsightsCard";
import { AmenitiesSection } from "@/components/property/Neighbourhood";
import {
  PriceDistribution,
  TrendChart,
  TypeSplit,
} from "@/components/property/CommunityCharts";
import {
  REFERENCE_DISTRIBUTIONS,
  REFERENCE_INSIGHT_METRICS,
} from "@/lib/demo/neighbourhoodInsights";
import type { PropertySummary } from "@/lib/types/domain";
import { formatPrice } from "@/lib/utils/format";

/**
 * Community tab. Neighbourhood Insights matches HomeAtlasUI: 9 demographic
 * tiles + household income (and related) distribution chart. Census FSA data
 * is preferred; the reference demo profile fills gaps so the section always
 * appears.
 */
export async function CommunityPanel({
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
  const emptySold = {
    items: [] as PropertySummary[],
    total: 0,
    nextOffset: null,
    previousOffset: null,
    approximate: false,
    truncated: false,
  };
  const emptyAmenities: AmenitiesByCategory = {
    groceries: [],
    cafes: [],
    parks: [],
    transit: [],
  };
  const [stats, trends, census, wpCommunity, amenities, sold, active, homeTypes] = await Promise.all([
    city
      ? safeFetch(getCatalogStats({ city }), null, "property:catalog")
      : Promise.resolve(null),
    city
      ? safeFetch(getMarketTrends({ city }, 12), null, "property:trends")
      : Promise.resolve(null),
    fsa ? getCensusProfile(fsa) : Promise.resolve(null),
    safeFetch(getWpCommunityProfile(city, neighbourhood), null, "property:wp-community"),
    latitude !== null && longitude !== null
      ? safeFetch(
          getNearbyAmenities(latitude, longitude),
          emptyAmenities,
          "property:amenities",
        )
      : Promise.resolve(null),
    city
      ? safeFetch(searchProperties({ city, status: "Sold", limit: 24 }), emptySold, "property:sold-dist")
      : Promise.resolve(emptySold),
    city
      ? safeFetch(searchProperties({ city, status: "Active", limit: 24 }), emptySold, "property:ask-dist")
      : Promise.resolve(emptySold),
    city
      ? safeFetch(
          getHomeTypeDistribution(city, { community: neighbourhood }),
          [] as Array<{ name: string; count: number }>,
          "property:home-types",
        )
      : Promise.resolve([] as Array<{ name: string; count: number }>),
  ]);

  const series = (trends?.series ?? []).filter((point) => point.medianListPrice !== null);
  // Detached / Semi / townhouse / condo — not RESO "Single Family" buckets.
  const typeSlices = homeTypes.filter((row) => row.count > 0);
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

      <PriceDistribution
        sold={sold.items.map((item) => item.closePrice ?? item.price)}
        asking={active.items.map((item) => (item.isLease ? null : item.price))}
        city={city}
      />

      {typeSlices.length > 0 && (
        <TypeSplit slices={typeSlices} city={placeLabel !== "this area" ? placeLabel : city} />
      )}

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

