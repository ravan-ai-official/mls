"use client";

import Link from "next/link";
import { PropertyCard } from "@/components/property/PropertyCard";
import { EmptyState, PropertyGridSkeleton } from "@/components/ui/States";
import { HOME_RAIL_LIMIT, loadTodaysNewRail } from "@/lib/home/rails";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";
import type { PropertySummary } from "@/lib/types/domain";
import { textOf } from "@/lib/site/read";
import { cn } from "@/lib/utils/cn";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Today's new listings — exactly three cards. "View All" opens /todays-new.
 */
export function TodaysNewListings({ content }: { content?: Record<string, unknown> }) {
  const viewAllHref = textOf(content, "actionHref", "/todays-new");
  const viewAllLabel = textOf(content, "actionLabel", "View All");
  const { data: listings = [], isPending } = useMlsQuery<PropertySummary[]>(
    ["home", "todays-new", HOME_RAIL_LIMIT],
    () => loadTodaysNewRail(HOME_RAIL_LIMIT),
    [],
  );

  const now = Date.now();
  const isToday = (p: PropertySummary) => {
    if (!p.listedAt) return false;
    const t = new Date(p.listedAt).getTime();
    return !Number.isNaN(t) && now - t >= 0 && now - t <= DAY_MS;
  };
  const anyToday = listings.some(isToday);
  const updated = new Date(now).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Toronto",
  });

  return (
    <section className="bg-surface py-10 sm:py-14 lg:py-16">
      <div className="container-page">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
          <div>
            <p className="flex items-center gap-2 text-eyebrow uppercase text-gold">
              <span
                aria-hidden="true"
                className="h-2 w-2 animate-pulse rounded-full bg-gold"
              />
              {textOf(content, "eyebrow", "Live")}
            </p>
            <h2 className="mt-2 text-h1 text-ink">
              {textOf(content, "title", "Today's New Listings")}
            </h2>
            <p className="mt-2 text-small text-ink-muted">
              {isPending
                ? "Loading…"
                : anyToday
                  ? "Just added in the last 24 hours"
                  : "The newest listings on the market"}
              {" · "}Updated {updated}
            </p>
          </div>
          <Link
            href={viewAllHref}
            className="text-small font-semibold text-navy transition-colors hover:text-gold"
          >
            {viewAllLabel} →
          </Link>
        </div>

        {isPending && listings.length === 0 ? (
          <PropertyGridSkeleton count={HOME_RAIL_LIMIT} />
        ) : listings.length === 0 ? (
          <EmptyState
            title="Listings are unavailable right now"
            description="We couldn't reach the listing service. Please try again shortly."
            action={{ label: "Browse listings", href: "/listings" }}
          />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {listings.slice(0, HOME_RAIL_LIMIT).map((property) => (
              <li key={property.id} className="relative h-full">
                <PropertyCard property={property} className="h-full" />
                {isToday(property) && (
                  <span
                    className={cn(
                      "pointer-events-none absolute left-3 z-10",
                      property.badge ? "top-12" : "top-3",
                    )}
                  >
                    <span className="flex items-center gap-1 rounded-full bg-navy px-2 py-1 text-[10px] font-bold uppercase text-white">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold"
                      />
                      New today
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
