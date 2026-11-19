"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { PendingLink, sameHref, usePendingNavigation } from "@/components/navigation/PendingNavigation";
import { cn } from "@/lib/utils/cn";

/**
 * Tab strip in the three shapes the reference uses:
 *
 * - `pill`      — rounded chips; Watched page (HomeAtlasUI Navbar / WatchedList)
 * - `segmented` — joined control on a surface-alt track; status tabs
 *                 (HomeAtlasUI ListingsPage L190-216, AuthModal L57-78)
 * - `underline` — text tabs over a hairline; section nav on detail pages
 * - `folder`    — rounded-top tabs sitting on a hairline; the navbar Watched
 *                 dropdown (HomeAtlasUI Navbar L150-162)
 *
 * Two modes:
 * - Button tabs (`onChange`) — `role="tablist"` with arrow-key roving focus.
 *   Pair each panel with `tabPanelProps(id)` for aria wiring.
 * - Link tabs (`hrefFor`) — plain navigation with `aria-current`. Used when the
 *   selection lives in the URL (listing status, anchored sections), where
 *   tab/tabpanel roles would be wrong because each tab is a page or anchor.
 */
export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  /** Trailing count, rendered muted. */
  count?: number | null;
  disabled?: boolean;
}

type Variant = "pill" | "segmented" | "underline" | "folder";

const TRACK: Record<Variant, string> = {
  pill: "flex flex-wrap gap-2",
  segmented:
    "inline-flex max-w-full gap-1 overflow-x-auto rounded-control bg-navy-tint p-1 ring-1 ring-navy/10",
  underline: "flex gap-6 overflow-x-auto border-b border-line",
  folder: "flex gap-1 overflow-x-auto border-b border-line px-2 pt-2",
};

function tabClasses(variant: Variant, active: boolean, size: "sm" | "md") {
  switch (variant) {
    case "pill":
      return cn(
        "rounded-full border font-medium transition-colors whitespace-nowrap",
        size === "sm" ? "px-3 py-1.5 text-caption" : "px-4 py-2 text-caption",
        active
          ? "border-navy bg-navy text-white"
          : "border-line text-ink-muted hover:border-navy hover:text-ink",
      );
    case "segmented":
      return cn(
        "rounded-[calc(var(--radius-control)-0.25rem)] font-semibold transition-colors whitespace-nowrap",
        size === "sm" ? "px-3 py-1.5 text-caption" : "px-4 py-2 text-small",
        active
          ? "bg-navy text-white shadow-md"
          : "text-navy/75 hover:text-navy",
      );
    case "folder":
      return cn(
        "rounded-t-lg px-3 py-2 text-caption font-medium transition-colors whitespace-nowrap",
        active ? "bg-navy text-white" : "text-ink-muted hover:text-ink",
      );
    case "underline":
      return cn(
        "-mb-px border-b-2 pb-3 pt-1 text-small font-medium transition-colors whitespace-nowrap",
        active ? "border-navy text-ink" : "border-transparent text-ink-muted hover:text-ink",
      );
  }
}

function Label({ item, active, variant }: { item: TabItem<string>; active: boolean; variant: Variant }) {
  return (
    <>
      {item.label}
      {typeof item.count === "number" && (
        <span
          className={cn(
            "ml-1.5 tabular-nums",
            active && (variant === "pill" || variant === "folder" || variant === "segmented")
              ? "text-white/75"
              : active
                ? "text-ink-subtle"
                : "text-navy/45",
          )}
        >
          {item.count.toLocaleString("en-CA")}
        </span>
      )}
    </>
  );
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  hrefFor,
  variant = "pill",
  size = "md",
  label,
  idBase,
  className,
}: {
  items: Array<TabItem<T>>;
  value: T;
  onChange?: (id: T) => void;
  hrefFor?: (id: T) => string;
  variant?: Variant;
  size?: "sm" | "md";
  /** Accessible name for the strip. */
  label: string;
  /** Prefix for tab / panel ids; required for button tabs with panels. */
  idBase?: string;
  className?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const { target } = usePendingNavigation();

  if (hrefFor) {
    // Mid-navigation the clicked tab is already selected (PendingNavigation).
    const pendingId = target ? items.find((item) => sameHref(hrefFor(item.id), target))?.id : undefined;
    const selected = pendingId ?? value;
    return (
      <nav aria-label={label} className={cn(TRACK[variant], className)}>
        {items.map((item) => {
          const active = item.id === selected;
          return (
            <PendingLink
              key={item.id}
              href={hrefFor(item.id)}
              aria-current={active ? "page" : undefined}
              scroll={false}
              className={tabClasses(variant, active, size)}
            >
              <Label item={item} active={active} variant={variant} />
            </PendingLink>
          );
        })}
      </nav>
    );
  }

  const enabled = items.filter((item) => !item.disabled);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const pos = enabled.findIndex((item) => item.id === items[index].id);
    let next = pos;
    if (event.key === "ArrowRight") next = (pos + 1) % enabled.length;
    if (event.key === "ArrowLeft") next = (pos - 1 + enabled.length) % enabled.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = enabled.length - 1;
    const target = enabled[next];
    onChange?.(target.id);
    refs.current[items.indexOf(target)]?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className={cn(TRACK[variant], className)}>
      {items.map((item, index) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={idBase ? `${idBase}-tab-${item.id}` : undefined}
            aria-controls={idBase ? `${idBase}-panel-${item.id}` : undefined}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange?.(item.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              tabClasses(variant, active, size),
              // Tailwind v4 dropped the pointer cursor from buttons; link tabs get it natively.
              "cursor-pointer disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            <Label item={item} active={active} variant={variant} />
          </button>
        );
      })}
    </div>
  );
}

/** Props for the panel paired with a button tab. */
export function tabPanelProps(idBase: string, id: string) {
  return {
    role: "tabpanel" as const,
    id: `${idBase}-panel-${id}`,
    "aria-labelledby": `${idBase}-tab-${id}`,
    tabIndex: 0,
  };
}
