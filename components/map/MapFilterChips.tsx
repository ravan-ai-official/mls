"use client";

import { clearMapChip, mapSearchChips } from "@/lib/map/mapChips";
import type { ListingQuery } from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";

/**
 * Always-visible filter summary on the map / list chrome.
 * One-tap clear per chip so shoppers see what’s applied without opening Filters.
 */
export function MapFilterChips({
  query,
  onChange,
  className,
}: {
  query: ListingQuery;
  onChange: (next: ListingQuery) => void;
  className?: string;
}) {
  const chips = mapSearchChips(query);
  if (chips.length === 0) return null;

  return (
    <div
      className={cn(
        "flex gap-1.5 overflow-x-auto scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none]",
        className,
      )}
      role="list"
      aria-label="Active filters"
    >
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          role="listitem"
          onClick={() => onChange(clearMapChip(query, chip.key))}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-caption text-ink shadow-card transition-colors hover:border-navy/40 hover:text-navy"
          aria-label={`Remove filter ${chip.label}`}
          title={`Remove ${chip.label}`}
        >
          <span className="max-w-[10rem] truncate">{chip.label}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
      ))}
    </div>
  );
}
