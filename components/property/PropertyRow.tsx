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
 * List-view row — the horizontal counterpart to <PropertyCard>.
 *
 * Follows HomeAtlasUI's ListPropertyRow: photo left, details right, specs on
 * one line. It shows the same fields as the card so switching view never
 * changes what you can see, only how densely it is packed.
 *
 * On narrow screens it stacks to a photo above details, because a 176px photo
 * beside text leaves roughly 150px for an address on a phone.
 */
export function PropertyRow({
  property,
  priority = false,
  layout = false,
}: {
  property: PropertySummary;
  priority?: boolean;
  /** Shared-element morph with grid cards via layoutId. */
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

  // Sold rows lead with the actual sale price, matching <PropertyCard>.
  const isSold = status === "sold";
  const headlinePrice = isSold && closePrice !== null ? closePrice : price;
  const overAskPct =
    isSold && closePrice !== null && price !== null && price > 0
      ? ((closePrice - price) / price) * 100
      : null;
  const soldOn = closeDate ?? statusChangedAt;

  return (
    <motion.article
      layout={layout || undefined}
      layoutId={layout ? `listing-shell-${id}` : undefined}
      transition={LAYOUT_SPRING}
      className={cn(
        "group relative flex flex-col gap-0 overflow-hidden rounded-surface border border-line bg-surface",
        "shadow-card transition-shadow duration-200 hover:shadow-card-hover",
        "has-[a:focus-visible]:border-navy sm:flex-row sm:gap-4",
      )}
      onPointerEnter={prefetch}
      onFocusCapture={prefetch}
    >
      <motion.div
        layout={layout || undefined}
        layoutId={layout ? `listing-photo-${id}` : undefined}
        transition={LAYOUT_SPRING}
        className="relative h-48 w-full shrink-0 bg-surface-alt sm:h-auto sm:w-44 sm:self-stretch"
      >
        <SafeImage
          src={image}
          alt={`Photo of ${address}`}
          fill
          sizes="(max-width: 640px) 100vw, 176px"
          priority={priority}
          className="object-cover"
        />
        {badge && (
          <PropertyBadgePill badge={badge} className="absolute left-2 top-2 z-10" />
        )}
      </motion.div>

      <div className="flex min-w-0 flex-1 flex-col p-4 sm:py-4 sm:pl-0 sm:pr-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
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

            <h3 className="mt-1 truncate text-small font-medium text-ink">
              <Link
                href={href}
                onClick={rememberListingsScroll}
                aria-label={`${address}${headlinePrice === null ? "" : `, ${isSold ? "sold for " : ""}${isLease ? formatLeasePrice(headlinePrice) : formatPrice(headlinePrice)}`}`}
                className="outline-none before:absolute before:inset-0 before:rounded-surface focus-visible:before:outline-1 focus-visible:before:outline-offset-2 focus-visible:before:outline-navy/40"
              >
                {address}
              </Link>
            </h3>
            <p className="mt-0.5 truncate text-caption text-ink-muted">
              {location || EMPTY}
              {isSold && soldOn && (
                <span className="ml-1.5">· Sold {formatDate(soldOn)}</span>
              )}
            </p>
          </div>

          {status === "active" && (
            // z-10 lifts these above the stretched link covering the row.
            <div className="z-10 flex shrink-0 items-center gap-2">
              <CompareButton listingKey={id} address={address} />
              <SaveButton listingKey={id} address={address} size="sm" />
            </div>
          )}
        </div>

        <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink">
          <Spec label="Beds" value={beds === null ? EMPTY : formatNumber(beds)} />
          <Spec label="Baths" value={baths === null ? EMPTY : formatNumber(baths)} />
          {type && <Spec label="Type" value={type} />}
          <Spec
            label="Area"
            value={sqft === null ? EMPTY : `${formatNumber(sqft)} sq ft`}
          />
          <span className="text-ink-muted">MLS® {mls}</span>
        </dl>
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

