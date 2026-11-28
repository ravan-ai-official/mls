"use client";

import Link from "next/link";
import { searchProperties } from "@/lib/api/properties";
import { estimateValue } from "@/lib/api/valuation";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";
import type { PropertyDetail, PropertySummary } from "@/lib/types/domain";
import { formatPrice } from "@/lib/utils/format";

/**
 * Estimates tab — valuation + rent comps fetched in the browser so Network
 * shows `/api/mls/…` JSON.
 */
export function EstimatesPanel({ property }: { property: PropertyDetail }) {
  const { data } = useMlsQuery(
    ["property", "estimates", property.id],
    async () => {
      const [estimate, rents] = await Promise.all([
        estimateValue({
          listingKey: property.id,
          latitude: property.latitude,
          longitude: property.longitude,
          postalCode: property.postalCode ?? undefined,
          city: property.community ?? undefined,
          propertySubType: property.propertySubType ?? property.type ?? undefined,
          bedroomsTotal: property.beds,
          bathroomsTotal: property.baths,
          livingArea: property.sqft,
          parkingTotal: property.parkingTotal,
          lotFrontage: property.lotFrontage,
        }).catch(() => null),
        property.community
          ? searchProperties({
              city: property.community,
              transaction: "rent",
              status: "Active",
              limit: 12,
            }).catch(() => emptyList())
          : Promise.resolve(emptyList()),
      ]);
      return { estimate, rents };
    },
    { estimate: null, rents: emptyList() },
  );

  const estimate = data?.estimate ?? null;
  const rents = data?.rents ?? emptyList();
  const usable = estimate && !estimate.sparse && estimate.market > 0 ? estimate : null;
  const rent = property.isLease ? property.price : medianPrice(rents.items);
  const value = usable?.market ?? (property.isLease ? null : property.price);
  const yieldPct = rent && value && value > 0 ? (rent * 12) / value * 100 : null;
  const listedDays = property.daysOnMarket;

  return (
    <div className="rounded-2xl bg-surface-alt p-4 sm:p-6">
      <h2 className="mb-1 text-[20px] font-semibold text-ink">Home Value Estimate</h2>
      <p className="mb-4 text-[13px] text-ink-muted">
        {usable
          ? "Current valuation based on market comparables. This is a beta estimate, not an appraisal."
          : "A modelled value is not available for this listing yet."}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Tile label="Estimated Value" value={usable ? formatPrice(usable.market) : "—"} />
        <Tile label="Estimated Rent" value={rent ? `${formatPrice(rent)}/mo` : "—"} />
        <Tile label="Rental Yield" value={yieldPct !== null ? `${yieldPct.toFixed(1)}%` : "—"} />
        <Tile label="Days on market" value={listedDays !== null ? `${listedDays} day(s)` : "—"} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3 sm:gap-4">
        <RatingCard label="School" filled={0} tone="text-line" note="No rating on file" />
        <RatingCard
          label="Growth"
          filled={usable ? trendStars(usable.trendPct30d) : 0}
          tone="text-navy"
          note={
            usable && Number.isFinite(usable.trendPct30d)
              ? `${usable.trendPct30d > 0 ? "+" : ""}${usable.trendPct30d.toFixed(1)}% in 30 days`
              : "No trend yet"
          }
        />
        <RatingCard
          label="Rental"
          filled={yieldPct !== null ? yieldStars(yieldPct) : 0}
          tone="text-purple-500"
          note={yieldPct !== null ? `${yieldPct.toFixed(1)}% gross yield` : "No rent comps"}
        />
      </div>
      {!usable && (
        <Link
          href="/home-evaluation"
          className="mt-4 inline-flex rounded-xl bg-navy px-4 py-2.5 text-[13px] font-medium text-white hover:bg-navy-deep"
        >
          Get a free evaluation
        </Link>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-4">
      <div className="mb-1 text-[11px] text-ink-muted">{label}</div>
      <div className="text-[18px] font-semibold text-ink sm:text-[20px]">{value}</div>
    </div>
  );
}

function RatingCard({
  label,
  filled,
  tone,
  note,
}: {
  label: string;
  filled: number;
  tone: string;
  note: string;
}) {
  return (
    <div className="rounded-xl bg-white p-4">
      <div className="mb-1.5 text-[12px] text-ink-muted">{label}</div>
      <div className="flex gap-0.5" aria-label={`${filled} of 5`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} className={`text-[16px] ${star <= filled ? tone : "text-line"}`}>
            ★
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-ink-muted">{note}</p>
    </div>
  );
}

function emptyList() {
  return {
    items: [] as PropertySummary[],
    total: 0,
    nextOffset: null,
    previousOffset: null,
    approximate: false,
    truncated: false,
    soldLocked: false,
  };
}

function medianPrice(items: PropertySummary[]): number | null {
  const prices = items
    .map((item) => item.price)
    .filter((price): price is number => price !== null && price > 0)
    .sort((a, b) => a - b);
  if (prices.length === 0) return null;
  const mid = Math.floor(prices.length / 2);
  return prices.length % 2 === 0 ? Math.round((prices[mid - 1] + prices[mid]) / 2) : prices[mid];
}

function trendStars(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  if (pct <= -5) return 1;
  if (pct <= 0) return 2;
  if (pct < 2) return 3;
  if (pct < 5) return 4;
  return 5;
}

function yieldStars(pct: number): number {
  if (pct < 2) return 1;
  if (pct < 3) return 2;
  if (pct < 4) return 3;
  if (pct < 5) return 4;
  return 5;
}
