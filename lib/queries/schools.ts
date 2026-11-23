"use client";

import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import {
  SCHOOL_SEARCH_MIN_CHARS,
  searchSchools,
  type SchoolSearchHit,
} from "@/lib/api/schools";
import { qk } from "@/lib/queries/keys";

export function schoolSearchQuery(q: string) {
  const term = q.trim();
  return queryOptions({
    queryKey: qk.schools.search(term),
    queryFn: () => searchSchools(term, { cache: "no-store" }),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });
}

/**
 * School name suggestions. Pass an already-debounced value; prior hits stay
 * visible while the next set loads.
 */
export function useSchoolSearch(q: string) {
  return useQuery({
    ...schoolSearchQuery(q),
    enabled: q.trim().length >= SCHOOL_SEARCH_MIN_CHARS,
    placeholderData: keepPreviousData,
  });
}

export type { SchoolSearchHit };
