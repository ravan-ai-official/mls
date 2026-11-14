/**
 * Types mirroring the mls-v2 Django/DRF responses.
 *
 * Shapes were read from source, not inferred:
 *   backend/mls/serializers.py       — PropertySerializer, PropertyDetailSerializer
 *   backend/mls/views_properties.py  — PropertyFilterView response envelope
 *   backend/mls/views_valuation.py   — valuation estimate payload
 *   backend/accounts/serializers.py  — UserProfileSerializer
 *
 * DRF renders DecimalField as a *string*, so every money/measure field that maps
 * to a Decimal is typed `string | null` here and converted at the mapper boundary.
 */

/** Single media object as returned by PropertySerializer (list endpoints). */
export interface BackendMediaSummary {
  media_url: string | null;
  media_category: string | null;
  is_preferred: boolean;
}

/** Full media row as returned by MediaSerializer (detail endpoints). */
export interface BackendMedia {
  url: string | null;
  media_url: string | null;
  media_file: string | null;
  media_category: string | null;
  is_preferred: boolean;
  order: number | null;
}

export interface BackendRoom {
  room_type: string | null;
  room_level: string | null;
  room_length: string | null;
  room_width: string | null;
  room_dimensions: string | null;
}

/** PropertySerializer — the list/search shape. */
export interface BackendPropertySummary {
  listing_key: string;
  listing_id: string | null;
  list_price: string | null;
  lease_amount: string | null;
  /** Where most DDF rentals carry their monthly rent. Older backends omit it. */
  total_actual_rent?: string | null;
  property_sub_type: string | null;
  /** "House", "Apartment", "Row / Townhouse"… Older backends omit it. */
  structure_type?: string | null;
  property_attached_yn?: boolean | null;
  city: string | null;
  city_region: string | null;
  directions: string | null;
  postal_code: string | null;
  unparsed_address: string | null;
  state_or_province: string | null;
  bedrooms_total: number | null;
  bathrooms_total_integer: number | null;
  building_area_total: string | null;
  year_built: number | null;
  public_remarks: string | null;
  listing_url: string | null;
  category_type: string | null;
  latitude: string | null;
  longitude: string | null;
  photos_count: number | null;
  standard_status: string | null;
  /** NOTE: a single object (or null) on list endpoints — not an array. */
  media: BackendMediaSummary | null;

  /*
   * Added by mls-v2 migration 0052_api_gaps_fields for the v3 gap list.
   * Decimals arrive as strings; all are null on rows the feed hasn't filled.
   */
  /** G3/G10 — true close price and date on sold rows. */
  close_price?: string | null;
  close_date?: string | null;
  /** G7 — previous list price, for the "Price Drop" badge. */
  previous_list_price?: string | null;
  price_change_timestamp?: string | null;
  /** G6 — next scheduled open house, for the "Open House" badge. */
  next_open_house?: { start?: string | null; end?: string | null } | null;

  /*
   * Fields below are not declared in PropertySerializer.Meta.fields, but the
   * curated-rail endpoints (newly-listed, exclusive, community) build their own
   * payloads and may include them. Optional so the base search shape stays honest.
   */
  is_featured?: boolean | null;
  subdivision_name?: string | null;
  living_area?: string | null;
  above_grade_finished_area?: string | null;
  original_entry_timestamp?: string | null;
  modification_timestamp?: string | null;
  status_change_timestamp?: string | null;
}

/**
 * PropertyDetailSerializer uses `fields = '__all__'`, so the payload carries the
 * whole RESO model. We type the fields the UI actually reads and allow the rest.
 */
export interface BackendPropertyDetail extends Omit<BackendPropertySummary, "media"> {
  media: BackendMedia[];
  rooms: BackendRoom[];
  subdivision_name: string | null;
  street_name: string | null;
  street_number: string | null;
  unit_number: string | null;
  country: string | null;
  living_area: string | null;
  above_grade_finished_area: string | null;
  below_grade_finished_area: string | null;
  lot_size_area: string | null;
  lot_size_dimensions: string | null;
  lot_size_units: string | null;
  frontage_length_numeric: string | null;
  parking_total: number | null;
  parking_features: string | null;
  building_features?: string | null;
  garages?: number | null;
  garage_size?: string | null;
  kitchens?: number | null;
  bedrooms_above_grade?: number | null;
  bedrooms_below_grade?: number | null;
  /** Freehold / Condo/Strata ownership title from the feed. */
  common_interest?: string | null;
  zoning?: string | null;
  water_source?: string | null;
  sewer?: string | null;
  bathrooms_partial: number | null;
  stories: number | null;
  tax_annual_amount: string | null;
  association_fee: string | null;
  association_fee_frequency: string | null;
  association_fee_includes: string | null;
  heating: string | null;
  cooling: string | null;
  basement: string | null;
  /** Present on some feed/AVM-enriched detail payloads; compare shows — when absent. */
  family_room?: boolean | null;
  potl_monthly_fees?: string | number | null;
  flooring: string | null;
  roof: string | null;
  appliances: string | null;
  /** CREA OtherEquipment — often holds rented HWTs / contract rental items. */
  other_equipment?: string | null;
  exterior_features: string | null;
  interior_features: string | null;
  community_features: string | null;
  architectural_style: string | null;
  construction_materials: string | null;
  property_condition: string | null;
  fireplaces_total: number | null;
  fireplace_yn: boolean | null;
  pool_features: string | null;
  view: string | null;
  waterfront_features: string | null;
  inclusions: string | null;
  virtual_tour_url?: string | null;
  original_entry_timestamp: string | null;
  modification_timestamp: string | null;
  status_change_timestamp: string | null;
  availability_date: string | null;
  is_featured: boolean | null;
  [key: string]: unknown;
}

/** PropertyFilterView envelope. `next`/`previous` are offsets, not URLs. */
export interface BackendListResponse<T> {
  count: number;
  next: number | null;
  previous: number | null;
  results: T[];
  fallback_applied?: boolean;
}

export interface BackendPropertyTypeFacet {
  value: string;
  label: string;
  count: number;
}

export interface BackendCatalogStats {
  scope: { city: string | null; fsa: string | null };
  sample_size: number;
  median_list_price: number | null;
  mean_list_price: number | null;
  min_list_price: number | null;
  max_list_price: number | null;
  median_price_per_sqft: number | null;
  disclaimer: string;
}

export interface BackendTrendPoint {
  month: string;
  median_list_price?: number | null;
  sample_size?: number | null;
  [key: string]: unknown;
}

export interface BackendTrendsResponse {
  scope?: { city: string | null; fsa: string | null };
  window_months?: number;
  series?: BackendTrendPoint[];
  results?: BackendTrendPoint[];
  disclaimer?: string;
  [key: string]: unknown;
}

/** POST valuation/estimate/ */
export interface BackendValuationEstimate {
  estimate: {
    low: number;
    market: number;
    high: number;
    quick_sale_low: number;
    quick_sale_high: number;
  };
  breakdown: Array<{
    label?: string;
    feature?: string;
    factor?: string;
    amount?: number;
    delta?: number;
    source?: string;
    note?: string;
    [k: string]: unknown;
  }>;
  trend: {
    pct_30d: number;
    applied: number;
    pct_90d?: number;
    pct_12m?: number;
    source?: string | null;
    series?: Array<{ month?: string; median_sold_price?: number | null; units_sold?: number | null }>;
  };
  comps: Array<Record<string, unknown>>;
  active_comps?: Array<Record<string, unknown>>;
  agent: Record<string, unknown> | null;
  beta: boolean;
  sparse: boolean;
  detail?: string;
  /** AVM report fields (scope #10); absent on older backends. */
  confidence_stars?: number;
  valuation_date?: string;
  subject_details?: Record<string, unknown>;
  ai?: {
    suggested?: number | null;
    weight?: number;
    rationale?: string | null;
    adjustments?: Array<{ feature?: string; delta?: number; note?: string | null; source?: string }>;
    used?: boolean;
    confidence?: string | null;
  };
  methodology?: string;
  cma_point?: number;
  prior_sale_anchor?: number | null;
}

export interface BackendValuationSuggestion {
  listing_key?: string;
  label: string;
  city?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  [key: string]: unknown;
}

/** UserProfileSerializer */
export interface BackendUserProfile {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  phone_verified: boolean;
  avatar: string | null;
  date_joined: string;
  /* Blog Studio access. Optional so an older backend simply yields `false`
     rather than breaking the profile call. */
  is_staff?: boolean;
  can_author?: boolean;
  /** Server-computed `is_staff || can_author` — the flag to branch on. */
  can_use_studio?: boolean;
}

/** SimpleJWT pair returned by login / verify-email / social auth. */
export interface BackendTokenPair {
  access: string;
  refresh: string;
  user?: BackendUserProfile;
}

export interface BackendMapAggregateCell {
  cell: string;
  count: number;
  latitude: number;
  longitude: number;
  [key: string]: unknown;
}

export interface BackendMapAggregatesResponse {
  mode: "aggregates" | "listings";
  resolution: number | null;
  results: BackendMapAggregateCell[];
  message?: string;
  meta?: { cached?: boolean; duration_ms?: number };
}
