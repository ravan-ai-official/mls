"use client";

import { useState } from "react";
import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";
import { MortgageCalculator } from "@/components/property/MortgageCalculator";
import { SoldLockedEmptyState, SoldLockedOverlay } from "@/components/sold/SoldLockedOverlay";
import { useSoldLock } from "@/components/sold/useSoldLock";
import type { ListingEngagement } from "@/lib/api/neighbourhood";
import type { PropertySummary } from "@/lib/types/domain";
import { propertyPath } from "@/lib/seo/urls";
import { EMPTY, formatLeasePrice, formatNumber, formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const TABS = [
  { id: "sold", label: "Sold Comparables" },
  { id: "sale", label: "Similar for Sale" },
  { id: "rent", label: "Rent Comparables" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * Comparables tab from HomeAtlasUI: sold / for-sale / rent sub-tabs, a
 * popularity bar from real view counts, then the mortgage calculator.
 */
export function ComparablesBoard({
  sold,
  sale,
  rent,
  engagement,
  price,
  annualTax,
  lockSoldComps = false,
}: {
  sold: PropertySummary[];
  sale: PropertySummary[];
  rent: PropertySummary[];
  engagement: ListingEngagement | null;
  price: number | null;
  annualTax?: number | null;
  /** Parent listing is locked sold — sold-comp dollars stay hidden. */
  lockSoldComps?: boolean;
}) {
  const { locked: soldTabLocked } = useSoldLock({
    soldLocked: lockSoldComps,
    status: lockSoldComps ? "sold" : undefined,
  });
  const [tab, setTab] = useState<TabId>(
    sold.length > 0 && !soldTabLocked
      ? "sold"
      : sale.length > 0
        ? "sale"
        : rent.length > 0
          ? "rent"
          : "sold",
  );
  const items = tab === "sold" ? sold : tab === "rent" ? rent : sale;
  const heat = engagement
    ? Math.min(100, Math.round((engagement.views7d / 15) * 100))
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-5 text-[20px] font-semibold text-ink">Comparables</h2>
        <div className="mb-5 flex gap-3 overflow-x-auto border-b border-line">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "shrink-0 border-b-2 pb-3 text-[13px] font-medium",
                tab === item.id ? "border-navy text-navy" : "border-transparent text-ink-muted",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {tab === "sold" && soldTabLocked ? (
          <SoldLockedEmptyState
            title="Sign in to view sold comparables"
            description="Sold comparable prices are available after you sign in."
          />
        ) : items.length === 0 ? (
          <p className="text-[13px] text-ink-muted">No listings in this group right now.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {items.slice(0, 4).map((item) => (
              <ComparableCard key={item.id} property={item} forceLockSold={soldTabLocked} />
            ))}
          </div>
        )}
      </div>

      {heat !== null && (
        <div className="rounded-2xl border border-line p-4 sm:p-6">
          <h3 className="mb-2 text-[16px] font-semibold text-ink">Listing Popularity</h3>
          <p className="mb-3 text-[13px] text-ink-muted">
            Popularity: {heat}/100 · {engagement?.views30d ?? 0} views in 30 days
          </p>
          <div className="relative mb-2 h-3 rounded-full bg-gradient-to-r from-sky-400 via-yellow-400 to-red-500">
            <div
              className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-ink bg-white shadow"
              style={{ left: `${heat}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-ink-muted">
            <span>Cold</span>
            <span>Medium</span>
            <span>Hot</span>
          </div>
        </div>
      )}

      <MortgageCalculator price={price} annualTax={annualTax ?? null} suggestedRent={rentMedian(rent)} />
    </div>
  );
}

function rentMedian(items: PropertySummary[]): number | null {
  const prices = items
    .map((item) => item.price)
    .filter((price): price is number => price !== null && price > 0)
    .sort((a, b) => a - b);
  if (prices.length === 0) return null;
  const mid = Math.floor(prices.length / 2);
  return prices.length % 2 === 0 ? Math.round((prices[mid - 1] + prices[mid]) / 2) : prices[mid];
}

function ComparableCard({
  property,
  forceLockSold = false,
}: {
  property: PropertySummary;
  forceLockSold?: boolean;
}) {
  const { locked, closePrice } = useSoldLock({
    soldLocked: property.soldLocked || forceLockSold,
    status: property.status,
    closePrice: property.closePrice,
  });
  const hideSold = locked && property.status === "sold";
  const price =
    !hideSold && property.status === "sold" && closePrice !== null
      ? closePrice
      : hideSold
        ? null
        : property.price;
  const label = hideSold
    ? "Sold"
    : property.isLease
      ? formatLeasePrice(price)
      : formatPrice(price);
  const status =
    property.status === "sold" ? "Sold" : property.isLease ? "For Rent" : "For Sale";

  return (
    <Link
      href={propertyPath(property.id)}
      className="overflow-hidden rounded-xl border border-line transition-shadow hover:shadow-card"
    >
      <div className="relative isolate h-36 overflow-hidden bg-surface-alt">
        <SafeImage
          src={property.image}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, 320px"
          className={cn("object-cover", hideSold && "blur-[2px] scale-105")}
        />
        {hideSold && <SoldLockedOverlay dense message="Sign in for sold $" />}
        {!hideSold && (
          <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] text-white">
            {status} · {label}
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="mb-1 text-[13px] font-semibold text-ink">{property.address}</p>
        <p className="mb-2 text-[12px] text-ink-muted">
          {property.beds ?? EMPTY}bd · {property.baths ?? EMPTY}ba
          {property.sqft ? ` · ${formatNumber(property.sqft)} sqft` : ""}
        </p>
        <p className="text-[12px] font-semibold text-ink">{label}</p>
        {property.type && <p className="mt-1 text-[11px] font-medium text-navy">{property.type}</p>}
      </div>
    </Link>
  );
}
