/**
 * Translation layer: mls-v2 RESO payloads → HomeAtlas UI domain objects.
 *
 * All backend-shape knowledge lives here. Components never read RESO field
 * names directly, so a backend change is a one-file fix.
 *
 * Documented in docs/02-MAPPING.md. Where the backend cannot supply a field the
 * mapper returns null and the UI shows an unavailable state — it never guesses.
 */

import type {
  BackendMedia,
  BackendPropertyDetail,
  BackendPropertySummary,
  BackendPropertyTypeFacet,
  BackendRoom,
  BackendUserProfile,
} from "@/lib/types/backend";
import {
  UI_PROPERTY_TYPES,
  type AuthUser,
  type PropertyBadge,
  type PropertyDetail,
  type PropertyFact,
  type PropertyImage,
  type PropertyStatus,
  type PropertySummary,
  type PropertyTypeFacet,
  type PropertyWashroom,
  type UiPropertyType,
} from "@/lib/types/domain";
import {
  EMPTY,
  daysSince,
  splitFeatures,
  titleCase,
  toNumber,
  formatLeasePrice,
  formatNumber,
  formatPrice,
} from "@/lib/utils/format";

/* -------------------------------------------------------------------------- */
/* Property type normalization                                                */
/* -------------------------------------------------------------------------- */

/**
 * RESO `property_sub_type` is free text from the DDF feed ("Single Family",
 * "Att/Row/Townhouse", "Condo Apartment", …). The reference UI filters on six
 * canonical types, so we map onto those where possible and otherwise pass the
 * raw label through rather than dropping the listing from view.
 */
const TYPE_PATTERNS: Array<{ test: RegExp; type: UiPropertyType }> = [
  { test: /semi[-\s]?detached/i, type: "Semi-Detached" },
  { test: /town\s?(house|home)|att\/row|row\s?house|freehold town/i, type: "Townhome" },
  { test: /condo|apartment|co-?op|loft/i, type: "Condo" },
  { test: /detached|single\s?family|house/i, type: "Detached" },
  { test: /lease|rental|rent/i, type: "Rental" },
];

export function normalizePropertyType(raw: string | null | undefined): {
  label: string | null;
  uiType: UiPropertyType | null;
} {
  if (!raw || !raw.trim()) return { label: null, uiType: null };
  const value = raw.trim();
  for (const { test, type } of TYPE_PATTERNS) {
    if (test.test(value)) return { label: type, uiType: type };
  }
  return { label: titleCase(value), uiType: null };
}

/**
 * Home type from `structure_type` (+ attached flag) when the feed has it, else
 * from `property_sub_type`. Needed because the sub-type is "Single Family" for
 * condos and houses alike, which labelled every apartment "Detached".
 */
export function resolvePropertyType(
  subType: string | null | undefined,
  structureType: string | null | undefined,
  attached: boolean | null | undefined,
): { label: string | null; uiType: UiPropertyType | null } {
  const structure = (structureType ?? "").trim().toLowerCase();
  if (structure === "apartment") return { label: "Condo", uiType: "Condo" };
  if (structure.startsWith("row")) return { label: "Townhome", uiType: "Townhome" };
  if (structure === "house") {
    return attached ? { label: "Semi-Detached", uiType: "Semi-Detached" } : { label: "Detached", uiType: "Detached" };
  }
  return normalizePropertyType(subType);
}

/** Maps a UI type back to a regex for client-side filtering (see API_GAPS G1). */
export function matchesUiType(raw: string | null | undefined, uiType: string): boolean {
  const { label } = normalizePropertyType(raw);
  return (label ?? "").toLowerCase() === uiType.toLowerCase();
}

/* -------------------------------------------------------------------------- */
/* Status                                                                      */
/* -------------------------------------------------------------------------- */

export function normalizeStatus(raw: string | null | undefined): PropertyStatus {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) return "other";
  if (value === "active" || value.startsWith("active")) return "active";
  if (value === "sold" || value === "closed") return "sold";
  if (value === "leased" || value === "rented") return "leased";
  // Terminated / Expired / Withdrawn / Cancelled — never show as For Sale.
  return "other";
}

export function statusLabel(status: PropertyStatus): string {
  switch (status) {
    case "active":
      return "For Sale";
    case "sold":
      return "Sold";
    case "leased":
      return "Leased";
    default:
      return "Off Market";
  }
}

/**
 * Exact sqft, else DDF min/max band floor, else a number mentioned in remarks
 * ("560 Sqft"). Returns null rather than inventing a value.
 */
export function resolveSqft(raw: {
  building_area_total?: string | null;
  living_area?: string | null;
  living_area_minimum?: string | null;
  living_area_maximum?: string | null;
  above_grade_finished_area?: string | null;
  public_remarks?: string | null;
}): { sqft: number | null; sqftLabel: string | null } {
  const exact =
    toNumber(raw.building_area_total) ??
    toNumber(raw.living_area) ??
    toNumber(raw.above_grade_finished_area);
  if (exact && exact > 0) {
    return { sqft: exact, sqftLabel: `${formatNumber(exact)} sq ft` };
  }

  const min = toNumber(raw.living_area_minimum);
  const max = toNumber(raw.living_area_maximum);
  if (min && max && min > 0 && max > 0 && min !== max) {
    return {
      sqft: min,
      sqftLabel: `${formatNumber(min)}–${formatNumber(max)} sq ft`,
    };
  }
  if (min && min > 0) {
    return { sqft: min, sqftLabel: `${formatNumber(min)} sq ft` };
  }
  if (max && max > 0) {
    return { sqft: max, sqftLabel: `${formatNumber(max)} sq ft` };
  }

  const fromRemarks = raw.public_remarks?.match(
    /(\d[\d,]*)\s*(?:sq\.?\s*ft|sqft|square\s*feet)/i,
  );
  if (fromRemarks?.[1]) {
    const n = toNumber(fromRemarks[1].replace(/,/g, ""));
    if (n && n > 0 && n < 100_000) {
      return { sqft: n, sqftLabel: `${formatNumber(n)} sq ft` };
    }
  }

  return { sqft: null, sqftLabel: null };
}

/* -------------------------------------------------------------------------- */
/* Badges                                                                      */
/* -------------------------------------------------------------------------- */

const NEW_LISTING_DAYS = 7;
/** A price cut is only worth badging once it is a real move, not a rounding. */
const PRICE_DROP_MIN_PCT = 1;

/**
 * Open House and Price Drop are now derivable: mls-v2 exposes `next_open_house`
 * (G6) and `previous_list_price` / `price_change_timestamp` (G7). Both are still
 * optional on the payload, so every read is guarded — an older backend simply
 * yields no badge rather than a crash.
 *
 * Order is by usefulness to a buyer scanning a grid: a scheduled visit beats a
 * price cut, which beats "new", which beats a brokerage marketing flag.
 */
function deriveBadge(
  raw: BackendPropertySummary,
  status: PropertyStatus,
): PropertyBadge | null {
  if (status === "sold") return { label: "Sold", tone: "sold" };

  if (isUpcomingOpenHouse(raw.next_open_house)) {
    return { label: "Open House", tone: "openHouse" };
  }

  const drop = priceDropPercent(raw);
  if (drop !== null && drop >= PRICE_DROP_MIN_PCT) {
    return { label: `Price Drop ${Math.round(drop)}%`, tone: "priceDrop" };
  }

  const age = daysSince(raw.original_entry_timestamp ?? raw.modification_timestamp ?? null);
  if (age !== null && age <= NEW_LISTING_DAYS) {
    return { label: "New", tone: "new" };
  }

  const category = (raw.category_type ?? "").toLowerCase();
  if (category.includes("exclusive")) return { label: "Exclusive", tone: "exclusive" };
  if (raw.is_featured) return { label: "Featured", tone: "featured" };

  return null;
}

/** True when the feed carries an open house whose END is still in the future. */
function isUpcomingOpenHouse(
  event: BackendPropertySummary["next_open_house"],
): boolean {
  const end = event?.end ?? event?.start;
  if (!end) return false;
  const ends = Date.parse(end);
  return Number.isFinite(ends) && ends >= Date.now();
}

/**
 * Percentage cut from the previous list price, or null when there was no cut.
 * Increases return null — an upward revision is not a "price drop".
 */
function priceDropPercent(raw: BackendPropertySummary): number | null {
  const previous = toNumber(raw.previous_list_price);
  const current = toNumber(raw.list_price);
  if (!previous || !current || previous <= 0 || current <= 0) return null;
  if (current >= previous) return null;
  return ((previous - current) / previous) * 100;
}

/* -------------------------------------------------------------------------- */
/* Media                                                                       */
/* -------------------------------------------------------------------------- */

/** Make relative Django `/media/...` paths absolute against the API origin. */
function resolveMediaUrl(raw: string | null | undefined): string {
  const url = (raw || "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (!url.startsWith("/")) return url;
  const base =
    (typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL)) ||
    "";
  if (!base) return url;
  return `${base.replace(/\/$/, "")}${url}`;
}

function summaryImage(raw: BackendPropertySummary): string | null {
  const url = resolveMediaUrl(raw.media?.media_url);
  return url || null;
}

function mapImages(media: BackendMedia[] | undefined): PropertyImage[] {
  if (!Array.isArray(media)) return [];
  return media
    .map((m, index) => {
      // Prefer the feed CDN URL. media_file is only for rare Cloudinary
      // uploads; when both exist, media_url is what DDF/AMPRE keep fresh.
      const rawUrl = m.media_url || m.url || m.media_file;
      return {
        url: resolveMediaUrl(rawUrl),
        category: m.media_category ?? null,
        isPreferred: Boolean(m.is_preferred),
        order: typeof m.order === "number" ? m.order : index,
      };
    })
    .filter((m) => m.url.length > 0)
    // Preferred photo leads the gallery, then the feed's own order.
    .sort((a, b) => {
      const preferred = Number(b.isPreferred) - Number(a.isPreferred);
      if (preferred !== 0) return preferred;
      return a.order - b.order;
    })
    .map(({ url, category, isPreferred }) => ({ url, category, isPreferred }));
}

/**
 * DDF often packs the community into City as "Toronto (Casa Loma)" while
 * leaving `city_region` empty. Split that so Municipality / Community Key
 * Facts (and city search) match the feed intent.
 */
export function parseCityAndCommunity(
  city: string | null | undefined,
  cityRegion: string | null | undefined,
  subdivision: string | null | undefined,
): { municipality: string | null; community: string | null } {
  const rawCity = city?.trim() || "";
  const region = cityRegion?.trim() || "";
  const sub = subdivision?.trim() || "";

  let municipality: string | null = rawCity || null;
  let fromParen: string | null = null;

  const match = rawCity.match(/^(.+?)\s*\((.+)\)\s*$/);
  if (match) {
    municipality = match[1].trim() || null;
    fromParen = match[2].trim() || null;
  }

  return {
    municipality,
    community: region || sub || fromParen || null,
  };
}

/** Unit # from the dedicated column, or from common address patterns when empty. */
export function deriveUnitNumber(
  unit: string | null | undefined,
  address: string | null | undefined,
): string | null {
  const explicit = unit?.trim();
  if (explicit) return explicit;
  const addr = address?.trim() || "";
  if (!addr) return null;
  const unitToken = addr.match(/\bunit\s*#?\s*([A-Za-z0-9-]+)\b/i);
  if (unitToken?.[1]) return unitToken[1];
  // "507 - 2450 BLOOR STREET W" — unit before the street number.
  const leading = addr.match(/^(\d+[A-Za-z]?)\s*[-–]\s*\d+/);
  return leading?.[1] ?? null;
}

/* -------------------------------------------------------------------------- */
/* Summary                                                                     */
/* -------------------------------------------------------------------------- */

export function mapPropertySummary(raw: BackendPropertySummary): PropertySummary {
  const status = normalizeStatus(raw.standard_status);
  const listPrice = toNumber(raw.list_price);
  // Monthly rent. DDF puts it in total_actual_rent for most rentals (1,172 of
  // 1,215) and in lease_amount for the rest; list_price is null for both.
  const leaseAmount = toNumber(raw.lease_amount) ?? toNumber(raw.total_actual_rent);
  const isLease = (!listPrice || listPrice <= 0) && Boolean(leaseAmount && leaseAmount > 0);
  const { label, uiType } = resolvePropertyType(raw.property_sub_type, raw.structure_type, raw.property_attached_yn);
  const { municipality, community } = parseCityAndCommunity(
    raw.city,
    raw.city_region,
    raw.subdivision_name,
  );

  // building_area_total is the RESO primary; fall through LivingArea, the
  // DDF min/max band, above-grade, then a sqft mention in public remarks.
  const { sqft } = resolveSqft(raw);

  return {
    id: raw.listing_key,
    address: raw.unparsed_address?.trim() || "Address not disclosed",
    // Domain: neighbourhood = Community, community = Municipality.
    neighbourhood: community,
    community: municipality,
    price: isLease ? leaseAmount : listPrice,
    isLease,
    beds: raw.bedrooms_total ?? null,
    baths: raw.bathrooms_total_integer ?? null,
    type: isLease && !uiType ? "Rental" : label,
    propertySubType: raw.property_sub_type?.trim() || null,
    uiType: isLease ? "Rental" : uiType,
    sqft,
    status,
    badge: deriveBadge(raw, status),
    mls: raw.listing_id?.trim() || raw.listing_key,
    image: summaryImage(raw),
    photosCount: raw.photos_count ?? 0,
    latitude: toNumber(raw.latitude),
    longitude: toNumber(raw.longitude),
    postalCode: raw.postal_code?.trim() || null,
    yearBuilt: raw.year_built ?? null,
    description: raw.public_remarks?.trim() || null,
    statusChangedAt: raw.status_change_timestamp ?? null,
    listedAt: raw.original_entry_timestamp ?? null,
    closePrice: toNumber(raw.close_price),
    closeDate: raw.close_date ?? null,
    previousListPrice: toNumber(raw.previous_list_price),
    priceChangedAt: raw.price_change_timestamp ?? null,
    nextOpenHouse:
      raw.next_open_house?.start
        ? { start: raw.next_open_house.start, end: raw.next_open_house.end ?? null }
        : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Detail                                                                      */
/* -------------------------------------------------------------------------- */

/** Second measure in "35 x 110 ft". The feed stores both in one string. */
function lotDepthLabel(dimensions: string | null | undefined): string | null {
  const parts = (dimensions ?? "")
    .split(/[x×]/i)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  return /ft/i.test(parts[1]) ? parts[1] : `${parts[1]} ft`;
}

/**
 * Condo floor / suite level from room rows. Skips house-style levels
 * (Main / Second / Basement) the same way the AVM report does.
 */
export function deriveCondoLevel(rooms: BackendRoom[] | null | undefined): string | null {
  if (!rooms?.length) return null;
  for (const room of rooms) {
    const raw = (room.room_level || "").trim();
    if (!raw) continue;
    const lower = raw.toLowerCase();
    if (
      /(main|second|third|fourth|basement|lower|ground|upper|sub-)/.test(lower)
    ) {
      continue;
    }
    return titleCase(raw) ?? raw;
  }
  return null;
}

/** True/false when feed text mentions a locker; null when there is nothing to scan. */
export function deriveLocker(
  ...blobs: Array<string | null | undefined>
): boolean | null {
  const joined = blobs.filter(Boolean).join(" ").toLowerCase();
  if (!joined.trim()) return null;
  if (/\b(?:no|without|not)\s+locker\b/.test(joined) || /\blocker\s*[:=]\s*no\b/.test(joined)) {
    return false;
  }
  return /\blocker\b/.test(joined);
}

/**
 * Calendar days from list entry to close (sold) or today (active).
 * Matches mls-v2 `avm_report._days_on_market`.
 */
export function deriveDaysOnMarket(
  listedAt: string | null | undefined,
  closeDate: string | null | undefined,
): number | null {
  if (!listedAt) return null;
  const start = new Date(listedAt);
  if (Number.isNaN(start.getTime())) return null;
  const end = closeDate ? new Date(closeDate) : new Date();
  if (Number.isNaN(end.getTime())) return null;
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
  return days >= 0 ? days : null;
}

/**
 * Rented equipment under contract (HWT, etc.). Prefer OtherEquipment; fall
 * back to inclusions only when they clearly describe a rental.
 */
export function deriveRentalItems(
  otherEquipment: string | null | undefined,
  inclusions: string | null | undefined,
): string | null {
  const equipment = otherEquipment?.trim();
  if (equipment) return titleCase(equipment);
  const text = inclusions?.trim();
  if (!text) return null;
  if (!/rental|hot\s*water|hwt|\bleased\b/i.test(text)) return null;
  return titleCase(text);
}

function fact(label: string, value: string | number | null | undefined): PropertyFact | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text || text === EMPTY) return null;
  return { label, value: text };
}

function keepFacts(facts: Array<PropertyFact | null>): PropertyFact[] {
  // Omit unknown MLS fields entirely — never render a dash placeholder row.
  return facts.filter((f): f is PropertyFact => {
    if (f === null) return false;
    const value = f.value.trim();
    return value.length > 0 && value !== EMPTY;
  });
}

function groupColumns(
  title: string,
  left: Array<PropertyFact | null>,
  right: Array<PropertyFact | null>,
) {
  const leftKept = keepFacts(left);
  const rightKept = keepFacts(right);
  if (leftKept.length === 0 && rightKept.length === 0) return null;
  return {
    title,
    left: leftKept,
    right: rightKept,
    facts: [...leftKept, ...rightKept],
  };
}

/** Decimal feet → `12'6"` so room dimensions always carry feet/inches units. */
export function formatFeetInches(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/['′]|ft|feet|in|″|"/i.test(raw)) return raw;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return raw;
  const feet = Math.floor(n);
  let inches = Math.round((n - feet) * 12);
  if (inches === 12) return `${feet + 1}'`;
  if (inches === 0) return `${feet}'`;
  return `${feet}'${inches}"`;
}

/**
 * Room dimensions with feet/inches units. Prefers the feed’s dimension string;
 * falls back to length × width.
 */
export function formatRoomDimensions(room: BackendRoom): string | null {
  const dims = room.room_dimensions?.trim();
  if (dims) {
    if (/['′]|ft|feet|in|″|"/i.test(dims)) return dims;
    const parts = dims.split(/[x×]/i).map((part) => part.trim()).filter(Boolean);
    if (parts.length === 2) {
      const a = formatFeetInches(parts[0]);
      const b = formatFeetInches(parts[1]);
      if (a && b) return `${a} × ${b}`;
    }
    const asFeet = formatFeetInches(dims);
    return asFeet && asFeet !== dims ? asFeet : `${dims} ft`;
  }
  const length = formatFeetInches(room.room_length);
  const width = formatFeetInches(room.room_width);
  if (length && width) return `${length} × ${width}`;
  return length ?? width;
}

/** Bathroom / washroom / powder rows for the Washroom Info table. */
export function deriveWashrooms(rooms: BackendRoom[] | null | undefined): PropertyWashroom[] {
  if (!rooms?.length) return [];
  const out: PropertyWashroom[] = [];
  for (const room of rooms) {
    const type = (room.room_type || "").trim();
    if (!type) continue;
    if (!/bath|wash\s*room|powder/i.test(type)) continue;
    const blob = `${type} ${room.room_description ?? ""}`;
    const piecesMatch = blob.match(/(\d+)\s*[- ]?\s*(?:pc|pcs|piece)/i);
    out.push({
      count: 1,
      pieces: piecesMatch ? Number(piecesMatch[1]) : null,
      level: titleCase(room.room_level),
    });
  }
  return out;
}

function deriveLaundryLevel(rooms: BackendRoom[] | null | undefined): string | null {
  if (!rooms?.length) return null;
  for (const room of rooms) {
    if (!/laundry/i.test(room.room_type || "")) continue;
    return titleCase(room.room_level);
  }
  return null;
}

function yesNoFromFlag(value: boolean | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value ? "Yes" : "No";
}

/** "4-year-new" / "built in 2022" in remarks when YearBuilt is blank. */
export function deriveYearBuiltFromRemarks(
  remarks: string | null | undefined,
  now = new Date(),
): number | null {
  if (!remarks) return null;
  const builtIn = remarks.match(/\bbuilt\s+in\s+(\d{4})\b/i);
  if (builtIn?.[1]) {
    const year = Number(builtIn[1]);
    if (year >= 1800 && year <= now.getFullYear() + 1) return year;
  }
  const ageNew = remarks.match(/(\d+)\s*[- ]?\s*year(?:s)?[ -]?new\b/i);
  if (ageNew?.[1]) {
    const age = Number(ageNew[1]);
    if (age >= 0 && age < 300) return now.getFullYear() - age;
  }
  return null;
}

/**
 * Kitchen count + family-room flag from room rows (same signals as the AVM
 * report) when the dedicated feed columns are empty.
 */
export function deriveRoomSignals(rooms: BackendRoom[] | null | undefined): {
  kitchens: number | null;
  familyRoom: boolean | null;
} {
  if (!rooms?.length) return { kitchens: null, familyRoom: null };
  let kitchens = 0;
  let familyRoom = false;
  for (const room of rooms) {
    const type = (room.room_type || "").toLowerCase();
    if (type.includes("kitchen")) kitchens += 1;
    if (type.includes("family")) familyRoom = true;
  }
  return {
    kitchens: kitchens > 0 ? kitchens : null,
    // Rooms were listed — absence of a family room is a real "No", not unknown.
    familyRoom,
  };
}

export function mapPropertyDetail(raw: BackendPropertyDetail): PropertyDetail {
  const summary = mapPropertySummary(raw as unknown as BackendPropertySummary);
  const images = mapImages(raw.media);

  const taxAnnual = toNumber(raw.tax_annual_amount);
  const assocFee = toNumber(raw.association_fee);
  const lotFrontage = toNumber(raw.frontage_length_numeric);

  const above = toNumber(raw.bedrooms_above_grade);
  const below = toNumber(raw.bedrooms_below_grade);
  const bedsLabel =
    above !== null && below !== null && below > 0 ? `${above}+${below}` : null;
  const roomSignals = deriveRoomSignals(raw.rooms);
  const roomCount = (raw.rooms ?? []).filter((room) => titleCase(room.room_type)).length;

  const level = deriveCondoLevel(raw.rooms);
  const locker = deriveLocker(
    raw.building_features,
    raw.parking_features,
    raw.interior_features,
    raw.lot_features,
  );
  const daysOnMarket = deriveDaysOnMarket(
    raw.original_entry_timestamp ?? summary.listedAt,
    raw.close_date ?? summary.closeDate,
  );
  const rentalItems = deriveRentalItems(raw.other_equipment, raw.inclusions);
  const unitNumber = deriveUnitNumber(raw.unit_number, raw.unparsed_address);
  const style = titleCase(raw.architectural_style);
  const basement = titleCase(raw.basement);
  const associationFeeIncludes = titleCase(raw.association_fee_includes);
  const lotDepth = lotDepthLabel(raw.lot_size_dimensions);
  const sqftAboveGrade = toNumber(raw.above_grade_finished_area);
  const resolvedArea = resolveSqft(raw);
  const sqft = summary.sqft ?? resolvedArea.sqft;
  const sqftLabel = resolvedArea.sqftLabel;
  const kitchens = raw.kitchens ?? roomSignals.kitchens;
  const familyRoom =
    typeof raw.family_room === "boolean"
      ? raw.family_room
      : roomSignals.familyRoom;
  // Prefer dedicated garage column; fall back to parking total when the feed
  // describes garage parking (same rule the listing filters use).
  const parkingFeatures = (raw.parking_features || "").toLowerCase();
  const garageSpaces =
    toNumber(raw.garages) ??
    (/(garage|carport)/.test(parkingFeatures) ? raw.parking_total ?? null : null);
  const stories = raw.stories ?? null;
  const ownership = titleCase(raw.common_interest);
  const yearBuilt =
    raw.year_built ??
    summary.yearBuilt ??
    deriveYearBuiltFromRemarks(raw.public_remarks ?? summary.description);
  const propertyAge =
    yearBuilt != null && yearBuilt > 1800
      ? Math.max(0, new Date().getFullYear() - yearBuilt)
      : null;
  const potlMonthlyFees = toNumber(
    raw.potl_monthly_fees !== undefined && raw.potl_monthly_fees !== null
      ? String(raw.potl_monthly_fees)
      : null,
  );

  const maintenanceLabel = assocFee
    ? `${formatPrice(assocFee)}${raw.association_fee_frequency ? ` / ${raw.association_fee_frequency.toLowerCase()}` : ""}`
    : null;
  const daysOnMarketLabel =
    daysOnMarket === null
      ? null
      : `${daysOnMarket} day${daysOnMarket === 1 ? "" : "s"}`;
  const taxYear =
    typeof raw.tax_year === "number" && Number.isFinite(raw.tax_year) ? raw.tax_year : null;
  const taxLabel = taxAnnual
    ? taxYear
      ? `${formatPrice(taxAnnual)} / ${taxYear}`
      : formatPrice(taxAnnual)
    : null;
  const ageLabel =
    propertyAge === null
      ? null
      : `${propertyAge} year${propertyAge === 1 ? "" : "s"}`;
  const dataSource =
    titleCase(raw.origin_system_name) || titleCase(raw.list_aor);
  const aboveGradeLabel =
    sqftAboveGrade && sqftAboveGrade > 0
      ? `${formatNumber(sqftAboveGrade)} sq ft`
      : null;
  const hasGarage =
    garageSpaces !== null
      ? garageSpaces > 0
      : Boolean(raw.garage_size?.trim()) || /(garage|carport)/.test(parkingFeatures)
        ? true
        : null;
  const fireplaceLabel =
    typeof raw.fireplace_yn === "boolean"
      ? raw.fireplace_yn
        ? raw.fireplaces_total && raw.fireplaces_total > 0
          ? `Yes (${raw.fireplaces_total})`
          : "Yes"
        : "No"
      : raw.fireplaces_total != null
        ? raw.fireplaces_total > 0
          ? String(raw.fireplaces_total)
          : "No"
        : null;
  const poolLabel = titleCase(raw.pool_features);
  const exteriorLabel = titleCase(raw.construction_materials);
  const laundryLevel = deriveLaundryLevel(raw.rooms);
  const driveSpacesMatch = (raw.parking_features || "").match(
    /(\d+)\s*(?:drive|driveway|parking\s*drive)/i,
  );
  const parkingDriveSpaces = driveSpacesMatch ? driveSpacesMatch[1] : null;
  const inclusions =
    typeof raw.inclusions === "string" && raw.inclusions.trim()
      ? raw.inclusions.trim()
      : null;
  const washrooms = deriveWashrooms(raw.rooms);

  // Listing Details — Overview / More details columns match the mockup order.
  // Sparse MLS fields are omitted per column (no dash placeholders).
  const factGroups = [
    groupColumns(
      "Overview",
      [
        fact("Listing #", summary.mls),
        fact("Data source", dataSource),
        fact("Ownership / Title", ownership),
        // Area is only shown when it differs from Community (avoid duplicates).
        fact(
          "Area",
          raw.city_region?.trim() &&
            summary.neighbourhood &&
            raw.city_region.trim().toLowerCase() !== summary.neighbourhood.toLowerCase()
            ? titleCase(raw.city_region)
            : null,
        ),
        fact("Address", summary.address),
        fact("Postal code", summary.postalCode),
        fact("Approx. age", ageLabel),
      ],
      [
        fact("Status", statusLabel(summary.status)),
        fact("Property tax/year", taxLabel),
        fact("Property type", summary.type),
        fact("Municipality", summary.community),
        fact("Community", summary.neighbourhood),
        fact("Size", sqftLabel),
      ],
    ),
    groupColumns(
      "More details",
      [
        fact(
          "Lot frontage",
          lotFrontage ? `${formatNumber(lotFrontage)} ft` : null,
        ),
        fact("Square feet above ground", aboveGradeLabel),
        fact("Garage", yesNoFromFlag(hasGarage)),
        fact(
          "Garage parking spaces",
          garageSpaces === null ? null : formatNumber(garageSpaces),
        ),
        fact("Rooms", roomCount || null),
        fact("Number of bedrooms", bedsLabel ?? summary.beds),
        fact("Number of kitchens", kitchens),
        fact("Number of floors", stories),
        fact("Locker", yesNoFromFlag(locker)),
        fact("Maintenance", maintenanceLabel),
        fact("Exterior", exteriorLabel),
        fact("Fireplace", fireplaceLabel),
        fact("Laundry level", laundryLevel),
        fact("Water", titleCase(raw.water_source)),
        fact("Heating", titleCase(raw.heating)),
      ],
      [
        fact("Lot depth", lotDepth),
        fact("CDOM", daysOnMarketLabel),
        fact("Style", style),
        fact("Basement", basement),
        fact("Garage type", titleCase(raw.garage_size)),
        fact(
          "Total parking spaces",
          raw.parking_total === null || raw.parking_total === undefined
            ? null
            : formatNumber(raw.parking_total),
        ),
        fact("Family room", yesNoFromFlag(familyRoom)),
        fact("Number of washrooms", summary.baths),
        fact("Year built", yearBuilt),
        fact(
          "POTL monthly fee",
          potlMonthlyFees === null ? null : formatPrice(potlMonthlyFees),
        ),
        fact("Level", level),
        fact("Unit #", unitNumber),
        fact("Included in maintenance cost", associationFeeIncludes),
        fact("Parking drive spaces", parkingDriveSpaces),
        fact("Pool", poolLabel),
        fact("Under contract", rentalItems),
        fact("Sewer", titleCase(raw.sewer)),
        fact("Cooling", titleCase(raw.cooling)),
      ],
    ),
  ].filter(
    (
      g,
    ): g is {
      title: string;
      left: PropertyFact[];
      right: PropertyFact[];
      facts: PropertyFact[];
    } => g !== null,
  );

  const features = collectFeatures(raw);

  return {
    ...summary,
    sqft: sqft && sqft > 0 ? sqft : null,
    yearBuilt,
    // Detail carries the full media array; prefer it over the summary's single image.
    image: images[0]?.url ?? summary.image,
    images,
    rooms: (raw.rooms ?? [])
      .map((r) => ({
        name: titleCase(r.room_type),
        level: titleCase(r.room_level),
        dimensions: formatRoomDimensions(r),
      }))
      .filter((r) => r.name !== null),
    unitNumber,
    stateOrProvince: raw.state_or_province?.trim() || null,
    lotFrontage,
    lotDepth,
    lotSizeDimensions: raw.lot_size_dimensions?.trim() || null,
    parkingTotal: raw.parking_total ?? null,
    bedsLabel,
    garageSpaces,
    taxAnnualAmount: taxAnnual,
    associationFee: assocFee,
    associationFeeFrequency: raw.association_fee_frequency?.trim() || null,
    associationFeeIncludes,
    style,
    level,
    locker,
    basement,
    kitchens,
    daysOnMarket,
    sqftAboveGrade,
    familyRoom,
    stories,
    ownership,
    propertyAge,
    potlMonthlyFees,
    rentalItems,
    inclusions,
    washrooms,
    features,
    factGroups,
    virtualTourUrl: httpUrl(raw.virtual_tour_url),
  };
}

/** Only http(s) tour links are rendered. Anything else is dropped. */
function httpUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Amenity/feature chips shown on the detail page — all MLS feature columns. */
export function collectFeatures(raw: BackendPropertyDetail): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of [
    ...splitFeatures(raw.interior_features),
    ...splitFeatures(raw.exterior_features),
    ...splitFeatures(raw.community_features),
    ...splitFeatures(raw.building_features),
    ...splitFeatures(raw.lot_features),
    ...splitFeatures(raw.pool_features),
    ...splitFeatures(raw.appliances),
    ...splitFeatures(raw.view),
  ]) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(part);
    if (out.length >= 24) break;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Facets & user                                                               */
/* -------------------------------------------------------------------------- */

export function mapPropertyTypeFacet(raw: BackendPropertyTypeFacet): PropertyTypeFacet {
  const fromApi = (raw.ui_type ?? "").trim();
  if (fromApi && (UI_PROPERTY_TYPES as readonly string[]).includes(fromApi)) {
    return {
      value: raw.value,
      label: raw.label || fromApi,
      count: raw.count,
      uiType: fromApi as UiPropertyType,
    };
  }
  const { label, uiType } = normalizePropertyType(raw.value);
  return {
    value: raw.value,
    label: label ?? raw.label,
    count: raw.count,
    uiType,
  };
}

/** Display name for nav / account UI when the profile name fields are sparse. */
export function displayNameFromProfile(
  raw: Pick<BackendUserProfile, "name" | "first_name" | "last_name" | "email">,
): string {
  const composed = [raw.first_name, raw.last_name]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ");
  const named = (raw.name ?? "").trim() || composed;
  if (named) return named;
  const email = (raw.email ?? "").trim();
  if (!email) return "";
  const local = email.split("@")[0] ?? email;
  return local
    .replace(/[._+-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapUser(raw: BackendUserProfile): AuthUser {
  return {
    id: raw.id,
    name: displayNameFromProfile(raw),
    email: raw.email,
    phone: raw.phone,
    phoneVerified: raw.phone_verified,
    avatar: raw.avatar,
    // Default to false: an unknown flag must never open a privileged door.
    canUseStudio: Boolean(raw.can_use_studio ?? (raw.is_staff || raw.can_author)),
    isStaff: Boolean(raw.is_staff),
  };
}
