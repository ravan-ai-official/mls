"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { CircleMarker, MapContainer, Marker, Polygon, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { DrawHint, MapControls } from "@/components/map/MapControls";
import { MapPreviewCard } from "@/components/map/MapListingCard";
import {
  MapResultsPanel,
  type SheetSnap,
} from "@/components/map/MapResultsPanel";
import { useAuth } from "@/components/providers/AuthProvider";
import { useWatched } from "@/components/providers/WatchedProvider";
import { Spinner } from "@/components/ui/Button";
import { isSoldDataLocked } from "@/lib/sold/gate";
import { cn } from "@/lib/utils/cn";

const LIST_PANEL_EASE = [0.22, 1, 0.36, 1] as const;
const LIST_PANEL_TRANSITION = { duration: 0.38, ease: LIST_PANEL_EASE };
import {
  MAP_BASEMAPS,
  MAP_CLUSTER_ORANGE,
  type BasemapId,
  type PinColorMode,
} from "@/lib/map/basemap";
import {
  getBoundingBoxFromPoints,
  serializePolygonParam,
  type LatLngPoint,
} from "@/lib/map/polygon";
import {
  parseViewportParams,
  readMapUiPrefs,
  readMapViewport,
  rememberMapViewport,
  viewportToSearchParams,
  writeMapUiPrefs,
  type MapUiPrefs,
} from "@/lib/map/mapPrefs";
import { pinFillColor } from "@/lib/map/pinStyles";
import { useMapDrawing, type DrawMode } from "@/lib/map/useMapDrawing";
import { useUserLocation } from "@/lib/map/useUserLocation";
import {
  buildListingQueryString,
  hasActiveFilters,
  parseListingSearch,
} from "@/lib/utils/searchParams";
import { EMPTY, formatPriceCompact } from "@/lib/utils/format";
import type { ListingQuery, PropertySummary } from "@/lib/types/domain";
import type { GeocodeResult, MapCluster } from "@/lib/api/geo";
import {
  DEFAULT_SCHOOL_RADIUS_KM,
  schoolSearchArea,
  type SchoolSearchHit,
} from "@/lib/api/schools";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { rememberLastSearch } from "@/lib/personalize/lastSearch";
import { cityFromText, rememberPlace } from "@/lib/personalize/places";
import { PLACE_SEARCH_MIN_CHARS, usePlaceSearch } from "@/lib/queries/geo";
import { useSchoolSearch } from "@/lib/queries/schools";
import {
  isClusterReply,
  mapAggregatesQuery,
  mapListingsQuery,
  mapQueryView,
  type MapViewport,
} from "@/lib/queries/map";

/** Downtown Toronto; the GTA fits comfortably at this zoom. */
const DEFAULT_CENTER: [number, number] = [43.6532, -79.3832];
const DEFAULT_ZOOM = 11;

/**
 * Price pin — rounded pill; fill follows status / price / DOM color mode.
 * Locked sold pins show "Sold" with no dollar amount.
 */
function priceIcon(
  property: PropertySummary,
  active: boolean,
  pinMode: PinColorMode,
  soldLocked: boolean,
) {
  const label =
    soldLocked && property.status === "sold"
      ? "Sold"
      : property.status === "sold" && property.closePrice !== null
        ? formatPriceCompact(property.closePrice)
        : property.price === null
          ? EMPTY
          : formatPriceCompact(property.price);
  const forColor =
    soldLocked && property.status === "sold"
      ? { ...property, closePrice: null }
      : property;
  const bg = pinFillColor(forColor, pinMode, active);
  return L.divIcon({
    className: "",
    html: `<span style="background:${bg};border:2px solid #fff;border-radius:7px;min-width:58px;height:25px;padding:0 8px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:500;line-height:1;box-shadow:0 1px 3px rgba(0,0,0,.25);white-space:nowrap">${label}</span>`,
    iconSize: [0, 0],
    iconAnchor: [29, 14],
  });
}

/** Approximate a cluster cell and zoom into it instead of only flying to its centroid. */
function clusterFocusZoom(currentZoom: number, count: number) {
  const bump = count > 200 ? 3 : count > 40 ? 2 : 1;
  return Math.min(16, Math.max(currentZoom + bump, 12));
}

/** Cluster bubble — orange, white stroke, count in white. */
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
  const router = useRouter();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { user } = useAuth();
  const { isComparing } = useWatched();
  const hideSoldPrices = !user;
  const [map, setMap] = useState<L.Map | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverPreviewId, setHoverPreviewId] = useState<string | null>(null);
  const hoverClearRef = useRef<number | null>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const listRef = useRef<HTMLUListElement>(null);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [flyZoom, setFlyZoom] = useState<number | null>(null);
  const placeChosen = useRef(false);
  const cityFlown = useRef<string | null>(null);
  const restoredViewport = useRef(false);
  const [prefs, setPrefs] = useState<MapUiPrefs>({
    searchAsMove: true,
    listCollapsed: false,
    listWidthPct: 0.4,
    basemap: "streets",
    pinMode: "status",
  });
  // Peek by default so map chrome stays clear; drag up for the list.
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>("peek");
  const searchAsMoveRef = useRef(true);
  const forceSearchOnceRef = useRef(false);
  const [liveViewport, setLiveViewport] = useState<MapViewport | null>(null);
  const [searchViewport, setSearchViewport] = useState<MapViewport | null>(null);
  const debouncedViewport = useDebouncedValue(searchViewport, 350);
  const resizing = useRef(false);

  useEffect(() => {
    const stored = readMapUiPrefs();
    setPrefs(stored);
    searchAsMoveRef.current = stored.searchAsMove;
  }, []);

  const urlCamera = useMemo(() => parseViewportParams(params), [params]);

  const userLocation = useUserLocation({
    autoCenter:
      !params.get("poly") && !params.get("city") && !urlCamera,
    onLocated: (point, auto) => {
      if (auto && placeChosen.current) return;
      if (auto && restoredViewport.current) return;
      setFlyZoom(null);
      setFlyTarget(point);
    },
  });

  const flyToPlace = useCallback((point: [number, number], zoom?: number) => {
    placeChosen.current = true;
    setFlyZoom(zoom ?? null);
    setFlyTarget(point);
  }, []);

  const query = useMemo(() => parseListingSearch(params), [params]);
  const polygon = query.polygon ?? null;
  const polyKey = serializePolygonParam(polygon);
  const filterQuery = useMemo(
    () => ({ ...query, polygon: undefined, view: undefined, page: undefined }),
    [query],
  );
  const filterQs = buildListingQueryString(filterQuery);
  const filtered = hasActiveFilters(filterQuery) || Boolean(query.status);

  const pushQuery = useCallback((next: ListingQuery) => {
    const qs = buildListingQueryString({ ...next, view: undefined, page: undefined });
    rememberLastSearch(next);
    window.history.pushState(null, "", qs ? `/map-search?${qs}` : "/map-search");
  }, []);

  const patchPrefs = useCallback((patch: Partial<MapUiPrefs>) => {
    const next = writeMapUiPrefs(patch);
    setPrefs(next);
    if (patch.searchAsMove !== undefined) {
      searchAsMoveRef.current = patch.searchAsMove;
      if (patch.searchAsMove && liveViewport) {
        setSearchViewport(liveViewport);
        rememberMapViewport(liveViewport);
      }
    }
  }, [liveViewport]);

  const handleBounds = useCallback((bounds: Bounds, zoom: number) => {
    const next: MapViewport = { ...bounds, zoom };
    setLiveViewport(next);
    if (searchAsMoveRef.current || forceSearchOnceRef.current) {
      forceSearchOnceRef.current = false;
      setSearchViewport(next);
      rememberMapViewport(next);
    }
  }, []);

  const commitSearchArea = useCallback(() => {
    if (!liveViewport) return;
    setSearchViewport(liveViewport);
    rememberMapViewport(liveViewport);
  }, [liveViewport]);

  // Restore camera: URL lat/lng/z wins, else last local viewport.
  useEffect(() => {
    if (!map || restoredViewport.current) return;
    if (params.get("poly") || params.get("city")) {
      restoredViewport.current = true;
      return;
    }
    restoredViewport.current = true;
    if (urlCamera) {
      placeChosen.current = true;
      map.setView(urlCamera.center, urlCamera.zoom, { animate: false });
      return;
    }
    const saved = readMapViewport();
    if (!saved) return;
    map.fitBounds(
      [
        [saved.latMin, saved.lngMin],
        [saved.latMax, saved.lngMax],
      ],
      { maxZoom: Math.min(saved.zoom, 15), animate: false },
    );
    setSearchViewport(saved);
    setLiveViewport(saved);
  }, [map, params, urlCamera]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const qs = new URLSearchParams(buildListingQueryString({ ...query, view: undefined, page: undefined }));
    const cam = liveViewport ?? searchViewport;
    if (cam) {
      const next = viewportToSearchParams(cam);
      qs.set("lat", next.lat);
      qs.set("lng", next.lng);
      qs.set("z", next.z);
    }
    const q = qs.toString();
    return `${window.location.origin}/map-search${q ? `?${q}` : ""}`;
  }, [query, liveViewport, searchViewport]);

  const view = mapQueryView({
    viewport: debouncedViewport,
    filters: filterQs,
    poly: polyKey,
  });

  const viewKey = JSON.stringify(view);
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [viewKey]);

  const aggregatesEnabled = view !== null && !polyKey && !filtered;
  const aggregates = useQuery({
    ...mapAggregatesQuery(view ?? EMPTY_VIEW),
    enabled: aggregatesEnabled,
  });
  const aggregatesSettled =
    aggregates.isError || (aggregates.isFetched && !aggregates.isPlaceholderData);
  const clusterMode =
    aggregatesEnabled && !aggregates.isError && isClusterReply(aggregates.data);

  const listingsEnabled =
    view !== null && (!aggregatesEnabled || (aggregatesSettled && !clusterMode));
  const listings = useInfiniteQuery({
    ...mapListingsQuery(view ?? EMPTY_VIEW),
    enabled: listingsEnabled,
  });

  const { fetchNextPage } = listings;
  const loadMore = useCallback(() => {
    void fetchNextPage({ cancelRefetch: false });
  }, [fetchNextPage]);

  const clustered = clusterMode;
  const clusters = clustered ? (aggregates.data?.clusters ?? []) : NO_CLUSTERS;
  const properties = clustered ? NO_PROPERTIES : (listings.data?.items ?? NO_PROPERTIES);
  const total = clustered ? null : (listings.data?.total ?? null);
  const error =
    listingsEnabled && listings.isError && !listings.isFetchNextPageError
      ? "Could not load listings for this area."
      : null;
  const loading =
    view === null ||
    aggregates.isFetching ||
    (listings.isFetching && !listings.isFetchingNextPage) ||
    (aggregatesEnabled && !aggregatesSettled);

  const drawing = useMapDrawing(map, (points) =>
    pushQuery({ ...query, polygon: points, schoolLabel: undefined, schoolKm: undefined }),
  );

  // Drawn / school areas own the search geometry — pan-to-search UI is noise.
  const areaLocked = Boolean(polygon) || Boolean(drawing.mode);

  const viewportDrifted =
    !areaLocked &&
    !prefs.searchAsMove &&
    liveViewport !== null &&
    searchViewport !== null &&
    (liveViewport.latMin !== searchViewport.latMin ||
      liveViewport.latMax !== searchViewport.latMax ||
      liveViewport.lngMin !== searchViewport.lngMin ||
      liveViewport.lngMax !== searchViewport.lngMax ||
      liveViewport.zoom !== searchViewport.zoom);

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
      forceSearchOnceRef.current = true;
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

  const widenSchool = useCallback(() => {
    if (!query.schoolLabel || !polygon?.[0]) return;
    const nextKm = (query.schoolKm ?? DEFAULT_SCHOOL_RADIUS_KM) + 2;
    // Rebuild around the polygon centroid.
    const lat =
      polygon.reduce((sum, p) => sum + p.lat, 0) / polygon.length;
    const lng =
      polygon.reduce((sum, p) => sum + p.lng, 0) / polygon.length;
    pushQuery({
      ...query,
      polygon: schoolSearchArea(lat, lng, nextKm),
      schoolKm: nextKm,
    });
  }, [polygon, pushQuery, query]);

  const applyPlace = useCallback(
    (result: GeocodeResult) => {
      const city = cityFromText(result.label);
      rememberPlace(city);
      if (city) cityFlown.current = city;
      forceSearchOnceRef.current = true;
      flyToPlace([result.latitude, result.longitude], city ? 12 : 14);
      pushQuery({
        ...query,
        city: city ?? undefined,
        polygon: undefined,
        schoolLabel: undefined,
        schoolKm: undefined,
      });
    },
    [flyToPlace, pushQuery, query],
  );

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
      .catch(() => {});

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
  const hovered =
    hoverPreviewId && hoverPreviewId !== selectedId
      ? (mappable.find((p) => p.id === hoverPreviewId) ?? null)
      : null;

  const selectPin = (id: string) => {
    setSelectedId(id);
    setActiveId(id);
    setHoverPreviewId(null);
    if (!isDesktop) setSheetSnap("mid");
    // Defer scroll until the sheet has room for the list.
    window.setTimeout(() => {
      rowRefs.current.get(id)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 50);
  };

  const basemap = MAP_BASEMAPS[prefs.basemap];

  const prefetchProperty = useCallback(
    (id: string) => {
      router.prefetch(`/property/${encodeURIComponent(id)}`);
    },
    [router],
  );

  const refreshing = loading && listings.isPlaceholderData && properties.length > 0;

  const countLabel = (() => {
    if (error) return error;
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

  const listCollapsed = isDesktop && prefs.listCollapsed;
  const listWidthPct = prefs.listWidthPct;

  // Leaflet only remeasures after the panel width finishes animating.
  useEffect(() => {
    if (!map || !isDesktop) return;
    const id = window.setTimeout(() => map.invalidateSize({ animate: false }), 400);
    return () => window.clearTimeout(id);
  }, [map, isDesktop, listCollapsed, listWidthPct]);

  const onResizeStart = (event: ReactMouseEvent) => {
    event.preventDefault();
    resizing.current = true;
    const startX = event.clientX;
    const startPct = listWidthPct;
    const onMove = (moveEvent: MouseEvent) => {
      if (!resizing.current) return;
      const delta = startX - moveEvent.clientX;
      const next = startPct + delta / window.innerWidth;
      patchPrefs({ listWidthPct: next });
    };
    const onUp = () => {
      resizing.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const panel = (
    <MapResultsPanel
      query={query}
      onChange={pushQuery}
      countLabel={countLabel}
      properties={properties}
      clustered={clustered}
      loading={loading}
      refreshing={refreshing}
      error={error}
      polygon={Boolean(polygon)}
      filtered={filtered}
      total={total}
      hasMore={Boolean(listings.hasNextPage)}
      loadingMore={listings.isFetchingNextPage}
      failedMore={listings.isFetchNextPageError}
      paused={listings.isPlaceholderData}
      onLoadMore={loadMore}
      activeId={activeId}
      selectedId={selectedId}
      onActivate={setActiveId}
      onShowOnMap={(property) => {
        setSelectedId(property.id);
        flyToPlace(
          [property.latitude as number, property.longitude as number],
          15,
        );
        if (!isDesktop) setSheetSnap("peek");
      }}
      rowRefs={rowRefs}
      listRef={listRef}
      onZoomIn={() => map?.zoomIn()}
      onZoomOut={() => map?.zoomOut()}
      onWidenSchool={widenSchool}
      mobile={!isDesktop}
      sheetSnap={sheetSnap}
      onSheetSnap={setSheetSnap}
      listCollapsed={prefs.listCollapsed}
      onToggleCollapse={() => patchPrefs({ listCollapsed: !prefs.listCollapsed })}
      dragHandle={
        isDesktop ? (
          <button
            type="button"
            aria-label="Resize results panel"
            onMouseDown={onResizeStart}
            className="absolute inset-y-0 left-0 z-10 w-1.5 -translate-x-1/2 cursor-col-resize bg-transparent hover:bg-navy/20"
          />
        ) : null
      }
    />
  );

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0",
        isDesktop ? "flex-row" : "flex-col",
      )}
    >
      <motion.div
        className={cn(
          "relative isolate h-full min-h-0",
          !isDesktop && "w-full",
        )}
        initial={false}
        animate={
          isDesktop
            ? { width: listCollapsed ? "100%" : `${(1 - listWidthPct) * 100}%` }
            : { width: "100%" }
        }
        transition={LIST_PANEL_TRANSITION}
      >
        <MapContainer
          ref={setMap}
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom
          zoomControl={false}
          className="h-full w-full"
        >
          <TileLayer
            key={prefs.basemap}
            attribution={basemap.attribution}
            url={basemap.url}
            maxZoom={basemap.maxZoom}
          />
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
          <MapClickWatcher
            onClick={() => {
              setSelectedId(null);
              setHoverPreviewId(null);
            }}
          />
          {polygon && <DrawnArea points={polygon} />}

          {clustered
            ? clusters.map((cell, index) => (
                <Marker
                  key={`cluster-${index}`}
                  position={[cell.latitude, cell.longitude]}
                  icon={clusterIcon(cell.count)}
                  interactive={!drawing.mode}
                  eventHandlers={{
                    click: () => {
                      const zoom = clusterFocusZoom(map?.getZoom() ?? DEFAULT_ZOOM, cell.count);
                      flyToPlace([cell.latitude, cell.longitude], zoom);
                    },
                  }}
                />
              ))
            : mappable.map((property) => {
                const pinLocked = isSoldDataLocked({
                  isAuthenticated: !hideSoldPrices,
                  soldLocked: property.soldLocked,
                  status: property.status,
                });
                return (
                <Marker
                  key={`${property.id}-${prefs.pinMode}-${pinLocked ? "lock" : "open"}-${isComparing(property.id) ? "c" : ""}`}
                  position={[property.latitude as number, property.longitude as number]}
                  icon={priceIcon(
                    property,
                    property.id === activeId ||
                      property.id === selectedId ||
                      isComparing(property.id),
                    prefs.pinMode,
                    pinLocked,
                  )}
                  zIndexOffset={
                    property.id === activeId ||
                    property.id === selectedId ||
                    isComparing(property.id)
                      ? 1000
                      : 0
                  }
                  interactive={!drawing.mode}
                  eventHandlers={{
                    click: () => selectPin(property.id),
                    mouseover: () => {
                      if (drawing.mode) return;
                      if (hoverClearRef.current) window.clearTimeout(hoverClearRef.current);
                      setActiveId(property.id);
                      setHoverPreviewId(property.id);
                      prefetchProperty(property.id);
                    },
                    mouseout: () => {
                      if (hoverClearRef.current) window.clearTimeout(hoverClearRef.current);
                      hoverClearRef.current = window.setTimeout(() => {
                        setHoverPreviewId((current) =>
                          current === property.id ? null : current,
                        );
                        setActiveId((current) =>
                          current === property.id && current !== selectedId ? null : current,
                        );
                      }, 120);
                    },
                  }}
                />
                );
              })}
        </MapContainer>

        <div
          className={cn(
            "absolute left-1/2 z-[400] flex -translate-x-1/2 flex-col items-center gap-2",
            isDesktop
              ? "bottom-4"
              : sheetSnap === "full"
                ? "bottom-[calc(85vh+0.75rem)]"
                : sheetSnap === "mid"
                  ? "bottom-[calc(50vh+0.75rem)]"
                  : "bottom-[calc(28vh+0.75rem)]",
          )}
        >
          {viewportDrifted && (
            <button
              type="button"
              onClick={commitSearchArea}
              className="rounded-control bg-navy px-4 py-2.5 text-caption font-semibold text-white shadow-pop transition-colors hover:bg-navy-deep"
            >
              Search this area
            </button>
          )}
          {!areaLocked && (
            <label className="flex cursor-pointer items-center gap-2 rounded-control border border-line bg-surface px-3 py-2 text-caption text-ink shadow-card">
              <input
                type="checkbox"
                className="accent-navy"
                checked={prefs.searchAsMove}
                onChange={(event) => patchPrefs({ searchAsMove: event.target.checked })}
              />
              Search as I move
            </label>
          )}
        </div>

        {(userLocation.status === "denied" || userLocation.status === "unavailable") && (
          <p
            role="status"
            className="absolute bottom-20 left-1/2 z-[400] -translate-x-1/2 rounded-full bg-ink/90 px-4 py-2 text-caption text-white shadow-pop"
          >
            {userLocation.status === "denied"
              ? "Location is blocked for this site in your browser settings."
              : "Your location isn't available right now."}
          </p>
        )}

        {selected && !drawing.mode && isDesktop && (
          <MapPreviewCard property={selected} onClose={() => setSelectedId(null)} />
        )}
        {!selected && hovered && !drawing.mode && isDesktop && (
          <MapPreviewCard property={hovered} ephemeral />
        )}

        {drawing.mode && (
          <DrawHint
            mode={drawing.mode}
            pointCount={drawing.pointCount}
            onFinish={drawing.finish}
            onUndo={drawing.undo}
            onCancel={drawing.cancel}
          />
        )}

        {loading && properties.length === 0 && (
          <div className="pointer-events-none absolute left-1/2 top-[4.5rem] z-[400] flex -translate-x-1/2 items-center gap-2 rounded-full bg-surface px-4 py-2 shadow-pop">
            <Spinner className="text-navy" />
            <span className="text-caption text-ink">Loading listings…</span>
          </div>
        )}
        {refreshing && (
          <div className="pointer-events-none absolute left-1/2 top-[4.5rem] z-[400] -translate-x-1/2 rounded-full bg-surface/95 px-3 py-1.5 text-caption text-ink-muted shadow-card">
            Updating…
          </div>
        )}
      </motion.div>

      <AnimatePresence initial={false}>
        {isDesktop && !listCollapsed && (
          <motion.div
            key="map-results-panel"
            initial={{ width: 0, opacity: 0.7 }}
            animate={{ width: `${listWidthPct * 100}%`, opacity: 1 }}
            exit={{ width: 0, opacity: 0.7 }}
            transition={LIST_PANEL_TRANSITION}
            className="relative h-full min-h-0 shrink-0 overflow-hidden"
          >
            {/* Fixed open width so content doesn’t reflow while the clip animates. */}
            <div
              className="h-full min-w-[20rem]"
              style={{ width: `${listWidthPct * 100}vw` }}
            >
              {panel}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {!isDesktop && panel}

      {/*
        Overlay only the map column (not the desktop list). On mobile, tuck
        under the results sheet (z-500) and fade out when the sheet is full so
        search/controls don’t sit on top of the list.
      */}
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 z-[480] transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          !isDesktop && sheetSnap === "full" && "pointer-events-none opacity-0",
        )}
        style={{
          right:
            isDesktop && !listCollapsed ? `${listWidthPct * 100}%` : 0,
        }}
        aria-hidden={!isDesktop && sheetSnap === "full" ? true : undefined}
      >
        <div
          className={cn(
            "absolute left-4 top-4 w-[min(320px,calc(100%-5.5rem))]",
            !isDesktop && sheetSnap === "full" ? "pointer-events-none" : "pointer-events-auto",
          )}
        >
          <PlaceSearch onSelect={applyPlace} onSelectSchool={applySchool} />
        </div>
        <div
          className={cn(
            "absolute right-4 top-4 flex flex-col items-end gap-2",
            !isDesktop && sheetSnap === "full" ? "pointer-events-none" : "pointer-events-auto",
          )}
        >
          <MapControls
            drawMode={drawing.mode}
            hasShape={Boolean(polygon)}
            locating={userLocation.status === "locating"}
            basemap={prefs.basemap}
            pinMode={prefs.pinMode}
            shareUrl={shareUrl}
            onZoomIn={() => map?.zoomIn()}
            onZoomOut={() => map?.zoomOut()}
            onLocate={userLocation.locate}
            onDraw={toggleDraw}
            onClear={clearShape}
            onBasemap={(next: BasemapId) => patchPrefs({ basemap: next })}
            onPinMode={(next: PinColorMode) => patchPrefs({ pinMode: next })}
          />
          <AnimatePresence initial={false}>
            {listCollapsed && (
              <motion.button
                key="show-list"
                type="button"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: LIST_PANEL_EASE }}
                onClick={() => patchPrefs({ listCollapsed: false })}
                className="rounded-control border border-line bg-surface px-3 py-2 text-caption font-medium text-ink shadow-card transition-colors hover:border-navy hover:text-navy"
              >
                Show list
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
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
    <div className="relative w-full">
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
        className="h-11 w-full rounded-control border border-line bg-surface px-4 text-small text-ink shadow-card outline-none placeholder:text-ink-subtle focus:border-navy/35 focus:ring-2 focus:ring-navy/10"
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
