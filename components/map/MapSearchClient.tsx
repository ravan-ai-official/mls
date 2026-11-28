"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui/Button";

/**
 * Client wrapper for the map.
 *
 * Leaflet reads `window` at import time, so it cannot be server-rendered.
 * Next 16 only permits `ssr: false` inside a Client Component, hence this shim.
 */
const MapSearch = dynamic(
  () => import("@/components/map/MapSearch").then((mod) => mod.MapSearch),
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

export function MapSearchClient() {
  return <MapSearch />;
}
