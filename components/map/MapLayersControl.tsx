"use client";

import { useState } from "react";
import {
  MAP_BASEMAPS,
  PIN_COLOR_MODE_LABELS,
  type BasemapId,
  type PinColorMode,
} from "@/lib/map/basemap";
import { pinModeLegend } from "@/lib/map/pinStyles";
import { cn } from "@/lib/utils/cn";

/**
 * Compact map style panel — opened from the layers control, not always on-map.
 */
export function MapLayersPanel({
  basemap,
  pinMode,
  shareUrl,
  onBasemap,
  onPinMode,
}: {
  basemap: BasemapId;
  pinMode: PinColorMode;
  shareUrl?: string;
  onBasemap: (next: BasemapId) => void;
  onPinMode: (next: PinColorMode) => void;
}) {
  const legend = pinModeLegend(pinMode);
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div className="w-[min(16.5rem,calc(100vw-5rem))] space-y-3 p-3">
      <div>
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          Map
        </p>
        <div className="flex gap-1" role="group" aria-label="Basemap">
          {(Object.keys(MAP_BASEMAPS) as BasemapId[]).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={basemap === id}
              onClick={() => onBasemap(id)}
              className={cn(
                "flex-1 rounded-control px-2 py-1.5 text-caption font-medium transition-colors",
                basemap === id
                  ? "bg-navy text-white"
                  : "bg-surface-alt text-ink-muted hover:text-ink",
              )}
            >
              {MAP_BASEMAPS[id].label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          Pin color
        </p>
        <div className="flex flex-col gap-1" role="group" aria-label="Pin colors">
          {(Object.keys(PIN_COLOR_MODE_LABELS) as PinColorMode[]).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={pinMode === id}
              onClick={() => onPinMode(id)}
              className={cn(
                "rounded-control px-2.5 py-1.5 text-left text-caption font-medium transition-colors",
                pinMode === id
                  ? "bg-navy text-white"
                  : "text-ink-muted hover:bg-surface-alt hover:text-ink",
              )}
            >
              {PIN_COLOR_MODE_LABELS[id]}
            </button>
          ))}
        </div>
      </div>

      <ul
        className="flex flex-wrap gap-x-3 gap-y-1 border-t border-line-soft pt-2"
        aria-label="Pin legend"
      >
        {legend.map((item) => (
          <li key={item.label} className="flex items-center gap-1.5 text-[11px] text-ink-muted">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: item.color }}
              aria-hidden
            />
            {item.label}
          </li>
        ))}
      </ul>

      {shareUrl && (
        <button
          type="button"
          onClick={() => void copyLink()}
          className="w-full rounded-control border border-line px-2.5 py-1.5 text-caption font-medium text-ink transition-colors hover:border-navy hover:text-navy"
        >
          {copied ? "Link copied" : "Copy map link"}
        </button>
      )}
    </div>
  );
}
