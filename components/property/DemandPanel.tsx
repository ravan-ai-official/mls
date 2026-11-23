"use client";

import { MarketDemand } from "@/components/property/KeyFacts";
import { getListingEngagement, type ListingEngagement } from "@/lib/api/neighbourhood";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";

/**
 * Market demand strip — engagement fetched in the browser via `/api/mls/…`.
 */
export function DemandPanel({ listingKey }: { listingKey: string }) {
  const { data: engagement = null } = useMlsQuery<ListingEngagement | null>(
    ["property", "engagement", listingKey],
    () => getListingEngagement(listingKey),
    null,
  );
  return <MarketDemand engagement={engagement} />;
}
