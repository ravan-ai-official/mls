/**
 * Tab-scoped preference for the property Rooms table [m] / [ft] toggle.
 * Default is metres (TREB). Survives soft navigation via sessionStorage.
 */
export const ROOM_UNITS_KEY = "room-units-v1";
/** Same-tab signal when the Rooms [m]/[ft] toggle changes. */
export const ROOM_UNITS_EVENT = "ha:room-units";

export type RoomUnits = "m" | "ft";

export function isRoomUnits(value: unknown): value is RoomUnits {
  return value === "m" || value === "ft";
}

export function readRoomUnits(): RoomUnits {
  if (typeof window === "undefined") return "m";
  try {
    const raw = sessionStorage.getItem(ROOM_UNITS_KEY);
    return isRoomUnits(raw) ? raw : "m";
  } catch {
    return "m";
  }
}

export function saveRoomUnits(units: RoomUnits): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(ROOM_UNITS_KEY, units);
  } catch {
    /* private mode / quota */
  }
  try {
    window.dispatchEvent(new CustomEvent(ROOM_UNITS_EVENT, { detail: units }));
  } catch {
    /* ignore */
  }
}

/** Pick the Dimensions cell for the active unit preference. */
export function roomDimensionForUnits(
  room: {
    dimensionsM: string | null;
    dimensionsFt: string | null;
    dimensionsDisplay: string | null;
  },
  units: RoomUnits,
): string {
  const primary = units === "m" ? room.dimensionsM : room.dimensionsFt;
  if (primary?.trim()) return primary.trim();
  const other = units === "m" ? room.dimensionsFt : room.dimensionsM;
  if (other?.trim()) return other.trim();
  return room.dimensionsDisplay?.trim() || "";
}
