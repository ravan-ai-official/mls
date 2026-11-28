"use client";

import L from "leaflet";
import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_POLYGON_POINTS, type LatLngPoint } from "@/lib/map/polygon";

/**
 * Hand-rolled area drawing on a Leaflet map — no leaflet-draw dependency.
 * Ported from mls-v2 `hooks/useMapDrawing.ts`, restructured so every listener
 * lives in ONE effect keyed on the mode: its cleanup detaches everything and
 * restores map interactions, so no exit path (finish, cancel, Escape, unmount)
 * can leave the map stuck with dragging off.
 *
 * Input is click-based on purpose. Leaflet turns a tap into a `click`, while
 * touch drags never become mouse drags — so taps are the one gesture that works
 * the same on a phone and a desktop.
 *
 *  - polygon:   tap to add points; finish by tapping the first point,
 *               double-click, right-click, the Finish button, or reaching the
 *               point cap (MAX_POLYGON_POINTS).
 *  - rectangle: tap one corner then the opposite one; on desktop a
 *               press-drag-release also works.
 *  - Escape cancels either.
 */

export type DrawMode = "polygon" | "rectangle";

/** Screen-pixel radius for "tapped the first point" — finger-sized. */
const CLOSE_RADIUS_PX = 18;
/** Clicks closer than this to the previous point are the two halves of a dblclick. */
const DUPLICATE_RADIUS_PX = 5;
/** Below this, a press-release is a tap rather than a rectangle drag. */
const DRAG_THRESHOLD_PX = 10;

const STROKE = "#1b2e4b"; // --color-navy; Leaflet paths need a literal colour.

function toPoint(latlng: L.LatLng): LatLngPoint {
  return { lat: latlng.lat, lng: latlng.lng };
}

function rectangleRing(a: LatLngPoint, b: LatLngPoint): LatLngPoint[] {
  const latMin = Math.min(a.lat, b.lat);
  const latMax = Math.max(a.lat, b.lat);
  const lngMin = Math.min(a.lng, b.lng);
  const lngMax = Math.max(a.lng, b.lng);
  return [
    { lat: latMin, lng: lngMin },
    { lat: latMax, lng: lngMin },
    { lat: latMax, lng: lngMax },
    { lat: latMin, lng: lngMax },
  ];
}

export function useMapDrawing(
  map: L.Map | null,
  onComplete: (points: LatLngPoint[]) => void,
) {
  const [mode, setMode] = useState<DrawMode | null>(null);
  const [pointCount, setPointCount] = useState(0);

  // Latest callback without re-binding listeners on every parent render.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Set by the effect for the active mode; lets the Finish / Undo buttons act.
  const finishRef = useRef<(() => void) | null>(null);
  const undoRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!map || !mode) return;

    const container = map.getContainer();
    const wasDragging = map.dragging.enabled();
    const wasDblZoom = map.doubleClickZoom.enabled();
    map.dragging.disable();
    map.doubleClickZoom.disable();
    container.style.cursor = "crosshair";

    const layer = L.layerGroup().addTo(map);
    const line = L.polyline([], { color: STROKE, weight: 2, dashArray: "5, 8" }).addTo(layer);
    const preview = L.polyline([], { color: STROKE, weight: 2, opacity: 0.6, dashArray: "4, 8" }).addTo(layer);
    const rect = L.polygon([], { color: STROKE, weight: 2, fillOpacity: 0.1, dashArray: "5, 8" }).addTo(layer);
    const vertices = L.layerGroup().addTo(layer);

    let points: LatLngPoint[] = [];
    let corner: LatLngPoint | null = null;
    let dragStart: L.LatLng | null = null;
    let suppressClick = false;
    let done = false;

    const complete = (ring: LatLngPoint[]) => {
      if (done) return;
      done = true;
      if (ring.length >= 3) onCompleteRef.current(ring);
      setMode(null);
    };

    const redrawPolygon = () => {
      line.setLatLngs(points.map((p) => [p.lat, p.lng]));
      vertices.clearLayers();
      points.forEach((p, index) => {
        // The first vertex is the "close the shape" target, so it reads larger.
        L.circleMarker([p.lat, p.lng], {
          radius: index === 0 && points.length >= 3 ? 7 : 4,
          color: STROKE,
          weight: 2,
          fillColor: "#ffffff",
          fillOpacity: 1,
          interactive: false,
        }).addTo(vertices);
      });
      setPointCount(points.length);
    };

    const undoLast = () => {
      if (mode === "polygon") {
        if (points.length === 0) return;
        points = points.slice(0, -1);
        redrawPolygon();
        preview.setLatLngs([]);
        return;
      }
      // rectangle: drop the first corner and start over
      if (corner) {
        corner = null;
        rect.setLatLngs([]);
        setPointCount(0);
      }
    };

    const px = (a: L.LatLng, b: L.LatLng) =>
      map.latLngToContainerPoint(a).distanceTo(map.latLngToContainerPoint(b));

    const finishPolygon = () => complete(points);

    const onClick = (event: L.LeafletMouseEvent) => {
      if (mode === "polygon") {
        const first = points[0];
        const last = points[points.length - 1];
        if (first && points.length >= 3 && px(event.latlng, L.latLng(first.lat, first.lng)) <= CLOSE_RADIUS_PX) {
          finishPolygon();
          return;
        }
        if (last && px(event.latlng, L.latLng(last.lat, last.lng)) <= DUPLICATE_RADIUS_PX) return;
        points = [...points, toPoint(event.latlng)];
        redrawPolygon();
        if (points.length >= MAX_POLYGON_POINTS) finishPolygon();
        return;
      }

      // rectangle
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      if (!corner) {
        corner = toPoint(event.latlng);
        setPointCount(1);
        return;
      }
      complete(rectangleRing(corner, toPoint(event.latlng)));
    };

    const onMove = (event: L.LeafletMouseEvent) => {
      if (mode === "polygon") {
        const last = points[points.length - 1];
        preview.setLatLngs(last ? [[last.lat, last.lng], event.latlng] : []);
        return;
      }
      const anchor = dragStart ? toPoint(dragStart) : corner;
      if (anchor) rect.setLatLngs(rectangleRing(anchor, toPoint(event.latlng)).map((p) => [p.lat, p.lng]));
    };

    const onDown = (event: L.LeafletMouseEvent) => {
      if (mode === "rectangle" && !corner) dragStart = event.latlng;
    };

    const onUp = (event: L.LeafletMouseEvent) => {
      if (mode !== "rectangle" || !dragStart) return;
      const start = dragStart;
      dragStart = null;
      if (px(start, event.latlng) > DRAG_THRESHOLD_PX) {
        // The browser still fires a click after this mouseup; swallow it.
        suppressClick = true;
        complete(rectangleRing(toPoint(start), toPoint(event.latlng)));
      }
    };

    const onFinishGesture = (event: L.LeafletMouseEvent) => {
      L.DomEvent.preventDefault(event.originalEvent);
      if (mode === "polygon") finishPolygon();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        done = true;
        setMode(null);
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        undoLast();
        return;
      }
      if ((event.key === "z" || event.key === "Z") && (event.metaKey || event.ctrlKey) && !event.shiftKey) {
        event.preventDefault();
        undoLast();
      }
    };

    finishRef.current = mode === "polygon" ? finishPolygon : null;
    undoRef.current = undoLast;
    map.on("click", onClick);
    map.on("mousemove", onMove);
    map.on("mousedown", onDown);
    map.on("mouseup", onUp);
    map.on("dblclick", onFinishGesture);
    map.on("contextmenu", onFinishGesture);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      map.off("click", onClick);
      map.off("mousemove", onMove);
      map.off("mousedown", onDown);
      map.off("mouseup", onUp);
      map.off("dblclick", onFinishGesture);
      map.off("contextmenu", onFinishGesture);
      document.removeEventListener("keydown", onKeyDown);
      layer.remove();
      finishRef.current = null;
      undoRef.current = null;
      if (wasDragging) map.dragging.enable();
      if (wasDblZoom) map.doubleClickZoom.enable();
      container.style.cursor = "";
      setPointCount(0);
    };
  }, [map, mode]);

  const start = useCallback((next: DrawMode) => setMode(next), []);
  const cancel = useCallback(() => setMode(null), []);
  const finish = useCallback(() => finishRef.current?.(), []);
  const undo = useCallback(() => undoRef.current?.(), []);

  return { mode, pointCount, start, cancel, finish, undo };
}
