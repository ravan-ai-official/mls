"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  MapListingCard,
  MapListingSkeletons,
} from "@/components/map/MapListingCard";
import { MapFilters } from "@/components/map/MapFilters";
import { Button } from "@/components/ui/Button";
import { clearListingFilters } from "@/lib/map/mapChips";
import { DEFAULT_SCHOOL_RADIUS_KM } from "@/lib/api/schools";
import {
  LISTING_SORTS,
  RELEVANCE_SORT,
  type ListingQuery,
  type ListingSort,
  type PropertySummary,
} from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";
import { MAP_PAGE_SIZE } from "@/lib/queries/map";
import { buildListingHref } from "@/lib/utils/searchParams";

export type SheetSnap = "peek" | "mid" | "full";

const SNAP_VH: Record<SheetSnap, number> = {
  peek: 28,
  mid: 50,
  full: 85,
};

const SNAP_ORDER: SheetSnap[] = ["peek", "mid", "full"];

function snapHeightCss(snap: SheetSnap) {
  return `${SNAP_VH[snap]}vh`;
}

function heightToSnap(heightPx: number, velocityY: number): SheetSnap {
  const vh = (heightPx / window.innerHeight) * 100;
  // Flick: negative velocity = finger up = expand; positive = collapse.
  // Threshold ~350px/s feels snappy on phones without needing a long swipe.
  if (velocityY < -0.35) {
    const above = SNAP_ORDER.find((snap) => SNAP_VH[snap] > vh + 1.5);
    if (above) return above;
  }
  if (velocityY > 0.35) {
    const below = [...SNAP_ORDER].reverse().find((snap) => SNAP_VH[snap] < vh - 1.5);
    if (below) return below;
  }
  return SNAP_ORDER.reduce((best, snap) =>
    Math.abs(SNAP_VH[snap] - vh) < Math.abs(SNAP_VH[best] - vh) ? snap : best,
  );
}

/**
 * Results column for map search — desktop aside or mobile bottom sheet.
 */
export function MapResultsPanel({
  query,
  onChange,
  countLabel,
  properties,
  clustered,
  loading,
  refreshing,
  error,
  polygon,
  filtered,
  total,
  hasMore,
  loadingMore,
  failedMore,
  paused,
  onLoadMore,
  activeId,
  selectedId,
  onActivate,
  onShowOnMap,
  rowRefs,
  listRef,
  onZoomIn,
  onZoomOut,
  onWidenSchool,
  mobile,
  sheetSnap,
  onSheetSnap,
  listCollapsed,
  onToggleCollapse,
  dragHandle,
}: {
  query: ListingQuery;
  onChange: (next: ListingQuery) => void;
  countLabel: string;
  properties: PropertySummary[];
  clustered: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  polygon: boolean;
  filtered: boolean;
  total: number | null;
  hasMore: boolean;
  loadingMore: boolean;
  failedMore: boolean;
  paused: boolean;
  onLoadMore: () => void;
  activeId: string | null;
  selectedId: string | null;
  onActivate: (id: string | null) => void;
  onShowOnMap: (property: PropertySummary) => void;
  rowRefs: RefObject<Map<string, HTMLElement> | null>;
  listRef: RefObject<HTMLUListElement | null>;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onWidenSchool: () => void;
  mobile: boolean;
  sheetSnap: SheetSnap;
  onSheetSnap: (snap: SheetSnap) => void;
  listCollapsed: boolean;
  onToggleCollapse: () => void;
  dragHandle?: ReactNode;
}) {
  const listingsHref = buildListingHref({ ...query, view: undefined });
  const sortOptions = query.semantic
    ? [RELEVANCE_SORT, ...LISTING_SORTS]
    : LISTING_SORTS;
  const [dragHeightPx, setDragHeightPx] = useState<number | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startHeight: number;
    lastY: number;
    lastT: number;
    velocityY: number;
  } | null>(null);

  // Drop the live drag height once the snap prop catches up.
  useEffect(() => {
    setDragHeightPx(null);
  }, [sheetSnap]);

  const onHandlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!mobile) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const startHeight =
      dragHeightPx ?? (SNAP_VH[sheetSnap] / 100) * window.innerHeight;
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight,
      lastY: event.clientY,
      lastT: performance.now(),
      velocityY: 0,
    };
    setDragHeightPx(startHeight);
  };

  const onHandlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const now = performance.now();
    const dt = Math.max(now - drag.lastT, 8);
    const dy = event.clientY - drag.lastY;
    // Blend recent samples so a flick still reads after a short pause at the end.
    const sample = dy / dt;
    drag.velocityY = drag.velocityY * 0.65 + sample * 0.35;
    drag.lastY = event.clientY;
    drag.lastT = now;
    const min = (SNAP_VH.peek / 100) * window.innerHeight;
    const max = (SNAP_VH.full / 100) * window.innerHeight;
    const next = Math.min(
      max,
      Math.max(min, drag.startHeight - (event.clientY - drag.startY)),
    );
    setDragHeightPx(next);
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Already released.
    }
    const height =
      dragHeightPx ?? (SNAP_VH[sheetSnap] / 100) * window.innerHeight;
    const next = heightToSnap(height, drag.velocityY);
    dragRef.current = null;
    onSheetSnap(next);
    // Keep the pixel height until sheetSnap updates to avoid a flash.
    setDragHeightPx((SNAP_VH[next] / 100) * window.innerHeight);
  };

  const body = (
    <>
      <header className="shrink-0 border-b border-line px-4 py-3 sm:px-5">
        {mobile && (
          <div
            role="slider"
            aria-label="Resize results sheet"
            aria-valuemin={SNAP_VH.peek}
            aria-valuemax={SNAP_VH.full}
            aria-valuenow={SNAP_VH[sheetSnap]}
            aria-valuetext={
              sheetSnap === "peek"
                ? "Collapsed"
                : sheetSnap === "mid"
                  ? "Half screen"
                  : "Expanded"
            }
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp") {
                event.preventDefault();
                const i = SNAP_ORDER.indexOf(sheetSnap);
                if (i < SNAP_ORDER.length - 1) onSheetSnap(SNAP_ORDER[i + 1]);
              } else if (event.key === "ArrowDown") {
                event.preventDefault();
                const i = SNAP_ORDER.indexOf(sheetSnap);
                if (i > 0) onSheetSnap(SNAP_ORDER[i - 1]);
              }
            }}
            onPointerDown={onHandlePointerDown}
            onPointerMove={onHandlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="touch-none -mx-4 -mt-3 mb-1 flex w-[calc(100%+2rem)] cursor-grab flex-col items-center py-3.5 active:cursor-grabbing"
          >
            <span className="h-1.5 w-11 rounded-full bg-ink-subtle/80" />
          </div>
        )}

        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 pt-0.5">
            <h1 className="truncate text-small font-semibold tracking-tight text-ink sm:text-h3">
              Map search
            </h1>
            <p className="mt-0.5 truncate text-caption text-ink-muted" aria-live="polite">
              {countLabel}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {!mobile && (
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-pressed={listCollapsed}
                aria-label="Hide results list"
                title="Hide list"
                className="flex h-10 w-10 items-center justify-center rounded-control border border-line bg-surface text-ink transition-colors hover:border-navy hover:text-navy"
              >
                <CollapseIcon collapsed={false} />
              </button>
            )}
            <MapFilters
              query={query}
              onChange={onChange}
              onOpenChange={(open) => {
                // Filters portal above the list; tuck the list away so they
                // don't stack as two competing bottom sheets.
                if (mobile && open) onSheetSnap("peek");
              }}
            />
            <Link
              href={listingsHref}
              className="flex h-10 items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 text-caption font-medium text-ink transition-colors hover:border-navy hover:text-navy sm:px-3"
            >
              <svg width="14" height="14" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path
                  d="M14.25 9H3.75M9 14.25 3.75 9 9 3.75"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                />
              </svg>
              <span className="hidden sm:inline">Listings</span>
            </Link>
          </div>
        </div>

        {(!mobile || sheetSnap !== "peek") && (
          <div className="mt-2.5 flex items-center gap-2">
            <label className="sr-only" htmlFor="map-list-sort">
              Sort by
            </label>
            <select
              id="map-list-sort"
              value={query.sort ?? (query.semantic ? "relevance" : "newest")}
              onChange={(event) =>
                onChange({ ...query, sort: event.target.value as ListingSort })
              }
              className="h-9 min-w-0 flex-1 rounded-control border border-line bg-surface px-2.5 text-caption text-ink outline-none focus:border-navy/35 focus:ring-2 focus:ring-navy/10"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      <ul
        ref={listRef}
        aria-busy={loading || undefined}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain transition-opacity duration-200",
          refreshing && "pointer-events-none opacity-50",
        )}
        onMouseLeave={() => onActivate(null)}
      >
        {properties.length === 0 && loading && <MapListingSkeletons count={8} />}

        {properties.length === 0 && !loading && (
          <MapEmptyState
            clustered={clustered}
            query={query}
            polygon={polygon}
            filtered={filtered}
            error={error}
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
            onWidenSchool={onWidenSchool}
            onClearFilters={() => onChange(clearListingFilters(query))}
            onClearArea={() =>
              onChange({
                ...query,
                polygon: undefined,
                schoolLabel: undefined,
                schoolKm: undefined,
              })
            }
          />
        )}

        {properties.length > 0 && properties.length < 5 && !loading && !clustered && (
          <li className="border-b border-line-soft bg-surface-alt/40 px-5 py-2.5 text-caption text-ink-muted">
            Only {properties.length} home{properties.length === 1 ? "" : "s"} here.{" "}
            {filtered ? (
              <button
                type="button"
                className="font-medium text-navy underline-offset-2 hover:underline"
                onClick={() => onChange(clearListingFilters(query))}
              >
                Clear filters
              </button>
            ) : (
              <button
                type="button"
                className="font-medium text-navy underline-offset-2 hover:underline"
                onClick={onZoomOut}
              >
                Zoom out
              </button>
            )}{" "}
            to see more.
          </li>
        )}

        {properties.map((property) => (
          <li key={property.id}>
            <MapListingCard
              ref={(node) => {
                const map = rowRefs.current;
                if (!map) return;
                if (node) map.set(property.id, node);
                else map.delete(property.id);
              }}
              property={property}
              active={property.id === activeId || property.id === selectedId}
              onActivate={() => onActivate(property.id)}
              onShowOnMap={
                property.latitude !== null && property.longitude !== null
                  ? () => onShowOnMap(property)
                  : null
              }
            />
          </li>
        ))}

        {!clustered && properties.length > 0 && (
          <ListFoot
            listRef={listRef}
            loaded={properties.length}
            total={total ?? properties.length}
            hasMore={hasMore}
            loadingMore={loadingMore}
            failed={failedMore}
            paused={paused}
            onLoadMore={onLoadMore}
          />
        )}
      </ul>
    </>
  );

  if (mobile) {
    const dragging = dragHeightPx !== null && dragRef.current !== null;
    return (
      <aside
        className={cn(
          // Above map search + controls (z-480) so a full sheet covers them.
          "absolute inset-x-0 bottom-0 z-[500] flex flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-pop",
          !dragging &&
            "transition-[height] duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
        )}
        style={{
          height: dragHeightPx !== null ? `${dragHeightPx}px` : snapHeightCss(sheetSnap),
          willChange: dragging ? "height" : undefined,
        }}
      >
        {body}
      </aside>
    );
  }

  return (
    <aside className="relative flex h-full min-h-0 w-full flex-col overflow-hidden border-l border-line bg-surface">
      {dragHandle}
      {body}
    </aside>
  );
}

function MapEmptyState({
  clustered,
  query,
  polygon,
  filtered,
  error,
  onZoomIn,
  onZoomOut,
  onWidenSchool,
  onClearFilters,
  onClearArea,
}: {
  clustered: boolean;
  query: ListingQuery;
  polygon: boolean;
  filtered: boolean;
  error: string | null;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onWidenSchool: () => void;
  onClearFilters: () => void;
  onClearArea: () => void;
}) {
  if (error) {
    return (
      <li className="px-5 py-10 text-center text-small text-ink-muted">{error}</li>
    );
  }

  if (clustered) {
    return (
      <li className="flex flex-col items-center gap-3 px-5 py-10 text-center">
        <p className="text-small text-ink-muted">Zoom in to list individual homes.</p>
        <Button variant="secondary" size="sm" onClick={onZoomIn}>
          Zoom in on this area
        </Button>
      </li>
    );
  }

  if (query.schoolLabel) {
    return (
      <li className="flex flex-col items-center gap-3 px-5 py-10 text-center">
        <p className="text-small text-ink-muted">
          No listings within {query.schoolKm ?? DEFAULT_SCHOOL_RADIUS_KM} km of{" "}
          {query.schoolLabel}.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={onWidenSchool}>
            Widen to {(query.schoolKm ?? DEFAULT_SCHOOL_RADIUS_KM) + 2} km
          </Button>
          <Button variant="ghost" size="sm" onClick={onClearArea}>
            Clear school
          </Button>
        </div>
      </li>
    );
  }

  if (polygon) {
    return (
      <li className="flex flex-col items-center gap-3 px-5 py-10 text-center">
        <p className="text-small text-ink-muted">
          No listings in your drawn area. Try a bigger area or fewer filters.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {filtered && (
            <Button variant="secondary" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClearArea}>
            Clear area
          </Button>
        </div>
      </li>
    );
  }

  if (filtered) {
    return (
      <li className="flex flex-col items-center gap-3 px-5 py-10 text-center">
        <p className="text-small text-ink-muted">
          No listings here match these filters.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={onClearFilters}>
            Clear filters
          </Button>
          <Button variant="ghost" size="sm" onClick={onZoomOut}>
            Zoom out
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-col items-center gap-3 px-5 py-10 text-center">
      <p className="text-small text-ink-muted">
        No listings in view. Try zooming out or panning to another area.
      </p>
      <Button variant="secondary" size="sm" onClick={onZoomOut}>
        Zoom out
      </Button>
    </li>
  );
}

function ListFoot({
  listRef,
  loaded,
  total,
  hasMore,
  loadingMore,
  failed,
  paused,
  onLoadMore,
}: {
  listRef: RefObject<HTMLUListElement | null>;
  loaded: number;
  total: number;
  hasMore: boolean;
  loadingMore: boolean;
  failed: boolean;
  paused: boolean;
  onLoadMore: () => void;
}) {
  const sentinelRef = useRef<HTMLLIElement>(null);
  const auto = hasMore && !loadingMore && !failed && !paused;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!auto || !sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
      },
      { root: listRef.current, rootMargin: "0px 0px 600px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [auto, loaded, listRef, onLoadMore]);

  const remaining = Math.max(0, total - loaded);
  const capped = !hasMore && remaining > 0;

  if (loadingMore) {
    return (
      <>
        <MapListingSkeletons count={Math.min(3, remaining) || 1} />
        <li role="status" className="sr-only">
          Loading more homes…
        </li>
      </>
    );
  }

  return (
    <li ref={sentinelRef} className="px-5 py-6 text-center text-caption text-ink-muted">
      {failed ? (
        <span className="inline-flex flex-wrap items-center justify-center gap-2" role="alert">
          Couldn&apos;t load more homes.
          <Button variant="secondary" size="sm" onClick={onLoadMore}>
            Try again
          </Button>
        </span>
      ) : hasMore ? (
        <Button variant="secondary" size="sm" onClick={onLoadMore} disabled={paused}>
          Load {Math.min(remaining, MAP_PAGE_SIZE)} more of {remaining.toLocaleString("en-CA")}
        </Button>
      ) : capped ? (
        <>
          That&apos;s the first {loaded.toLocaleString("en-CA")} of {total.toLocaleString("en-CA")}.
          Zoom in, draw an area or add a filter to browse the rest.
        </>
      ) : loaded > 10 ? (
        <>That&apos;s all {loaded.toLocaleString("en-CA")} homes.</>
      ) : null}
    </li>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {collapsed ? (
        <path d="M6 3.5 10 8 6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M10 3.5 6 8l4 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}
