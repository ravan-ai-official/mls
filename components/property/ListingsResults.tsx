"use client";

import { useSearchParams } from "next/navigation";
import { PropertyCard } from "@/components/property/PropertyCard";
import { PropertyRow } from "@/components/property/PropertyRow";
import { ViewToggle, type ListingView } from "@/components/property/ViewToggle";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState, PropertyGridSkeleton } from "@/components/ui/States";
import { useListingsSearch } from "@/lib/queries/properties";
import { matchKnownCity } from "@/lib/constants/cities";
import type { ListingQuery } from "@/lib/types/domain";
import {
  PAGE_SIZE,
  buildListingHref,
  currentPage,
  hasActiveFilters,
  parseListingSearch,
} from "@/lib/utils/searchParams";
import { backendStatusGroup, statusGroup } from "@/lib/utils/status";

/**
 * Client listings grid. Fetches `/api/properties/search` so DevTools Network
 * shows the JSON envelope (items/total) instead of only the Next.js RSC stream
 * from a server-rendered page navigation.
 */
export function ListingsResults({ isStaff = false }: { isStaff?: boolean }) {
  const params = useSearchParams();
  const search = params.toString();
  const query = listingQueryFromSearch(params);
  const page = currentPage(query);
  const view: ListingView = params.get("view") === "list" ? "list" : "grid";
  const group = backendStatusGroup(query.status);

  const { data: result, isPending, isError, error, isFetching } = useListingsSearch(search);

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
          href: buildListingHref({ ...query, status: undefined, page: undefined }),
        }}
      />
    );
  }

  if (result.items.length === 0) {
    const rent = query.transaction === "rent";
    const place = query.city || query.search;
    const activeEmpty = backendStatusGroup(query.status) === "active" && Boolean(place);
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
              ? "Try Sold or De-listed above, or clear the search to browse the full catalogue."
              : "Try Sold above, or clear the search to browse the full catalogue."
            : hasActiveFilters(query)
              ? "Try widening your price range or clearing a filter."
              : "There are no listings in the catalogue right now."
        }
        action={
          hasActiveFilters(query)
            ? {
                label: "Clear filters",
                href: rent ? "/listings?transaction_type=rent" : "/listings",
              }
            : undefined
        }
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <div className="space-y-8" aria-busy={isFetching || undefined}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-small text-ink-muted" aria-live="polite">
          {result.approximate ? "About " : ""}
          <span className="font-medium text-ink">
            {result.total.toLocaleString("en-CA")}
          </span>{" "}
          {result.total === 1 ? "home" : "homes"}
          {totalPages > 1 && ` · page ${page} of ${totalPages}`}
        </p>
        <ViewToggle view={view} />
      </div>

      {result.truncated && (
        <p
          role="status"
          className="rounded-control border border-gold/30 bg-gold-soft px-4 py-3 text-caption text-ink"
        >
          Property type is matched across the most recent 300 listings, so some
          older matches may not appear. Adding a city narrows the search.
        </p>
      )}

      {query.status && statusGroup(query.status) === "sold" && (
        <p
          role="status"
          className="rounded-control border border-gold/30 bg-gold-soft px-4 py-3 text-caption text-ink"
        >
          {query.transaction === "rent"
            ? "Lease history in our feed is limited, so this list may not include every recent lease in the area."
            : "Sold history in our feed is limited, so this list may not include every recent sale in the area."}
        </p>
      )}

      {view === "list" ? (
        <div className="space-y-4">
          {result.items.map((property, index) => (
            <PropertyRow
              key={property.id}
              property={property}
              priority={index < 3}
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
            />
          ))}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        buildHref={(next) => buildListingHref({ ...query, page: next })}
      />
    </div>
  );
}

/** Same defaults as the listings page server query (For Sale when unset). */
export function listingQueryFromSearch(params: URLSearchParams | string): ListingQuery {
  const parsed = parseListingSearch(params);
  const cityFromSearch =
    !parsed.city && parsed.search ? matchKnownCity(parsed.search) : null;
  const query = cityFromSearch
    ? { ...parsed, city: cityFromSearch, search: undefined }
    : parsed;
  return query.status || query.openHouse ? query : { ...query, status: "Active" };
}
