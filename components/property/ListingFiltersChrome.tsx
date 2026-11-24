"use client";

import { useSearchParams } from "next/navigation";
import { ListingFilters } from "@/components/property/ListingFilters";
import { listingQueryFromSearch } from "@/components/property/ListingsResults";
import { AiSearchNotice } from "@/components/search/AiSearchNotice";
import { StatusTabs, type StatusTabItem } from "@/components/search/StatusTabs";
import { getPropertyFacets } from "@/lib/api/properties";
import { useAuth } from "@/components/providers/AuthProvider";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";
import type { ListingQuery } from "@/lib/types/domain";
import { buildListingHref } from "@/lib/utils/searchParams";
import {
  backendStatusGroup,
  listingStatusTabs,
} from "@/lib/utils/status";

/**
 * Listings filters + status tabs. Facets load in the browser via `/api/mls/…`
 * so Network shows the JSON counts envelope.
 */
export function ListingFiltersChrome() {
  const params = useSearchParams();
  const { user } = useAuth();
  const isStaff = Boolean(user?.isStaff);
  const query = listingQueryFromSearch(params);

  const facetQuery: ListingQuery = {
    ...query,
    status: undefined,
    openHouse: undefined,
  };

  const { data: facets = null } = useMlsQuery<PropertyFacets | null>(
    ["listings", "facets", params.toString()],
    () => getPropertyFacets(facetQuery),
    null,
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
        <ListingStatusTabs query={query} isStaff={isStaff} />
      </div>
    </>
  );
}

function tabLabel(group: string, fallback: string, rent: boolean): string {
  if (!rent) return fallback;
  if (group === "active") return "For Lease";
  if (group === "sold") return "Leased";
  return fallback;
}

function ListingStatusTabs({
  query,
  isStaff,
}: {
  query: ListingQuery;
  isStaff: boolean;
}) {
  const base = { ...query, status: undefined, openHouse: undefined, page: undefined };
  const rent = query.transaction === "rent";
  const tabs = listingStatusTabs(isStaff);

  // Labels only — no per-tab counts (For Sale / Sold / Open house).
  const items: StatusTabItem[] = [
    ...tabs.map((tab) => ({
      id: tab.group,
      label: tabLabel(tab.group, tab.label, rent),
      href: buildListingHref({ ...base, status: tab.param }),
    })),
    {
      id: "open-house",
      label: "Open house",
      href: buildListingHref({ ...base, openHouse: true }),
    },
  ];

  const value = query.openHouse ? "open-house" : (backendStatusGroup(query.status) ?? "");

  return <StatusTabs items={items} value={value} />;
}
