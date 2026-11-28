"use client";

import {
  keepPreviousData,
  queryOptions,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  compareProperties,
  searchProperties,
  type ListingsResult,
} from "@/lib/api/properties";
import { matchKnownCity } from "@/lib/constants/cities";
import type { ListingQuery, PropertyDetail } from "@/lib/types/domain";
import { parseListingSearch } from "@/lib/utils/searchParams";
import { qk } from "@/lib/queries/keys";

const LISTINGS_STALE_TIME = 3 * 60_000;

/** Stable cache key from a listings URL (or relative search string). */
export function listingsSearchKey(search: string | URLSearchParams): string {
  const params = new URLSearchParams(
    typeof search === "string"
      ? search.startsWith("?")
        ? search.slice(1)
        : search
      : search,
  );
  // Presentation-only — must not bust the search cache or refetch.
  params.delete("view");
  params.sort();
  return params.toString();
}

/** Same defaults as the listings page (For sale when unset). */
export function listingQueryFromSearch(params: URLSearchParams | string): ListingQuery {
  const parsed = parseListingSearch(params);
  const cityFromSearch =
    !parsed.city && parsed.search ? matchKnownCity(parsed.search) : null;
  const query = cityFromSearch
    ? { ...parsed, city: cityFromSearch, search: undefined }
    : parsed;
  const transaction = query.transaction ?? "sale";
  if (transaction === "sold") {
    return {
      ...query,
      transaction: "sold",
      status: query.status ?? "Sold",
      openHouse: undefined,
    };
  }
  if (query.status || query.openHouse) return { ...query, transaction };
  return { ...query, transaction, status: "Active" };
}

/**
 * Shared options for prefetch / useQuery against mls-backend
 * `GET /api/mls/properties/filter/` (via same-origin proxy).
 */
export function listingsSearchQuery(search: string | URLSearchParams) {
  const filters = listingsSearchKey(search);
  return queryOptions({
    queryKey: qk.properties.search(filters),
    queryFn: () =>
      searchProperties(listingQueryFromSearch(filters), { cache: "no-store" }),
    staleTime: LISTINGS_STALE_TIME,
    placeholderData: keepPreviousData,
  });
}

/** Client listings search; keeps the previous page painted while filters change. */
export function useListingsSearch(search: string | URLSearchParams, enabled = true) {
  return useQuery({ ...listingsSearchQuery(search), enabled });
}

/**
 * Client-side query hooks.
 *
 * These replace the hand-rolled useEffect + useState fetching that previously
 * lived in each component. That pattern caused two real bugs:
 *  - an empty-state flash, because the initial state had to guess between
 *    "empty" and "loading" before the effect had run
 *  - a Strict Mode double-mount race that discarded the first response
 *
 * `useQuery` has an explicit `isPending` from the very first render, and
 * dedupes/caches by key, so neither failure mode is expressible here.
 */

async function fetchProperties(ids: string[]): Promise<PropertyDetail[]> {
  return compareProperties(ids.slice(0, 50), { cache: "no-store" });
}

/** Cache key for one property, so a set query can seed and reuse single rows. */
const propertyKey = qk.properties.byId;

/**
 * Hydrates a set of listing keys into full records.
 *
 * Each result is ALSO written into a per-id cache entry, and the set query is
 * seeded back FROM those entries via `placeholderData`. Both halves matter:
 *
 * The key includes the ids, so adding or removing a home produces a key with
 * no cached data. Without the seed that put the whole set back into a pending
 * state, and callers that render a skeleton while `data` is undefined blanked
 * the entire page — a removal looked exactly like a full reload. When every
 * remaining id is already cached individually, the seed serves the new key
 * from memory and the removed column simply disappears.
 *
 * `placeholderData` (not `initialData`) is deliberate: placeholder data is not
 * written into the cache and does not count as fresh, so the set still
 * revalidates in the background and a genuinely new id is still fetched.
 */
export function usePropertiesByIds(ids: string[]) {
  const queryClient = useQueryClient();

  return useQuery<PropertyDetail[]>({
    queryKey: qk.properties.byIds(ids),
    enabled: ids.length > 0,
    queryFn: async (): Promise<PropertyDetail[]> => {
      const data = await fetchProperties(ids);
      for (const property of data) {
        queryClient.setQueryData(propertyKey(property.id), property);
      }
      return data;
    },
    /*
     * Keep the grid painted while the set key changes (save / un-save).
     *
     * 1. If the previous set already has every remaining id (typical un-save),
     *    filter it — the removed card disappears with no skeleton flash.
     * 2. Otherwise rebuild from per-id cache entries when they are ALL present.
     *    A partial set is not returned: rendering three of four homes as if
     *    complete would make the fourth look removed rather than loading.
     */
    placeholderData: (previousData): PropertyDetail[] | undefined => {
      if (ids.length === 0) return undefined;
      if (previousData) {
        const wanted = new Set(ids);
        const filtered = previousData.filter((property) => wanted.has(property.id));
        if (filtered.length === ids.length) return filtered;
      }
      const cached = ids.map((id) =>
        queryClient.getQueryData<PropertyDetail>(propertyKey(id)),
      );
      return cached.every(Boolean) ? (cached as PropertyDetail[]) : undefined;
    },
  });
}

/**
 * Per-id lookup that reads whatever is already cached before fetching.
 *
 * Used by the compare strip: a home ticked on a listings page is usually
 * already in the cache, so its pill renders the address immediately rather
 * than waiting on a refetch of the whole set.
 */
export function usePropertyLookup(ids: string[]) {
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: propertyKey(id),
      queryFn: async () => {
        const [property] = await fetchProperties([id]);
        if (!property) throw new Error("Listing unavailable.");
        return property;
      },
    })),
  });

  const byId = new Map<string, PropertyDetail>();
  results.forEach((result, index) => {
    if (result.data) byId.set(ids[index], result.data);
  });
  return byId;
}

export type { ListingsResult };
