"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useUserKeys } from "@/components/providers/AuthProvider";
import {
  getRecentSales,
  normalizeRecentSalesPropertyType,
  type RecentSalesFilters,
  type RecentSalesPage,
} from "@/lib/api/market";

export type { RecentSalesFilters };

/**
 * Recently sold homes. Disabled while signed out.
 * Hits mls-backend `GET /api/mls/market/recent-sales/` via the same-origin
 * proxy (session cookie attached server-side).
 */
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
    queryFn: () =>
      getRecentSales("", {
        city,
        days,
        page,
        propertyType: propertyType || undefined,
        bedsMin,
        bathsMin,
        garagesMin,
        garagesMax,
        lotWidthMin,
      }),
    enabled: Boolean(keys && city),
    placeholderData: keepPreviousData,
    staleTime: 10 * 60_000,
  });
}

export type { RecentSalesPage };
