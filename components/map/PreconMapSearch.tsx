"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { DrawHint, MapControls } from "@/components/map/MapControls";
import {
  BoundsWatcher,
  DrawnArea,
  FlyTo,
  MapClickWatcher,
  PlaceSearch,
  type Bounds,
} from "@/components/map/MapSearch";
import { SafeImage } from "@/components/ui/SafeImage";
import { salesStageLabel, type PreconProject, type PreconSalesStage } from "@/lib/api/preconstruction";
import {
  MAP_PIN_ACTIVE,
  MAP_PIN_TEAL,
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_URL,
} from "@/lib/map/basemap";
import { isPointInPolygon, type LatLngPoint } from "@/lib/map/polygon";
import { useMapDrawing, type DrawMode } from "@/lib/map/useMapDrawing";
import { useUserLocation } from "@/lib/map/useUserLocation";
import { preconPath } from "@/lib/seo/urls";
import { cn } from "@/lib/utils/cn";
import { formatPrice, formatPriceCompact } from "@/lib/utils/format";

type MappedProject = PreconProject & { latitude: number; longitude: number };

const DEFAULT_CENTER: [number, number] = [43.6532, -79.3832];
const DEFAULT_ZOOM = 10;
const STAGES: PreconSalesStage[] = ["coming_soon", "vip_release", "now_selling", "sold_out"];

function hasLocation(project: PreconProject): project is MappedProject {
  return project.latitude !== null && project.longitude !== null;
}

/** Only numbers and fixed text reach this HTML, never a project field. */
function preconIcon(project: PreconProject, active: boolean) {
  const label = project.price ? formatPriceCompact(project.price) : "Pre-con";
  const bg = active ? MAP_PIN_ACTIVE : MAP_PIN_TEAL;
  return L.divIcon({
    className: "",
    html: `<span style="background:${bg};border:2px solid #fff;border-radius:7px;min-width:58px;height:25px;padding:0 8px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:500;line-height:1;box-shadow:0 1px 3px rgba(0,0,0,.25);white-space:nowrap">${label}</span>`,
    iconSize: [0, 0],
    iconAnchor: [29, 14],
  });
}

/** Frames every project once on load, so none starts off-screen. */
function FitProjects({ projects }: { projects: MappedProject[] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || projects.length === 0) return;
    fitted.current = true;
    map.fitBounds(
      projects.map((project) => [project.latitude, project.longitude] as [number, number]),
      { padding: [48, 48], maxZoom: 13 },
    );
  }, [map, projects]);
  return null;
}

/**
 * Map search for preconstruction projects.
 *
 * There are few enough projects to send them all with the page, so the map
 * area, drawn shape and stage filter narrow the list here in the browser.
 */
export function PreconMapSearch({ projects }: { projects: PreconProject[] }) {
  const [map, setMap] = useState<L.Map | null>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [polygon, setPolygon] = useState<LatLngPoint[] | null>(null);
  const [stage, setStage] = useState<PreconSalesStage | "">("");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);

  const userLocation = useUserLocation({ autoCenter: false, onLocated: (point) => setFlyTarget(point) });
  const drawing = useMapDrawing(map, setPolygon);
  const handleBounds = useCallback((next: Bounds) => setBounds(next), []);

  const mapped = useMemo(() => projects.filter(hasLocation), [projects]);
  const matching = useMemo(
    () => mapped.filter((project) => !stage || project.salesStage === stage),
    [mapped, stage],
  );
  const visible = useMemo(
    () =>
      matching.filter((project) => {
        const point = { lat: project.latitude, lng: project.longitude };
        if (polygon) return isPointInPolygon(point, polygon);
        if (!bounds) return true;
        return (
          point.lat >= bounds.latMin &&
          point.lat <= bounds.latMax &&
          point.lng >= bounds.lngMin &&
          point.lng <= bounds.lngMax
        );
      }),
    [matching, polygon, bounds],
  );

  const selected = mapped.find((project) => project.id === selectedId) ?? null;
  const unmappedCount = projects.length - mapped.length;
  const where = polygon ? "in your drawn area" : "in this area";

  const toggleDraw = (mode: DrawMode) => {
    if (drawing.mode === mode) drawing.cancel();
    else drawing.start(mode);
  };

  return (
    <div className="flex h-[calc(100vh-72px)] flex-col lg:flex-row">
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
          <FitProjects projects={mapped} />
          <FlyTo target={flyTarget} />
          <MapClickWatcher onClick={() => setSelectedId(null)} />
          {userLocation.position && (
            <CircleMarker
              center={userLocation.position}
              radius={7}
              pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#2563eb", fillOpacity: 1 }}
              interactive={false}
            />
          )}
          {polygon && <DrawnArea points={polygon} />}
          {/* Remounted non-interactive while drawing, so a tap on a pin adds a point. */}
          {matching.map((project) => {
            const active = project.id === activeId || project.id === selectedId;
            return (
              <Marker
                key={`${project.id}-${drawing.mode ?? "idle"}`}
                position={[project.latitude, project.longitude]}
                icon={preconIcon(project, active)}
                zIndexOffset={active ? 1000 : 0}
                interactive={!drawing.mode}
                title={project.title}
                eventHandlers={{
                  click: () => setSelectedId(project.id),
                  mouseover: () => setActiveId(project.id),
                  mouseout: () => setActiveId(null),
                }}
              />
            );
          })}
        </MapContainer>

        <PlaceSearch onSelect={(result) => setFlyTarget([result.latitude, result.longitude])} />

        <MapControls
          drawMode={drawing.mode}
          hasShape={Boolean(polygon)}
          locating={userLocation.status === "locating"}
          onZoomIn={() => map?.zoomIn()}
          onZoomOut={() => map?.zoomOut()}
          onLocate={userLocation.locate}
          onDraw={toggleDraw}
          onClear={() => {
            drawing.cancel();
            setPolygon(null);
          }}
        />

        {selected && !drawing.mode && (
          <div className="absolute bottom-4 left-4 right-4 z-[500] mx-auto max-w-sm overflow-hidden rounded-surface border border-line bg-surface shadow-pop">
            <button
              type="button"
              aria-label="Close preview"
              onClick={() => setSelectedId(null)}
              className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ink shadow-card"
            >
              ×
            </button>
            <ProjectRow project={selected} />
          </div>
        )}

        {drawing.mode && (
          <DrawHint
            mode={drawing.mode}
            pointCount={drawing.pointCount}
            onFinish={drawing.finish}
            onCancel={drawing.cancel}
          />
        )}
      </div>

      <aside className="flex h-1/2 min-h-0 w-full flex-col overflow-hidden border-t border-line lg:h-full lg:w-2/5 lg:border-l lg:border-t-0">
        <header className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2.5 sm:px-5 sm:py-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-small font-semibold text-ink sm:text-h3">Preconstruction map</h1>
            <p className="truncate text-caption text-ink-muted" aria-live="polite">
              {visible.length} {visible.length === 1 ? "project" : "projects"} {where}
            </p>
          </div>
          <label htmlFor="precon-stage" className="sr-only">
            Sales stage
          </label>
          <select
            id="precon-stage"
            value={stage}
            onChange={(event) => setStage(event.target.value as PreconSalesStage | "")}
            className="h-10 shrink-0 rounded-control border border-line bg-surface px-2 text-caption text-ink sm:h-11 sm:text-small"
          >
            <option value="">All stages</option>
            {STAGES.map((value) => (
              <option key={value} value={value}>
                {salesStageLabel(value)}
              </option>
            ))}
          </select>
          <Link
            href="/preconstruction"
            className="flex h-10 shrink-0 items-center rounded-control border border-line bg-surface px-2.5 text-caption font-medium text-ink transition-colors hover:border-navy hover:text-navy sm:h-11 sm:px-3 sm:text-small"
          >
            All projects
          </Link>
        </header>

        <ul className="flex-1 overflow-y-auto" onMouseLeave={() => setActiveId(null)}>
          {visible.length === 0 && (
            <li className="px-5 py-10 text-center text-small text-ink-muted">
              {polygon
                ? "No projects in your drawn area. Try a bigger area or another stage."
                : "No projects in view. Try zooming out or choosing another stage."}
            </li>
          )}
          {visible.map((project) => (
            <li
              key={project.id}
              onMouseEnter={() => setActiveId(project.id)}
              className={cn(
                "border-b border-line transition-colors",
                (project.id === activeId || project.id === selectedId) && "bg-surface-alt",
              )}
            >
              <ProjectRow project={project} />
            </li>
          ))}
          {unmappedCount > 0 && (
            <li className="px-5 py-5 text-center text-caption text-ink-muted">
              {unmappedCount} more {unmappedCount === 1 ? "project has" : "projects have"} no map location yet.{" "}
              <Link href="/preconstruction" className="font-medium text-navy hover:underline">
                See all projects
              </Link>
            </li>
          )}
        </ul>
      </aside>
    </div>
  );
}

function ProjectRow({ project }: { project: PreconProject }) {
  const stage = salesStageLabel(project.salesStage);
  return (
    <Link href={preconPath(project.id, project.slug || project.title)} className="flex gap-3 p-3 sm:p-4">
      <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-control bg-surface-alt">
        <SafeImage src={project.image} alt="" fill sizes="112px" className="object-cover" />
      </div>
      <div className="min-w-0 flex-1 pr-6">
        <p className="truncate text-small font-semibold text-ink">{project.title}</p>
        {project.address && <p className="truncate text-caption text-ink-muted">{project.address}</p>}
        <p className="mt-1 text-caption text-ink-muted">
          {project.price ? (
            <>
              From <span className="font-semibold text-ink">{formatPrice(project.price)}</span>
            </>
          ) : (
            "Price not published"
          )}
          {stage ? ` · ${stage}` : ""}
        </p>
      </div>
    </Link>
  );
}
