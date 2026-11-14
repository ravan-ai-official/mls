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
import type {
  AuthUser,
  PropertyBadge,
  PropertyDetail,
  PropertyFact,
  PropertyImage,
  PropertyStatus,
  PropertySummary,
  PropertyTypeFacet,
  UiPropertyType,
} from "@/lib/types/domain";
import {
  EMPTY,
  daysSince,
  splitFeatures,
  titleCase,
  toNumber,
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
    .map((m) => {
      // Prefer the feed CDN URL. media_file is only for rare Cloudinary
      // uploads; when both exist, media_url is what DDF/AMPRE keep fresh.
      const rawUrl = m.media_url || m.url || m.media_file;
      return {
        url: resolveMediaUrl(rawUrl),
        category: m.media_category ?? null,
        isPreferred: Boolean(m.is_preferred),
      };
    })
    .filter((m) => m.url.length > 0)
    // Preferred photo leads the gallery, then feed order.
    .sort((a, b) => Number(b.isPreferred) - Number(a.isPreferred));
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

  // building_area_total is the RESO primary; some feeds only populate the
  // finished-area variants, so fall through rather than showing nothing.
  const sqft =
    toNumber(raw.building_area_total) ??
    toNumber(raw.living_area) ??
    toNumber(raw.above_grade_finished_area);

  return {
    id: raw.listing_key,
    address: raw.unparsed_address?.trim() || "Address not disclosed",
    neighbourhood: raw.city_region?.trim() || raw.subdivision_name?.trim() || null,
    community: raw.city?.trim() || null,
    price: isLease ? leaseAmount : listPrice,
    isLease,
    beds: raw.bedrooms_total ?? null,
    baths: raw.bathrooms_total_integer ?? null,
    type: isLease && !uiType ? "Rental" : label,
    uiType: isLease ? "Rental" : uiType,
    sqft: sqft && sqft > 0 ? sqft : null,
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
  return joined.includes("locker");
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
  if (!text) return null;
  return { label, value: text };
}

/** Always keep the row — client-requested fields should still appear when unknown. */
function factOrDash(label: string, value: string | number | null | undefined): PropertyFact {
  if (value === null || value === undefined) return { label, value: EMPTY };
  const text = String(value).trim();
  return { label, value: text || EMPTY };
}

function group(title: string, facts: Array<PropertyFact | null>) {
  const kept = facts.filter((f): f is PropertyFact => f !== null);
  return kept.length > 0 ? { title, facts: kept } : null;
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
    familyRoom: familyRoom || null,
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
  const locker = deriveLocker(raw.building_features, raw.parking_features);
  const daysOnMarket = deriveDaysOnMarket(
    raw.original_entry_timestamp ?? summary.listedAt,
    raw.close_date ?? summary.closeDate,
  );
  const rentalItems = deriveRentalItems(raw.other_equipment, raw.inclusions);
  const style = titleCase(raw.architectural_style);
  const basement = titleCase(raw.basement);
  const associationFeeIncludes = titleCase(raw.association_fee_includes);
  const lotDepth = lotDepthLabel(raw.lot_size_dimensions);
  const sqftAboveGrade = toNumber(raw.above_grade_finished_area);
  const sqft =
    summary.sqft ??
    toNumber(raw.building_area_total) ??
    toNumber(raw.living_area) ??
    sqftAboveGrade;
  const kitchens = raw.kitchens ?? roomSignals.kitchens;
  const familyRoom =
    typeof raw.family_room === "boolean" ? raw.family_room : roomSignals.familyRoom;
  // Prefer dedicated garage column; fall back to parking total when the feed
  // describes garage parking (same rule the listing filters use).
  const parkingFeatures = (raw.parking_features || "").toLowerCase();
  const garageSpaces =
    toNumber(raw.garages) ??
    (/(garage|carport)/.test(parkingFeatures) ? raw.parking_total ?? null : null);
  const stories = raw.stories ?? null;
  const ownership = titleCase(raw.common_interest);
  const yearBuilt = raw.year_built ?? summary.yearBuilt;
  const propertyAge =
    yearBuilt != null && yearBuilt > 1800
      ? Math.max(0, new Date().getFullYear() - yearBuilt)
      : null;
  const potlMonthlyFees = toNumber(
    raw.potl_monthly_fees !== undefined && raw.potl_monthly_fees !== null
      ? String(raw.potl_monthly_fees)
      : null,
  );

  const factGroups = [
    group("Property", [
      fact("Listing #", summary.mls),
      fact("Status", statusLabel(summary.status)),
      fact("Property type", summary.type),
      fact("Style", style),
      factOrDash("Ownership / Title", ownership),
      factOrDash("Level", level),
      fact("Unit #", raw.unit_number?.trim()),
      locker === null ? null : fact("Locker", locker ? "Yes" : "No"),
      fact("Community", summary.neighbourhood),
      fact("Municipality", summary.community),
      fact("Directions", titleCase(raw.directions)),
      daysOnMarket === null
        ? null
        : fact(
            "Days on market",
            `${daysOnMarket} day${daysOnMarket === 1 ? "" : "s"}`,
          ),
      factOrDash("Family room", familyRoom === null ? null : familyRoom ? "Yes" : "No"),
      potlMonthlyFees === null ? null : fact("POTL monthly fees", formatPrice(potlMonthlyFees)),
    ]),
    group("Building", [
      fact("Bedrooms", bedsLabel ?? summary.beds),
      fact("Bathrooms", summary.baths),
      fact("Partial baths", raw.bathrooms_partial),
      fact("Basement", basement),
      factOrDash("Number of kitchens", kitchens),
      fact("Rooms", roomCount || null),
      factOrDash(
        "Square footage",
        sqft && sqft > 0 ? `${formatNumber(sqft)} sq ft` : null,
      ),
      fact(
        "Square feet above ground",
        sqftAboveGrade && sqftAboveGrade > 0 ? `${formatNumber(sqftAboveGrade)} sq ft` : null,
      ),
      factOrDash("Year built", yearBuilt),
      factOrDash(
        "Property age",
        propertyAge === null
          ? null
          : `${propertyAge} year${propertyAge === 1 ? "" : "s"}`,
      ),
      factOrDash("Number of floors", stories),
      fact("Construction", titleCase(raw.construction_materials)),
      fact("Flooring", titleCase(raw.flooring)),
    ]),
    group("Parking & Garage", [
      fact("Garage type", titleCase(raw.garage_size)),
      factOrDash("Number of garages", garageSpaces),
      fact("Parking spaces", raw.parking_total),
      fact("Parking features", titleCase(raw.parking_features)),
    ]),
    group("Land", [
      fact("Lot size", raw.lot_size_dimensions),
      fact("Frontage", lotFrontage ? `${formatNumber(lotFrontage)} ft` : null),
      fact("Depth", lotDepth),
      fact("Zoning", titleCase(raw.zoning)),
    ]),
    group("Utilities", [
      fact("Water", titleCase(raw.water_source)),
      fact("Sewer", titleCase(raw.sewer)),
      fact("Cooling", titleCase(raw.cooling)),
      fact("Heating", titleCase(raw.heating)),
    ]),
    group("Financial", [
      fact("Property taxes", taxAnnual ? formatPrice(taxAnnual) : null),
      fact(
        "Maintenance fee",
        assocFee
          ? `${formatPrice(assocFee)}${raw.association_fee_frequency ? ` / ${raw.association_fee_frequency.toLowerCase()}` : ""}`
          : null,
      ),
      fact("Included in maintenance costs", associationFeeIncludes),
      fact("Rental items under contract", rentalItems),
    ]),
  ].filter((g): g is { title: string; facts: PropertyFact[] } => g !== null);

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
        dimensions:
          r.room_dimensions?.trim() ||
          (r.room_length && r.room_width ? `${r.room_length} × ${r.room_width}` : null),
      }))
      .filter((r) => r.name !== null),
    unitNumber: raw.unit_number?.trim() || null,
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

/** Amenity/feature chips shown on the detail page. */
export function collectFeatures(raw: BackendPropertyDetail): string[] {
  return [
    ...splitFeatures(raw.interior_features),
    ...splitFeatures(raw.exterior_features),
    ...splitFeatures(raw.community_features),
    ...splitFeatures(raw.appliances),
  ].slice(0, 24);
}

/* -------------------------------------------------------------------------- */
/* Facets & user                                                               */
/* -------------------------------------------------------------------------- */

export function mapPropertyTypeFacet(raw: BackendPropertyTypeFacet): PropertyTypeFacet {
  const { label, uiType } = normalizePropertyType(raw.value);
  return {
    value: raw.value,
    label: label ?? raw.label,
    count: raw.count,
    uiType,
  };
}

export function mapUser(raw: BackendUserProfile): AuthUser {
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    phone: raw.phone,
    phoneVerified: raw.phone_verified,
    avatar: raw.avatar,
    // Default to false: an unknown flag must never open a privileged door.
    canUseStudio: Boolean(raw.can_use_studio ?? (raw.is_staff || raw.can_author)),
    isStaff: Boolean(raw.is_staff),
  };
}
