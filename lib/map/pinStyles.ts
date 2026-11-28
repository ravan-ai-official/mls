/**
 * Map pin fill colors for status / price / days-on-market modes.
 */

import { deriveDaysOnMarket } from "@/lib/api/mappers";
import {
  MAP_PIN_ACTIVE,
  MAP_PIN_DOM_RAMP,
  MAP_PIN_PRICE_RAMP,
  MAP_PIN_SOLD,
  MAP_PIN_TEAL,
  type PinColorMode,
} from "@/lib/map/basemap";
import type { PropertySummary } from "@/lib/types/domain";
import { statusGroup } from "@/lib/utils/status";

/** GTA sale-price buckets for the price color mode (CAD). */
const PRICE_BREAKS = [500_000, 800_000, 1_200_000, 2_000_000];

/** Days-on-market buckets. */
const DOM_BREAKS = [7, 21, 45, 90];

function rampColor(value: number | null, breaks: number[], ramp: readonly string[]): string {
  if (value === null || !Number.isFinite(value)) return MAP_PIN_TEAL;
  for (let i = 0; i < breaks.length; i++) {
    if (value < breaks[i]) return ramp[i] ?? ramp[ramp.length - 1];
  }
  return ramp[ramp.length - 1];
}

export function pinFillColor(
  property: PropertySummary,
  mode: PinColorMode,
  selected: boolean,
): string {
  if (selected) return MAP_PIN_ACTIVE;
  if (mode === "status") {
    return statusGroup(property.status) === "sold" ? MAP_PIN_SOLD : MAP_PIN_TEAL;
  }
  if (mode === "price") {
    const value =
      property.status === "sold" && property.closePrice !== null
        ? property.closePrice
        : property.price;
    return rampColor(value, PRICE_BREAKS, MAP_PIN_PRICE_RAMP);
  }
  const days = deriveDaysOnMarket(property.listedAt, property.closeDate);
  return rampColor(days, DOM_BREAKS, MAP_PIN_DOM_RAMP);
}

export function pinModeLegend(mode: PinColorMode): Array<{ color: string; label: string }> {
  if (mode === "status") {
    return [
      { color: MAP_PIN_TEAL, label: "For sale" },
      { color: MAP_PIN_SOLD, label: "Sold" },
      { color: MAP_PIN_ACTIVE, label: "Selected" },
    ];
  }
  if (mode === "price") {
    return [
      { color: MAP_PIN_PRICE_RAMP[0], label: "Under $500K" },
      { color: MAP_PIN_PRICE_RAMP[1], label: "$500K–$800K" },
      { color: MAP_PIN_PRICE_RAMP[2], label: "$800K–$1.2M" },
      { color: MAP_PIN_PRICE_RAMP[3], label: "$1.2M–$2M" },
      { color: MAP_PIN_PRICE_RAMP[4], label: "$2M+" },
    ];
  }
  return [
    { color: MAP_PIN_DOM_RAMP[0], label: "< 7 days" },
    { color: MAP_PIN_DOM_RAMP[1], label: "7–21 days" },
    { color: MAP_PIN_DOM_RAMP[2], label: "21–45 days" },
    { color: MAP_PIN_DOM_RAMP[3], label: "45–90 days" },
    { color: MAP_PIN_DOM_RAMP[4], label: "90+ days" },
  ];
}
