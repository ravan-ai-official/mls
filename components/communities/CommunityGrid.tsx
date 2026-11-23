"use client";

import {
  CommunityCard,
  CommunityCardSkeleton,
  communityImage,
} from "@/components/communities/CommunityCard";
import { getCommunityImages } from "@/lib/api/home";
import { getBulkCatalogStats } from "@/lib/api/market";
import { COMMUNITY_CITIES } from "@/lib/constants/cities";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";
import type { CityCatalogStat } from "@/lib/types/domain";

type CommunityGridPayload = {
  rows: CityCatalogStat[];
  curatedImages: Record<string, string> | null;
};

/**
 * All city stats in ONE request (`catalog-stats/bulk/`, API_GAPS G4), with the
 * 90-day sold summary the backend attaches from AMPRE. If the request fails
 * the cards still render with dashes rather than the grid disappearing.
 * Fetches in the browser via `/api/mls/…` so Network shows JSON.
 */
export function CommunityGrid() {
  const { data, isPending } = useMlsQuery<CommunityGridPayload>(
    ["communities", "bulk-stats"],
    async () => {
      const [rows, curatedImages] = await Promise.all([
        getBulkCatalogStats({ cities: [...COMMUNITY_CITIES] }).catch(
          () => [] as CityCatalogStat[],
        ),
        getCommunityImages(),
      ]);
      return { rows, curatedImages };
    },
    { rows: [], curatedImages: null },
  );

  if (isPending && !data) {
    return <CommunitiesSkeleton />;
  }

  const byCity = new Map((data?.rows ?? []).map((row) => [row.city.toLowerCase(), row]));
  const curatedImages = data?.curatedImages ?? null;

  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {COMMUNITY_CITIES.map((city) => (
        <li key={city}>
          <CommunityCard
            city={city}
            image={communityImage(city, curatedImages)}
            stats={byCity.get(city.toLowerCase()) ?? null}
          />
        </li>
      ))}
    </ul>
  );
}

export function CommunitiesSkeleton() {
  return (
    <div
      className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      role="status"
      aria-label="Loading communities"
    >
      {Array.from({ length: 8 }).map((_, index) => (
        <CommunityCardSkeleton key={index} />
      ))}
    </div>
  );
}
