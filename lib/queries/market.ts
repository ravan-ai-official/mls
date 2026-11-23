"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useUserKeys } from "@/components/providers/AuthProvider";
import {
  normalizeRecentSalesPropertyType,
  type RecentSalesFilters,
  type RecentSalesPage,
} from "@/lib/api/market";
import { fetchJson } from "@/lib/queries/fetcher";

export type { RecentSalesFilters };

/** Recently sold homes. Disabled while signed out (the route would 401). */
export function useRecentSales(
  city: string,
  days: number,
  page: number,
  filters: RecentSalesFilters = {},
) {
  const keys = useUserKeys();
  const propertyType =
    normalizeRecentSalesPropertyType(filters.propertyType) ||
    filters.propertyType?.trim() ||
    "";
  const bedsMin = filters.bedsMin;
  const bathsMin = filters.bathsMin;
  const garagesMin = filters.garagesMin;
  const garagesMax = filters.garagesMax;
  const lotWidthMin = filters.lotWidthMin;

  return useQuery({
    queryKey:
      keys?.recentSales(city, days, page, {
        propertyType: propertyType || undefined,
        bedsMin,
        bathsMin,
        garagesMin,
        garagesMax,
        lotWidthMin,
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
      if (garagesMin != null) params.set("garages_min", String(garagesMin));
      if (garagesMax != null) params.set("garages_max", String(garagesMax));
      if (lotWidthMin != null) params.set("lot_width_min", String(lotWidthMin));
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
