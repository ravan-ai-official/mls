import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PropertyCard } from "@/components/property/PropertyCard";
import { PropertyRow } from "@/components/property/PropertyRow";
import { ViewToggle, type ListingView } from "@/components/property/ViewToggle";
import { PendingContent, PendingNavigationProvider } from "@/components/navigation/PendingNavigation";
import { ListingFilters } from "@/components/property/ListingFilters";
import { AiSearchNotice } from "@/components/search/AiSearchNotice";
import { StatusTabs, type StatusTabItem } from "@/components/search/StatusTabs";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState, PropertyGridSkeleton } from "@/components/ui/States";
import { getPropertyFacets, searchProperties } from "@/lib/api/properties";
import { ApiError, type RequestOptions } from "@/lib/api/client";
import { getCurrentUser, requireAccessToken } from "@/lib/auth/session";
import { matchKnownCity } from "@/lib/constants/cities";
import type { ListingQuery, PropertyFacets } from "@/lib/types/domain";
import {
  backendStatusGroup,
  listingStatusTabs,
  statusGroup,
} from "@/lib/utils/status";
import {
  PAGE_SIZE,
  buildListingHref,
  currentPage,
  hasActiveFilters,
  parseListingParams,
} from "@/lib/utils/searchParams";

export const metadata: Metadata = {
  title: "Property listings",
  description:
    "Browse active MLS® listings across the Greater Toronto Area with live filters for price, type and bedrooms.",
  // Filtered URLs canonicalise to the unfiltered index (plan item 28).
  alternates: { canonical: "/listings" },
};

export default async function ListingsPage({ searchParams }: PageProps<"/listings">) {
  // Next 16: searchParams is a Promise.
  const params = await searchParams;
  // Non-staff must never land on ?status=De-listed (empty / useless tab).
  await stripDelistedForPublic(params);
  const rent = parseListingParams(params).transaction === "rent";

  return (
    <>
      <header className="border-b border-line bg-surface-alt py-4 sm:py-10">
        <div className="container-page">
          <h1 className="text-h2 sm:text-h1 text-ink">
            {rent ? "GTA homes for rent" : "GTA homes for sale"}
          </h1>
          <p className="mt-0.5 hidden text-small text-ink-muted sm:mt-1 sm:block">
            Live MLS® data, updated daily.
          </p>
        </div>
      </header>

      {/* Filters, tabs and pages navigate through the provider: the clicked
          control updates at once and the results show a skeleton until the
          new page arrives, instead of the old results sitting there stale. */}
      <PendingNavigationProvider>
        <div className="container-page py-4 sm:py-8">
          <Suspense fallback={<div className="h-24" />}>
            <FiltersSlot params={params} />
          </Suspense>

          <div className="mt-4 sm:mt-8">
            <PendingContent fallback={<PropertyGridSkeleton />}>
              <Suspense key={JSON.stringify(params)} fallback={<PropertyGridSkeleton />}>
                <Results params={params} />
              </Suspense>
            </PendingContent>
          </div>
        </div>
      </PendingNavigationProvider>
    </>
  );
}

/**
 * mls-backend hides delisted from anyone without JWT + is_staff. Strip the
 * URL so non-staff never sit on an empty De-listed state from a shared link.
 */
async function stripDelistedForPublic(
  params: Record<string, string | string[] | undefined>,
) {
  const query = listingQuery(params);
  if (backendStatusGroup(query.status) !== "de-listed") return;
  const user = await getCurrentUser();
  if (user?.isStaff) return;
  redirect(
    buildListingHref({
      ...query,
      status: undefined,
      page: undefined,
    }),
  );
}

/** Staff JWT for mls-backend delisted visibility (`viewer_can_see_delisted`). */
async function staffAuthOptions(): Promise<{
  isStaff: boolean;
  options: RequestOptions;
}> {
  const user = await getCurrentUser();
  const isStaff = Boolean(user?.isStaff);
  if (!isStaff) return { isStaff: false, options: {} };
  const token = await requireAccessToken();
  if (!token) return { isStaff: false, options: {} };
  return { isStaff: true, options: { token, cache: "no-store" } };
}

/**
 * The page's query: the URL's, defaulting to For Sale. Buy, Rent and "Clear
 * filters" land on homes you can actually act on, and junk feed statuses stay
 * out unless a status is asked for by name.
 *
 * A bare city typed into `q=` (e.g. "brampton") is promoted to `city=` so the
 * backend uses city matching and tab counts stay honest.
 */
function listingQuery(params: Record<string, string | string[] | undefined>): ListingQuery {
  const parsed = parseListingParams(params);
  const cityFromSearch =
    !parsed.city && parsed.search ? matchKnownCity(parsed.search) : null;
  const query = cityFromSearch
    ? { ...parsed, city: cityFromSearch, search: undefined }
    : parsed;
  return query.status || query.openHouse ? query : { ...query, status: "Active" };
}

/**
 * Filters + status tabs. Count comes from facets for the active tab so this
 * slot never duplicates the results grid's `searchProperties` round-trip.
 */
async function FiltersSlot({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  const query = listingQuery(params);
  // Staff JWT unlocks real de-listed facet counts; public always gets 0.
  const { isStaff, options: authOptions } = await staffAuthOptions();

  // Facets are scoped to everything EXCEPT status, so each tab shows how many
  // homes switching to it would return — a count that changed with the active
  // tab would be useless for deciding whether to click.
  const facets = await getPropertyFacets(
    {
      ...query,
      status: undefined,
      openHouse: undefined,
    },
    authOptions,
  );
  const group = backendStatusGroup(query.status);
  const resultCount = query.openHouse
    ? (facets?.openHouse ?? 0)
    : group
      ? (facets?.statusGroup?.[group] ?? 0)
      : (facets?.statusGroup?.active ?? 0);

  return (
    <>
      <AiSearchNotice />
      <ListingFilters resultCount={resultCount} />
      <div className="mt-3 sm:mt-4">
        <ListingStatusTabs facets={facets} query={query} isStaff={isStaff} />
      </div>
    </>
  );
}

/** Tab wording per side: a rental is "For Lease" and ends "Leased". */
function tabLabel(group: string, fallback: string, rent: boolean): string {
  if (!rent) return fallback;
  if (group === "active") return "For Lease";
  if (group === "sold") return "Leased";
  return fallback;
}

/**
 * Fixed status tabs — For Sale / Sold / (staff) De-listed / Open house — with
 * faceted counts (API_GAPS G2). De-listed is staff-only (mls-backend
 * `viewer_can_see_delisted`); public never sees the tab or sends
 * `status_group=de-listed`.
 *
 * The set is fixed rather than built from the feed's raw statuses, so a stray
 * value in the data ("Unknown", a test row) never becomes a tab. Counts come
 * from the backend's grouped `status_group` facet, scoped WITHOUT status or
 * open house, so each tab says what clicking it would return; zero is shown
 * rather than hiding the tab, since "Sold 0" is an answer too.
 *
 * "Open house" is a sibling tab rather than a status: it sets `has_open_house=1`
 * and clears status, and picking a status clears it, so the strip always
 * describes exactly one slice. If facets fail the tabs stay, without counts.
 */
function ListingStatusTabs({
  facets,
  query,
  isStaff,
}: {
  facets: PropertyFacets | null;
  query: ListingQuery;
  isStaff: boolean;
}) {
  const base = { ...query, status: undefined, openHouse: undefined, page: undefined };
  const rent = query.transaction === "rent";
  const tabs = listingStatusTabs(isStaff);

  const items: StatusTabItem[] = [
    ...tabs.map((tab) => ({
      id: tab.group,
      label: tabLabel(tab.group, tab.label, rent),
      count: facets?.statusGroup?.[tab.group] ?? null,
      href: buildListingHref({ ...base, status: tab.param }),
    })),
    {
      id: "open-house",
      label: "Open house",
      count: facets?.openHouse ?? null,
      href: buildListingHref({ ...base, openHouse: true }),
    },
  ];

  // A raw feed status typed into the URL matches no tab, so none is selected.
  const value = query.openHouse ? "open-house" : (backendStatusGroup(query.status) ?? "");

  return <StatusTabs items={items} value={value} />;
}

async function Results({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  const query = listingQuery(params);
  const page = currentPage(query);
  const view: ListingView = params.view === "list" ? "list" : "grid";
  const group = backendStatusGroup(query.status);
  const { isStaff, options: staffOptions } = await staffAuthOptions();
  // Only staff may request de-listed, and only with a JWT on the filter call.
  const authOptions =
    isStaff && group === "de-listed" ? staffOptions : ({} as RequestOptions);

  let result;
  try {
    result = await searchProperties(query, authOptions);
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : "We couldn't load listings right now.";
    return (
      <ErrorState
        title="Listings unavailable"
        description={`${message} Please try again in a moment.`}
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
    <div className="space-y-8">
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

      {/*
        Price, bed, bath, size and year now filter server-side (API_GAPS G1
        landed), so only the TYPE filter still scans a capped window — this feed
        has no granular sub-type to query on. Disclosed rather than hidden, so a
        truncated list is never mistaken for the whole market.
      */}
      {result.truncated && (
        <p
          role="status"
          className="rounded-control border border-gold/30 bg-gold-soft px-4 py-3 text-caption text-ink"
        >
          Property type is matched across the most recent 300 listings, so some
          older matches may not appear. Adding a city narrows the search.
        </p>
      )}

      {/* Same disclosure pattern: this feed is mostly active listings, so a
          short sold list reflects coverage, not a quiet market. */}
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
