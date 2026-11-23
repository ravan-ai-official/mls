/**
 * Basemap for map search — light street tiles with no API key.
 *
 * OpenStreetMap standard tiles (no key required). CARTO Voyager now watermarks
 * requests without a basemap API key, so we no longer use cartocdn.
 */
export const MAP_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

export const MAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** HouseSigma cluster orange (`cluster-ff5f05`). */
export const MAP_CLUSTER_ORANGE = "#ff5f05";

/** HouseSigma active listing pin teal. */
export const MAP_PIN_TEAL = "#28a3b3";

/** HouseSigma featured / selected pin orange. */
export const MAP_PIN_ACTIVE = "#ee802b";
