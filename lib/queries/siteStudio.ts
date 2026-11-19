"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useUserKeys } from "@/components/providers/AuthProvider";
import { fetchJson } from "@/lib/queries/fetcher";
import { qk } from "@/lib/queries/keys";
import type { SiteKey } from "@/lib/site/types";

export interface SiteRecordBody {
  draft: unknown;
  published: unknown;
  updated_at: string;
  published_at: string | null;
  dirty: boolean;
}

export interface SiteRevisionRow {
  id: number;
  created_at: string;
  created_by: string;
}

export interface FeaturedBody {
  pins: Array<{
    listing_key: string;
    address: string;
    city: string;
    list_price: string | null;
    standard_status: string;
    is_featured: boolean;
    featured_order: number | null;
    featured_until: string | null;
  }>;
  results: FeaturedBody["pins"];
}

export interface HighReturnBody {
  pins: Array<{
    listing_key: string;
    address: string;
    city: string;
    list_price: string | null;
    standard_status: string;
    is_high_return: boolean;
    high_return_order: number | null;
    high_return_until: string | null;
  }>;
  results: HighReturnBody["pins"];
}

export interface EditorialBody {
  results: Array<Record<string, unknown>>;
}

const absent = qk.me(-1);

/** Draft and published copy for one site document. Header and footer share `chrome`. */
export function useSiteDocument(siteKey: SiteKey) {
  const keys = useUserKeys();
  return useQuery({
    queryKey: (keys ?? absent).siteDocument(siteKey),
    enabled: keys !== null,
    queryFn: ({ signal }) =>
      fetchJson<SiteRecordBody>(`/api/studio/site/${siteKey}`, {
        signal,
        cache: "no-store",
        fallback: "Could not load this page.",
      }),
  });
}

export function useSiteRevisions(siteKey: SiteKey) {
  const keys = useUserKeys();
  return useQuery({
    queryKey: (keys ?? absent).siteRevisions(siteKey),
    enabled: keys !== null,
    queryFn: ({ signal }) =>
      fetchJson<{ results: SiteRevisionRow[] }>(`/api/studio/site/${siteKey}/revisions`, {
        signal,
        cache: "no-store",
        fallback: "Could not load previous versions.",
      }),
  });
}

export function useFeaturedListings(initial: FeaturedBody, submitted: string) {
  const keys = useUserKeys();
  const [seededAt] = useState(() => Date.now());
  return useQuery({
    queryKey: (keys ?? absent).featured(submitted),
    enabled: keys !== null,
    queryFn: ({ signal }) =>
      fetchJson<FeaturedBody>(`/api/studio/featured?q=${encodeURIComponent(submitted)}`, {
        signal,
        cache: "no-store",
        fallback: "Could not search listings.",
      }),
    initialData: submitted === "" ? initial : undefined,
    initialDataUpdatedAt: submitted === "" ? seededAt : undefined,
    placeholderData: keepPreviousData,
  });
}

export function useHighReturnListings(initial: HighReturnBody, submitted: string) {
  const keys = useUserKeys();
  const [seededAt] = useState(() => Date.now());
  return useQuery({
    queryKey: (keys ?? absent).highReturn(submitted),
    enabled: keys !== null,
    queryFn: ({ signal }) =>
      fetchJson<HighReturnBody>(`/api/studio/high-return?q=${encodeURIComponent(submitted)}`, {
        signal,
        cache: "no-store",
        fallback: "Could not search listings.",
      }),
    initialData: submitted === "" ? initial : undefined,
    initialDataUpdatedAt: submitted === "" ? seededAt : undefined,
    placeholderData: keepPreviousData,
  });
}

export function useEditorialList(resource: string, rows: Array<Record<string, unknown>>) {
  const keys = useUserKeys();
  const [seededAt] = useState(() => Date.now());
  return useQuery({
    queryKey: (keys ?? absent).editorial(resource),
    enabled: keys !== null,
    queryFn: ({ signal }) =>
      fetchJson<EditorialBody>(`/api/studio/editorial/${resource}`, {
        signal,
        cache: "no-store",
        fallback: "Could not load this list.",
      }),
    initialData: { results: rows },
    initialDataUpdatedAt: seededAt,
    // Background refetches used to overwrite in-progress photo/URL edits.
    refetchOnWindowFocus: false,
  });
}
