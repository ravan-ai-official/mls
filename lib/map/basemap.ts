/**
 * Basemap for map search — light street style close to HouseSigma's
 * MapTiler Streets layer (MapLibre), delivered as Leaflet raster tiles.
 *
 * Carto Voyager: pale parks, white roads, muted labels — same family as
 * MapTiler Street without a MapLibre migration or API key.
 */
export const MAP_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

export const MAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** HouseSigma cluster orange (`cluster-ff5f05`). */
export const MAP_CLUSTER_ORANGE = "#ff5f05";

/** HouseSigma active listing pin teal. */
export const MAP_PIN_TEAL = "#28a3b3";

/** HouseSigma featured / selected pin orange. */
export const MAP_PIN_ACTIVE = "#ee802b";
