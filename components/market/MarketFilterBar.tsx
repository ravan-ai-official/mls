"use client";

import type { ReactNode } from "react";
import {
  usePendingNavigation,
  usePendingSearchParams,
} from "@/components/navigation/PendingNavigation";
import { Select } from "@/components/ui/Field";
import {
  MARKET_CITIES,
  MARKET_RANGES,
  SOLD_PROPERTY_TYPES,
  type SoldCommunity,
} from "@/lib/api/market";

/**
 * Sticky filter bar for Market Insights.
 * Order: City → Community → Property type → Period.
 * Each control navigates via PendingNavigation so the rest of the page
 * swaps to a skeleton while the new URL loads. Selected values follow the
 * pending URL so dropdowns flip on change before the server answers.
 */
export function MarketFilterBar({
  city,
  community,
  type,
  rangeKey,
  communities,
  hrefFor,
}: {
  city: string;
  community: string | null;
  type: string | null;
  rangeKey: string;
  communities: SoldCommunity[];
  /** Prebuilt URLs keyed as city:<name>, community:<name|"", type:<key|"">, range:<key>. */
  hrefFor: Record<string, string>;
}) {
  const { navigate, target } = usePendingNavigation();
  const pending = usePendingSearchParams();

  // While a navigation is in flight, read the destination URL so selects flip
  // immediately (including when a param is cleared). Otherwise use server props.
  const shownCity = target
    ? (MARKET_CITIES.find((option) => option.toLowerCase() === pending.get("city")?.toLowerCase()) ?? city)
    : city;
  const shownCommunity = target ? pending.get("community") : community;
  const shownType = target
    ? (SOLD_PROPERTY_TYPES.find((option) => option.key === pending.get("type"))?.key ?? null)
    : type;
  const shownRange = target
    ? (MARKET_RANGES.find((option) => option.key === (pending.get("range") ?? MARKET_RANGES[0].key))?.key ??
      MARKET_RANGES[0].key)
    : rangeKey;

  function go(key: string) {
    const href = hrefFor[key];
    if (!href) return;
    navigate(href, { scroll: false });
    // Period drives the charts below the heatmap — scroll there so the update is visible.
    // City / community / type still land on the heatmap comparison.
    requestAnimationFrame(() => {
      const target = key.startsWith("range:") ? "market-selected" : "market-heatmap";
      document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <section
      aria-label="Filter the market view"
      className="sticky top-[72px] z-20 -mx-4 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface/85 sm:mx-0 sm:rounded-2xl sm:border sm:px-5 sm:py-4 lg:top-20"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        <FilterSelect
          label="City"
          value={shownCity}
          onChange={(value) => go(`city:${value}`)}
        >
          {MARKET_CITIES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          label="Community"
          value={shownCommunity ?? ""}
          onChange={(value) => go(`community:${value}`)}
          disabled={communities.length === 0}
        >
          <option value="">All communities</option>
          {communities.map((option) => (
            <option key={option.name} value={option.name}>
              {option.name}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          label="Property type"
          value={shownType ?? ""}
          onChange={(value) => go(`type:${value}`)}
        >
          <option value="">All types</option>
          {SOLD_PROPERTY_TYPES.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          label="Period"
          value={shownRange}
          onChange={(value) => go(`range:${value}`)}
        >
          {MARKET_RANGES.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </FilterSelect>
      </div>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[1.6px] text-ink-muted">
        {label}
      </span>
      <Select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0"
        aria-label={label}
      >
        {children}
      </Select>
    </label>
  );
}
