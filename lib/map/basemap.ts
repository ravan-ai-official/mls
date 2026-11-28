/**
 * Basemap tiles + pin palette for map search.
 *
 * Streets: OSM (no key). Satellite: Esri World Imagery (no key, fair-use).
 */

export type BasemapId = "streets" | "satellite";

export type PinColorMode = "status" | "price" | "dom";

export const MAP_BASEMAPS: Record<
  BasemapId,
  { label: string; url: string; attribution: string; maxZoom: number }
> = {
  streets: {
    label: "Streets",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  satellite: {
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    maxZoom: 19,
  },
};

/** @deprecated Prefer MAP_BASEMAPS.streets.url */
export const MAP_TILE_URL = MAP_BASEMAPS.streets.url;

/** @deprecated Prefer MAP_BASEMAPS.streets.attribution */
export const MAP_TILE_ATTRIBUTION = MAP_BASEMAPS.streets.attribution;

/** HouseSigma cluster orange (`cluster-ff5f05`). */
export const MAP_CLUSTER_ORANGE = "#ff5f05";

/** HouseSigma active listing pin teal. */
export const MAP_PIN_TEAL = "#28a3b3";

/** Sold / closed pin — muted so active homes stay dominant. */
export const MAP_PIN_SOLD = "#8b95a5";

/** HouseSigma featured / selected pin orange. */
export const MAP_PIN_ACTIVE = "#ee802b";

/** Price-mode ramp (low → high). */
export const MAP_PIN_PRICE_RAMP = ["#2a9d8f", "#e9c46a", "#f4a261", "#e76f51", "#9b2226"] as const;

/** Days-on-market ramp (fresh → stale). */
export const MAP_PIN_DOM_RAMP = ["#2a9d8f", "#8ab17d", "#e9c46a", "#f4a261", "#e76f51"] as const;

export const PIN_COLOR_MODE_LABELS: Record<PinColorMode, string> = {
  status: "Status",
  price: "Price",
  dom: "Days on market",
};
