"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui/Button";
import { getPreconProjects, type PreconProject } from "@/lib/api/preconstruction";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";

/** Leaflet reads `window` at import, and `ssr: false` needs a Client Component. */
const PreconMapSearch = dynamic(
  () => import("@/components/map/PreconMapSearch").then((mod) => mod.PreconMapSearch),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-0 items-center justify-center gap-3 bg-surface-alt">
        <Spinner className="text-navy" />
        <span className="text-small text-ink-muted">Loading map…</span>
      </div>
    ),
  },
);

/**
 * Preconstruction map. Projects load in the browser via `/api/mls/…` so Network
 * shows JSON before the Leaflet map mounts.
 */
type PreconMapPayload = {
  items: PreconProject[];
  total: number;
  hasSearchHistory: boolean;
  cities: string[];
};

export function PreconMapSearchClient() {
  const empty: PreconMapPayload = {
    items: [],
    total: 0,
    hasSearchHistory: false,
    cities: [],
  };
  const { data, isPending } = useMlsQuery<PreconMapPayload>(
    ["precon", "map"],
    () => getPreconProjects({ limit: 100 }).catch(() => empty),
    empty,
  );

  const items = data?.items ?? [];
  if (isPending && items.length === 0) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center gap-3 bg-surface-alt">
        <Spinner className="text-navy" />
        <span className="text-small text-ink-muted">Loading projects…</span>
      </div>
    );
  }

  return <PreconMapSearch projects={items} />;
}
