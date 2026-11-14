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
export const KITCHEN_OPTIONS = [1, 2, 3] as const;
export const DOM_OPTIONS = [7, 14, 30, 60, 90] as const;
export const YEAR_BUILT_MIN_OPTIONS = [2020, 2010, 2000, 1990, 1980] as const;

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
