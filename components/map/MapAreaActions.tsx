"use client";

import type { ReactNode } from "react";
import { SaveSearchButton } from "@/components/search/SaveSearchButton";
import type { ListingQuery } from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";

/**
 * Post-draw / school-area actions: redraw, clear, save.
 */
export function MapAreaActions({
  query,
  hasShape,
  onRedraw,
  onClear,
  className,
}: {
  query: ListingQuery;
  hasShape: boolean;
  onRedraw: () => void;
  onClear: () => void;
  className?: string;
}) {
  if (!hasShape && !query.schoolLabel) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 rounded-control border border-line bg-surface px-1 py-1 shadow-card",
        className,
      )}
    >
      <ActionChip onClick={onRedraw}>Redraw</ActionChip>
      <ActionChip onClick={onClear}>Clear area</ActionChip>
      <SaveSearchButton
        query={query}
        variant="quiet"
        className="h-8 w-auto gap-1 px-2.5 sm:h-8 sm:w-auto sm:px-2.5"
      />
    </div>
  );
}

function ActionChip({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-control px-2.5 py-1.5 text-caption font-medium text-ink transition-colors hover:bg-surface-alt hover:text-navy"
    >
      {children}
    </button>
  );
}
