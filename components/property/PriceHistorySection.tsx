"use client";

import { PriceHistory } from "@/components/property/PriceHistory";
import { getPropertySnapshots, type PriceSnapshot } from "@/lib/api/neighbourhood";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";

/**
 * Listing History tab — snapshots fetched in the browser via `/api/mls/…`.
 */
export function PriceHistorySection({
  listingKey,
  listingId,
}: {
  listingKey: string;
  listingId: string;
}) {
  const { data: snapshots = [] } = useMlsQuery<PriceSnapshot[]>(
    ["property", "snapshots", listingKey],
    () => getPropertySnapshots(listingKey).catch(() => [] as PriceSnapshot[]),
    [],
  );
  return <PriceHistory snapshots={snapshots} listingId={listingId} />;
}
