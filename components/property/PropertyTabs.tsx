"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Sticky detail tabs, matching HomeAtlasUI's property page.
 *
 * The bar sits under the site header. Tabs scroll sideways on a narrow
 * screen; the Watch / Share / tour actions wrap onto their own row so they
 * are never clipped. Estimates, schools and community only render data the
 * catalogue actually has — sample school ratings from the reference are not
 * reproduced. Climate Risk on Overview is location-based (Open-Meteo CMIP6).
 *
 * Visited panels stay mounted (hidden when inactive) so local UI state —
 * e.g. mortgage calculator inputs on Comparables — survives tab switches.
 */
export interface PropertyTab {
  id: string;
  label: string;
  /** Hidden entirely when false — an empty tab is worse than no tab. */
  available?: boolean;
  content: ReactNode;
}

export function PropertyTabs({
  tabs,
  actions,
  hero,
  lead,
  aside,
  footnote,
}: {
  tabs: PropertyTab[];
  /** Watch, share, tour, compare and WhatsApp. Wraps under the tabs on small screens. */
  actions?: ReactNode;
  /** Full-width photo gallery above the two-column body. */
  hero?: ReactNode;
  /** Price header under the gallery. Stays in the main column beside the aside. */
  lead?: ReactNode;
  /** Schedule-viewing column. Stacks under the tabs below the `lg` breakpoint. */
  aside?: ReactNode;
  footnote?: ReactNode;
}) {
  const visible = tabs.filter((tab) => tab.available !== false);
  const initialId = visible[0]?.id;
  const [active, setActive] = useState(initialId);
  const [visited, setVisited] = useState<ReadonlySet<string>>(
    () => new Set(initialId ? [initialId] : []),
  );

  if (visible.length === 0) return null;

  const current = visible.find((tab) => tab.id === active) ?? visible[0];

  function selectTab(id: string) {
    setActive(id);
    setVisited((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  return (
    <div className="mt-2 sm:mt-3">
      <div className="sticky top-[72px] z-40 border-b border-line bg-surface lg:top-20">
        <div className="container-page flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div
            role="tablist"
            aria-label="Property details"
            className="-mx-1 flex min-w-0 flex-1 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {visible.map((tab) => {
              const selected = tab.id === current.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={selected}
                  aria-controls={`panel-${tab.id}`}
                  onClick={() => selectTab(tab.id)}
                  className={cn(
                    "shrink-0 cursor-pointer whitespace-nowrap border-b-2 px-4 py-4 text-[13px] font-medium transition-colors sm:px-5",
                    selected
                      ? "border-navy text-navy"
                      : "border-transparent text-ink-muted hover:text-ink",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          {actions && (
            <div className="flex shrink-0 flex-wrap items-center gap-2 pb-3 lg:flex-nowrap lg:py-0 lg:pl-4">
              {actions}
            </div>
          )}
        </div>
      </div>

      <div className="container-page py-6 sm:py-8">
        {hero ? <div className="mb-6 sm:mb-8">{hero}</div> : null}
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            {lead && <div className="mb-8">{lead}</div>}
            {/*
              Several panel sections carry their own `mt-10` from when they
              were stacked down one long page. Inside a panel that margin is
              dead space, so the first child has it removed here.
              Mount each visited panel once and hide inactive ones so inputs
              (mortgage calculator, notes, …) are not reset on tab change.
            */}
            {visible.map((tab) => {
              if (!visited.has(tab.id)) return null;
              const selected = tab.id === current.id;
              return (
                <div
                  key={tab.id}
                  role="tabpanel"
                  id={`panel-${tab.id}`}
                  aria-labelledby={`tab-${tab.id}`}
                  hidden={!selected}
                  className="[&>*:first-child]:mt-0 [&>section:first-child]:mt-0"
                >
                  {tab.content}
                </div>
              );
            })}
            {footnote}
          </div>

          {aside && (
            <aside className="lg:sticky lg:top-[9.25rem] lg:h-fit">{aside}</aside>
          )}
        </div>
      </div>
    </div>
  );
}
