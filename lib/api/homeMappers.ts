/**
 * Pure mappers for the /api/home/ feeds (mls-v2 backend/homepage).
 *
 * Wire shapes are snake_case and loosely typed (DRF may send decimals as
 * strings, and derived feeds can carry nulls), so every field is parsed
 * defensively. Rows missing the fields a card cannot render without are
 * dropped rather than shown half-empty.
 */

import type { IncentiveIcon } from "@/lib/home/staticSections";
import type { ConnectionIcon } from "@/lib/home/contentSections";
import {
  formatDate,
  formatNumber,
  formatPercent,
  formatPriceCompact,
  toNumber,
} from "@/lib/utils/format";

/* ---------------------------------------------------------------- helpers */

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text : null;
}

function int(value: unknown): number | null {
  const n = toNumber(value);
  return n === null ? null : Math.round(n);
}

/** Only http(s) URLs reach an <img>/<a>; anything else (javascript:, data:) is dropped. */
export function safeUrl(value: unknown): string | null {
  const text = str(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function results(payload: unknown): unknown[] {
  if (!payload || typeof payload !== "object") return [];
  const list = (payload as { results?: unknown }).results;
  return Array.isArray(list) ? list : [];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Hosts we ask next/image to optimize. MLS photo CDNs (ddfcdn.realtor.ca,
 * AMPRE, CREA) are intentionally excluded: the Vercel image optimizer often
 * 400/timeouts on those Azure blobs, which made every listing show the house
 * placeholder even when "+45 more" proved the URLs were present. Those hosts
 * still load — via `unoptimized` so the browser fetches them directly.
 *
 * Admin-entered URLs outside this list also render unoptimized so next/image
 * does not throw on an unlisted host.
 */
const OPTIMIZED_HOSTS = [
  /^res\.cloudinary\.com$/,
  /^images\.unsplash\.com$/,
  /(^|\.)estate-4u\.com$/,
];

export function isOptimizableImage(url: string): boolean {
  // Local /public assets are always optimisable.
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  try {
    const { protocol, hostname } = new URL(url);
    return (
      protocol === "https:" && OPTIMIZED_HOSTS.some((re) => re.test(hostname))
    );
  } catch {
    return false;
  }
}

/* ------------------------------------------------------- investor picks */

export interface InvestorPick {
  listingKey: string;
  address: string;
  city: string;
  bedrooms: number | null;
  bathrooms: number | null;
  listPrice: number;
  imageUrl: string | null;
  estimatedMonthlyRent: number | null;
  grossYieldPct: number | null;
  capRatePct: number | null;
  compsUsed: number | null;
}

export interface InvestorPicksFeed {
  picks: InvestorPick[];
  /** Admin-pinned rows leading the rail (remainder filled by yield rank). */
  pinnedCount: number;
  /** calc_basis.note — the disclosure shown under the heading. */
  basisNote: string | null;
  generatedAt: string | null;
}

export function mapInvestorPicks(payload: unknown): InvestorPicksFeed {
  const picks = results(payload).flatMap((raw): InvestorPick[] => {
    const r = record(raw);
    const listingKey = str(r.listing_key);
    const listPrice = toNumber(r.list_price);
    if (!listingKey || !listPrice) return [];
    return [
      {
        listingKey,
        address: str(r.address) ?? "",
        city: str(r.city) ?? "",
        bedrooms: int(r.bedrooms),
        bathrooms: int(r.bathrooms),
        listPrice,
        imageUrl: safeUrl(r.image_url),
        estimatedMonthlyRent: toNumber(r.estimated_monthly_rent),
        grossYieldPct: toNumber(r.gross_yield_pct),
        capRatePct: toNumber(r.cap_rate_pct),
        compsUsed: int(r.comps_used),
      },
    ];
  });
  const p = record(payload);
  return {
    picks,
    pinnedCount: int(p.pinned_count) ?? 0,
    basisNote: str(record(p.calc_basis).note),
    generatedAt: str(p.generated_at),
  };
}

/* ---------------------------------------------------------------- deals */

export interface PriceDropDeal {
  mlsNumber: string;
  address: string;
  city: string;
  propertySubType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  listPrice: number;
  originalPrice: number;
  dropAmount: number;
  dropPct: number;
  changedOn: string | null;
  listingKey: string | null;
  imageUrl: string | null;
}

export function mapDeals(payload: unknown): PriceDropDeal[] {
  return results(payload).flatMap((raw): PriceDropDeal[] => {
    const r = record(raw);
    const mlsNumber = str(r.mls_number);
    const listPrice = toNumber(r.list_price);
    const originalPrice = toNumber(r.original_price);
    if (
      !mlsNumber ||
      !listPrice ||
      !originalPrice ||
      listPrice >= originalPrice
    )
      return [];
    const dropAmount = toNumber(r.drop_amount) ?? originalPrice - listPrice;
    const dropPct = toNumber(r.drop_pct) ?? (dropAmount / originalPrice) * 100;
    return [
      {
        mlsNumber,
        address: str(r.address) ?? "",
        city: str(r.city) ?? "",
        propertySubType: str(r.property_sub_type),
        bedrooms: int(r.bedrooms),
        bathrooms: int(r.bathrooms),
        listPrice,
        originalPrice,
        dropAmount,
        dropPct,
        changedOn: str(r.changed_on),
        listingKey: str(r.listing_key),
        imageUrl: safeUrl(r.image_url),
      },
    ];
  });
}

/**
 * A matched deal opens its property page; an AMPRE-only one (not in our
 * catalogue) opens a free-text /listings search for its address.
 */
export function dealHref(
  deal: Pick<PriceDropDeal, "listingKey" | "address" | "mlsNumber">,
): string {
  if (deal.listingKey)
    return `/property/${encodeURIComponent(deal.listingKey)}`;
  const q = deal.address || deal.mlsNumber;
  return `/listings?search=${encodeURIComponent(q)}`;
}

/* -------------------------------------------------- sold below purchase */

export interface SoldBelowRow {
  listingKey: string;
  address: string;
  city: string;
  propertySubType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  closePrice: number;
  closeDate: string;
  previousClosePrice: number;
  previousCloseDate: string;
  lossAmount: number;
  imageUrl: string | null;
}

/**
 * Maps mls-backend `/api/home/sold-below-purchase/`. Drops incomplete rows so
 * the homepage never invents addresses/prices — mirrors `_is_complete_sold_below_row`.
 */
export function mapSoldBelow(payload: unknown): SoldBelowRow[] {
  if (!payload || typeof payload !== "object") return [];
  const envelope = payload as {
    empty?: unknown;
    count?: unknown;
    results?: unknown;
  };
  // Explicit empty envelope → empty rail (FE shows EmptyState); never mock.
  if (envelope.empty === true) return [];
  const count = toNumber(envelope.count);
  if (count === 0) return [];

  return results(payload).flatMap((raw): SoldBelowRow[] => {
    const r = record(raw);
    const listingKey = str(r.listing_key);
    const address = str(r.address);
    const city = str(r.city);
    const closeDate = str(r.close_date);
    const previousCloseDate = str(r.previous_close_date);
    const closePrice = toNumber(r.close_price);
    const previousClosePrice = toNumber(r.previous_close_price);
    const lossAmount = toNumber(r.loss_amount);
    if (
      !listingKey ||
      !address ||
      !city ||
      !closeDate ||
      !previousCloseDate ||
      closePrice === null ||
      previousClosePrice === null ||
      lossAmount === null ||
      closePrice <= 0 ||
      previousClosePrice <= closePrice ||
      lossAmount <= 0
    ) {
      return [];
    }
    return [
      {
        listingKey,
        address,
        city,
        propertySubType: str(r.property_sub_type),
        bedrooms: int(r.bedrooms),
        bathrooms: int(r.bathrooms),
        closePrice,
        closeDate,
        previousClosePrice,
        previousCloseDate,
        lossAmount,
        imageUrl: safeUrl(r.image_url),
      },
    ];
  });
}

/* ---------------------------------------------- profitable investments */

export interface ProfitableInvestmentRow {
  listingKey: string;
  address: string;
  city: string;
  propertySubType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  closePrice: number;
  closeDate: string;
  previousClosePrice: number;
  previousCloseDate: string;
  gainAmount: number;
  imageUrl: string | null;
}

/**
 * Maps mls-backend `/api/home/profitable-investments/`.
 * Keeps only complete gain rows (latest sale above previous close).
 */
export function mapProfitableInvestments(payload: unknown): ProfitableInvestmentRow[] {
  if (!payload || typeof payload !== "object") return [];
  const envelope = payload as {
    empty?: unknown;
    count?: unknown;
    results?: unknown;
  };
  if (envelope.empty === true) return [];
  const count = toNumber(envelope.count);
  if (count === 0) return [];

  return results(payload).flatMap((raw): ProfitableInvestmentRow[] => {
    const r = record(raw);
    const listingKey = str(r.listing_key);
    const address = str(r.address);
    const city = str(r.city);
    const closeDate = str(r.close_date);
    const previousCloseDate = str(r.previous_close_date);
    const closePrice = toNumber(r.close_price);
    const previousClosePrice = toNumber(r.previous_close_price);
    const gainAmount = toNumber(r.gain_amount);
    if (
      !listingKey ||
      !address ||
      !city ||
      !closeDate ||
      !previousCloseDate ||
      closePrice === null ||
      previousClosePrice === null ||
      gainAmount === null ||
      previousClosePrice <= 0 ||
      closePrice <= previousClosePrice ||
      gainAmount <= 0
    ) {
      return [];
    }
    return [
      {
        listingKey,
        address,
        city,
        propertySubType: str(r.property_sub_type),
        bedrooms: int(r.bedrooms),
        bathrooms: int(r.bathrooms),
        closePrice,
        closeDate,
        previousClosePrice,
        previousCloseDate,
        gainAmount,
        imageUrl: safeUrl(r.image_url),
      },
    ];
  });
}

/* ------------------------------------------------------ market snapshot */

export interface MarketSnapshot {
  windowDays: number;
  medianSoldPrice: number | null;
  medianSoldPriceChangePct: number | null;
  avgDaysOnMarket: number | null;
  /** Ratio, e.g. 1.0234 = sold 2.3% over list on average. */
  saleToListRatio: number | null;
  /** Fraction 0–1 of sales that closed over asking. */
  overAskingShare: number | null;
  unitsSold: number | null;
  unitsSoldChangePct: number | null;
  activeListings: number | null;
  asOf: string | null;
  stale: boolean;
}

export function mapMarketSnapshot(payload: unknown): MarketSnapshot | null {
  const r = record(payload);
  const snapshot: MarketSnapshot = {
    windowDays: int(r.window_days) ?? 30,
    medianSoldPrice: toNumber(r.median_sold_price),
    medianSoldPriceChangePct: toNumber(r.median_sold_price_change_pct),
    avgDaysOnMarket: toNumber(r.avg_days_on_market),
    saleToListRatio: toNumber(r.sale_to_list_ratio),
    overAskingShare: toNumber(r.over_asking_share),
    unitsSold: int(r.units_sold),
    unitsSoldChangePct: toNumber(r.units_sold_change_pct),
    activeListings: int(r.active_listings),
    asOf: str(r.as_of),
    stale: r.stale === true,
  };
  // An empty window (no sales parsed) is "no data", not a row of dashes.
  return snapshot.medianSoldPrice === null && !snapshot.unitsSold
    ? null
    : snapshot;
}

export interface SnapshotStat {
  label: string;
  value: string;
  change?: string;
  up?: boolean;
}

/** Display rows for the snapshot card; stats the backend couldn't compute are omitted. */
export function snapshotStats(s: MarketSnapshot): SnapshotStat[] {
  const stats: SnapshotStat[] = [];
  if (s.medianSoldPrice !== null) {
    const change = s.medianSoldPriceChangePct;
    stats.push({
      label: "Median Sold Price",
      value: formatPriceCompact(s.medianSoldPrice),
      ...(change !== null
        ? { change: `${formatPercent(change)} MoM`, up: change >= 0 }
        : {}),
    });
  }
  if (s.avgDaysOnMarket !== null) {
    stats.push({
      label: "Avg. Days on Market",
      value: `${Math.round(s.avgDaysOnMarket)} days`,
    });
  }
  if (s.saleToListRatio !== null) {
    stats.push({
      label: "Sale-to-List",
      value: `${(s.saleToListRatio * 100).toFixed(1)}%`,
    });
  }
  if (s.overAskingShare !== null) {
    stats.push({
      label: "Sold Over Asking",
      value: `${Math.round(s.overAskingShare * 100)}%`,
    });
  }
  if (s.unitsSold !== null) {
    const change = s.unitsSoldChangePct;
    stats.push({
      label: `Sold (${s.windowDays} days)`,
      value: formatNumber(s.unitsSold),
      ...(change !== null
        ? { change: `${formatPercent(change)} MoM`, up: change >= 0 }
        : {}),
    });
  }
  return stats;
}

/* ------------------------------------------------------------ incentives */

const INCENTIVE_ICONS: IncentiveIcon[] = [
  "home",
  "savings",
  "green",
  "construction",
  "equity",
  "retirement",
];

export interface Incentive {
  id: string;
  title: string;
  label: string;
  icon: IncentiveIcon;
  amountText: string;
  description: string;
  sourceUrl: string | null;
  reviewedAt: string | null;
}

export function mapIncentives(payload: unknown): Incentive[] {
  return results(payload).flatMap((raw): Incentive[] => {
    const r = record(raw);
    const title = str(r.title);
    if (!title) return [];
    const icon = str(r.icon) as IncentiveIcon | null;
    return [
      {
        id: String(r.id ?? title),
        title,
        label: str(r.label) ?? "",
        icon: icon && INCENTIVE_ICONS.includes(icon) ? icon : "home",
        amountText: str(r.amount_text) ?? "",
        description: str(r.description) ?? "",
        sourceUrl: safeUrl(r.source_url),
        reviewedAt: str(r.reviewed_at),
      },
    ];
  });
}

/* -------------------------------------------------------------- partners */

export interface Partner {
  id: string;
  name: string;
  category: string;
  description: string;
  logoUrl: string | null;
  websiteUrl: string | null;
}

export function mapPartners(payload: unknown): Partner[] {
  return results(payload).flatMap((raw): Partner[] => {
    const r = record(raw);
    const name = str(r.name);
    if (!name) return [];
    return [
      {
        id: String(r.id ?? name),
        name,
        category: str(r.category) ?? "",
        description: str(r.description) ?? "",
        logoUrl: safeUrl(r.logo_url),
        websiteUrl: safeUrl(r.website_url),
      },
    ];
  });
}

/** Free-text partner category → the closest section glyph. */
export function connectionIconFor(category: string): ConnectionIcon {
  const c = category.toLowerCase();
  if (/legal|law|attorney|notary/.test(c)) return "legal";
  if (/mortgage|lend|financ|bank/.test(c)) return "mortgage";
  if (/inspect/.test(c)) return "inspection";
  if (/insur/.test(c)) return "insurance";
  if (/mov|reloc/.test(c)) return "moving";
  return "planning";
}

/* ------------------------------------------------------ community images */

/** city_key (already lower-cased by the backend) → image URL. */
export function mapCommunityImages(payload: unknown): Record<string, string> {
  const map: Record<string, string> = {};
  for (const raw of results(payload)) {
    const r = record(raw);
    const key = str(r.city_key)?.toLowerCase();
    const url = safeUrl(r.image_url);
    if (key && url) map[key] = url;
  }
  return map;
}

/**
 * `formatDate` for the backend's date-only fields ("2026-09-01"). `new Date`
 * reads those as UTC midnight, which is the previous day in Toronto — pin
 * them to local noon first.
 */
export function formatDay(value: string | null | undefined): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return formatDate(`${value}T12:00:00`);
  return formatDate(value);
}

/* ---------------------------------------------------- neighbour activity */

export type NeighbourActivityEvent =
  | "Just Listed"
  | "Price Drop"
  | "Open House"
  | "Just Sold";

export interface NeighbourActivityItem {
  listingKey: string;
  event: NeighbourActivityEvent;
  address: string;
  city: string;
  listPrice: number | null;
  occurredAt: string | null;
  imageUrl: string | null;
}

const NEIGHBOUR_EVENTS = new Set<NeighbourActivityEvent>([
  "Just Listed",
  "Price Drop",
  "Open House",
  "Just Sold",
]);

export function mapNeighbourActivity(payload: unknown): NeighbourActivityItem[] {
  return results(payload).flatMap((raw): NeighbourActivityItem[] => {
    const r = record(raw);
    const listingKey = str(r.listing_key);
    const eventRaw = str(r.event);
    if (!listingKey || !eventRaw || !NEIGHBOUR_EVENTS.has(eventRaw as NeighbourActivityEvent)) {
      return [];
    }
    return [
      {
        listingKey,
        event: eventRaw as NeighbourActivityEvent,
        address: str(r.address) ?? listingKey,
        city: str(r.city) ?? "",
        listPrice: toNumber(r.list_price),
        occurredAt: str(r.occurred_at),
        imageUrl: safeUrl(r.image_url),
      },
    ];
  });
}
