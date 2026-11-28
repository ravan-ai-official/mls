"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SafeImage } from "@/components/ui/SafeImage";
import { cn } from "@/lib/utils/cn";
import { PropertyBadgePill } from "@/components/ui/Badge";
import { SaveButton } from "@/components/property/SaveButton";
import { CompareButton } from "@/components/property/CompareButton";
import { rememberListingsScroll } from "@/lib/hooks/useListingsScrollRestore";
import type { PropertySummary } from "@/lib/types/domain";
import {
  EMPTY,
  formatLeasePrice,
  formatNumber,
  formatPrice,
  formatDate,
} from "@/lib/utils/format";

const LAYOUT_SPRING = { type: "spring" as const, stiffness: 380, damping: 34 };

/**
 * Listing card.
 *
 * Design follows HomeAtlasUI's PropertyCard — a flat card with the photo
 * full-bleed on top and the padded detail block beneath it (the same shape
 * <PropertyCardSkeleton> renders). The behaviour is upgraded:
 *  - the whole card is one <Link> (was an onClick <article>), so it is
 *    keyboard-reachable, middle-clickable and crawlable
 *  - the save control is a sibling button, not nested inside the link
 *  - every field degrades to an em-dash instead of rendering a fake value
 */
export function PropertyCard({
  property,
  priority = false,
  className,
  layout = false,
}: {
  property: PropertySummary;
  /** Set on above-the-fold cards so LCP images preload. */
  priority?: boolean;
  className?: string;
  /** Shared-element morph with list rows via layoutId. */
  layout?: boolean;
}) {
  const router = useRouter();
  const href = `/property/${encodeURIComponent(property.id)}`;
  const prefetch = () => {
    router.prefetch(href);
  };
  const {
    id,
    address,
    neighbourhood,
    community,
    price,
    isLease,
    beds,
    baths,
    type,
    sqft,
    status,
    badge,
    mls,
    image,
    statusChangedAt,
    closePrice,
    closeDate,
  } = property;

  const location = [neighbourhood, community].filter(Boolean).join(", ");

  // A sold card leads with what the home ACTUALLY sold for (API_GAPS G10), not
  // the asking price — the two differ, and showing the ask under a "Sold" badge
  // reads as the sale price. Falls back to list price when the feed has no
  // close_price on the row.
  const isSold = status === "sold";
  const headlinePrice = isSold && closePrice !== null ? closePrice : price;
  const overAskPct =
    isSold && closePrice !== null && price !== null && price > 0
      ? ((closePrice - price) / price) * 100
      : null;
  // close_date is a true close date; status_change_timestamp is only a proxy.
  const soldOn = closeDate ?? statusChangedAt;

  return (
    <motion.article
      layout={layout || undefined}
      layoutId={layout ? `listing-shell-${id}` : undefined}
      transition={LAYOUT_SPRING}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-surface border border-line bg-surface",
        "shadow-card transition-shadow duration-200 hover:shadow-card-hover",
        // The inner <a> carries the focus ring itself; a focus-within ring here
        // lit the entire card whenever the save button was focused too.
        "has-[a:focus-visible]:border-navy",
        className,
      )}
      onPointerEnter={prefetch}
      onFocusCapture={prefetch}
    >
      {/* Photo, full-bleed across the top of the card. */}
      <motion.div
        layout={layout || undefined}
        layoutId={layout ? `listing-photo-${id}` : undefined}
        transition={LAYOUT_SPRING}
        className="relative h-[210px] w-full shrink-0 bg-surface-alt"
      >
        <SafeImage
          src={image}
          alt={`Photo of ${address}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          priority={priority}
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />

        {badge && (
          <PropertyBadgePill badge={badge} className="absolute left-3 top-3 z-10" />
        )}

        {status === "active" && (
          <>
            {/* z-10 keeps these above the stretched card link below them. */}
            <SaveButton
              listingKey={id}
              address={address}
              className="absolute right-3 top-3 z-10"
            />
            <CompareButton
              listingKey={id}
              address={address}
              className="absolute bottom-3 right-3 z-10"
            />
          </>
        )}
      </motion.div>

      <div className="flex flex-1 flex-col p-5">
        <motion.p
          layout={layout || undefined}
          layoutId={layout ? `listing-price-${id}` : undefined}
          transition={LAYOUT_SPRING}
          className="text-h2 text-ink"
        >
          {headlinePrice === null
            ? EMPTY
            : isLease
              ? formatLeasePrice(headlinePrice)
              : formatPrice(headlinePrice)}
        </motion.p>
        {isSold && closePrice !== null && price !== null && (
          <p className="mt-0.5 text-caption text-ink-muted">
            List {formatPrice(price)}
            {overAskPct !== null && Math.abs(overAskPct) >= 0.1 && (
              <span
                className={cn(
                  "ml-1.5 font-medium",
                  overAskPct > 0 ? "text-positive" : "text-negative",
                )}
              >
                {overAskPct > 0 ? "+" : "−"}
                {Math.abs(overAskPct).toFixed(1)}%
              </span>
            )}
          </p>
        )}

        <h3 className="mt-1 text-small font-medium text-ink">
          {/* Stretched link: the whole card is the click target, but only this
              text is the accessible link name. */}
          <Link
            href={href}
            onClick={rememberListingsScroll}
            aria-label={`${address}${headlinePrice === null ? "" : `, ${isSold ? "sold for " : ""}${isLease ? formatLeasePrice(headlinePrice) : formatPrice(headlinePrice)}`}`}
            className="outline-none before:absolute before:inset-0 before:rounded-surface focus-visible:before:outline-1 focus-visible:before:outline-offset-2 focus-visible:before:outline-navy/40"
          >
            {address}
          </Link>
        </h3>
        <p className="mt-0.5 text-caption text-ink-muted">
          {location || EMPTY}
          {isSold && soldOn && (
            <span className="ml-1.5">· Sold {formatDate(soldOn)}</span>
          )}
        </p>

        {/* Absorbs the leftover height so the specs block sits flush with the
            bottom of every card in a row, whatever height the address wraps to. */}
        <div className="flex-1" aria-hidden="true" />

        <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-caption text-ink">
          <Spec label="Beds" value={beds === null ? EMPTY : formatNumber(beds)} />
          <Spec label="Baths" value={baths === null ? EMPTY : formatNumber(baths)} />
          {type && <Spec label="Type" value={type} />}
          <Spec
            label="Area"
            value={sqft === null ? EMPTY : `${formatNumber(sqft)} sq ft`}
          />
        </dl>
        <p className="mt-2 text-caption text-ink-muted">MLS® {mls}</p>
      </div>
    </motion.article>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="font-medium">{value}</span>
        {label !== "Type" && <span className="text-ink-muted"> {label}</span>}
      </dd>
    </div>
  );
}

