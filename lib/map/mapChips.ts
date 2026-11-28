/**
 * Removable filter chips for map search chrome.
 * Labels mirror describeCriteria(); keys drive clearMapChip().
 */

import { matchPropertyAgePreset } from "@/lib/search/listingFilterOptions";
import type { ListingQuery } from "@/lib/types/domain";
import { formatPostal } from "@/lib/utils/postal";
import { formatPriceCompact } from "@/lib/utils/format";
import { backendStatusGroup, STATUS_TABS } from "@/lib/utils/status";

export type MapChip = {
  key: string;
  label: string;
};

export function mapSearchChips(query: ListingQuery): MapChip[] {
  const chips: MapChip[] = [];
  if (query.search) chips.push({ key: "search", label: `"${query.search}"` });
  if (query.city) chips.push({ key: "city", label: query.city });
  if (query.transaction === "rent") chips.push({ key: "transaction", label: "For rent" });
  for (const code of query.postalCodes ?? []) {
    chips.push({ key: `postal:${code}`, label: formatPostal(code) });
  }
  if (query.polygon?.length) {
    chips.push({
      key: "polygon",
      label: query.schoolLabel
        ? `Near ${query.schoolLabel}${query.schoolKm ? ` (${query.schoolKm} km)` : ""}`
        : "Drawn area",
    });
  }
  if (query.status) {
    const group = backendStatusGroup(query.status);
    chips.push({
      key: "status",
      label: STATUS_TABS.find((tab) => tab.group === group)?.label ?? query.status,
    });
  }
  if (query.openHouse) chips.push({ key: "openHouse", label: "Open house" });
  if (query.type) chips.push({ key: "type", label: query.type });
  if (query.priceMin && query.priceMax) {
    chips.push({
      key: "price",
      label: `${formatPriceCompact(query.priceMin)} – ${formatPriceCompact(query.priceMax)}`,
    });
  } else if (query.priceMin) {
    chips.push({ key: "price", label: `From ${formatPriceCompact(query.priceMin)}` });
  } else if (query.priceMax) {
    chips.push({ key: "price", label: `Under ${formatPriceCompact(query.priceMax)}` });
  }
  if (query.bedsMin) chips.push({ key: "beds", label: `${query.bedsMin}+ beds` });
  if (query.bathsMin) chips.push({ key: "baths", label: `${query.bathsMin}+ baths` });
  if (query.sqftMin) {
    chips.push({ key: "sqft", label: `${query.sqftMin.toLocaleString("en-CA")}+ sq ft` });
  }
  {
    const age = matchPropertyAgePreset(query.yearBuiltMin, query.yearBuiltMax);
    if (age) {
      chips.push({ key: "year", label: `Age: ${age.label}` });
    } else {
      if (query.yearBuiltMin) chips.push({ key: "yearMin", label: `Built ${query.yearBuiltMin}+` });
      if (query.yearBuiltMax) {
        chips.push({ key: "yearMax", label: `Built ${query.yearBuiltMax} or earlier` });
      }
    }
  }
  if (query.garagesMin) chips.push({ key: "garages", label: `${query.garagesMin}+ garage` });
  if (query.storiesMin) chips.push({ key: "floors", label: `${query.storiesMin}+ floors` });
  if (query.basement) {
    const labels: Record<NonNullable<ListingQuery["basement"]>, string> = {
      yes: "Has basement",
      finished: "Finished basement",
      unfinished: "Unfinished basement",
      apartment: "Basement apartment",
      none: "No basement",
    };
    chips.push({ key: "basement", label: labels[query.basement] });
  }
  if (query.semantic) chips.push({ key: "semantic", label: `Like: ${query.semantic}` });
  return chips;
}

/** Drop one chip’s criterion; polygon clear also drops school proximity. */
export function clearMapChip(query: ListingQuery, key: string): ListingQuery {
  if (key.startsWith("postal:")) {
    const code = key.slice("postal:".length);
    const postalCodes = (query.postalCodes ?? []).filter((c) => c !== code);
    return { ...query, postalCodes: postalCodes.length ? postalCodes : undefined };
  }

  switch (key) {
    case "search":
      return { ...query, search: undefined };
    case "city":
      return { ...query, city: undefined };
    case "transaction":
      return { ...query, transaction: "sale" };
    case "polygon":
      return {
        ...query,
        polygon: undefined,
        schoolLabel: undefined,
        schoolKm: undefined,
      };
    case "status":
      return { ...query, status: undefined };
    case "openHouse":
      return { ...query, openHouse: undefined };
    case "type":
      return { ...query, type: undefined };
    case "price":
      return { ...query, priceMin: undefined, priceMax: undefined };
    case "beds":
      return { ...query, bedsMin: undefined };
    case "baths":
      return { ...query, bathsMin: undefined };
    case "sqft":
      return { ...query, sqftMin: undefined, sqftMax: undefined };
    case "year":
      return { ...query, yearBuiltMin: undefined, yearBuiltMax: undefined };
    case "yearMin":
      return { ...query, yearBuiltMin: undefined };
    case "yearMax":
      return { ...query, yearBuiltMax: undefined };
    case "garages":
      return { ...query, garagesMin: undefined };
    case "floors":
      return { ...query, storiesMin: undefined };
    case "basement":
      return { ...query, basement: undefined };
    case "semantic":
      return { ...query, semantic: undefined };
    default:
      return query;
  }
}

/** Strip listing facets but keep the drawn / school area. */
export function clearListingFilters(query: ListingQuery): ListingQuery {
  return {
    polygon: query.polygon,
    schoolLabel: query.schoolLabel,
    schoolKm: query.schoolKm,
    transaction: query.transaction ?? "sale",
  };
}
