"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useUserKeys } from "@/components/providers/AuthProvider";
import type { RecentSalesPage } from "@/lib/api/market";
import { fetchJson } from "@/lib/queries/fetcher";

export interface RecentSalesFilters {
  propertyType?: string;
  bedsMin?: number;
  bathsMin?: number;
}

/** Recently sold homes. Disabled while signed out (the route would 401). */
export function useRecentSales(
  city: string,
  days: number,
  page: number,
  filters: RecentSalesFilters = {},
) {
  const keys = useUserKeys();
  const propertyType = filters.propertyType?.trim() || "";
  const bedsMin = filters.bedsMin;
  const bathsMin = filters.bathsMin;

  return useQuery({
    queryKey:
      keys?.recentSales(city, days, page, {
        propertyType: propertyType || undefined,
        bedsMin,
        bathsMin,
      }) ?? ["me", "anonymous", "recent-sales"],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({
        city,
        days: String(days),
        page: String(page),
      });
      if (propertyType) params.set("property_type", propertyType);
      if (bedsMin != null) params.set("beds_min", String(bedsMin));
      if (bathsMin != null) params.set("baths_min", String(bathsMin));
      return fetchJson<RecentSalesPage>(`/api/market/recent-sales?${params}`, {
        signal,
        fallback: "Could not load recent sales.",
      });
    },
    enabled: Boolean(keys && city),
    placeholderData: keepPreviousData,
    staleTime: 10 * 60_000,
  });
}
