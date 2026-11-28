/**
 * Listings filter schema — option sets + which sheet fields show per
 * transaction_type. Prefer GET /api/mls/properties/filter-schema/; fall back
 * to these REALTOR.ca-style defaults when the endpoint is missing.
 */

import type { ListingTransaction } from "@/lib/types/domain";

export type FilterSchemaPriceOption = { value: number; label: string };

export type SheetFieldKey =
  | "property_type"
  | "sqft"
  | "land"
  | "listed_since"
  | "building_type"
  | "storeys"
  | "ownership"
  | "maintenance"
  | "tax"
  | "year_built"
  | "open_houses"
  | "keywords"
  | "sold_within_days"
  | "basement"
  | "garages"
  | "city"
  | "postal_code";

export interface FilterSchema {
  option_sets: {
    price_sale: FilterSchemaPriceOption[];
    price_rent: FilterSchemaPriceOption[];
    bedrooms: number[];
    bathrooms: number[];
    sold_within_days: number[];
  };
  sheet_visibility_by_transaction: Record<
    ListingTransaction,
    { show?: SheetFieldKey[]; hide?: SheetFieldKey[] }
  >;
  /** From filter-schema `ui.sold_login_required` — sold search needs auth. */
  ui?: {
    sold_login_required?: boolean;
  };
}

function price(value: number, label: string): FilterSchemaPriceOption {
  return { value, label };
}

/** Sale / sold price presets (CAD). */
export const DEFAULT_PRICE_SALE: FilterSchemaPriceOption[] = [
  price(100_000, "$100,000"),
  price(200_000, "$200,000"),
  price(300_000, "$300,000"),
  price(400_000, "$400,000"),
  price(500_000, "$500,000"),
  price(600_000, "$600,000"),
  price(700_000, "$700,000"),
  price(800_000, "$800,000"),
  price(900_000, "$900,000"),
  price(1_000_000, "$1,000,000"),
  price(1_250_000, "$1,250,000"),
  price(1_500_000, "$1,500,000"),
  price(1_750_000, "$1,750,000"),
  price(2_000_000, "$2,000,000"),
  price(2_500_000, "$2,500,000"),
  price(3_000_000, "$3,000,000"),
  price(4_000_000, "$4,000,000"),
  price(5_000_000, "$5,000,000"),
];

/** Monthly rent presets. */
export const DEFAULT_PRICE_RENT: FilterSchemaPriceOption[] = [
  price(500, "$500"),
  price(1_000, "$1,000"),
  price(1_500, "$1,500"),
  price(2_000, "$2,000"),
  price(2_500, "$2,500"),
  price(3_000, "$3,000"),
  price(3_500, "$3,500"),
  price(4_000, "$4,000"),
  price(5_000, "$5,000"),
  price(6_000, "$6,000"),
  price(7_500, "$7,500"),
  price(10_000, "$10,000"),
];

export const DEFAULT_FILTER_SCHEMA: FilterSchema = {
  option_sets: {
    price_sale: DEFAULT_PRICE_SALE,
    price_rent: DEFAULT_PRICE_RENT,
    bedrooms: [1, 2, 3, 4, 5],
    bathrooms: [1, 2, 3, 4],
    sold_within_days: [7, 30, 90, 180, 365],
  },
  ui: {
    sold_login_required: true,
  },
  sheet_visibility_by_transaction: {
    sale: {
      show: [
        "property_type",
        "sqft",
        "land",
        "listed_since",
        "building_type",
        "storeys",
        "ownership",
        "maintenance",
        "tax",
        "year_built",
        "open_houses",
        "keywords",
        "basement",
        "garages",
        "city",
        "postal_code",
      ],
      hide: ["sold_within_days"],
    },
    rent: {
      show: [
        "property_type",
        "sqft",
        "listed_since",
        "building_type",
        "storeys",
        "ownership",
        "maintenance",
        "year_built",
        "open_houses",
        "keywords",
        "basement",
        "garages",
        "city",
        "postal_code",
      ],
      hide: ["sold_within_days", "tax", "land"],
    },
    sold: {
      show: [
        "property_type",
        "sqft",
        "land",
        "building_type",
        "storeys",
        "ownership",
        "maintenance",
        "tax",
        "year_built",
        "keywords",
        "basement",
        "garages",
        "city",
        "postal_code",
        "sold_within_days",
      ],
      hide: ["open_houses", "listed_since"],
    },
  },
};

export const TRANSACTION_OPTIONS: ReadonlyArray<{
  value: ListingTransaction;
  label: string;
}> = [
  { value: "sale", label: "For sale" },
  { value: "rent", label: "For rent" },
  { value: "sold", label: "Sold" },
];

export function priceOptionsForTransaction(
  schema: FilterSchema,
  transaction: ListingTransaction,
): FilterSchemaPriceOption[] {
  return transaction === "rent"
    ? schema.option_sets.price_rent
    : schema.option_sets.price_sale;
}

export function isPriceAllowed(
  schema: FilterSchema,
  transaction: ListingTransaction,
  value: number | undefined,
): boolean {
  if (value == null || !Number.isFinite(value) || value <= 0) return true;
  const options = priceOptionsForTransaction(schema, transaction);
  if (options.length === 0) return true;
  if (options.some((option) => option.value === value)) return true;
  // Custom typed amounts are OK inside the preset band (sale ↔ rent switch
  // still clears e.g. $800k when moving to rent).
  const min = Math.min(...options.map((option) => option.value));
  const max = Math.max(...options.map((option) => option.value));
  return value >= min / 2 && value <= max * 2;
}

export function isSheetFieldVisible(
  schema: FilterSchema,
  transaction: ListingTransaction,
  field: SheetFieldKey,
): boolean {
  const rules = schema.sheet_visibility_by_transaction[transaction] ??
    schema.sheet_visibility_by_transaction.sale;
  if (rules.hide?.includes(field)) return false;
  if (rules.show?.length) return rules.show.includes(field);
  return true;
}

function asPriceOptions(raw: unknown): FilterSchemaPriceOption[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: FilterSchemaPriceOption[] = [];
  for (const item of raw) {
    if (typeof item === "number" && Number.isFinite(item) && item > 0) {
      out.push({
        value: item,
        label: item >= 1000 ? `$${item.toLocaleString("en-CA")}` : `$${item}`,
      });
      continue;
    }
    if (item && typeof item === "object") {
      const value = Number(
        (item as { value?: unknown; min?: unknown }).value ??
          (item as { min?: unknown }).min,
      );
      const label = (item as { label?: unknown }).label;
      if (!Number.isFinite(value) || value <= 0) continue;
      out.push({
        value,
        label: typeof label === "string" && label.trim() ? label.trim() : `$${value.toLocaleString("en-CA")}`,
      });
    }
  }
  return out.length ? out : null;
}

function asNumberList(raw: unknown, fallback: number[]): number[] {
  if (!Array.isArray(raw)) return fallback;
  const nums = raw
    .map((item) => Number(item))
    .filter((n) => Number.isFinite(n) && n > 0);
  return nums.length ? nums : fallback;
}

function asVisibility(
  raw: unknown,
  fallback: FilterSchema["sheet_visibility_by_transaction"]["sale"],
): FilterSchema["sheet_visibility_by_transaction"]["sale"] {
  if (!raw || typeof raw !== "object") return fallback;
  const show = Array.isArray((raw as { show?: unknown }).show)
    ? ((raw as { show: unknown[] }).show.filter(
        (item): item is SheetFieldKey => typeof item === "string",
      ) as SheetFieldKey[])
    : fallback.show;
  const hide = Array.isArray((raw as { hide?: unknown }).hide)
    ? ((raw as { hide: unknown[] }).hide.filter(
        (item): item is SheetFieldKey => typeof item === "string",
      ) as SheetFieldKey[])
    : fallback.hide;
  return { show, hide };
}

/** Merge a live schema payload onto defaults. */
export function normalizeFilterSchema(raw: unknown): FilterSchema {
  if (!raw || typeof raw !== "object") return DEFAULT_FILTER_SCHEMA;
  const optionSets = (raw as { option_sets?: unknown }).option_sets;
  const visibility = (raw as { sheet_visibility_by_transaction?: unknown })
    .sheet_visibility_by_transaction;
  const sets =
    optionSets && typeof optionSets === "object"
      ? (optionSets as Record<string, unknown>)
      : {};
  const vis =
    visibility && typeof visibility === "object"
      ? (visibility as Record<string, unknown>)
      : {};

  const uiRaw = (raw as { ui?: unknown }).ui;
  const uiObj =
    uiRaw && typeof uiRaw === "object" ? (uiRaw as Record<string, unknown>) : null;

  return {
    option_sets: {
      price_sale:
        asPriceOptions(sets.price_sale) ?? DEFAULT_FILTER_SCHEMA.option_sets.price_sale,
      price_rent:
        asPriceOptions(sets.price_rent) ?? DEFAULT_FILTER_SCHEMA.option_sets.price_rent,
      bedrooms: asNumberList(
        sets.bedrooms,
        DEFAULT_FILTER_SCHEMA.option_sets.bedrooms,
      ),
      bathrooms: asNumberList(
        sets.bathrooms,
        DEFAULT_FILTER_SCHEMA.option_sets.bathrooms,
      ),
      sold_within_days: asNumberList(
        sets.sold_within_days,
        DEFAULT_FILTER_SCHEMA.option_sets.sold_within_days,
      ),
    },
    ui: {
      sold_login_required:
        typeof uiObj?.sold_login_required === "boolean"
          ? uiObj.sold_login_required
          : DEFAULT_FILTER_SCHEMA.ui?.sold_login_required,
    },
    sheet_visibility_by_transaction: {
      sale: asVisibility(
        vis.sale,
        DEFAULT_FILTER_SCHEMA.sheet_visibility_by_transaction.sale,
      ),
      rent: asVisibility(
        vis.rent,
        DEFAULT_FILTER_SCHEMA.sheet_visibility_by_transaction.rent,
      ),
      sold: asVisibility(
        vis.sold,
        DEFAULT_FILTER_SCHEMA.sheet_visibility_by_transaction.sold,
      ),
    },
  };
}
