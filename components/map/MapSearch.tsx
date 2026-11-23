"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { CircleMarker, MapContainer, Marker, Polygon, TileLayer, useMap, useMapEvents } from "react-leaflet";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DrawHint, MapControls } from "@/components/map/MapControls";
import { MapFilters } from "@/components/map/MapFilters";
import {
  MapListingCard,
  MapListingSkeletons,
  MapPreviewCard,
} from "@/components/map/MapListingCard";
import { cn } from "@/lib/utils/cn";
import {
  MAP_CLUSTER_ORANGE,
  MAP_PIN_ACTIVE,
  MAP_PIN_TEAL,
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_URL,
} from "@/lib/map/basemap";
import {
  getBoundingBoxFromPoints,
  serializePolygonParam,
  type LatLngPoint,
} from "@/lib/map/polygon";
import { useMapDrawing, type DrawMode } from "@/lib/map/useMapDrawing";
import { useUserLocation } from "@/lib/map/useUserLocation";
import {
  buildListingHref,
  buildListingQueryString,
  hasActiveFilters,
  parseListingSearch,
} from "@/lib/utils/searchParams";
import { Button, Spinner } from "@/components/ui/Button";
import { EMPTY, formatPriceCompact } from "@/lib/utils/format";
import type { ListingQuery, PropertySummary } from "@/lib/types/domain";
import type { GeocodeResult, MapCluster } from "@/lib/api/geo";
import {
  DEFAULT_SCHOOL_RADIUS_KM,
  schoolSearchArea,
  type SchoolSearchHit,
} from "@/lib/api/schools";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { rememberLastSearch } from "@/lib/personalize/lastSearch";
import { cityFromText, rememberPlace } from "@/lib/personalize/places";
import { PLACE_SEARCH_MIN_CHARS, usePlaceSearch } from "@/lib/queries/geo";
import { useSchoolSearch } from "@/lib/queries/schools";
import {
  isClusterReply,
  mapAggregatesQuery,
  mapListingsQuery,
  MAP_PAGE_SIZE,
  mapQueryView,
  type MapViewport,
} from "@/lib/queries/map";

/** Downtown Toronto; the GTA fits comfortably at this zoom. */
const DEFAULT_CENTER: [number, number] = [43.6532, -79.3832];
const DEFAULT_ZOOM = 11;

/**
 * Price pin — HouseSigma shape: teal rounded pill, white stroke; orange when
 * selected. Label stays in the DOM for assistive tech.
 */
function priceIcon(property: PropertySummary, active: boolean) {
  const label = property.price === null ? EMPTY : formatPriceCompact(property.price);
  const bg = active ? MAP_PIN_ACTIVE : MAP_PIN_TEAL;
  return L.divIcon({
    className: "",
    html: `<span style="background:${bg};border:2px solid #fff;border-radius:7px;min-width:58px;height:25px;padding:0 8px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:500;line-height:1;box-shadow:0 1px 3px rgba(0,0,0,.25);white-space:nowrap">${label}</span>`,
    iconSize: [0, 0],
    iconAnchor: [29, 14],
  });
}

/** Cluster bubble — HouseSigma orange (#ff5f05), white stroke, count in white. */
function clusterIcon(count: number) {
  const size = count > 500 ? 52 : count > 100 ? 44 : count > 25 ? 38 : 35;
  const label = count > 999 ? `${Math.round(count / 1000)}k` : String(count);
  return L.divIcon({
    className: "",
    html: `<span style="width:${size}px;height:${size}px;background:${MAP_CLUSTER_ORANGE};border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:${size >= 44 ? 15 : 13}px;font-weight:500;line-height:1;box-shadow:0 1px 4px rgba(0,0,0,.2)">${label}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export interface Bounds {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}

/** Stand-in key while no viewport is known; its queries are disabled. */
const EMPTY_VIEW = mapQueryView({
  viewport: { latMin: 0, latMax: 0, lngMin: 0, lngMax: 0, zoom: 0 },
  filters: "",
  poly: "",
})!;
const NO_CLUSTERS: MapCluster[] = [];
const NO_PROPERTIES: PropertySummary[] = [];

/** Reports viewport changes so the parent can refetch for the visible area. */
export function BoundsWatcher({
  onChange,
}: {
  onChange: (bounds: Bounds, zoom: number) => void;
}) {
  const emit = useCallback(
    (map: L.Map) => {
      const b = map.getBounds();
      onChange(
        {
          latMin: b.getSouth(),
          latMax: b.getNorth(),
          lngMin: b.getWest(),
          lngMax: b.getEast(),
        },
        map.getZoom(),
      );
    },
    [onChange],
  );

  const map = useMapEvents({
    moveend: () => emit(map),
    zoomend: () => emit(map),
  });

  // Emit once on mount for the initial viewport.
  useEffect(() => {
    emit(map);
  }, [map, emit]);

  return null;
}

/** Clicking empty map (not a pin) dismisses the pin preview. */
export function MapClickWatcher({ onClick }: { onClick: () => void }) {
  useMapEvents({ click: onClick });
  return null;
}

export function FlyTo({
  target,
  zoom,
}: {
  target: [number, number] | null;
  /** When set, used as the destination zoom; otherwise at least 14. */
  zoom?: number | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    const nextZoom = zoom ?? Math.max(map.getZoom(), 14);
    map.flyTo(target, nextZoom, { duration: 0.6 });
  }, [target, zoom, map]);
  return null;
}

/** The committed drawn area, framed in view whenever it changes. */
export function DrawnArea({ points }: { points: LatLngPoint[] }) {
  const map = useMap();
  const key = serializePolygonParam(points);
  useEffect(() => {
    const box = getBoundingBoxFromPoints(points);
    if (!box) return;
    map.fitBounds(
      [
        [box.latMin, box.lngMin],
        [box.latMax, box.lngMax],
      ],
      { padding: [40, 40], maxZoom: 16 },
    );
    // Keyed on the serialised shape, not the array identity, so a re-render
    // with the same area never yanks the viewport back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);

  return (
    <Polygon
      positions={points.map((p) => [p.lat, p.lng] as [number, number])}
      pathOptions={{ color: "#1b2e4b", weight: 2, fillColor: "#1b2e4b", fillOpacity: 0.08 }}
      interactive={false}
    />
  );
}

export function MapSearch() {
  const params = useSearchParams();
  const [map, setMap] = useState<L.Map | null>(null);
  // Hovered row or pin (highlight only) vs clicked pin (highlight + preview).
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const listRef = useRef<HTMLUListElement>(null);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [flyZoom, setFlyZoom] = useState<number | null>(null);
  // A place the visitor searched for wins over a late automatic locate,
  // which would otherwise pull the map back to where they are standing.
  const placeChosen = useRef(false);
  /** Last city we already geocoded/flew for — avoids repeat flights. */
  const cityFlown = useRef<string | null>(null);
  // Auto-centre only when the URL doesn't already say where to look.
  const userLocation = useUserLocation({
    autoCenter: !params.get("poly"),
    onLocated: (point, auto) => {
      if (auto && placeChosen.current) return;
      setFlyZoom(null);
      setFlyTarget(point);
    },
  });
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  // Debounce viewport changes so a drag doesn't fire a request per frame.
  const debouncedViewport = useDebouncedValue(viewport, 350);

  const flyToPlace = useCallback((point: [number, number], zoom?: number) => {
    placeChosen.current = true;
    setFlyZoom(zoom ?? null);
    setFlyTarget(point);
  }, []);

  /*
   * The URL is the source of truth, shared with /listings: the same filter
   * params, plus `poly` for a drawn area. `filterQs` is everything except the
   * area, forwarded to /api/properties/map so the map honours the filters.
   */
  const query = useMemo(() => parseListingSearch(params), [params]);
  const polygon = query.polygon ?? null;
  const polyKey = serializePolygonParam(polygon);
  const filterQuery = useMemo(
    () => ({ ...query, polygon: undefined, view: undefined, page: undefined }),
    [query],
  );
  const filterQs = buildListingQueryString(filterQuery);
  // H3 aggregates count the whole catalogue — they cannot apply listing
  // filters — so with any filter set we show filtered pins instead of
  // clusters that would overstate what matches.
  const filtered = hasActiveFilters(filterQuery) || Boolean(query.status);

  /** Writes the query to the URL without a server round-trip. */
  const pushQuery = useCallback((next: ListingQuery) => {
    const qs = buildListingQueryString({ ...next, view: undefined, page: undefined });
    rememberLastSearch(next);
    // Next 16 syncs native pushState with useSearchParams, and it gives the
    // back button a step per drawn area.
    window.history.pushState(null, "", qs ? `/map-search?${qs}` : "/map-search");
  }, []);

  const handleBounds = useCallback((bounds: Bounds, zoom: number) => {
    setViewport({ ...bounds, zoom });
  }, []);

  /*
   * A drawn area ignores the viewport (see `mapQueryView`); otherwise the
   * debounced viewport plus filters is the key, so a filter change refetches
   * at once for the current view.
   */
  const view = mapQueryView({ viewport: debouncedViewport, filters: filterQs, poly: polyKey });

  // A new view is a new result set: start its list from the top rather than
  // mid-way down, where the previous set's scroll position left it.
  const viewKey = JSON.stringify(view);
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [viewKey]);

  /**
   * Zoomed out and unfiltered, the backend returns H3 cluster counts instead of
   * rows — drawing thousands of pins would be unreadable and slow. It tells us
   * which mode applies via `mode`, and we only fetch rows in marker mode.
   */
  const aggregatesEnabled = view !== null && !polyKey && !filtered;
  const aggregates = useQuery({
    ...mapAggregatesQuery(view ?? EMPTY_VIEW),
    enabled: aggregatesEnabled,
  });
  // A failed aggregates call falls back to marker mode so the map still works.
  const aggregatesSettled = aggregates.isError || (aggregates.isFetched && !aggregates.isPlaceholderData);
  const clusterMode = aggregatesEnabled && !aggregates.isError && isClusterReply(aggregates.data);

  const listingsEnabled =
    view !== null && (!aggregatesEnabled || (aggregatesSettled && !clusterMode));
  const listings = useInfiniteQuery({
    ...mapListingsQuery(view ?? EMPTY_VIEW),
    enabled: listingsEnabled,
  });

  // `cancelRefetch: false` makes a second trigger join the page already in
  // flight; v5's default would abort it and start over.
  const { fetchNextPage } = listings;
  const loadMore = useCallback(() => {
    void fetchNextPage({ cancelRefetch: false });
  }, [fetchNextPage]);

  const clustered = clusterMode;
  const clusters =clustered ? (aggregates.data?.clusters ?? []) : NO_CLUSTERS;
  const properties = clustered ? NO_PROPERTIES : (listings.data?.items ?? NO_PROPERTIES);
  const total = clustered ? null : (listings.data?.total ?? null);
  // A failed LATER page keeps the rows already loaded; the list offers a retry
  // at its foot instead of the whole view reading as an error.
  const error =
    listingsEnabled && listings.isError && !listings.isFetchNextPageError
      ? "Could not load listings for this area."
      : null;
  // Before the first viewport is reported there is nothing in flight, but the
  // page is still loading — don't flash the empty state. Loading more rows is
  // shown at the foot of the list, not as a map-wide "Loading listings…".
  const loading =
    view === null ||
    aggregates.isFetching ||
    (listings.isFetching && !listings.isFetchingNextPage) ||
    (aggregatesEnabled && !aggregatesSettled);

  const drawing = useMapDrawing(map, (points) =>
    pushQuery({ ...query, polygon: points, schoolLabel: undefined, schoolKm: undefined }),
  );

  const toggleDraw = (mode: DrawMode) => {
    if (drawing.mode === mode) drawing.cancel();
    else drawing.start(mode);
  };

  const clearShape = () => {
    drawing.cancel();
    pushQuery({ ...query, polygon: undefined, schoolLabel: undefined, schoolKm: undefined });
  };

  const applySchool = useCallback(
    (school: SchoolSearchHit, km = DEFAULT_SCHOOL_RADIUS_KM) => {
      flyToPlace([school.latitude, school.longitude], 14);
      pushQuery({
        ...query,
        polygon: schoolSearchArea(school.latitude, school.longitude, km),
        schoolLabel: school.name,
        schoolKm: km,
      });
    },
    [flyToPlace, pushQuery, query],
  );

  /** Place / city pick: fly there and keep listing filters aligned with the view. */
  const applyPlace = useCallback(
    (result: GeocodeResult) => {
      const city = cityFromText(result.label);
      rememberPlace(city);
      if (city) cityFlown.current = city;
      // Cities need a wider frame than a street pin.
      flyToPlace([result.latitude, result.longitude], city ? 12 : 14);
      pushQuery({
        ...query,
        // Known city → filter to it; unknown place → clear a stale city so the
        // new bbox is not ANDed with e.g. Toronto after flying to Mississauga.
        city: city ?? undefined,
        polygon: undefined,
        schoolLabel: undefined,
        schoolKm: undefined,
      });
    },
    [flyToPlace, pushQuery, query],
  );

  // Filters / listings "View on map" can set ?city= without a place search.
  // Geocode once and fly so the viewport matches the city filter.
  useEffect(() => {
    const city = query.city?.trim();
    if (!city) {
      cityFlown.current = null;
      return;
    }
    if (query.polygon?.length) return;
    if (cityFlown.current?.toLowerCase() === city.toLowerCase()) return;

    let cancelled = false;
    const controller = new AbortController();
    const q = `${city}, Ontario, Canada`;
    void fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return [];
        return (await response.json()) as GeocodeResult[];
      })
      .then((places) => {
        if (cancelled || !places[0]) return;
        cityFlown.current = city;
        flyToPlace([places[0].latitude, places[0].longitude], 12);
      })
      .catch(() => {
        // Geocode soft-fails; the city filter still applies to the current bbox.
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [query.city, query.polygon, flyToPlace]);

  const mappable = useMemo(
    () => properties.filter((p) => p.latitude !== null && p.longitude !== null),
    [properties],
  );

  const selected = selectedId ? (mappable.find((p) => p.id === selectedId) ?? null) : null;

  /** A pin click selects its home and brings its row into view in the list. */
  const selectPin = (id: string) => {
    setSelectedId(id);
    setActiveId(id);
    rowRefs.current.get(id)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  const listingsHref = buildListingHref({ ...query, view: undefined });
  // Rows on screen belong to the previous viewport while this one loads.
  const refreshing = loading && listings.isPlaceholderData && properties.length > 0;

  const countLabel = (() => {
    if (error) return error;
    // Without this the header read "0 homes in this area" during the first
    // load, which looked like an answer.
    const schoolNear = query.schoolLabel
      ? `near ${query.schoolLabel}`
      : polygon
        ? "in your drawn area"
        : "in this area";
    if (loading && (properties.length === 0 || refreshing)) {
      return `Finding homes ${schoolNear}…`;
    }
    if (clustered) {
      return `${clusters.reduce((sum, cell) => sum + cell.count, 0).toLocaleString("en-CA")} homes — zoom in to see them`;
    }
    const all = total ?? properties.length;
    return `${all.toLocaleString("en-CA")} ${all === 1 ? "home" : "homes"} ${schoolNear}`;
  })();

  return (
    <div className="flex h-[calc(100vh-72px)] flex-col lg:flex-row">
      {/* `isolate` gives the map its own stacking context. Leaflet's panes and
          controls (z-index 400-1000) and our z-[400] overlays then only compete
          with each other, instead of rising above the navbar and page modals. */}
      <div className="relative isolate h-1/2 w-full lg:h-full lg:w-3/5">
        <MapContainer
          ref={setMap}
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom
          zoomControl={false}
          className="h-full w-full"
        >
          <TileLayer attribution={MAP_TILE_ATTRIBUTION} url={MAP_TILE_URL} />
          <BoundsWatcher onChange={handleBounds} />
          <FlyTo target={flyTarget} zoom={flyZoom} />
          {userLocation.position && (
            <CircleMarker
              center={userLocation.position}
              radius={7}
              pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#2563eb", fillOpacity: 1 }}
              interactive={false}
            />
          )}
          <MapClickWatcher onClick={() => setSelectedId(null)} />
          {polygon && <DrawnArea points={polygon} />}

          {/* Markers swallow clicks, so while drawing they are remounted as
              non-interactive — otherwise a tap on a pin would not add a point. */}
          {clustered
            ? clusters.map((cell, index) => (
                <Marker
                  key={`cluster-${index}-${drawing.mode ?? "idle"}`}
                  position={[cell.latitude, cell.longitude]}
                  icon={clusterIcon(cell.count)}
                  interactive={!drawing.mode}
                  eventHandlers={{
                    // Clicking a cluster zooms toward it until markers appear.
                    click: () => flyToPlace([cell.latitude, cell.longitude]),
                  }}
                />
              ))
            : mappable.map((property) => (
                <Marker
                  key={`${property.id}-${drawing.mode ?? "idle"}`}
                  position={[property.latitude as number, property.longitude as number]}
                  icon={priceIcon(property, property.id === activeId || property.id === selectedId)}
                  // The highlighted pin draws above its neighbours in a dense cluster.
                  zIndexOffset={property.id === activeId || property.id === selectedId ? 1000 : 0}
                  interactive={!drawing.mode}
                  eventHandlers={{
                    click: () => selectPin(property.id),
                    mouseover: () => setActiveId(property.id),
                  }}
                />
              ))}
        </MapContainer>

        <PlaceSearch onSelect={applyPlace} onSelectSchool={applySchool} />

        <MapControls
          drawMode={drawing.mode}
          hasShape={Boolean(polygon)}
          locating={userLocation.status === "locating"}
          onZoomIn={() => map?.zoomIn()}
          onZoomOut={() => map?.zoomOut()}
          onLocate={userLocation.locate}
          onDraw={toggleDraw}
          onClear={clearShape}
        />

        {(userLocation.status === "denied" || userLocation.status === "unavailable") && (
          <p
            role="status"
            className="absolute bottom-4 left-1/2 z-[400] -translate-x-1/2 rounded-full bg-ink/90 px-4 py-2 text-caption text-white shadow-pop"
          >
            {userLocation.status === "denied"
              ? "Location is blocked for this site in your browser settings."
              : "Your location isn't available right now."}
          </p>
        )}

        {selected && !drawing.mode && (
          <MapPreviewCard property={selected} onClose={() => setSelectedId(null)} />
        )}

        {drawing.mode && (
          <DrawHint
            mode={drawing.mode}
            pointCount={drawing.pointCount}
            onFinish={drawing.finish}
            onCancel={drawing.cancel}
          />
        )}

        {loading && (
          <div className="pointer-events-none absolute left-1/2 top-4 z-[400] flex -translate-x-1/2 items-center gap-2 rounded-full bg-surface px-4 py-2 shadow-pop">
            <Spinner className="text-navy" />
            <span className="text-caption text-ink">Loading listings…</span>
          </div>
        )}
      </div>

      <aside className="flex h-1/2 min-h-0 w-full flex-col overflow-hidden border-t border-line lg:h-full lg:w-2/5 lg:border-l lg:border-t-0">
        {/* One compact row only — search and filters live in the sheet so the
            list keeps almost the whole half-screen on phones. */}
        <header className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2.5 sm:px-5 sm:py-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-small font-semibold text-ink sm:text-h3">Map search</h1>
            <p className="truncate text-caption text-ink-muted" aria-live="polite">
              {countLabel}
            </p>
          </div>
          <MapFilters query={query} onChange={pushQuery} />
          {/* Return path for the listings view toggle, carrying the search. */}
          <Link
            href={listingsHref}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 text-caption font-medium text-ink transition-colors hover:border-navy hover:text-navy sm:h-11 sm:px-3 sm:text-small"
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
            Listings
          </Link>
        </header>

        <ul
          ref={listRef}
          aria-busy={loading || undefined}
          className={cn(
            "flex-1 overflow-y-auto transition-opacity duration-200",
            // The previous area's rows stay while the new area loads (so the
            // list doesn't flash empty), dimmed so they don't read as results.
            refreshing && "pointer-events-none opacity-50",
          )}
          onMouseLeave={() => setActiveId(null)}
        >
          {properties.length === 0 && loading && <MapListingSkeletons count={8} />}

          {properties.length === 0 && !loading && (
            <li className="px-5 py-10 text-center text-small text-ink-muted">
              {clustered
                ? "Zoom in to list individual homes."
                : query.schoolLabel
                  ? `No listings within ${query.schoolKm ?? DEFAULT_SCHOOL_RADIUS_KM} km of ${query.schoolLabel}. Try a wider radius from Schools search, or clear the school filter.`
                  : polygon
                    ? "No listings in your drawn area. Try a bigger area or fewer filters."
                    : filtered
                      ? "No listings here match these filters. Try zooming out or clearing a filter."
                      : "No listings in view. Try zooming out or panning to another area."}
            </li>
          )}

          {properties.map((property) => (
            <li key={property.id}>
              <MapListingCard
                ref={(node) => {
                  if (node) rowRefs.current.set(property.id, node);
                  else rowRefs.current.delete(property.id);
                }}
                property={property}
                active={property.id === activeId || property.id === selectedId}
                onActivate={() => setActiveId(property.id)}
                onShowOnMap={
                  property.latitude !== null && property.longitude !== null
                    ? () => {
                        setSelectedId(property.id);
                        flyToPlace(
                          [property.latitude as number, property.longitude as number],
                          15,
                        );
                      }
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
              hasMore={listings.hasNextPage}
              loadingMore={listings.isFetchingNextPage}
              failed={listings.isFetchNextPageError}
              // Placeholder rows belong to the previous view; paging them
              // would append the old area's homes to the new one.
              paused={listings.isPlaceholderData}
              onLoadMore={loadMore}
            />
          )}
        </ul>
      </aside>
    </div>
  );
}

/**
 * Foot of the results list: loads the next page as it scrolls into view.
 *
 * Infinite scroll rather than numbered pages because the list is a companion
 * to the map: every loaded row is also a pin, so rows accumulate instead of
 * replacing each other, and any pan or filter restarts the set anyway, which
 * would make "page 4" meaningless. A real button is always rendered too, for
 * keyboard users and as a fallback if the observer never fires.
 */
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
    // Starts loading ~one screen before the end, so scrolling rarely waits.
    // Re-created per page (`loaded`): observe() reports the current state at
    // once, so a list still too short to scroll keeps filling itself.
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

  // Placeholder rows where the next rows will land, rather than a spinner
  // below them: the list visibly continues instead of seeming to end.
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

/**
 * Place search overlaid on the map, backed by `locations/geocode/`, with
 * school suggestions when the query looks school-related.
 * Selecting a place flies the viewport; selecting a school sets a proximity area.
 */
function preferCanada(results: GeocodeResult[]): GeocodeResult | undefined {
  return results.find((result) => /canada/i.test(result.label)) ?? results[0];
}

function wantsSchoolSuggestions(term: string): boolean {
  return /\b(school|academy|collegiate|secondary|elementary|ss|ps)\b/i.test(term);
}

export function PlaceSearch({
  onSelect,
  onSelectSchool,
}: {
  onSelect: (result: GeocodeResult) => void;
  onSelectSchool?: (school: SchoolSearchHit, km?: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);
  const search = usePlaceSearch(debouncedQuery);
  const schoolQuery = wantsSchoolSuggestions(debouncedQuery) ? debouncedQuery : "";
  const schools = useSchoolSearch(schoolQuery);
  // Too short to search: no suggestions, even if an older set is cached.
  const results = search.isEnabled ? (search.data ?? NO_RESULTS) : NO_RESULTS;
  const schoolHits =
    onSelectSchool && schools.isEnabled ? (schools.data ?? NO_SCHOOLS) : NO_SCHOOLS;
  const term = debouncedQuery.trim();
  const settled = search.isEnabled && !search.isFetching && !search.isPlaceholderData;
  // Enter before the suggestions arrive should still move the map.
  const goWhenReady = useRef(false);
  const flownFor = useRef("");

  function choose(result: GeocodeResult) {
    goWhenReady.current = false;
    flownFor.current = term;
    onSelect(result);
    setQuery(result.label);
    setOpen(false);
  }

  function chooseSchool(school: SchoolSearchHit) {
    goWhenReady.current = false;
    flownFor.current = term;
    onSelectSchool?.(school, DEFAULT_SCHOOL_RADIUS_KM);
    setQuery(school.name);
    setOpen(false);
  }

  // Open the list when a fresh set of suggestions arrives (adjusting state
  // during render rather than in an effect).
  const [shownData, setShownData] = useState(search.data);
  if (search.data !== shownData) {
    setShownData(search.data);
    if (!search.isPlaceholderData && search.data) setOpen(search.data.length > 0);
  }
  const [shownSchools, setShownSchools] = useState(schools.data);
  if (schools.data !== shownSchools) {
    setShownSchools(schools.data);
    if (!schools.isPlaceholderData && schools.data && schools.data.length > 0) setOpen(true);
  }

  useEffect(() => {
    if (term.length < 4) {
      if (!term) flownFor.current = "";
      return;
    }
    // Prefer an explicit school pick when the query names a school.
    if (wantsSchoolSuggestions(term) && schoolHits.length > 0) return;
    if (!settled) return;
    const pick = preferCanada(results);
    if (!pick) return;
    if (goWhenReady.current) {
      choose(pick);
      return;
    }
    // Typing a city and stopping is the search. Don't wait for a click,
    // and don't fly again for the same text.
    if (flownFor.current === term) return;
    flownFor.current = term;
    onSelect(pick);
    // choose() also writes the label back into the box, which would search
    // the long name again. Leaving the typed text alone avoids that loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, term, results, onSelect, schoolHits.length]);

  const showList =
    open &&
    query.trim().length >= PLACE_SEARCH_MIN_CHARS &&
    (results.length > 0 ||
      schoolHits.length > 0 ||
      settled ||
      schools.isFetching ||
      search.isError ||
      schools.isError);

  return (
    <div className="absolute left-4 top-4 z-[1100] w-[min(320px,calc(100%-2rem))]">
      <label htmlFor="map-place-search" className="sr-only">
        Search for a city, neighbourhood, or school
      </label>
      <input
        id="map-place-search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          goWhenReady.current = false;
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            return;
          }
          if (event.key !== "Enter") return;
          event.preventDefault();
          if (wantsSchoolSuggestions(term) && schoolHits[0] && onSelectSchool) {
            chooseSchool(schoolHits[0]);
            return;
          }
          const pick = preferCanada(results);
          if (pick && settled) choose(pick);
          else goWhenReady.current = true;
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onFocus={() => (results.length > 0 || schoolHits.length > 0) && setOpen(true)}
        placeholder="City, neighbourhood, or school…"
        className="h-11 w-full rounded-control border border-line bg-surface px-4 text-small text-ink shadow-card outline-none placeholder:text-ink-subtle focus:border-navy"
      />

      {showList && (
        <ul className="mt-1 max-h-72 overflow-auto rounded-control border border-line bg-surface shadow-pop">
          {schoolHits.length > 0 && (
            <>
              <li className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                Schools
              </li>
              {schoolHits.slice(0, 5).map((school) => (
                <li key={`school-${school.id}`}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => chooseSchool(school)}
                    className="block w-full px-4 py-2.5 text-left transition-colors hover:bg-surface-alt"
                  >
                    <span className="block text-caption font-medium text-ink">{school.name}</span>
                    <span className="block text-[11px] text-ink-muted">
                      Homes within {DEFAULT_SCHOOL_RADIUS_KM} km · proximity, not catchment
                    </span>
                  </button>
                </li>
              ))}
            </>
          )}
          {results.length > 0 && (
            <li className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              Places
            </li>
          )}
          {results.map((result, index) => (
            <li key={`${result.label}-${index}`}>
              <button
                type="button"
                // mousedown would blur the input and unmount this list before click.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(result)}
                className="block w-full px-4 py-2.5 text-left text-caption text-ink-soft transition-colors hover:bg-surface-alt"
              >
                {result.label}
              </button>
            </li>
          ))}
          {settled && results.length === 0 && schoolHits.length === 0 && (
            <li className="px-4 py-2.5 text-caption text-ink-muted">No places found.</li>
          )}
          {(search.isError || schools.isError) && results.length === 0 && schoolHits.length === 0 && (
            <li className="px-4 py-2.5 text-caption text-ink-muted">
              Place search is unavailable right now.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

const NO_RESULTS: GeocodeResult[] = [];
const NO_SCHOOLS: SchoolSearchHit[] = [];
