"use client";

import { ListingFilters } from "@/components/property/ListingFilters";
import { AiSearchNotice } from "@/components/search/AiSearchNotice";
import { getFilterSchema } from "@/lib/api/properties";
import { DEFAULT_FILTER_SCHEMA, type FilterSchema } from "@/lib/search/filterSchema";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";

/**
 * Listings filters chrome. Search dock + facet chips (transaction, price,
 * beds, baths, sort, more); advanced filters stay draft-until-Show-homes.
 */
export function ListingFiltersChrome() {
  const { data: schema = DEFAULT_FILTER_SCHEMA } = useMlsQuery<FilterSchema>(
    ["listings", "filter-schema"],
    () => getFilterSchema(),
    DEFAULT_FILTER_SCHEMA,
  );

  return (
    <>
      <AiSearchNotice />
      <ListingFilters schema={schema} />
    </>
  );
}
