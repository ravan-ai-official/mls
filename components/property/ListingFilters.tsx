"use client";

import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import {
  Field,
  Input,
  NumericInput,
  Select,
  ChipToggle,
} from "@/components/ui/Field";
import { usePendingNavigation, usePendingSearchParams } from "@/components/navigation/PendingNavigation";
import { AiSearchBox } from "@/components/search/AiSearchBox";
import {
  FilterChipMenu,
  FilterChipOption,
  FilterMenuPanel,
} from "@/components/search/FilterChipMenu";
import { PriceRangeChip } from "@/components/search/PriceRangeChip";
import { SaveSearchButton } from "@/components/search/SaveSearchButton";
import { Modal } from "@/components/ui/Modal";
import { SideSheet } from "@/components/ui/SideSheet";
import { Tabs } from "@/components/ui/Tabs";
import { getPropertyFacets } from "@/lib/api/properties";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { cn } from "@/lib/utils/cn";
import { listingQueryFromSearch } from "@/lib/queries/properties";
import { backendStatusGroup } from "@/lib/utils/status";
import {
  BASEMENT_OPTIONS,
  BUILDING_OPTIONS,
  FLOOR_OPTIONS,
  GARAGE_OPTIONS,
  KEYWORD_OPTIONS,
  OWNERSHIP_OPTIONS,
  PROPERTY_AGE_OPTIONS,
  matchKeywordOption,
  matchPropertyAgePreset,
  propertyAgeToYears,
  type PropertyAgeId,
} from "@/lib/search/listingFilterOptions";
import {
  DEFAULT_FILTER_SCHEMA,
  TRANSACTION_OPTIONS,
  isPriceAllowed,
  isSheetFieldVisible,
  priceOptionsForTransaction,
  type FilterSchema,
} from "@/lib/search/filterSchema";
import {
  SEARCH_PROPERTY_TYPES,
  LISTING_SORTS,
  RELEVANCE_SORT,
  type ListingTransaction,
} from "@/lib/types/domain";
import { formatNumber, formatPrice } from "@/lib/utils/format";
import { formatPostal, looksLikePostal, parsePostalList } from "@/lib/utils/postal";
import { matchKnownCity } from "@/lib/constants/cities";
import { rememberLastSearch } from "@/lib/personalize/lastSearch";
import { rememberPlace } from "@/lib/personalize/places";
import {
  buildListingQueryString,
  parseListingSearch,
} from "@/lib/utils/searchParams";
import { STATUS_TABS } from "@/lib/utils/status";

/** Promote legacy URL keys to the MLS contract names, then drop the aliases. */
function canonicalizeListingParams(params: URLSearchParams): URLSearchParams {
  const query = parseListingSearch(params);
  const page = params.get("page");
  const next = new URLSearchParams(buildListingQueryString({
    ...query,
    page: page && Number(page) > 1 ? Number(page) : undefined,
  }));
  return next;
}

/** Draft field → canonical URL key (MLS filter contract). Bar owns price/beds/baths. */
const PANEL_FIELDS = [
  { draft: "city", url: "city" },
  { draft: "postal", url: "postal_code" },
  { draft: "sqftMin", url: "sqft_min" },
  { draft: "sqftMax", url: "sqft_max" },
  { draft: "garages", url: "garages_min" },
  { draft: "floors", url: "stories_min" },
  { draft: "basement", url: "basement" },
  { draft: "yearBuiltMin", url: "year_built_min" },
  { draft: "yearBuiltMax", url: "year_built_max" },
  { draft: "floorsMax", url: "stories_max" },
  { draft: "feeMin", url: "maintenance_fee_min" },
  { draft: "feeMax", url: "maintenance_fee_max" },
  { draft: "listedSince", url: "listed_since" },
  { draft: "building", url: "structure_type" },
  { draft: "ownership", url: "common_interest" },
  { draft: "keywords", url: "keywords" },
  { draft: "soldWithinDays", url: "sold_within_days" },
  { draft: "openHouse", url: "has_open_house" },
] as const;

type PanelKey = (typeof PANEL_FIELDS)[number]["draft"];
type DetailDraft = Record<PanelKey, string>;

/** Full panel draft — quick filters + details; applied only on Show homes. */
type Draft = DetailDraft & {
  transaction: ListingTransaction;
  priceMin: string;
  priceMax: string;
  beds: string;
  baths: string;
  homeType: string;
  sort: string;
};

type PanelTab = "filters" | "ai";

/** Canonical (+ a few display-only) keys that count toward the Filters badge. */
const ALL_KEYS = [
  "semantic",
  "search",
  "type",
  "home_type",
  "poly",
  "transaction_type",
  "price_min",
  "price_max",
  "bedrooms",
  "bathrooms",
  "beds_min",
  "baths_min",
  "status",
  ...PANEL_FIELDS.map((field) => field.url),
] as const;
type FilterKey = (typeof ALL_KEYS)[number];

const EMPTY_DETAILS: DetailDraft = {
  city: "",
  postal: "",
  sqftMin: "",
  sqftMax: "",
  garages: "",
  floors: "",
  basement: "",
  yearBuiltMin: "",
  yearBuiltMax: "",
  floorsMax: "",
  feeMin: "",
  feeMax: "",
  listedSince: "",
  building: "",
  ownership: "",
  keywords: "",
  soldWithinDays: "",
  openHouse: "",
};

function emptyDraft(transaction: ListingTransaction = "sale"): Draft {
  return {
    ...EMPTY_DETAILS,
    transaction,
    priceMin: "",
    priceMax: "",
    beds: "",
    baths: "",
    homeType: "",
    sort: "newest",
  };
}

/** Build URL params from a sheet draft so we can preview facet counts live. */
function draftToSearchParams(draft: Draft, current: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  const setOrDelete = (key: string, value: string | null | undefined) => {
    if (value === null || value === undefined || value === "") next.delete(key);
    else next.set(key, value);
  };

  setOrDelete("transaction_type", draft.transaction === "sale" ? null : draft.transaction);
  setOrDelete("status", draft.transaction === "sold" ? "Sold" : null);
  setOrDelete("price_min", draft.priceMin || null);
  setOrDelete("price_max", draft.priceMax || null);
  setOrDelete("bedrooms", draft.beds || null);
  setOrDelete("beds_min", draft.beds || null);
  setOrDelete("bathrooms", draft.baths || null);
  setOrDelete("baths_min", draft.baths || null);
  setOrDelete("type", draft.homeType || null);
  next.delete("home_type");
  setOrDelete("sort", draft.sort || null);
  setOrDelete("city", draft.city.trim() || null);
  setOrDelete("postal_code", parsePostalList(draft.postal).codes.join(",") || null);
  setOrDelete("sqft_min", draft.sqftMin || null);
  setOrDelete("sqft_max", draft.sqftMax || null);
  setOrDelete("garages_min", draft.garages || null);
  setOrDelete("stories_min", draft.floors || null);
  setOrDelete("basement", draft.basement || null);
  setOrDelete("year_built_min", draft.yearBuiltMin || null);
  setOrDelete("year_built_max", draft.yearBuiltMax || null);
  setOrDelete("stories_max", draft.floorsMax || null);
  setOrDelete("maintenance_fee_min", draft.feeMin || null);
  setOrDelete("maintenance_fee_max", draft.feeMax || null);
  setOrDelete(
    "listed_since",
    draft.transaction === "sold" ? null : draft.listedSince || null,
  );
  setOrDelete("structure_type", draft.building || null);
  setOrDelete("common_interest", draft.ownership || null);
  setOrDelete(
    "keywords",
    draft.keywords
      .split(",")
      .map((word) => word.trim())
      .filter(Boolean)
      .join(",") || null,
  );
  setOrDelete(
    "sold_within_days",
    draft.transaction === "sold" ? draft.soldWithinDays || null : null,
  );
  setOrDelete(
    "has_open_house",
    draft.transaction === "sold" ? null : draft.openHouse || null,
  );
  next.delete("page");
  return canonicalizeListingParams(next);
}

function paramGet(params: URLSearchParams, ...keys: string[]): string {
  for (const key of keys) {
    const value = params.get(key);
    if (value) return value;
  }
  return "";
}

function postalDraft(raw: string | null): string {
  return parsePostalList(raw ?? "").codes.map(formatPostal).join(", ");
}

function resolveHomeTypeFromParams(params: URLSearchParams): string {
  if (params.get("type") === "Rental") return "";
  const homeTypeRaw = paramGet(params, "home_type");
  const homeTypeUi = homeTypeRaw
    ? SEARCH_PROPERTY_TYPES.find(
        (type) =>
          type.toLowerCase() === homeTypeRaw.toLowerCase() ||
          ({
            Detached: "detached",
            "Semi-Detached": "semi",
            Townhome: "townhouse",
            Condo: "condo",
            Luxury: "",
          }[type] === homeTypeRaw.toLowerCase()),
      ) ?? homeTypeRaw
    : "";
  return paramGet(params, "type") || homeTypeUi || "";
}

function draftFromParams(params: URLSearchParams): Draft {
  const openHouse = paramGet(params, "has_open_house", "openHouse");
  const transaction = parseTransactionParam(params);
  const hasSemantic = Boolean(paramGet(params, "semantic", "ai"));
  return {
    city: paramGet(params, "city"),
    postal: postalDraft(paramGet(params, "postal_code", "postal")),
    sqftMin: paramGet(params, "sqft_min", "sqftMin"),
    sqftMax: paramGet(params, "sqft_max", "sqftMax"),
    garages: paramGet(params, "garages_min", "garages"),
    floors: paramGet(params, "stories_min", "floors"),
    basement: paramGet(params, "basement"),
    yearBuiltMin: paramGet(params, "year_built_min", "yearBuiltMin"),
    yearBuiltMax: paramGet(params, "year_built_max", "yearBuiltMax"),
    floorsMax: paramGet(params, "stories_max", "floorsMax"),
    feeMin: paramGet(params, "maintenance_fee_min", "feeMin"),
    feeMax: paramGet(params, "maintenance_fee_max", "feeMax"),
    listedSince: paramGet(params, "listed_since", "listedSince"),
    building: paramGet(params, "structure_type", "building"),
    ownership: paramGet(params, "common_interest", "ownership"),
    keywords: paramGet(params, "keywords"),
    soldWithinDays: paramGet(params, "sold_within_days", "soldWithinDays"),
    openHouse: openHouse === "1" || openHouse === "true" ? "1" : "",
    transaction,
    priceMin: paramGet(params, "price_min", "priceMin"),
    priceMax: paramGet(params, "price_max", "priceMax"),
    beds: paramGet(params, "bedrooms", "beds_min", "beds"),
    baths: paramGet(params, "bathrooms", "baths_min", "baths"),
    homeType: resolveHomeTypeFromParams(params),
    sort: params.get("sort") ?? (hasSemantic ? RELEVANCE_SORT.value : "newest"),
  };
}

function parseTransactionParam(params: URLSearchParams): ListingTransaction {
  const raw = paramGet(params, "transaction_type", "tx").toLowerCase();
  if (raw === "rent" || params.get("type") === "Rental") return "rent";
  if (raw === "sold") return "sold";
  return "sale";
}

function sameDraft(a: Draft, b: Draft) {
  return (
    a.transaction === b.transaction &&
    a.priceMin === b.priceMin &&
    a.priceMax === b.priceMax &&
    a.beds === b.beds &&
    a.baths === b.baths &&
    a.homeType === b.homeType &&
    a.sort === b.sort &&
    PANEL_FIELDS.every((field) => a[field.draft] === b[field.draft])
  );
}

/**
 * Listings chrome: live search bar + Filters panel (dialog on md+, sheet on phone).
 * Panel edits are draft-only until Show homes; bar dropdowns update the URL live.
 */
export function ListingFilters({
  resultCount,
  schema = DEFAULT_FILTER_SCHEMA,
}: {
  resultCount: number;
  schema?: FilterSchema;
}) {
  const { navigate } = usePendingNavigation();
  const params = usePendingSearchParams();

  const urlQuery = paramGet(params, "search", "q");
  const [search, setSearch] = useState(urlQuery);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>("filters");
  const [draft, setDraft] = useState<Draft>(() => draftFromParams(params));
  const [postalError, setPostalError] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search, 400);
  const debouncedDraft = useDebouncedValue(draft, 350);

  const paramKey = params.toString();
  const [lastParamKey, setLastParamKey] = useState(paramKey);
  if (paramKey !== lastParamKey) {
    setLastParamKey(paramKey);
    setSearch(urlQuery);
    if (!sheetOpen) setDraft(draftFromParams(params));
    setPostalError(null);
  }

  const baseline = draftFromParams(params);
  const dirty = !sameDraft(draft, baseline);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDraft(draftFromParams(params));
      setPanelTab("filters");
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sheetOpen, params]);

  const update = (changes: Record<string, string | null>) => {
    const staged = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") staged.delete(key);
      else staged.set(key, value);
    }
    staged.delete("page");
    const next = canonicalizeListingParams(staged);
    rememberLastSearch(parseListingSearch(next));
    navigate(`/listings?${next.toString()}`);
  };

  // Live search: apply after pause (skip while the sheet owns focus).
  useEffect(() => {
    if (sheetOpen) return;
    if (debouncedSearch === urlQuery) return;
    const term = debouncedSearch.trim();
    if (term && looksLikePostal(term)) {
      const codes = parsePostalList(
        `${paramGet(params, "postal_code", "postal")},${term}`,
      ).codes;
      update({ postal_code: codes.join(","), search: null, keywords: null });
      return;
    }
    const city = matchKnownCity(term);
    if (city) {
      rememberPlace(city);
      update({ city, search: null, keywords: null });
      return;
    }
    const keyword = matchKeywordOption(term);
    if (keyword) {
      update({ keywords: keyword.value, search: null });
      return;
    }
    update({ search: term || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settle on debounced term only
  }, [debouncedSearch, sheetOpen, urlQuery]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const term = search.trim();
    if (term && looksLikePostal(term)) {
      const codes = parsePostalList(
        `${paramGet(params, "postal_code", "postal")},${term}`,
      ).codes;
      update({ postal_code: codes.join(","), search: null, keywords: null });
      return;
    }
    const city = matchKnownCity(term);
    if (city) {
      rememberPlace(city);
      update({ city, search: null, keywords: null });
      return;
    }
    const keyword = matchKeywordOption(term);
    if (keyword) {
      update({ keywords: keyword.value, search: null });
      return;
    }
    update({ search: term || null });
  };

  const openSheet = () => {
    setDraft(draftFromParams(params));
    setPanelTab("filters");
    setPostalError(null);
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setDraft(draftFromParams(params));
    setPanelTab("filters");
    setPostalError(null);
    setSheetOpen(false);
  };

  const setDraftTransaction = (next: ListingTransaction) => {
    setDraft((current) => {
      if (current.transaction === next) return current;
      const keepMin = isPriceAllowed(
        schema,
        next,
        current.priceMin ? Number(current.priceMin) : undefined,
      );
      const keepMax = isPriceAllowed(
        schema,
        next,
        current.priceMax ? Number(current.priceMax) : undefined,
      );
      return {
        ...current,
        transaction: next,
        priceMin: keepMin ? current.priceMin : "",
        priceMax: keepMax ? current.priceMax : "",
        openHouse: next === "sold" ? "" : current.openHouse,
        soldWithinDays: next === "sold" ? current.soldWithinDays : "",
        listedSince: next === "sold" ? "" : current.listedSince,
      };
    });
  };

  const applySheet = () => {
    const postal = parsePostalList(draft.postal);
    if (postal.invalid.length > 0) {
      setPostalError(
        `Not a valid postal code: ${postal.invalid.join(", ")}. Use L7A or L7A 3K9.`,
      );
      setPanelTab("filters");
      return;
    }
    setPostalError(null);

    let { sqftMin, sqftMax } = draft;
    const sqftLo = Number(sqftMin);
    const sqftHi = Number(sqftMax);
    if (sqftMin && sqftMax && Number.isFinite(sqftLo) && Number.isFinite(sqftHi) && sqftLo > sqftHi) {
      [sqftMin, sqftMax] = [sqftMax, sqftMin];
    }

    let priceMin = draft.priceMin;
    let priceMax = draft.priceMax;
    const priceLo = Number(priceMin);
    const priceHi = Number(priceMax);
    if (
      priceMin &&
      priceMax &&
      Number.isFinite(priceLo) &&
      Number.isFinite(priceHi) &&
      priceLo > priceHi
    ) {
      [priceMin, priceMax] = [priceMax, priceMin];
    }

    const nextCity = draft.city.trim() || null;
    rememberPlace(nextCity);
    update({
      transaction_type: draft.transaction === "sale" ? null : draft.transaction,
      status: draft.transaction === "sold" ? "Sold" : null,
      price_min: priceMin || null,
      price_max: priceMax || null,
      bedrooms: draft.beds || null,
      beds_min: draft.beds || null,
      bathrooms: draft.baths || null,
      baths_min: draft.baths || null,
      type: draft.homeType || null,
      home_type: null,
      sort: draft.sort || null,
      city: nextCity,
      postal_code: postal.codes.join(",") || null,
      sqft_min: sqftMin || null,
      sqft_max: sqftMax || null,
      garages_min: draft.garages || null,
      stories_min: draft.floors || null,
      basement: draft.basement || null,
      year_built_min: draft.yearBuiltMin || null,
      year_built_max: draft.yearBuiltMax || null,
      stories_max: draft.floorsMax || null,
      maintenance_fee_min: draft.feeMin || null,
      maintenance_fee_max: draft.feeMax || null,
      listed_since: draft.transaction === "sold" ? null : draft.listedSince || null,
      structure_type: draft.building || null,
      common_interest: draft.ownership || null,
      keywords:
        draft.keywords
          .split(",")
          .map((word) => word.trim())
          .filter(Boolean)
          .join(",") || null,
      sold_within_days: draft.transaction === "sold" ? draft.soldWithinDays || null : null,
      has_open_house: draft.transaction === "sold" ? null : draft.openHouse || null,
    });
    setSheetOpen(false);
    setPanelTab("filters");
  };

  const legacyRent = params.get("type") === "Rental";
  const transaction = parseTransactionParam(params);
  const isRent = transaction === "rent";
  const draftRent = draft.transaction === "rent";
  /** Tablet / desktop → centered dialog; phones → side sheet. */
  const useDialog = useMediaQuery("(min-width: 768px)");
  const activeType = resolveHomeTypeFromParams(params) || null;
  const appliedAge = matchPropertyAgePreset(
    Number(params.get("year_built_min")) || null,
    Number(params.get("year_built_max")) || null,
  );
  const appliedKeys = ALL_KEYS.filter((key) => {
    if (!params.get(key)) return false;
    if (key === "type" && legacyRent) return false;
    if (key === "type" && params.get("home_type")) return false;
    if (key === "beds_min" && params.get("bedrooms")) return false;
    if (key === "baths_min" && params.get("bathrooms")) return false;
    if (key === "transaction_type" && params.get("transaction_type") === "sale") return false;
    // Age presets may set both bounds — keep a single pill (prefer min).
    if (key === "year_built_max" && appliedAge && params.get("year_built_min")) return false;
    if (key === "status") {
      const status = (params.get("status") ?? "").toLowerCase();
      if (transaction === "sold" && status === "sold") return false;
      if ((transaction === "sale" || transaction === "rent") && status === "active") {
        return false;
      }
    }
    return true;
  });
  const barKeys = new Set([
    "transaction_type",
    "price_min",
    "price_max",
    "bedrooms",
    "bathrooms",
    "beds_min",
    "baths_min",
    "search",
    "sort",
  ]);
  const sheetFilterCount = appliedKeys.filter((key) => !barKeys.has(key)).length;
  /** Phones hide the chip rail — badge counts every active filter except free-text search. */
  const mobileFilterCount = appliedKeys.filter((key) => key !== "search").length;

  const priceMin = paramGet(params, "price_min", "priceMin");
  const priceMax = paramGet(params, "price_max", "priceMax");
  const beds = paramGet(params, "bedrooms", "beds_min", "beds");
  const baths = paramGet(params, "bathrooms", "baths_min", "baths");
  const priceOptions = priceOptionsForTransaction(schema, transaction);
  const draftPriceOptions = priceOptionsForTransaction(schema, draft.transaction);
  const bedOptions = schema.option_sets.bedrooms;
  const bathOptions = schema.option_sets.bathrooms;
  const hasSemantic = Boolean(paramGet(params, "semantic", "ai"));
  const sortOptions = hasSemantic ? [RELEVANCE_SORT, ...LISTING_SORTS] : LISTING_SORTS;
  const draftSortOptions =
    hasSemantic || draft.sort === RELEVANCE_SORT.value
      ? [RELEVANCE_SORT, ...LISTING_SORTS]
      : LISTING_SORTS;
  const sortValue =
    params.get("sort") ?? (hasSemantic ? RELEVANCE_SORT.value : "newest");

  const setTransaction = (next: ListingTransaction) => {
    if (next === transaction) return;
    const currentMin = priceMin ? Number(priceMin) : undefined;
    const currentMax = priceMax ? Number(priceMax) : undefined;
    const keepMin = isPriceAllowed(schema, next, currentMin);
    const keepMax = isPriceAllowed(schema, next, currentMax);
    update({
      transaction_type: next === "sale" ? null : next,
      type: legacyRent ? null : activeType,
      home_type: null,
      price_min: keepMin ? priceMin || null : null,
      price_max: keepMax ? priceMax || null : null,
      status: next === "sold" ? "Sold" : null,
      has_open_house: next === "sold" ? null : paramGet(params, "has_open_house") || null,
      sold_within_days: next === "sold" ? paramGet(params, "sold_within_days") || null : null,
      listed_since: next === "sold" ? null : paramGet(params, "listed_since") || null,
    });
  };

  const postalCodes = parsePostalList(paramGet(params, "postal_code", "postal")).codes;
  const removePostal = (code: string) =>
    update({
      postal_code: postalCodes.filter((c) => c !== code).join(",") || null,
    });

  const listingQuery = parseListingSearch(params);
  const resetDraft = () => setDraft(emptyDraft(draft.transaction));

  const draftFacetQuery = useMemo(
    () => listingQueryFromSearch(draftToSearchParams(debouncedDraft, params)),
    [debouncedDraft, params],
  );

  const draftFacetKey = buildListingQueryString(draftFacetQuery);
  const { data: draftFacets, isFetching: draftCountLoading } = useQuery({
    queryKey: ["listings", "facets", "draft", draftFacetKey],
    queryFn: () => getPropertyFacets(draftFacetQuery, { cache: "no-store" }),
    enabled: sheetOpen && panelTab === "filters",
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const liveCount = (() => {
    if (!draftFacets) return resultCount;
    if (draftFacetQuery.openHouse) return draftFacets.openHouse ?? resultCount;
    const group = backendStatusGroup(draftFacetQuery.status);
    if (group) return draftFacets.statusGroup?.[group] ?? resultCount;
    return draftFacets.statusGroup?.active ?? resultCount;
  })();

  const filterFooter =
    panelTab === "ai" ? null : (
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="md"
          className="shrink-0"
          onClick={resetDraft}
          disabled={sameDraft(draft, emptyDraft(draft.transaction))}
        >
          Reset
        </Button>
        <Button
          variant="primary"
          size="md"
          className="flex-1"
          onClick={applySheet}
          loading={draftCountLoading && dirty}
        >
          {liveCount > 0
            ? `Show ${liveCount.toLocaleString("en-CA")} ${liveCount === 1 ? "home" : "homes"}`
            : "Show homes"}
        </Button>
      </div>
    );

  const filterBody = (
    <div id="listing-filter-sheet" className="space-y-5">
      <Tabs
        label="Filter panels"
        idBase="listing-filters"
        variant="pill"
        value={panelTab}
        onChange={setPanelTab}
        items={[
          { id: "filters", label: "Filters" },
          { id: "ai", label: "AI Search" },
        ]}
      />

      {panelTab === "ai" ? (
        <div
          role="tabpanel"
          id="listing-filters-panel-ai"
          aria-labelledby="listing-filters-tab-ai"
          className="space-y-3"
        >
          <p className="text-caption text-ink-muted">
            Describe what you want in plain English — we turn it into filters.
          </p>
          <AiSearchBox variant="panel" current={listingQuery} onSearched={closeSheet} />
        </div>
      ) : (
        <div
          role="tabpanel"
          id="listing-filters-panel-filters"
          aria-labelledby="listing-filters-tab-filters"
          className="space-y-6"
        >
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Transaction type" htmlFor="sheet-transaction">
              <Select
                id="sheet-transaction"
                value={draft.transaction}
                onChange={(event) =>
                  setDraftTransaction(event.target.value as ListingTransaction)
                }
              >
                {TRANSACTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Sort by" htmlFor="sheet-sort">
              <Select
                id="sheet-sort"
                value={draft.sort}
                onChange={(event) => setDraft((d) => ({ ...d, sort: event.target.value }))}
              >
                {draftSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <PanelPriceField
              id="sheet-price-min"
              label={draftRent ? "Min rent" : "Min price"}
              placeholder="No min"
              value={draft.priceMin}
              options={draftPriceOptions}
              onChange={(next) => setDraft((d) => ({ ...d, priceMin: next }))}
            />

            <PanelPriceField
              id="sheet-price-max"
              label={draftRent ? "Max rent" : "Max price"}
              placeholder="No max"
              value={draft.priceMax}
              options={draftPriceOptions}
              onChange={(next) => setDraft((d) => ({ ...d, priceMax: next }))}
            />

            <Field label="Bedrooms" htmlFor="sheet-beds">
              <Select
                id="sheet-beds"
                value={draft.beds}
                onChange={(event) => setDraft((d) => ({ ...d, beds: event.target.value }))}
              >
                <option value="">Any</option>
                {bedOptions.map((n) => (
                  <option key={n} value={String(n)}>
                    {n}+
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Bathrooms" htmlFor="sheet-baths">
              <Select
                id="sheet-baths"
                value={draft.baths}
                onChange={(event) => setDraft((d) => ({ ...d, baths: event.target.value }))}
              >
                <option value="">Any</option>
                {bathOptions.map((n) => (
                  <option key={n} value={String(n)}>
                    {n}+
                  </option>
                ))}
              </Select>
            </Field>
          </section>

          <section className="space-y-3 border-t border-line pt-5">
            <h3 className="text-small font-semibold text-ink">Home type</h3>
            <div className="flex flex-wrap gap-2">
              <ChipToggle
                active={!draft.homeType}
                onClick={() => setDraft((d) => ({ ...d, homeType: "" }))}
              >
                All
              </ChipToggle>
              {SEARCH_PROPERTY_TYPES.map((type) => (
                <ChipToggle
                  key={type}
                  active={draft.homeType === type}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      homeType: d.homeType === type ? "" : type,
                    }))
                  }
                >
                  {type}
                </ChipToggle>
              ))}
            </div>
          </section>

          <section className="space-y-4 border-t border-line pt-5">
            <div>
              <h3 className="text-small font-semibold text-ink">More details</h3>
              <p className="mt-1 text-caption text-ink-muted">
                {dirty
                  ? "Edit freely, then tap Show homes."
                  : `${resultCount.toLocaleString("en-CA")} matching ${resultCount === 1 ? "home" : "homes"}`}
              </p>
            </div>
            <FilterFields
              draft={draft}
              setDraft={setDraft}
              transaction={draft.transaction}
              schema={schema}
              postalError={postalError}
              clearPostalError={() => setPostalError(null)}
            />
          </section>
        </div>
      )}
    </div>
  );

  const transactionLabel =
    TRANSACTION_OPTIONS.find((option) => option.value === transaction)?.label ?? "For sale";
  const sortLabel =
    sortOptions.find((option) => option.value === sortValue)?.label ?? "Newest";
  const bedsActive = Boolean(beds);
  const bathsActive = Boolean(baths);
  const defaultSort = hasSemantic ? RELEVANCE_SORT.value : "newest";
  const sortActive = sortValue !== defaultSort;

  return (
    <div className="space-y-3">
      {/* Search + Filters/Save on small screens; facet chips from md up. */}
      <div className="flex items-center gap-2">
        <form
          onSubmit={submitSearch}
          className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-control border border-line bg-surface pl-3.5 pr-1.5 shadow-card transition-colors focus-within:border-navy/35 focus-within:ring-2 focus-within:ring-navy/10 sm:h-13 sm:pl-4 sm:pr-2"
        >
          <SearchGlyph className="shrink-0 text-ink-muted" />
          <label htmlFor="listing-search-input" className="sr-only">
            Search by address, city, postal code, MLS number or keyword
          </label>
          <input
            id="listing-search-input"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Address, city, postal, MLS…"
            className="min-w-0 flex-1 bg-transparent text-small text-ink outline-none placeholder:text-ink-subtle"
            autoComplete="off"
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            aria-label="Search"
            className="h-9 w-9 shrink-0 px-0 sm:h-10 sm:w-auto sm:px-5 sm:text-small"
          >
            <SearchGlyph className="h-5 w-5 sm:hidden" />
            <span className="hidden sm:inline">Search</span>
          </Button>
        </form>

      </div>

      {/* Facet rail — tablet/desktop only; phones use the Filters sheet.
          No overflow-x here: it clips absolute menus on mid-width screens. */}
      <div className="hidden items-start gap-2 md:flex">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <FilterChipMenu
              id="bar-transaction"
              label="Transaction type"
              display={transactionLabel}
              active={transaction !== "sale"}
            >
              {(close) => (
                <FilterMenuPanel title="Transaction">
                  {TRANSACTION_OPTIONS.map((option) => (
                    <FilterChipOption
                      key={option.value}
                      selected={transaction === option.value}
                      onClick={() => {
                        setTransaction(option.value);
                        close();
                      }}
                    >
                      {option.label}
                    </FilterChipOption>
                  ))}
                </FilterMenuPanel>
              )}
            </FilterChipMenu>

            <PriceRangeChip
              id="bar-price"
              isRent={isRent}
              min={priceMin}
              max={priceMax}
              options={priceOptions}
              onChange={({ min, max }) =>
                update({ price_min: min, price_max: max })
              }
            />

            <FilterChipMenu
              id="bar-beds"
              label="Bedrooms"
              display={bedsActive ? `${beds}+ beds` : "Beds"}
              active={bedsActive}
            >
              {(close) => (
                <FilterMenuPanel title="Bedrooms">
                  <FilterChipOption
                    selected={!beds}
                    onClick={() => {
                      update({ bedrooms: null, beds_min: null });
                      close();
                    }}
                  >
                    Any
                  </FilterChipOption>
                  {bedOptions.map((n) => (
                    <FilterChipOption
                      key={n}
                      selected={beds === String(n)}
                      onClick={() => {
                        const value = String(n);
                        update({ bedrooms: value, beds_min: value });
                        close();
                      }}
                    >
                      {n}+ bedrooms
                    </FilterChipOption>
                  ))}
                </FilterMenuPanel>
              )}
            </FilterChipMenu>

            <FilterChipMenu
              id="bar-baths"
              label="Bathrooms"
              display={bathsActive ? `${baths}+ baths` : "Baths"}
              active={bathsActive}
            >
              {(close) => (
                <FilterMenuPanel title="Bathrooms">
                  <FilterChipOption
                    selected={!baths}
                    onClick={() => {
                      update({ bathrooms: null, baths_min: null });
                      close();
                    }}
                  >
                    Any
                  </FilterChipOption>
                  {bathOptions.map((n) => (
                    <FilterChipOption
                      key={n}
                      selected={baths === String(n)}
                      onClick={() => {
                        const value = String(n);
                        update({ bathrooms: value, baths_min: value });
                        close();
                      }}
                    >
                      {n}+ bathrooms
                    </FilterChipOption>
                  ))}
                </FilterMenuPanel>
              )}
            </FilterChipMenu>

            <FilterChipMenu
              id="bar-sort"
              label="Sort listings"
              display={sortLabel}
              active={sortActive}
            >
              {(close) => (
                <FilterMenuPanel title="Sort by">
                  {sortOptions.map((option) => (
                    <FilterChipOption
                      key={option.value}
                      selected={sortValue === option.value}
                      onClick={() => {
                        update({ sort: option.value });
                        close();
                      }}
                    >
                      {option.label}
                    </FilterChipOption>
                  ))}
                </FilterMenuPanel>
              )}
            </FilterChipMenu>

            <button
              type="button"
              aria-label="More filters"
              aria-expanded={sheetOpen}
              aria-controls="listing-filter-sheet"
              onClick={openSheet}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-control border px-3 text-caption font-medium transition-colors sm:h-10 sm:px-3.5 sm:text-small",
                sheetFilterCount > 0
                  ? "border-navy/40 bg-navy-tint text-navy shadow-sm"
                  : "border-line bg-surface text-ink-soft hover:border-navy/40 hover:text-navy",
              )}
            >
              <FilterIcon />
              <span>More</span>
              {sheetFilterCount > 0 && (
                <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-navy px-1 text-[10px] font-semibold text-white">
                  {sheetFilterCount}
                </span>
              )}
            </button>
        </div>

        <SaveSearchButton query={listingQuery} variant="quiet" />
      </div>

      {/* Advanced/applied chips — bar facets already read as active chips above. */}
      {(sheetFilterCount > 0 ||
        postalCodes.length > 0 ||
        appliedKeys.some((key) => !barKeys.has(key))) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption text-ink-muted">Applied:</span>
          {postalCodes.map((code) => (
            <FilterPill
              key={`postal-${code}`}
              label={formatPostal(code)}
              icon={<PinIcon />}
              onRemove={() => removePostal(code)}
            />
          ))}
          {appliedKeys
            .filter((key) => key !== "postal_code" && !barKeys.has(key))
            .map((key) => (
              <FilterPill
                key={key}
                label={pillLabel(key, params)}
                onRemove={() =>
                  update(
                    key === "poly"
                      ? { poly: null, school: null, schoolKm: null }
                      : key === "semantic"
                        ? { semantic: null, sort: null }
                        : key === "type" || key === "home_type"
                          ? { type: null, home_type: null }
                          : key === "year_built_min" && appliedAge
                            ? { year_built_min: null, year_built_max: null }
                            : key === "year_built_max" && appliedAge
                              ? { year_built_min: null, year_built_max: null }
                              : { [key]: null },
                  )
                }
              />
            ))}
          <button
            type="button"
            onClick={() =>
              navigate(
                transaction === "rent"
                  ? "/listings?transaction_type=rent"
                  : transaction === "sold"
                    ? "/listings?transaction_type=sold"
                    : "/listings",
              )
            }
            className="text-caption font-medium text-ink-muted underline underline-offset-2 transition-colors hover:text-ink"
          >
            Clear all
          </button>
        </div>
      )}

      {useDialog ? (
        <Modal
          open={sheetOpen}
          onClose={closeSheet}
          title="Filters"
          description="Adjust your search, then show homes."
          size="lg"
          footer={filterFooter ?? undefined}
        >
          {filterBody}
        </Modal>
      ) : (
        <SideSheet
          open={sheetOpen}
          onClose={closeSheet}
          title="Filters"
          description="Adjust your search, then show homes."
          footer={filterFooter ?? undefined}
        >
          {filterBody}
        </SideSheet>
      )}

      {/* Portal out of sticky/blur so position:fixed binds to the viewport. */}
      {typeof document !== "undefined" &&
        createPortal(
          <div
            className={cn(
              "fixed inset-x-0 z-[110] px-4 md:hidden",
              "bottom-[max(0.75rem,calc(env(safe-area-inset-bottom)+0.5rem+var(--compare-tray-height,0px)))]",
            )}
          >
            <div className="mx-auto flex max-w-lg items-center gap-2 rounded-full border border-line bg-surface p-1.5 shadow-pop">
              <button
                type="button"
                onClick={openSheet}
                className={cn(
                  "relative inline-flex h-11 min-h-11 flex-1 items-center justify-center gap-2 rounded-full text-small font-semibold transition-colors",
                  mobileFilterCount > 0
                    ? "bg-navy text-white"
                    : "bg-navy-tint text-navy hover:bg-navy hover:text-white",
                )}
              >
                <FilterIcon />
                Filters
                {mobileFilterCount > 0 && (
                  <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white/20 px-1 text-[10px]">
                    {mobileFilterCount}
                  </span>
                )}
              </button>
              <SaveSearchButton
                query={listingQuery}
                variant="quiet"
                className="h-11 w-11 min-h-11 border-0 bg-transparent sm:h-11 sm:w-11 sm:px-0 [&>span]:hidden"
              />
              <a
                href={
                  (() => {
                    const mapQuery = new URLSearchParams(params.toString());
                    mapQuery.delete("view");
                    mapQuery.delete("page");
                    const qs = mapQuery.toString();
                    return qs ? `/map-search?${qs}` : "/map-search";
                  })()
                }
                className="inline-flex h-11 w-11 min-h-11 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-alt hover:text-navy"
                aria-label="Map search"
              >
                <MapDockIcon />
              </a>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function MapDockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M2.5 4.5 6.5 2.75l5 2 4-1.75v10l-4 1.75-5-2-4 1.75v-10Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M6.5 2.75v10M11.5 4.75v10" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** Preset select + typed amount — safe inside overflow scroll (no popup menu). */
function PanelPriceField({
  id,
  label,
  placeholder,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  options: FilterSchema["option_sets"]["price_sale"];
  onChange: (next: string) => void;
}) {
  const inOptions = options.some((option) => String(option.value) === value);
  const selectValue = inOptions ? value : value ? "__custom__" : "";

  return (
    <Field label={label} htmlFor={id}>
      <Select
        id={id}
        value={selectValue}
        onChange={(event) => {
          const next = event.target.value;
          if (next === "__custom__") return;
          onChange(next);
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={String(option.value)}>
            {option.label}
          </option>
        ))}
        {value && !inOptions ? (
          <option value="__custom__">Custom ({formatPrice(Number(value))})</option>
        ) : null}
      </Select>
      <NumericInput
        aria-label={`${label} — type amount`}
        min={0}
        max={100_000_000}
        placeholder="Or type amount"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2"
      />
    </Field>
  );
}

function FilterFields({
  draft,
  setDraft,
  transaction,
  schema,
  postalError,
  clearPostalError,
}: {
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  transaction: ListingTransaction;
  schema: FilterSchema;
  postalError: string | null;
  clearPostalError: () => void;
}) {
  const show = (field: Parameters<typeof isSheetFieldVisible>[2]) =>
    isSheetFieldVisible(schema, transaction, field);

  return (
    <div className="grid grid-cols-1 gap-4">
      {show("city") ? (
        <Field label="City" htmlFor="sheet-city">
          <Input
            id="sheet-city"
            placeholder="e.g. Toronto"
            value={draft.city}
            onChange={(event) => setDraft((d) => ({ ...d, city: event.target.value }))}
          />
        </Field>
      ) : null}

      {show("postal_code") ? (
        <Field
          label="Postal code"
          htmlFor="sheet-postal"
          hint="L7A or L7A 3K9 — separate several with commas"
          error={postalError}
        >
          <Input
            id="sheet-postal"
            placeholder="e.g. L7A, L6P 2K1"
            autoCapitalize="characters"
            autoComplete="postal-code"
            value={draft.postal}
            aria-invalid={postalError ? true : undefined}
            aria-describedby={postalError ? "sheet-postal-error" : "sheet-postal-hint"}
            onChange={(event) => {
              clearPostalError();
              setDraft((d) => ({ ...d, postal: event.target.value }));
            }}
          />
        </Field>
      ) : null}

      {show("sqft") ? (
        <fieldset>
          <legend className="text-small font-medium text-ink">Size (sq ft)</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-3">
            <NumericInput
              aria-label="Minimum square feet"
              min={0}
              max={100000}
              placeholder="No min"
              value={draft.sqftMin}
              onChange={(event) => setDraft((d) => ({ ...d, sqftMin: event.target.value }))}
            />
            <NumericInput
              aria-label="Maximum square feet"
              min={0}
              max={100000}
              placeholder="No max"
              value={draft.sqftMax}
              onChange={(event) => setDraft((d) => ({ ...d, sqftMax: event.target.value }))}
            />
          </div>
        </fieldset>
      ) : null}

      {show("garages") ? (
        <ChipField
          label="Garages"
          value={draft.garages}
          options={GARAGE_OPTIONS}
          suffix="+"
          onChange={(garages) => setDraft((d) => ({ ...d, garages }))}
        />
      ) : null}

      {show("storeys") ? (
        <ChipField
          label="Floors"
          value={draft.floors}
          options={FLOOR_OPTIONS}
          suffix="+"
          onChange={(floors) => setDraft((d) => ({ ...d, floors }))}
        />
      ) : null}

      {show("basement") ? (
        <div className="space-y-1.5">
          <span className="block text-small font-medium text-ink">Basement</span>
          <div className="flex flex-wrap gap-2">
            {BASEMENT_OPTIONS.map((option) => (
              <ChipToggle
                key={option.value || "any"}
                active={draft.basement === option.value}
                onClick={() => setDraft((d) => ({ ...d, basement: option.value }))}
              >
                {option.label}
              </ChipToggle>
            ))}
          </div>
        </div>
      ) : null}

      {show("year_built") ? (
        <YearBuiltFields
          yearBuiltMin={draft.yearBuiltMin}
          yearBuiltMax={draft.yearBuiltMax}
          onAgeChange={(age) => {
            const years = propertyAgeToYears(age);
            setDraft((d) => ({
              ...d,
              yearBuiltMin: years.min != null ? String(years.min) : "",
              yearBuiltMax: years.max != null ? String(years.max) : "",
            }));
          }}
          onYearMaxChange={(yearBuiltMax) =>
            setDraft((d) => ({
              ...d,
              // Age and “built before” are either/or — a typed year clears the age range.
              yearBuiltMin: "",
              yearBuiltMax,
            }))
          }
        />
      ) : null}

      {show("storeys") ? (
        <ChipField
          label="Most floors"
          value={draft.floorsMax}
          options={FLOOR_OPTIONS}
          onChange={(floorsMax) => setDraft((d) => ({ ...d, floorsMax }))}
        />
      ) : null}

      {show("maintenance") ? (
        <fieldset>
          <legend className="text-small font-medium text-ink">
            {transaction === "rent" ? "Rent extras / fees (monthly)" : "Maintenance fees (monthly)"}
          </legend>
          <div className="mt-1.5 grid grid-cols-2 gap-3">
            <NumericInput
              aria-label="Minimum monthly maintenance fee"
              min={0}
              max={100000}
              placeholder="No min"
              value={draft.feeMin}
              onChange={(event) => setDraft((d) => ({ ...d, feeMin: event.target.value }))}
            />
            <NumericInput
              aria-label="Maximum monthly maintenance fee"
              min={0}
              max={100000}
              placeholder="No max"
              value={draft.feeMax}
              onChange={(event) => setDraft((d) => ({ ...d, feeMax: event.target.value }))}
            />
          </div>
        </fieldset>
      ) : null}

      {show("listed_since") ||
      show("sold_within_days") ||
      show("building_type") ||
      show("ownership") ||
      show("keywords") ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {show("listed_since") ? (
            <Field label="Listed since" htmlFor="sheet-listed-since">
              <Input
                id="sheet-listed-since"
                type="date"
                value={draft.listedSince}
                onChange={(event) => setDraft((d) => ({ ...d, listedSince: event.target.value }))}
              />
            </Field>
          ) : null}

          {show("sold_within_days") ? (
            <Field label="Sold in last" htmlFor="sheet-sold-within">
              <Select
                id="sheet-sold-within"
                value={draft.soldWithinDays}
                onChange={(event) =>
                  setDraft((d) => ({ ...d, soldWithinDays: event.target.value }))
                }
              >
                <option value="">Any time</option>
                {schema.option_sets.sold_within_days.map((days) => (
                  <option key={days} value={String(days)}>
                    {days} days
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          {show("building_type") ? (
            <Field label="Building type" htmlFor="sheet-building">
              <Select
                id="sheet-building"
                value={draft.building}
                onChange={(event) => setDraft((d) => ({ ...d, building: event.target.value }))}
              >
                <option value="">Any</option>
                {BUILDING_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          {show("ownership") ? (
            <Field label="Ownership / title" htmlFor="sheet-ownership">
              <Select
                id="sheet-ownership"
                value={draft.ownership}
                onChange={(event) => setDraft((d) => ({ ...d, ownership: event.target.value }))}
              >
                <option value="">Any</option>
                {OWNERSHIP_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          {show("keywords") ? (
            <Field
              label="Keywords"
              htmlFor="sheet-keywords"
              hint="Matches the listing description. Pick a preset, or clear for any."
            >
              <Select
                id="sheet-keywords"
                value={
                  KEYWORD_OPTIONS.some((option) => option.value === draft.keywords)
                    ? draft.keywords
                    : draft.keywords
                      ? "__custom__"
                      : ""
                }
                onChange={(event) => {
                  const next = event.target.value;
                  if (next === "__custom__") return;
                  setDraft((d) => ({ ...d, keywords: next }));
                }}
              >
                <option value="">Any</option>
                {KEYWORD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                {draft.keywords &&
                !KEYWORD_OPTIONS.some((option) => option.value === draft.keywords) ? (
                  <option value="__custom__">{keywordPillLabel(draft.keywords)}</option>
                ) : null}
              </Select>
            </Field>
          ) : null}
        </div>
      ) : null}

      {show("open_houses") ? (
        <div className="space-y-1.5">
          <span className="block text-small font-medium text-ink">Open house</span>
          <div className="flex flex-wrap gap-2">
            <ChipToggle
              active={draft.openHouse === "1"}
              onClick={() =>
                setDraft((d) => ({ ...d, openHouse: d.openHouse === "1" ? "" : "1" }))
              }
            >
              Has an upcoming open house
            </ChipToggle>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Property age dropdown + optional “built in or before” — mutually exclusive. */
function YearBuiltFields({
  yearBuiltMin,
  yearBuiltMax,
  onAgeChange,
  onYearMaxChange,
  ageId = "sheet-property-age",
  yearId = "sheet-year-max",
}: {
  yearBuiltMin: string;
  yearBuiltMax: string;
  onAgeChange: (age: PropertyAgeId | "") => void;
  onYearMaxChange: (year: string) => void;
  ageId?: string;
  yearId?: string;
}) {
  const min = yearBuiltMin ? Number(yearBuiltMin) : null;
  const max = yearBuiltMax ? Number(yearBuiltMax) : null;
  const age = matchPropertyAgePreset(min, max);
  const ageValue = age?.id ?? "";
  // When an age range owns max, keep the free-form field empty so the UI reads either/or.
  const yearMaxDisplay = age ? "" : yearBuiltMax;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
      <Field label="Property age" htmlFor={ageId}>
        <Select
          id={ageId}
          value={ageValue}
          onChange={(event) => onAgeChange(event.target.value as PropertyAgeId | "")}
        >
          <option value="">Any</option>
          {PROPERTY_AGE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Built in or before"
        htmlFor={yearId}
        hint={
          age
            ? "Clear property age to set a specific year."
            : "Few listings publish a year built."
        }
      >
        <NumericInput
          id={yearId}
          min={1800}
          max={2100}
          placeholder="Any year"
          value={yearMaxDisplay}
          disabled={Boolean(age)}
          onChange={(event) => onYearMaxChange(event.target.value)}
        />
      </Field>
    </div>
  );
}

function ChipField({
  label,
  value,
  options,
  suffix = "",
  onChange,
}: {
  label: string;
  value: string;
  options: readonly number[];
  suffix?: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="block text-small font-medium text-ink">{label}</span>
      <div className="flex flex-wrap gap-2">
        <ChipToggle active={!value} onClick={() => onChange("")}>
          Any
        </ChipToggle>
        {options.map((option) => (
          <ChipToggle
            key={option}
            active={value === String(option)}
            onClick={() => onChange(value === String(option) ? "" : String(option))}
          >
            {option}
            {suffix}
          </ChipToggle>
        ))}
      </div>
    </div>
  );
}

function keywordPillLabel(value: string): string {
  const preset = KEYWORD_OPTIONS.find((option) => option.value === value);
  if (preset) return preset.label;
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 2) return parts.join(", ");
  return `Keywords: ${parts[0]} +${parts.length - 1}`;
}

function pillLabel(key: FilterKey, params: URLSearchParams): string {
  const value = params.get(key) ?? "";
  switch (key) {
    case "semantic":
      return `Like: ${value}`;
    case "search":
      return `"${value}"`;
    case "transaction_type":
      return value === "rent"
        ? "For rent"
        : value === "sold"
          ? "Sold"
          : value === "sale"
            ? "For sale"
            : value;
    case "home_type":
      return value;
    case "bedrooms":
    case "beds_min":
      return `${value}+ beds`;
    case "bathrooms":
    case "baths_min":
      return `${value}+ baths`;
    case "sold_within_days":
      return `Sold in last ${value} days`;
    case "garages_min":
      return `${value}+ garage`;
    case "stories_min":
      return `${value}+ floors`;
    case "basement": {
      const labels: Record<string, string> = {
        yes: "Has basement",
        finished: "Finished basement",
        unfinished: "Unfinished basement",
        apartment: "Basement apartment",
        none: "No basement",
      };
      return labels[value] ?? `Basement: ${value}`;
    }
    case "year_built_min": {
      const age = matchPropertyAgePreset(
        Number(params.get("year_built_min")) || null,
        Number(params.get("year_built_max")) || null,
      );
      if (age) return `Age: ${age.label}`;
      return `Built ${value}+`;
    }
    case "year_built_max": {
      const age = matchPropertyAgePreset(
        Number(params.get("year_built_min")) || null,
        Number(params.get("year_built_max")) || null,
      );
      if (age) return `Age: ${age.label}`;
      return `Built ${value} or earlier`;
    }
    case "stories_max":
      return `Up to ${value} floors`;
    case "maintenance_fee_min":
      return `Fees from ${formatPrice(Number(value))}/mo`;
    case "maintenance_fee_max":
      return `Fees up to ${formatPrice(Number(value))}/mo`;
    case "listed_since":
      return `Listed since ${value}`;
    case "structure_type":
      return `Building: ${value}`;
    case "common_interest":
      return `Ownership: ${value}`;
    case "keywords":
      return keywordPillLabel(value);
    case "sqft_min":
      return `${formatNumber(Number(value))}+ sq ft`;
    case "sqft_max":
      return `Up to ${formatNumber(Number(value))} sq ft`;
    case "status": {
      const tab = STATUS_TABS.find((t) => t.param.toLowerCase() === value.toLowerCase());
      return tab?.label ?? value;
    }
    case "price_min":
      return `Min ${formatPrice(Number(value))}`;
    case "price_max":
      return `Max ${formatPrice(Number(value))}`;
    case "has_open_house":
      return "Open house";
    case "poly": {
      const school = params.get("school")?.trim();
      if (!school) return "Drawn area";
      const km = params.get("schoolKm")?.trim();
      return km ? `Near ${school} (${km} km)` : `Near ${school}`;
    }
    default:
      return value;
  }
}

function SearchGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={cn("h-4 w-4 shrink-0", className)}
    >
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16l-3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6h16M7 12h10M10 18h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="text-ink-muted">
      <path
        d="M9 16.5s5.25-4.5 5.25-9a5.25 5.25 0 1 0-10.5 0c0 4.5 5.25 9 5.25 9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="7.5" r="1.9" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function FilterPill({
  label,
  icon,
  onRemove,
}: {
  label: string;
  icon?: ReactNode;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface py-1 pl-3 pr-1 text-caption text-ink">
      {icon}
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter ${label}`}
        className="flex h-5 w-5 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-surface-alt hover:text-ink"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M18 6 6 18M6 6l12 12"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </span>
  );
}
