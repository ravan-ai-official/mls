import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readRoomUnits,
  ROOM_UNITS_KEY,
  roomDimensionForUnits,
  saveRoomUnits,
} from "./roomUnits";

function installSessionStorageMock() {
  const store = new Map<string, string>();
  const mock = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
  vi.stubGlobal("sessionStorage", mock);
  vi.stubGlobal("window", { sessionStorage: mock });
  return mock;
}

describe("roomUnits preference", () => {
  beforeEach(() => {
    installSessionStorageMock();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("defaults to metres and persists ft", () => {
    expect(readRoomUnits()).toBe("m");
    saveRoomUnits("ft");
    expect(sessionStorage.getItem(ROOM_UNITS_KEY)).toBe("ft");
    expect(readRoomUnits()).toBe("ft");
  });

  it("picks dimensions with preferred → other → display fallback", () => {
    const room = {
      dimensionsM: "5.4 × 5.1 m",
      dimensionsFt: `17'9" × 16'9"`,
      dimensionsDisplay: "5.4 × 5.1 m",
    };
    expect(roomDimensionForUnits(room, "m")).toBe("5.4 × 5.1 m");
    expect(roomDimensionForUnits(room, "ft")).toBe(`17'9" × 16'9"`);
    expect(
      roomDimensionForUnits(
        { dimensionsM: null, dimensionsFt: null, dimensionsDisplay: "5.4 × 5.1 m" },
        "ft",
      ),
    ).toBe("5.4 × 5.1 m");
    expect(
      roomDimensionForUnits(
        { dimensionsM: null, dimensionsFt: `10' × 12'`, dimensionsDisplay: null },
        "m",
      ),
    ).toBe(`10' × 12'`);
  });
});
