/**
 * Reference HomeAtlasUI neighbourhood-insights shape.
 *
 * Used when the FSA census API has no real profile yet, so the Community tab
 * still matches the client prototype (9 tiles + income distribution chart).
 */

import type {
  InsightCategory,
  InsightDistribution,
  InsightMetric,
} from "@/components/property/NeighbourhoodInsightsCard";

export const REFERENCE_INSIGHT_METRICS: InsightMetric[] = [
  { label: "Population", value: "8,222" },
  { label: "Avg. Age", value: "49.2" },
  { label: "Avg. HH Income", value: "$78,900" },
  { label: "Renters", value: "38.4%" },
  { label: "Immigrants", value: "60.7%" },
  { label: "Avg. Home Value", value: "$878,000" },
  { label: "Condos", value: "94.7%" },
  { label: "Households w/ Children", value: "29%" },
  { label: "Not in Labour Force", value: "49.1%" },
];

export const REFERENCE_DISTRIBUTIONS: Record<InsightCategory, InsightDistribution[]> = {
  "Household Income": [
    { range: "$0-25K", value: 4 },
    { range: "$25-50K", value: 11 },
    { range: "$50-75K", value: 18 },
    { range: "$75-100K", value: 22 },
    { range: "$100-150K", value: 26 },
    { range: "$150K+", value: 19 },
  ],
  Age: [
    { range: "0-14", value: 12 },
    { range: "15-24", value: 11 },
    { range: "25-44", value: 28 },
    { range: "45-64", value: 27 },
    { range: "65+", value: 22 },
  ],
  Education: [
    { range: "No cert.", value: 8 },
    { range: "High school", value: 22 },
    { range: "College", value: 31 },
    { range: "Bachelor+", value: 39 },
  ],
  Ethnicity: [
    { range: "European", value: 34 },
    { range: "South Asian", value: 22 },
    { range: "East Asian", value: 18 },
    { range: "Black", value: 9 },
    { range: "Other", value: 17 },
  ],
  Language: [
    { range: "English", value: 58 },
    { range: "Mandarin", value: 12 },
    { range: "Punjabi", value: 9 },
    { range: "Cantonese", value: 7 },
    { range: "Other", value: 14 },
  ],
  Construction: [
    { range: "Pre-1960", value: 8 },
    { range: "1960-79", value: 14 },
    { range: "1980-99", value: 22 },
    { range: "2000-10", value: 28 },
    { range: "2011+", value: 28 },
  ],
  Occupation: [
    { range: "Management", value: 12 },
    { range: "Business", value: 18 },
    { range: "Sciences", value: 14 },
    { range: "Health", value: 9 },
    { range: "Education", value: 11 },
    { range: "Sales/Service", value: 22 },
    { range: "Trades", value: 8 },
    { range: "Other", value: 6 },
  ],
};
