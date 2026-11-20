/**
 * Home valuation — the seller funnel.
 *
 * Backed by mls-v2 hybrid CMA (`mls/services/valuation/`): AMPRE sold comps,
 * sold-market trends, hedonic adjustments, and an optional AI blend.
 */

import { apiFetch, type RequestOptions } from "@/lib/api/client";
import { toNumber } from "@/lib/utils/format";
import type {
  BackendValuationEstimate,
  BackendValuationSuggestion,
} from "@/lib/types/backend";

const MLS = "/api/mls";

export interface AddressSuggestion {
  label: string;
  listingKey: string | null;
  latitude: number | null;
  longitude: number | null;
  fsa: string | null;
}

/** Subject-property payload returned by `valuation/lookup/`. */
export interface ValuationSubject {
  listingKey: string | null;
  address: string;
  city: string;
  cityRegion: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  bedroomsTotal: number | null;
  bathroomsTotal: number | null;
  livingArea: number | null;
  parkingTotal: number | null;
  taxAnnualAmount: number | null;
  propertySubType: string;
  lotFrontage: number | null;
  lotDepth: number | null;
  /** Calendar year the home was built, when the listing carries it. */
  yearBuilt: number | null;
  /** Approximate age in years derived from year built (or provided by the visitor). */
  age: number | null;
}

/**
 * One column of the AVM report table (scope #10). Every field is null when
 * the feed does not carry it; the table renders a dash.
 */
export interface AvmDetails {
  /** Parcel / assessment roll when the feed carries it. */
  rollNumber: string | null;
  address: string | null;
  city: string | null;
  community: string | null;
  province: string | null;
  postalCode: string | null;
  level: string | null;
  unitNumber: string | null;
  locker: boolean | null;
  potlMonthlyFees: number | null;
  maintenance: number | null;
  maintenanceIncludes: string | null;
  propertyStyle: string | null;
  propertyType: string | null;
  frontageFt: number | null;
  depthFt: number | null;
  lotArea: number | null;
  lotAreaUnits: string | null;
  listPrice: number | null;
  lastSoldPrice: number | null;
  taxAnnualAmount: number | null;
  daysOnMarket: number | null;
  yearBuilt: number | null;
  floorAreaSqft: number | null;
  aboveGradeSqft: number | null;
  basement: string | null;
  basementTotalSqft: number | null;
  basementFinishedSqft: number | null;
  storeys: number | null;
  structureCondition: string | null;
  bedrooms: number | null;
  bedroomsBelowGrade: number | null;
  bathroomsFull: number | null;
  bathroomsHalf: number | null;
  familyRoom: boolean | null;
  kitchens: number | null;
  rentalItems: string | null;
  fireplaces: number | null;
  renovationYear: number | null;
  renovationType: string | null;
  heating: string | null;
  airConditioning: boolean | null;
  pool: boolean | null;
  garageType: string | null;
  garageArea: number | null;
  garageSpaces: number | null;
  parkingTotal: number | null;
  parkingFeatures: string | null;
}

/**
 * `sold`: AMPRE closed sale with ClosePrice.
 * `sold_proxy`: left the market; price is last asking (fallback).
 * `active_listing`: currently for sale (DOM / asking signal).
 */
export type CompSource = "sold" | "sold_proxy" | "active_listing";

export interface ValuationComp {
  listingKey: string | null;
  price: number | null;
  closePrice: number | null;
  listPrice: number | null;
  beds: number | null;
  baths: number | null;
  livingArea: number | null;
  address: string;
  city: string;
  distanceKm: number | null;
  source: CompSource | null;
  /** Close date for sold; off-market date for proxy; listed date for active. */
  eventDate: string | null;
  daysOnMarket: number | null;
  details: AvmDetails;
}

export interface ValuationTrendPoint {
  month: string;
  medianSoldPrice: number | null;
  unitsSold: number | null;
}

export interface ValuationBreakdownItem {
  feature: string;
  delta: number;
  source: "hedonic" | "ai" | string;
  note: string | null;
}

export interface ValuationAiSuggestion {
  suggested: number | null;
  weight: number;
  rationale: string | null;
  adjustments: ValuationBreakdownItem[];
  used: boolean;
  confidence: string | null;
}

export interface ValuationResult {
  low: number;
  market: number;
  high: number;
  quickSaleLow: number;
  quickSaleHigh: number;
  /** Display percent (e.g. 1.5 for +1.5%). */
  trendPct30d: number;
  trendPct90d: number;
  trendPct12m: number;
  trendSource: string | null;
  trendSeries: ValuationTrendPoint[];
  comps: ValuationComp[];
  activeComps: ValuationComp[];
  breakdown: ValuationBreakdownItem[];
  ai: ValuationAiSuggestion;
  methodology: string | null;
  cmaPoint: number | null;
  priorSaleAnchor: number | null;
  confidence: string | null;
  /** 0-5, derived by the backend from the model's confidence band. */
  confidenceStars: number;
  valuationDate: string | null;
  subjectDetails: AvmDetails;
  /** True when too few comparables were found for a reliable estimate. */
  sparse: boolean;
  /** The backend always flags this model as beta; surface it in the UI. */
  beta: boolean;
  agentName: string | null;
  message: string | null;
}

/** Minimum characters before the backend will answer (enforced server-side). */
export const AUTOCOMPLETE_MIN_CHARS = 2;

export async function autocompleteAddress(
  query: string,
  options: RequestOptions = {},
): Promise<AddressSuggestion[]> {
  if (query.trim().length < AUTOCOMPLETE_MIN_CHARS) return [];

  const data = await apiFetch<{ results: BackendValuationSuggestion[] }>(
    `${MLS}/valuation/autocomplete/`,
    { ...options, params: { q: query.trim() } },
  );

  return (data.results ?? []).map((item) => ({
    label: item.label,
    listingKey: item.listing_key ?? null,
    latitude: toNumber(item.latitude),
    longitude: toNumber(item.longitude),
    fsa: typeof item.fsa === "string" ? item.fsa : null,
  }));
}

export async function lookupSubject(
  input: { listingKey?: string; address?: string },
  options: RequestOptions = {},
): Promise<ValuationSubject> {
  const raw = await apiFetch<Record<string, unknown>>(`${MLS}/valuation/lookup/`, {
    ...options,
    params: { listing_key: input.listingKey, address: input.address },
  });

  const yearBuilt = toNumber(raw.year_built);
  const ageFromApi = toNumber(raw.age);
  const age =
    ageFromApi ??
    (yearBuilt != null && yearBuilt >= 1800 ? new Date().getFullYear() - yearBuilt : null);

  return {
    listingKey: (raw.listing_key as string) ?? null,
    address: (raw.unparsed_address as string) ?? "",
    city: (raw.city as string) ?? "",
    cityRegion: (raw.city_region as string) ?? "",
    postalCode: (raw.postal_code as string) ?? "",
    latitude: toNumber(raw.latitude),
    longitude: toNumber(raw.longitude),
    bedroomsTotal: toNumber(raw.bedrooms_total),
    bathroomsTotal: toNumber(raw.bathrooms_total),
    livingArea: toNumber(raw.living_area) ?? toNumber(raw.above_grade_finished_area),
    parkingTotal: toNumber(raw.parking_total),
    taxAnnualAmount: toNumber(raw.tax_annual_amount),
    propertySubType: (raw.property_sub_type as string) ?? "",
    lotFrontage: toNumber(raw.lot_frontage),
    lotDepth: toNumber(raw.lot_depth),
    yearBuilt,
    age: age != null && age >= 0 ? age : null,
  };
}

export interface EstimateInput {
  listingKey?: string | null;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  postalCode?: string;
  city?: string;
  propertySubType?: string;
  bedroomsTotal?: number | null;
  bathroomsTotal?: number | null;
  livingArea?: number | null;
  parkingTotal?: number | null;
  lotFrontage?: number | null;
  lotDepth?: number | null;
  yearBuilt?: number | null;
  age?: number | null;
}

function mapComp(comp: Record<string, unknown>): ValuationComp {
  const source =
    comp.source === "sold" || comp.source === "sold_proxy" || comp.source === "active_listing"
      ? comp.source
      : null;
  return {
    listingKey: (comp.listing_key as string) ?? null,
    price: typeof comp.price === "number" ? comp.price : null,
    closePrice: typeof comp.close_price === "number" ? comp.close_price : null,
    listPrice: typeof comp.list_price === "number" ? comp.list_price : null,
    beds: typeof comp.bedrooms_total === "number" ? comp.bedrooms_total : null,
    baths:
      typeof comp.bathrooms_total_integer === "number" ? comp.bathrooms_total_integer : null,
    livingArea: typeof comp.living_area === "number" ? comp.living_area : null,
    address: (comp.unparsed_address as string) ?? "",
    city: (comp.city as string) ?? "",
    distanceKm: typeof comp.distance_km === "number" ? comp.distance_km : null,
    source,
    eventDate: typeof comp.event_date === "string" ? comp.event_date : null,
    daysOnMarket: typeof comp.days_on_market === "number" ? comp.days_on_market : null,
    details: mapAvmDetails(comp.details),
  };
}

function mapBreakdownItem(raw: Record<string, unknown>): ValuationBreakdownItem {
  const feature =
    (typeof raw.feature === "string" && raw.feature) ||
    (typeof raw.label === "string" && raw.label) ||
    (typeof raw.factor === "string" && raw.factor) ||
    "adjustment";
  const delta =
    typeof raw.delta === "number"
      ? raw.delta
      : typeof raw.amount === "number"
        ? raw.amount
        : 0;
  return {
    feature,
    delta,
    source: typeof raw.source === "string" ? raw.source : "hedonic",
    note: typeof raw.note === "string" ? raw.note : null,
  };
}

export async function estimateValue(
  input: EstimateInput,
  options: RequestOptions = {},
): Promise<ValuationResult> {
  const data = await apiFetch<BackendValuationEstimate & { confidence?: string }>(
    `${MLS}/valuation/estimate/`,
    {
      ...options,
      method: "POST",
      body: {
        listing_key: input.listingKey ?? undefined,
        address: input.address || undefined,
        latitude: input.latitude ?? undefined,
        longitude: input.longitude ?? undefined,
        postal_code: input.postalCode,
        city: input.city,
        property_sub_type: input.propertySubType,
        bedrooms_total: input.bedroomsTotal ?? undefined,
        bathrooms_total: input.bathroomsTotal ?? undefined,
        living_area: input.livingArea ?? undefined,
        parking_total: input.parkingTotal ?? undefined,
        lot_frontage: input.lotFrontage ?? undefined,
        lot_depth: input.lotDepth ?? undefined,
        year_built: input.yearBuilt ?? undefined,
        age: input.age ?? undefined,
      },
    },
  );

  const agent = data.agent as Record<string, unknown> | null;
  const ai = data.ai;
  const series = (data.trend?.series ?? []).map((point) => ({
    month: typeof point.month === "string" ? point.month : "",
    medianSoldPrice:
      typeof point.median_sold_price === "number" ? point.median_sold_price : null,
    unitsSold: typeof point.units_sold === "number" ? point.units_sold : null,
  })).filter((point) => point.month);

  return {
    low: data.estimate?.low ?? 0,
    market: data.estimate?.market ?? 0,
    high: data.estimate?.high ?? 0,
    quickSaleLow: data.estimate?.quick_sale_low ?? 0,
    quickSaleHigh: data.estimate?.quick_sale_high ?? 0,
    // Backend stores fractions (0.012); display as percent.
    trendPct30d: Number(data.trend?.pct_30d ?? 0) * 100,
    trendPct90d: Number(data.trend?.pct_90d ?? 0) * 100,
    trendPct12m: Number(data.trend?.pct_12m ?? 0) * 100,
    trendSource: typeof data.trend?.source === "string" ? data.trend.source : null,
    trendSeries: series,
    comps: (data.comps ?? []).map(mapComp),
    activeComps: (data.active_comps ?? []).map(mapComp),
    breakdown: (data.breakdown ?? []).map((row) => mapBreakdownItem(row as Record<string, unknown>)),
    ai: {
      suggested: typeof ai?.suggested === "number" ? ai.suggested : null,
      weight: typeof ai?.weight === "number" ? ai.weight : 0,
      rationale: typeof ai?.rationale === "string" ? ai.rationale : null,
      adjustments: (ai?.adjustments ?? []).map((row) =>
        mapBreakdownItem(row as Record<string, unknown>),
      ),
      used: Boolean(ai?.used),
      confidence: typeof ai?.confidence === "string" ? ai.confidence : null,
    },
    methodology: typeof data.methodology === "string" ? data.methodology : null,
    cmaPoint: typeof data.cma_point === "number" ? data.cma_point : null,
    priorSaleAnchor:
      typeof data.prior_sale_anchor === "number" ? data.prior_sale_anchor : null,
    confidence: (data.confidence as string) ?? null,
    confidenceStars: typeof data.confidence_stars === "number" ? data.confidence_stars : 0,
    valuationDate: typeof data.valuation_date === "string" ? data.valuation_date : null,
    subjectDetails: mapAvmDetails(data.subject_details),
    sparse: Boolean(data.sparse),
    beta: Boolean(data.beta),
    agentName:
      (agent?.name as string) ??
      (agent?.full_name as string) ??
      null,
    // Present when the backend could not geolocate the subject property.
    message: data.detail ?? null,
  };
}

export function mapAvmDetails(raw: unknown): AvmDetails {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const num = (value: unknown) => toNumber(value);
  const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
  const bool = (value: unknown) => (typeof value === "boolean" ? value : null);
  return {
    rollNumber: text(row.roll_number),
    address: text(row.address),
    city: text(row.city),
    community: text(row.community),
    province: text(row.province),
    postalCode: text(row.postal_code),
    level: text(row.level),
    unitNumber: text(row.unit_number),
    locker: bool(row.locker),
    potlMonthlyFees: num(row.potl_monthly_fees),
    maintenance: num(row.maintenance),
    maintenanceIncludes: text(row.maintenance_includes),
    propertyStyle: text(row.property_style),
    propertyType: text(row.property_type),
    frontageFt: num(row.frontage_ft),
    depthFt: num(row.depth_ft),
    lotArea: num(row.lot_area),
    lotAreaUnits: text(row.lot_area_units),
    listPrice: num(row.list_price),
    lastSoldPrice: num(row.last_sold_price),
    taxAnnualAmount: num(row.tax_annual_amount),
    daysOnMarket: num(row.days_on_market),
    yearBuilt: num(row.year_built),
    floorAreaSqft: num(row.floor_area_sqft),
    aboveGradeSqft: num(row.above_grade_sqft),
    basement: text(row.basement),
    basementTotalSqft: num(row.basement_total_sqft),
    basementFinishedSqft: num(row.basement_finished_sqft),
    storeys: num(row.storeys),
    structureCondition: text(row.structure_condition),
    bedrooms: num(row.bedrooms),
    bedroomsBelowGrade: num(row.bedrooms_below_grade),
    bathroomsFull: num(row.bathrooms_full),
    bathroomsHalf: num(row.bathrooms_half),
    familyRoom: bool(row.family_room),
    kitchens: num(row.kitchens),
    rentalItems: text(row.rental_items),
    fireplaces: num(row.fireplaces),
    renovationYear: num(row.renovation_year),
    renovationType: text(row.renovation_type),
    heating: text(row.heating),
    airConditioning: bool(row.air_conditioning),
    pool: bool(row.pool),
    garageType: text(row.garage_type),
    garageArea: num(row.garage_area),
    garageSpaces: num(row.garage_spaces),
    parkingTotal: num(row.parking_total),
    parkingFeatures: text(row.parking_features),
  };
}
