"use client";

import type { ReactNode } from "react";
import { Menu } from "@/components/ui/Menu";
import { cn } from "@/lib/utils/cn";

/**
 * Compact facet control for the listings search rail.
 * Active when a non-default filter is applied.
 */
export function FilterChipMenu({
  id,
  label,
  display,
  active = false,
  align = "left",
  panelClassName,
  children,
}: {
  id: string;
  label: string;
  display: string;
  active?: boolean;
  align?: "left" | "right";
  panelClassName?: string;
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  return (
    <div className="relative shrink-0">
      <Menu
        align={align}
        role="dialog"
        label={label}
        panelClassName={cn(
          "w-[min(17.5rem,calc(100vw-2rem))] overflow-hidden rounded-surface border border-line bg-surface shadow-pop",
          panelClassName,
        )}
        trigger={({ open, buttonProps }) => (
          <button
            {...buttonProps}
            id={id}
            type="button"
            aria-label={label}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-control border px-3 text-caption font-medium transition-colors sm:h-10 sm:px-3.5 sm:text-small",
              active
                ? "border-navy/40 bg-navy-tint text-navy shadow-sm"
                : "border-line bg-surface text-ink-soft hover:border-navy/40 hover:text-navy",
              open && "border-navy/35 text-navy ring-2 ring-navy/10",
            )}
          >
            <span className="max-w-[9.5rem] truncate sm:max-w-[12rem]">{display}</span>
            <Chevron open={open} />
          </button>
        )}
      >
        {children}
      </Menu>
    </div>
  );
}

export function FilterMenuPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex max-h-72 flex-col">
      <div className="border-b border-line px-4 py-2.5">
        <p className="text-caption font-semibold tracking-wide text-ink-muted uppercase">
          {title}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1.5" role="listbox">
        {children}
      </div>
    </div>
  );
}

export function FilterChipOption({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-2.5 text-left text-small transition-colors",
        selected
          ? "bg-navy-tint font-medium text-navy"
          : "text-ink hover:bg-surface-alt",
      )}
    >
      <span className="min-w-0 flex-1">{children}</span>
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
          selected
            ? "border-navy bg-navy text-white"
            : "border-line bg-surface text-transparent",
        )}
        aria-hidden="true"
      >
        <CheckMark />
      </span>
    </button>
  );
}

function CheckMark() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
      <path
        d="M2.5 6.2 4.8 8.5 9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0 opacity-50 transition-transform duration-200", open && "rotate-180")}
    >
      <path
        d="M4 6L8 10L12 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
