"use client";

import { useSearchParams } from "next/navigation";
import { ListingFilters } from "@/components/property/ListingFilters";
import { listingQueryFromSearch } from "@/components/property/ListingsResults";
import { AiSearchNotice } from "@/components/search/AiSearchNotice";
import { getFilterSchema, getPropertyFacets } from "@/lib/api/properties";
import { DEFAULT_FILTER_SCHEMA, type FilterSchema } from "@/lib/search/filterSchema";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";
import type { ListingQuery, PropertyFacets } from "@/lib/types/domain";
import { backendStatusGroup } from "@/lib/utils/status";

/**
 * Listings filters chrome. Search dock + facet chips (transaction, price,
 * beds, baths, sort, more); advanced filters stay in the sheet.
 */
export function ListingFiltersChrome() {
  const params = useSearchParams();
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

  const { data: schema = DEFAULT_FILTER_SCHEMA } = useMlsQuery<FilterSchema>(
    ["listings", "filter-schema"],
    () => getFilterSchema(),
    DEFAULT_FILTER_SCHEMA,
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
      <ListingFilters resultCount={resultCount} schema={schema} />
    </>
  );
}
