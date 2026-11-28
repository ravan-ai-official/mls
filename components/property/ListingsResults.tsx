"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { PropertyCard } from "@/components/property/PropertyCard";
import { PropertyRow } from "@/components/property/PropertyRow";
import { ViewToggle } from "@/components/property/ViewToggle";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState, PropertyGridSkeleton } from "@/components/ui/States";
import { useListingView } from "@/lib/hooks/useListingView";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import {
  listingQueryFromSearch,
  listingsSearchQuery,
  useListingsSearch,
} from "@/lib/queries/properties";
import {
  PAGE_SIZE,
  buildListingHref,
  buildListingQueryString,
  currentPage,
  hasActiveFilters,
} from "@/lib/utils/searchParams";
import { backendStatusGroup, statusGroup } from "@/lib/utils/status";

/**
 * Client listings grid. Fetches mls-backend `GET /api/mls/properties/filter/`
 * (via same-origin proxy) so DevTools Network shows the real backend JSON.
 *
 * Grid / list is client state — same URL, no refetch, layoutId morph between.
 */
export function ListingsResults({ isStaff = false }: { isStaff?: boolean }) {
  const params = useSearchParams();
  const search = params.toString();
  const query = listingQueryFromSearch(params);
  const page = currentPage(query);
  const [view, setView] = useListingView();
  const listAllowed = useMediaQuery("(min-width: 768px)");
  const effectiveView = listAllowed ? view : "grid";
  const group = backendStatusGroup(query.status);
  const queryClient = useQueryClient();

  const [dismissTruncation, setDismissTruncation] = useState(false);
  const [dismissSoldNote, setDismissSoldNote] = useState(false);

  const { data: result, isPending, isError, error, isFetching } = useListingsSearch(search);

  // Prefetch the next page while the user scans this one.
  useEffect(() => {
    if (!result || result.total <= page * PAGE_SIZE) return;
    const nextSearch = buildListingQueryString({ ...query, page: page + 1, view: undefined });
    void queryClient.prefetchQuery(listingsSearchQuery(nextSearch));
    // Depend on serialized search + page, not the query object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.total, page, search, queryClient]);

  useEffect(() => {
    setDismissTruncation(false);
    setDismissSoldNote(false);
  }, [search]);

  if (isPending && !result) {
    return <PropertyGridSkeleton />;
  }

  if (isError || !result) {
    return (
      <ErrorState
        title="Listings unavailable"
        description={`${error?.message ?? "We couldn't load listings right now."} Please try again in a moment.`}
      />
    );
  }

  if (result.items.length === 0 && (group === "sold" || group === "de-listed")) {
    const rent = query.transaction === "rent";
    const label = group === "de-listed" ? "de-listed" : rent ? "leased" : "sold";
    return (
      <EmptyState
        title={`No ${label} homes to show`}
        description={`Our feed carries little ${label} history yet, so this list may be empty even in an active market.`}
        action={{
          label: rent ? "See homes for rent" : "See homes for sale",
          href: buildListingHref({ ...query, status: undefined, page: undefined, view: undefined }),
        }}
      />
    );
  }

  if (result.items.length === 0) {
    const rent = query.transaction === "rent";
    const place = query.city || query.search;
    const activeEmpty = backendStatusGroup(query.status) === "active" && Boolean(place);
    const hasFilters = hasActiveFilters(query);

    const widenHref =
      query.priceMin || query.priceMax
        ? buildListingHref({
            ...query,
            priceMin: query.priceMin ? Math.max(0, Math.round(query.priceMin * 0.8)) : undefined,
            priceMax: query.priceMax ? Math.round(query.priceMax * 1.2) : undefined,
            page: undefined,
            view: undefined,
          })
        : null;

    return (
      <EmptyState
        title={
          activeEmpty
            ? rent
              ? `No homes for lease${place ? ` matching “${place}”` : ""}`
              : `No homes for sale${place ? ` matching “${place}”` : ""}`
            : "No homes match these filters"
        }
        description={
          activeEmpty
            ? isStaff
              ? "Try Sold or De-listed above, widen the price, or clear the search."
              : "Try Sold above, widen the price, or clear the search to browse more homes."
            : hasFilters
              ? "Try widening your price range, dropping bedrooms, or clearing filters."
              : "There are no listings in the catalogue right now."
        }
        action={
          hasFilters
            ? {
                label: "Clear filters",
                href: rent ? "/listings?transaction_type=rent" : "/listings",
              }
            : undefined
        }
        secondaryAction={
          widenHref
            ? { label: "Widen price ±20%", href: widenHref }
            : query.bedsMin
              ? {
                  label: "Any bedrooms",
                  href: buildListingHref({
                    ...query,
                    bedsMin: undefined,
                    page: undefined,
                    view: undefined,
                  }),
                }
              : undefined
        }
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const rangeStart = (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, result.total);
  return (
    <div className="space-y-6 sm:space-y-8" aria-busy={isFetching || undefined}>
      <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
        <div className="min-w-0" aria-live="polite">
          <p className="truncate text-small font-semibold text-ink sm:text-body">
            {result.approximate ? "About " : ""}
            {result.total.toLocaleString("en-CA")}{" "}
            <span className="font-normal text-ink-muted">
              {result.total === 1 ? "home" : "homes"}
            </span>
          </p>
          <p className="mt-0.5 text-caption text-ink-muted">
            <span className="sm:hidden">
              {rangeStart}–{rangeEnd}
              {totalPages > 1 && ` · p. ${page}`}
            </span>
            <span className="hidden sm:inline">
              Showing {rangeStart.toLocaleString("en-CA")}–
              {rangeEnd.toLocaleString("en-CA")}
              {totalPages > 1 && (
                <>
                  {" "}
                  · Page {page.toLocaleString("en-CA")} of{" "}
                  {totalPages.toLocaleString("en-CA")}
                </>
              )}
            </span>
          </p>
        </div>
        <ViewToggle view={effectiveView} onChange={setView} />
      </div>

      {result.truncated && !dismissTruncation && (
        <NoticeBanner onDismiss={() => setDismissTruncation(true)}>
          Property type is matched across the most recent 300 listings, so some
          older matches may not appear. Adding a city narrows the search.
        </NoticeBanner>
      )}

      {query.status && statusGroup(query.status) === "sold" && !dismissSoldNote && (
        <NoticeBanner onDismiss={() => setDismissSoldNote(true)}>
          {query.transaction === "rent"
            ? "Lease history in our feed is limited, so this list may not include every recent lease in the area."
            : "Sold history in our feed is limited, so this list may not include every recent sale in the area."}
        </NoticeBanner>
      )}

      <LayoutGroup id="listings-view">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={effectiveView}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            {effectiveView === "list" ? (
              <div className="space-y-4">
                {result.items.map((property, index) => (
                  <PropertyRow
                    key={property.id}
                    property={property}
                    priority={index < 3}
                    layout
                  />
                ))}
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {result.items.map((property, index) => (
                  <PropertyCard
                    key={property.id}
                    property={property}
                    priority={index < 3}
                    layout
                  />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </LayoutGroup>

      <div className="space-y-3">
        <p className="text-center text-caption text-ink-muted">
          Showing {rangeStart.toLocaleString("en-CA")}–
          {rangeEnd.toLocaleString("en-CA")} of{" "}
          {result.total.toLocaleString("en-CA")}
        </p>
        <Pagination
          page={page}
          totalPages={totalPages}
          buildHref={(next) =>
            buildListingHref({ ...query, page: next, view: undefined })
          }
        />
      </div>
    </div>
  );
}

function NoticeBanner({
  children,
  onDismiss,
}: {
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <p
      role="status"
      className="relative rounded-control border border-gold/30 bg-gold-soft py-3 pl-4 pr-10 text-caption text-ink"
    >
      {children}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notice"
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface/60 hover:text-ink"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M18 6 6 18M6 6l12 12"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </p>
  );
}

export { listingQueryFromSearch };
