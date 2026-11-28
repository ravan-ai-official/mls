"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { HighReturnCard } from "@/components/home/HighReturnCard";
import { ProfitableInvestmentCard } from "@/components/home/ProfitableInvestmentCard";
import { PropertyCard } from "@/components/property/PropertyCard";
import { useAuth } from "@/components/providers/AuthProvider";
import { SoldLockedEmptyState } from "@/components/sold/SoldLockedOverlay";
import { Eyebrow } from "@/components/ui/Badge";
import { EmptyState, PropertyGridSkeleton } from "@/components/ui/States";
import { getProfitableInvestments } from "@/lib/api/home";
import type { InvestorPick, InvestorPicksFeed, ProfitableInvestmentsFeed } from "@/lib/api/homeMappers";
import {
  HOME_RAIL_LIMIT,
  RAIL_PAGE_LIMIT,
  loadFeaturedListingsPage,
  loadHighReturnPage,
  loadTodaysNewRail,
} from "@/lib/home/rails";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";
import type { PropertySummary } from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";

const DAY_MS = 24 * 60 * 60 * 1000;

function RailPageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <>
      <header className="border-b border-line bg-surface-alt py-8 sm:py-12">
        <div className="container-page">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-3 text-h1 text-ink">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-small text-ink-muted">{description}</p>
          ) : null}
          <p className="mt-4">
            <Link href="/" className="text-small font-medium text-navy hover:text-gold">
              ← Back to home
            </Link>
          </p>
        </div>
      </header>
      <div className="container-page py-10 sm:py-12">{children}</div>
    </>
  );
}

function PropertyGrid({
  listings,
  showNewToday = false,
}: {
  listings: PropertySummary[];
  showNewToday?: boolean;
}) {
  const now = Date.now();
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((property) => {
        const listedAt = property.listedAt ? new Date(property.listedAt).getTime() : NaN;
        const isToday =
          showNewToday &&
          !Number.isNaN(listedAt) &&
          now - listedAt >= 0 &&
          now - listedAt <= DAY_MS;
        return (
          <li key={property.id} className="relative h-full">
            <PropertyCard property={property} className="h-full" />
            {isToday ? (
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
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Dedicated /featured-listings — `featured-properties/?limit=48` only.
 * No Buy/Rent tabs, listing filters, or exclusive/new catalogue fallbacks.
 */
export function FeaturedListingsBrowse() {
  const { data, isPending } = useMlsQuery(
    ["rail", "featured", RAIL_PAGE_LIMIT],
    () => loadFeaturedListingsPage(RAIL_PAGE_LIMIT),
    { listings: [], description: "Hand-picked homes from the HomeAtlas team." },
  );
  const listings = data?.listings ?? [];

  return (
    <RailPageShell
      eyebrow="Curated for you"
      title="Featured MLS® Listings"
      description={data?.description}
    >
      {isPending && listings.length === 0 ? (
        <PropertyGridSkeleton count={HOME_RAIL_LIMIT} />
      ) : listings.length === 0 ? (
        <EmptyState
          title="No featured listings right now"
          description="Check back soon, or browse the full catalogue."
          action={{ label: "Browse listings", href: "/listings" }}
        />
      ) : (
        <PropertyGrid listings={listings} />
      )}
    </RailPageShell>
  );
}

/** Dedicated /todays-new page — last 24 hours (same API as the homepage rail). */
export function TodaysNewBrowse() {
  const { data: listings = [], isPending } = useMlsQuery(
    ["rail", "todays-new", RAIL_PAGE_LIMIT],
    () => loadTodaysNewRail(RAIL_PAGE_LIMIT),
    [],
  );

  return (
    <RailPageShell
      eyebrow="Live"
      title="Today's New Listings"
      description="Homes first listed in the last 24 hours, newest first."
    >
      {isPending && listings.length === 0 ? (
        <PropertyGridSkeleton count={HOME_RAIL_LIMIT} />
      ) : listings.length === 0 ? (
        <EmptyState
          title="No new listings in the last 24 hours"
          description="Fresh homes will show up here as they hit the market."
          action={{ label: "Browse listings", href: "/listings" }}
        />
      ) : (
        <PropertyGrid listings={listings} showNewToday />
      )}
    </RailPageShell>
  );
}

/**
 * Dedicated /high-return — `investor-picks/?limit=48` only.
 * Same HighReturnCard as the homepage rail; no Buy/Rent listing filters.
 */
export function HighReturnBrowse() {
  const emptyFeed: InvestorPicksFeed = {
    picks: [],
    pinnedCount: 0,
    basisNote: null,
    generatedAt: null,
  };
  const { data: feed, isPending } = useMlsQuery(
    ["rail", "investor-picks", RAIL_PAGE_LIMIT],
    () => loadHighReturnPage(RAIL_PAGE_LIMIT),
    emptyFeed,
  );
  const picks: InvestorPick[] = (feed?.picks ?? []).slice(0, RAIL_PAGE_LIMIT);

  return (
    <RailPageShell
      eyebrow="For investors"
      title="High Return Properties"
      description={
        feed?.basisNote ??
        "Top rental yield opportunities in the GTA — strong cash flow potential"
      }
    >
      {isPending && picks.length === 0 ? (
        <PropertyGridSkeleton count={HOME_RAIL_LIMIT} />
      ) : picks.length === 0 ? (
        <EmptyState
          title="No high return properties right now"
          description="Yield estimates will appear here when comparable rents are available."
          action={{ label: "Browse listings", href: "/listings" }}
        />
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {picks.map((pick) => (
            <li key={pick.listingKey} className="h-full min-w-0">
              <HighReturnCard pick={pick} tone="light" />
            </li>
          ))}
        </ul>
      )}
    </RailPageShell>
  );
}

/** Dedicated /profitable-investments page — sold-above re-sales, no filter chrome. */
export function ProfitableInvestmentsBrowse() {
  const { user } = useAuth();
  const { data: feed, isPending, refetch } = useMlsQuery<ProfitableInvestmentsFeed | null>(
    ["rail", "profitable-investments", RAIL_PAGE_LIMIT, user?.id ?? "anon"],
    () => getProfitableInvestments(RAIL_PAGE_LIMIT, { cache: "no-store" }),
    null,
  );
  const locked = Boolean(!user || feed?.soldLocked);
  const displayRows = (feed?.rows ?? []).filter((row) => Boolean(row.imageUrl));

  return (
    <RailPageShell
      eyebrow="For investors"
      title="Profitable Investments"
      description="Homes that sold again for more than their previous sale price in the last 12 months."
    >
      {isPending && !feed ? (
        <PropertyGridSkeleton count={HOME_RAIL_LIMIT} />
      ) : locked && displayRows.length === 0 ? (
        <SoldLockedEmptyState onUnlocked={() => void refetch()} />
      ) : displayRows.length === 0 ? (
        <EmptyState
          title="No profitable re-sales available"
          description="We don't have recent homes that sold above their previous purchase right now."
          action={{ label: "Back to home", href: "/" }}
        />
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {displayRows.map((row) => (
            <li key={row.listingKey}>
              <ProfitableInvestmentCard
                row={row}
                locked={locked || row.soldLocked}
              />
            </li>
          ))}
        </ul>
      )}
    </RailPageShell>
  );
}
