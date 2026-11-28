"use client";

import { motion } from "framer-motion";
import { usePendingSearchParams } from "@/components/navigation/PendingNavigation";
import type { ListingView } from "@/lib/hooks/useListingView";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { cn } from "@/lib/utils/cn";

type Mode = ListingView | "map";

/**
 * Grid / list / map switch with a sliding active pill.
 *
 * Grid and list stay on this page (client state) for instant swaps.
 * List is desktop/tablet only — phones stay on grid.
 * Map is a route (`/map-search`) carrying the active filters.
 */
export function ViewToggle({
  view,
  onChange,
}: {
  view: ListingView;
  onChange: (next: ListingView) => void;
}) {
  const params = usePendingSearchParams();
  const listAllowed = useMediaQuery("(min-width: 768px)");

  const mapQuery = new URLSearchParams(params.toString());
  mapQuery.delete("view");
  mapQuery.delete("page");
  const mapQs = mapQuery.toString();
  const mapHref = mapQs ? `/map-search?${mapQs}` : "/map-search";

  const modes: Array<{
    id: Mode;
    label: string;
    icon: React.ReactNode;
    onSelect?: () => void;
    href?: string;
  }> = [
    { id: "grid", label: "Grid", icon: <GridIcon />, onSelect: () => onChange("grid") },
    ...(listAllowed
      ? [{ id: "list" as const, label: "List", icon: <ListIcon />, onSelect: () => onChange("list") }]
      : []),
    { id: "map", label: "Map", icon: <MapIcon />, href: mapHref },
  ];

  const activeView: Mode = !listAllowed && view === "list" ? "grid" : view;

  return (
    <div
      role="group"
      aria-label="Result view"
      className="relative inline-flex items-center rounded-full bg-navy-tint/80 p-1 ring-1 ring-navy/10"
    >
      {modes.map((mode) => {
        const active = mode.id === activeView;
        const className = cn(
          "relative z-10 inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-2.5 text-caption font-medium transition-colors sm:h-9 sm:min-w-[4.25rem] sm:px-3",
          active ? "text-white" : "text-ink-muted hover:text-ink",
        );
        const content = (
          <>
            {active && (
              <motion.span
                layoutId="listings-view-pill"
                className="absolute inset-0 -z-10 rounded-full bg-navy shadow-sm"
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              {mode.icon}
              <span className="hidden sm:inline">{mode.label}</span>
            </span>
          </>
        );

        if (mode.href) {
          return (
            <a
              key={mode.id}
              href={mode.href}
              title={mode.label}
              aria-label={`${mode.label} search`}
              className={className}
            >
              {content}
            </a>
          );
        }

        return (
          <button
            key={mode.id}
            type="button"
            title={mode.label}
            aria-label={`${mode.label} view`}
            aria-pressed={active}
            onClick={mode.onSelect}
            className={className}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

export type { ListingView };

function GridIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="10.5" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="10.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="10.5" y="10.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M6 4h10M6 9h10M6 14h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="2.75" cy="4" r="1" fill="currentColor" />
      <circle cx="2.75" cy="9" r="1" fill="currentColor" />
      <circle cx="2.75" cy="14" r="1" fill="currentColor" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M2.5 4.5 6.5 2.75l5 2 4-1.75v10l-4 1.75-5-2-4 1.75v-10Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M6.5 2.75v10M11.5 4.75v10" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
