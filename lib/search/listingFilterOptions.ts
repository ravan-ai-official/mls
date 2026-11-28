/**
 * Shared option lists for the public listings filter sheet and the Studio
 * keyword → search-definition editor. Keep these in sync so admins can
 * configure every criterion buyers can search with.
 */

import type { ListingQuery } from "@/lib/types/domain";

export const BED_OPTIONS = [1, 2, 3, 4, 5] as const;
export const BATH_OPTIONS = [1, 2, 3, 4] as const;
export const GARAGE_OPTIONS = [1, 2, 3] as const;
export const FLOOR_OPTIONS = [1, 2, 3] as const;
/** @deprecated Prefer PROPERTY_AGE_OPTIONS — kept for older Studio configs. */
export const YEAR_BUILT_MIN_OPTIONS = [2020, 2010, 2000, 1990, 1980] as const;

/**
 * Age buckets for the listings / map filter sheets.
 * Mapped to year_built_min / year_built_max from the current calendar year.
 * Mutually exclusive with a free-form “built in or before” year.
 */
export const PROPERTY_AGE_OPTIONS = [
  { id: "new", label: "New" },
  { id: "0-5", label: "0-5" },
  { id: "6-15", label: "6-15" },
  { id: "16-30", label: "16-30" },
  { id: "31-50", label: "31-50" },
  { id: "51-plus", label: "51+" },
] as const;

export type PropertyAgeId = (typeof PROPERTY_AGE_OPTIONS)[number]["id"];

export function propertyAgeToYears(
  id: PropertyAgeId | "" | null | undefined,
  now = new Date().getFullYear(),
): { min?: number; max?: number } {
  switch (id) {
    case "new":
      return { min: now };
    case "0-5":
      return { min: now - 5 };
    case "6-15":
      return { min: now - 15, max: now - 6 };
    case "16-30":
      return { min: now - 30, max: now - 16 };
    case "31-50":
      return { min: now - 50, max: now - 31 };
    case "51-plus":
      return { max: now - 51 };
    default:
      return {};
  }
}

/** Reverse-map URL year bounds back to a preset when they still match this year. */
export function matchPropertyAgePreset(
  yearBuiltMin?: number | null,
  yearBuiltMax?: number | null,
  now = new Date().getFullYear(),
): (typeof PROPERTY_AGE_OPTIONS)[number] | null {
  const min = yearBuiltMin == null ? undefined : yearBuiltMin;
  const max = yearBuiltMax == null ? undefined : yearBuiltMax;
  for (const option of PROPERTY_AGE_OPTIONS) {
    const years = propertyAgeToYears(option.id, now);
    if (years.min === min && years.max === max) return option;
  }
  return null;
}

/** Exact feed values; each was checked to return listings. */
export const BUILDING_OPTIONS = [
  "House",
  "Row / Townhouse",
  "Apartment",
  "Duplex",
  "Mobile Home",
] as const;

export const OWNERSHIP_OPTIONS = ["Freehold", "Condo/Strata", "Leasehold"] as const;

/**
 * Description-keyword presets for the listings filter sheet. Values are
 * comma-separated phrases OR'ed against public remarks (same as URL
 * `keywords`). Prefer phrases over short tokens that over-match.
 */
export const KEYWORD_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  {
    value: "power of sale,power-of-sale,mortgagee sale,bank sale,bank-owned",
    label: "Power of sale",
  },
  {
    value:
      "sold as is,as-is,estate sale,handyman,motivated seller,fixer upper,fixer-upper,needs work,tlc",
    label: "Distress / fixer-upper",
  },
  { value: "waterfront", label: "Waterfront" },
  { value: "pool", label: "Pool" },
  { value: "garage", label: "Garage" },
  { value: "parking", label: "Parking" },
  { value: "renovated", label: "Renovated" },
  { value: "backyard", label: "Backyard" },
  { value: "elevator", label: "Elevator" },
  { value: "basement apartment", label: "Basement apartment" },
  { value: "corner unit", label: "Corner unit" },
  { value: "hardwood", label: "Hardwood floors" },
  { value: "motivated seller", label: "Motivated seller" },
  { value: "estate sale", label: "Estate sale" },
];

/** Resolve free text to a keyword preset when the buyer typed a label or value. */
export function matchKeywordOption(term: string): (typeof KEYWORD_OPTIONS)[number] | null {
  const needle = term.trim().toLowerCase();
  if (!needle) return null;
  return (
    KEYWORD_OPTIONS.find(
      (option) =>
        option.label.toLowerCase() === needle ||
        option.value.toLowerCase() === needle ||
        option.value
          .split(",")
          .map((part) => part.trim().toLowerCase())
          .includes(needle),
    ) ?? null
  );
}

export const BASEMENT_OPTIONS: ReadonlyArray<{
  value: "" | NonNullable<ListingQuery["basement"]>;
  label: string;
}> = [
  { value: "", label: "Any" },
  { value: "yes", label: "Yes" },
  { value: "finished", label: "Finished" },
  { value: "unfinished", label: "Unfinished" },
  { value: "apartment", label: "Apartment / walk-out" },
];

export const BASEMENT_VALUES: ReadonlySet<string> = new Set(
  BASEMENT_OPTIONS.map((option) => option.value).filter((value) => value !== ""),
);
