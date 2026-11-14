/**
 * UI-facing domain types.
 *
 * These mirror the shapes HomeAtlasUI renders (`HomeAtlasUI/src/data/index.ts`)
 * so components stay close to the reference design, while `lib/api/mappers.ts`
 * absorbs the translation from mls-v2's RESO field names.
 *
 * Every field that the backend may not supply is explicitly nullable — the UI
 * renders a real "—" or an unavailable state rather than a fabricated value.
 */

export type PropertyStatus = "active" | "sold" | "leased" | "other";

/** The reference's closed union, kept for filter chips and iconography. */
export const UI_PROPERTY_TYPES = [
  "Detached",
  "Semi-Detached",
  "Townhome",
  "Condo",
  "Luxury",
  "Rental",
] as const;

export type UiPropertyType = (typeof UI_PROPERTY_TYPES)[number];

/**
 * Property types a search can filter by. "Rental" is a transaction, not a
 * type: it lives on `ListingQuery.transaction` (URL `tx=rent`).
 */
export const SEARCH_PROPERTY_TYPES = UI_PROPERTY_TYPES.filter(
  (type): type is Exclude<UiPropertyType, "Rental"> => type !== "Rental",
);

/** Buy vs Rent — the backend's `transaction_type`. */
export type ListingTransaction = "sale" | "rent";

export interface PropertyBadge {
  label: string;
  tone: "new" | "openHouse" | "priceDrop" | "sold" | "featured" | "exclusive";
}

export interface PropertySummary {
  /** listing_key — the canonical id used in routes. */
  id: string;
  address: string;
  /** city_region ?? subdivision_name — may be absent in the feed. */
  neighbourhood: string | null;
  /** city */
  community: string | null;
  price: number | null;
  /** True when price came from lease_amount rather than list_price. */
  isLease: boolean;
  beds: number | null;
  baths: number | null;
  /** Normalized display label, e.g. "Detached". Falls back to the raw RESO value. */
  type: string | null;
  /** Matched UI type when the RESO value maps cleanly, else null. */
  uiType: UiPropertyType | null;
  sqft: number | null;
  status: PropertyStatus;
  badge: PropertyBadge | null;
  mls: string;
  image: string | null;
  photosCount: number;
  latitude: number | null;
  longitude: number | null;
  postalCode: string | null;
  yearBuilt: number | null;
  description: string | null;
  /** status_change_timestamp — a proxy for a sold date, not a true close date. */
  statusChangedAt: string | null;
  listedAt: string | null;
  /** close_price — the true sold price (G10). Null on anything not closed. */
  closePrice: number | null;
  /** close_date — the true close date (G3), preferred over statusChangedAt. */
  closeDate: string | null;
  /** previous_list_price — drives the "Price Drop" badge (G7). */
  previousListPrice: number | null;
  priceChangedAt: string | null;
  /** next_open_house — drives the "Open House" badge (G6). */
  nextOpenHouse: { start: string; end: string | null } | null;
}

export interface PropertyRoom {
  name: string | null;
  level: string | null;
  dimensions: string | null;
}

export interface PropertyImage {
  url: string;
  category: string | null;
  isPreferred: boolean;
}

/** A label/value pair rendered in the detail page's spec tables. */
export interface PropertyFact {
  label: string;
  value: string;
}

export interface PropertyDetail extends PropertySummary {
  images: PropertyImage[];
  rooms: PropertyRoom[];
  unitNumber: string | null;
  stateOrProvince: string | null;
  lotFrontage: number | null;
  lotDepth: string | null;
  lotSizeDimensions: string | null;
  parkingTotal: number | null;
  /** "3+1" when the feed splits above- and below-grade bedrooms. */
  bedsLabel: string | null;
  garageSpaces: number | null;
  taxAnnualAmount: number | null;
  associationFee: number | null;
  associationFeeFrequency: string | null;
  associationFeeIncludes: string | null;
  style: string | null;
  level: string | null;
  locker: boolean | null;
  basement: string | null;
  kitchens: number | null;
  daysOnMarket: number | null;
  sqftAboveGrade: number | null;
  familyRoom: boolean | null;
  /** Stories / floors from the feed. */
  stories: number | null;
  /** Ownership title (Freehold, Condo/Strata, …). */
  ownership: string | null;
  /** Age in years when year built is known. */
  propertyAge: number | null;
  potlMonthlyFees: number | null;
  rentalItems: string | null;
  /** Grouped facts for the detail spec sections; empty groups are dropped. */
  factGroups: Array<{ title: string; facts: PropertyFact[] }>;
  /** http(s) virtual-tour link from the feed. Absent when the listing has none. */
  virtualTourUrl: string | null;
}

export interface CommunitySummary {
  id: string;
  name: string;
  listingCount: number | null;
  averagePrice: number | null;
  medianPrice: number | null;
  image: string | null;
}

export interface PropertyTypeFacet {
  value: string;
  label: string;
  count: number;
  uiType: UiPropertyType | null;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  phoneVerified: boolean;
  avatar: string | null;
  /** True when this user may open the Blog Studio. */
  canUseStudio: boolean;
  /** True for full admins — gates team management within the Studio. */
  isStaff: boolean;
}

/** Normalized list envelope used by every paginated view. */
export interface Paginated<T> {
  items: T[];
  total: number;
  nextOffset: number | null;
  previousOffset: number | null;
}

export interface ListingQuery {
  search?: string;
  city?: string;
  status?: string;
  /**
   * Buy ("sale", the default) or Rent. Sent as `transaction_type`, which the
   * backend applies in SQL, and which also moves price filters onto the
   * monthly lease for rentals.
   */
  transaction?: ListingTransaction;
  type?: string;
  priceMin?: number;
  priceMax?: number;
  bedsMin?: number;
  bathsMin?: number;
  sqftMin?: number;
  sqftMax?: number;
  yearBuiltMin?: number;
  yearBuiltMax?: number;
  /** Maximum floors (backend `stories_max`). URL `floorsMax`. */
  storiesMax?: number;
  /** Monthly maintenance fee range. URL `feeMin` / `feeMax`. */
  feeMin?: number;
  feeMax?: number;
  /** First listed on or after this YYYY-MM-DD date. URL `listedSince`. */
  listedSince?: string;
  /** Minimum garage spaces (backend `garages_min`). */
  garagesMin?: number;
  /** Minimum floors / stories (backend `stories_min`). */
  storiesMin?: number;
  /**
   * Basement preference. URL `basement=yes|finished|unfinished|apartment|none`.
   */
  basement?: "yes" | "finished" | "unfinished" | "apartment" | "none";
  /** Maximum days on market (backend `days_on_market_max`). URL `domMax`. */
  domMax?: number;
  /** Require a family room (backend `family_room=1`). URL `familyRoom=1`. */
  familyRoom?: boolean;
  /** Minimum kitchens (backend `kitchens_min`). URL `kitchens`. */
  kitchensMin?: number;
  /**
   * Raw feed `property_sub_type` values, passed straight to the backend's
   * repeatable filter. Distinct from `type`, which is a canonical UI label
   * matched client-side — see lib/api/properties.ts.
   */
  propertySubTypes?: string[];
  /**
   * Description keywords, OR'ed ("power of sale"). URL `keywords`, comma
   * separated. Forces a strict (no-fallback) search.
   */
  keywords?: string[];
  /** Feed `structure_type`, e.g. "House". URL `building`. Strict search. */
  buildingType?: string;
  /** Feed `common_interest`, e.g. "Freehold". URL `ownership`. Strict search. */
  ownership?: string;
  sort?: ListingSort;
  limit?: number;
  offset?: number;
  hasLease?: boolean;
  bounds?: { latMin: number; latMax: number; lngMin: number; lngMax: number };
  /** Drawn map area, open ring. URL `poly=lat,lng;…` (lib/map/polygon.ts). */
  polygon?: Array<{ lat: number; lng: number }>;
  /**
   * Display-only label when `polygon` came from a school proximity search.
   * URL `school`. Never sent to the listings backend.
   */
  schoolLabel?: string;
  /** Radius (km) used to build the school box. URL `schoolKm`. Display only. */
  schoolKm?: number;
  /** Normalised compact codes — FSAs ("L7A") and/or full codes ("L7A3K9"). */
  postalCodes?: string[];
  /** Only listings with an upcoming open house (today onwards). */
  openHouse?: boolean;
  /**
   * AI search's soft preferences ("near subway, big backyard"). URL `ai`.
   * Never filters: with the "relevance" sort the backend ranks the filtered
   * results by listing-description similarity to it.
   */
  semantic?: string;
  /**
   * Presentation only (grid is the default). Carried on the query so links
   * built from it — pagination, status tabs — keep the chosen view; it is
   * never sent to the backend.
   */
  view?: "list";
}

export type ListingSort =
  | "relevance"
  | "newest"
  | "price-asc"
  | "price-desc"
  | "beds-desc"
  | "sqft-desc";

export const LISTING_SORTS: Array<{ value: ListingSort; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "beds-desc", label: "Most Bedrooms" },
  { value: "sqft-desc", label: "Largest Area" },
];

/** Offered only while an AI search's preferences (`ai`) are applied. */
export const RELEVANCE_SORT: { value: ListingSort; label: string } = {
  value: "relevance",
  label: "Best match",
};

/** `properties/facets/` — counts for the current filter set (API_GAPS G2). */
export interface PropertyFacets {
  status: Record<string, number>;
  /** Counts per status tab ("active" / "sold" / "de-listed"); null on older backends. */
  statusGroup: Partial<Record<"active" | "sold" | "de-listed", number>> | null;
  propertySubType: Record<string, number>;
  priceBuckets: Array<{ min: number; max: number | null; count: number }>;
  /** Listings with an upcoming open house; null when the backend omits it. */
  openHouse?: number | null;
}

/** One city row from `catalog-stats/bulk/` (API_GAPS G4). */
export interface CityCatalogStat {
  city: string;
  activeCount: number;
  medianListPrice: number | null;
  /** Mean asking price of active listings; null on older backends. */
  meanListPrice: number | null;
  /**
   * Closed sales in the last 90 days (AMPRE). Null when sold data was not
   * fetched or the upstream failed, which is different from 0 sales.
   */
  soldCount90d: number | null;
  avgSoldPrice90d: number | null;
  medianSoldPrice90d: number | null;
}

/** `stats/platform/` — the only sourced figures we may quote (API_GAPS G13). */
export interface PlatformStats {
  registeredUsers: number;
  activeListings: number;
  inquiriesLast30d: number;
  generatedAt: string | null;
}
