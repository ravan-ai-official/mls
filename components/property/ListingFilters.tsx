"use client";

import {
  useEffect,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { Button } from "@/components/ui/Button";
import {
  Field,
  Input,
  NumericInput,
  Select,
  SearchInput,
  ChipToggle,
} from "@/components/ui/Field";
import { usePendingNavigation, usePendingSearchParams } from "@/components/navigation/PendingNavigation";
import { AiSearchBox } from "@/components/search/AiSearchBox";
import { SaveSearchButton } from "@/components/search/SaveSearchButton";
import { SideSheet } from "@/components/ui/SideSheet";
import {
  BASEMENT_OPTIONS,
  BATH_OPTIONS,
  BED_OPTIONS,
  BUILDING_OPTIONS,
  FLOOR_OPTIONS,
  GARAGE_OPTIONS,
  KEYWORD_OPTIONS,
  OWNERSHIP_OPTIONS,
  YEAR_BUILT_MIN_OPTIONS,
  matchKeywordOption,
} from "@/lib/search/listingFilterOptions";
import { SEARCH_PROPERTY_TYPES, LISTING_SORTS, RELEVANCE_SORT } from "@/lib/types/domain";
import type { ListingQuery } from "@/lib/types/domain";
import { formatNumber, formatPrice } from "@/lib/utils/format";
import { formatPostal, looksLikePostal, parsePostalList } from "@/lib/utils/postal";
import { matchKnownCity } from "@/lib/constants/cities";
import { rememberLastSearch } from "@/lib/personalize/lastSearch";
import { rememberPlace } from "@/lib/personalize/places";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  buildListingQueryString,
  parseListingSearch,
} from "@/lib/utils/searchParams";
import { listingStatusTabs, STATUS_TABS } from "@/lib/utils/status";

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

/** Draft field → canonical URL key (MLS filter contract). */
const PANEL_FIELDS = [
  { draft: "priceMin", url: "price_min" },
  { draft: "priceMax", url: "price_max" },
  { draft: "city", url: "city" },
  { draft: "postal", url: "postal_code" },
  { draft: "beds", url: "beds_min" },
  { draft: "baths", url: "baths_min" },
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
  { draft: "status", url: "status" },
  { draft: "openHouse", url: "has_open_house" },
] as const;

type PanelKey = (typeof PANEL_FIELDS)[number]["draft"];
type Draft = Record<PanelKey, string>;

/** Canonical (+ a few display-only) keys that count toward the Filters badge. */
const ALL_KEYS = [
  "semantic",
  "search",
  "type",
  "home_type",
  "poly",
  "transaction_type",
  ...PANEL_FIELDS.map((field) => field.url),
] as const;
type FilterKey = (typeof ALL_KEYS)[number];

const EMPTY_DRAFT: Draft = {
  priceMin: "",
  priceMax: "",
  city: "",
  postal: "",
  beds: "",
  baths: "",
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
  status: "",
  openHouse: "",
};

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

function draftFromParams(params: URLSearchParams): Draft {
  const openHouse = paramGet(params, "has_open_house", "openHouse");
  return {
    priceMin: paramGet(params, "price_min", "priceMin"),
    priceMax: paramGet(params, "price_max", "priceMax"),
    city: paramGet(params, "city"),
    postal: postalDraft(paramGet(params, "postal_code", "postal")),
    beds: paramGet(params, "beds_min", "beds"),
    baths: paramGet(params, "baths_min", "baths"),
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
    status: paramGet(params, "status", "status_group"),
    openHouse: openHouse === "1" || openHouse === "true" ? "1" : "",
  };
}

function sameDraft(a: Draft, b: Draft) {
  return PANEL_FIELDS.every((field) => a[field.draft] === b[field.draft]);
}

/**
 * Clean listings chrome + right-side filter sheet.
 *
 * On the page itself: keyword search, Buy/Rent, and a Filters button.
 * Everything else (AI search, type, sort, save search, advanced filters) lives
 * in the sheet so the results stay above the fold and the bar stays simple.
 */
export function ListingFilters({ resultCount }: { resultCount: number }) {
  const { navigate } = usePendingNavigation();
  const params = usePendingSearchParams();
  const { user } = useAuth();

  const urlQuery = paramGet(params, "search", "q");
  const [search, setSearch] = useState(urlQuery);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftFromParams(params));
  const [postalError, setPostalError] = useState<string | null>(null);

  const paramKey = params.toString();
  const [lastParamKey, setLastParamKey] = useState(paramKey);
  if (paramKey !== lastParamKey) {
    setLastParamKey(paramKey);
    setSearch(urlQuery);
    setDraft(draftFromParams(params));
    setPostalError(null);
  }

  const dirty = !sameDraft(draft, draftFromParams(params));

  useEffect(() => {
    if (!sheetOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // SideSheet also handles Escape; this keeps the draft in sync if the
      // sheet closes via its own handler first.
      if (event.key !== "Escape") return;
      setDraft(draftFromParams(params));
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
    // A known city belongs on `city=` (city_match_q) so tab counts and results
    // stay aligned — free-text search used to fall back to the whole catalogue.
    const city = matchKnownCity(term);
    if (city) {
      rememberPlace(city);
      update({ city, search: null, keywords: null });
      return;
    }
    // Amenity / deal phrases belong on description `keywords`, not address search.
    const keyword = matchKeywordOption(term);
    if (keyword) {
      update({ keywords: keyword.value, search: null });
      return;
    }
    update({ search: term || null });
  };

  const openSheet = () => {
    setDraft(draftFromParams(params));
    setPostalError(null);
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setDraft(draftFromParams(params));
    setPostalError(null);
    setSheetOpen(false);
  };

  const applySheet = () => {
    let { priceMin, priceMax } = draft;
    const lo = Number(priceMin);
    const hi = Number(priceMax);
    if (priceMin && priceMax && Number.isFinite(lo) && Number.isFinite(hi) && lo > hi) {
      [priceMin, priceMax] = [priceMax, priceMin];
    }

    const postal = parsePostalList(draft.postal);
    if (postal.invalid.length > 0) {
      setPostalError(
        `Not a valid postal code: ${postal.invalid.join(", ")}. Use L7A or L7A 3K9.`,
      );
      return;
    }
    setPostalError(null);

    let { sqftMin, sqftMax } = draft;
    const sqftLo = Number(sqftMin);
    const sqftHi = Number(sqftMax);
    if (sqftMin && sqftMax && Number.isFinite(sqftLo) && Number.isFinite(sqftHi) && sqftLo > sqftHi) {
      [sqftMin, sqftMax] = [sqftMax, sqftMin];
    }

    const nextCity = draft.city.trim() || null;
    rememberPlace(nextCity);
    update({
      price_min: priceMin || null,
      price_max: priceMax || null,
      city: nextCity,
      postal_code: postal.codes.join(",") || null,
      beds_min: draft.beds || null,
      baths_min: draft.baths || null,
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
      listed_since: draft.listedSince || null,
      structure_type: draft.building || null,
      common_interest: draft.ownership || null,
      keywords: draft.keywords.split(",").map((word) => word.trim()).filter(Boolean).join(",") || null,
      status: draft.status || null,
      has_open_house: draft.openHouse || null,
    });
    setSheetOpen(false);
  };

  const legacyRent = params.get("type") === "Rental";
  const isRent =
    paramGet(params, "transaction_type", "tx") === "rent" || legacyRent;
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
    : null;
  const activeType = legacyRent
    ? null
    : paramGet(params, "type") || homeTypeUi || null;
  const appliedKeys = ALL_KEYS.filter((key) => {
    if (!params.get(key)) return false;
    if (key === "type" && legacyRent) return false;
    // Prefer `home_type` when both are present after a partial migration.
    if (key === "type" && params.get("home_type")) return false;
    return true;
  });
  // Badge counts sheet-owned filters (not the free-text search already on the bar).
  const sheetFilterCount = appliedKeys.filter((key) => key !== "search").length;

  const setRent = (rent: boolean) => {
    if (rent === isRent) return;
    update({
      transaction_type: rent ? "rent" : null,
      type: legacyRent ? null : activeType,
      home_type: null,
      price_min: null,
      price_max: null,
    });
  };

  const postalCodes = parsePostalList(paramGet(params, "postal_code", "postal")).codes;
  const removePostal = (code: string) =>
    update({
      postal_code: postalCodes.filter((c) => c !== code).join(",") || null,
    });

  const listingQuery = parseListingSearch(params);

  return (
    <div className="space-y-3">
      {/* Simple bar: search + Buy/Rent + Filters. */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <form
          onSubmit={submitSearch}
          className="flex min-w-0 flex-[1_1_100%] items-center gap-2 sm:min-w-[280px] sm:flex-[1_1_auto]"
        >
          <SearchInput
            label="Search by address, city, postal code, MLS number or keyword"
            value={search}
            onValueChange={setSearch}
            placeholder="Address, city, postal, MLS or keyword…"
            className="min-w-0 flex-1"
          />
          <Button type="submit" variant="primary" size="md" className="shrink-0">
            Search
          </Button>
        </form>

        <div role="group" aria-label="Buy or rent" className="flex shrink-0 gap-2">
          <ChipToggle active={!isRent} onClick={() => setRent(false)}>
            Buy
          </ChipToggle>
          <ChipToggle active={isRent} onClick={() => setRent(true)}>
            Rent
          </ChipToggle>
        </div>

        <Button
          variant="secondary"
          size="md"
          aria-expanded={sheetOpen}
          aria-controls="listing-filter-sheet"
          onClick={openSheet}
          className="shrink-0"
        >
          <FilterIcon />
          <span className="ml-1.5">Filters</span>
          {sheetFilterCount > 0 && (
            <span className="ml-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-navy px-1.5 text-[11px] font-semibold text-white">
              {sheetFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Applied filters stay visible so the sheet isn't the only place to see them. */}
      {appliedKeys.length > 0 && (
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
            .filter((key) => key !== "postal_code")
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
                          : { [key]: null },
                  )
                }
              />
            ))}
          <button
            type="button"
            onClick={() =>
              navigate(isRent ? "/listings?transaction_type=rent" : "/listings")
            }
            className="text-caption font-medium text-ink-muted underline underline-offset-2 transition-colors hover:text-ink"
          >
            Clear all
          </button>
        </div>
      )}

      <SideSheet
        open={sheetOpen}
        onClose={closeSheet}
        title="Filters & tools"
        description="AI search, home type, sort and detailed filters."
        footer={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="md"
              className="shrink-0"
              onClick={() => setDraft(EMPTY_DRAFT)}
              disabled={sameDraft(draft, EMPTY_DRAFT)}
            >
              Reset
            </Button>
            <Button variant="secondary" size="md" className="flex-1" onClick={closeSheet}>
              Cancel
            </Button>
            <Button variant="primary" size="md" className="flex-1" onClick={applySheet}>
              {dirty ? "Show homes" : "Done"}
            </Button>
          </div>
        }
      >
        <div id="listing-filter-sheet" className="space-y-8">
          <section className="space-y-3">
            <AiSearchBox
              variant="panel"
              current={listingQuery}
              onSearched={closeSheet}
            />
          </section>

          <section className="space-y-3 border-t border-line pt-6">
            <h3 className="text-small font-semibold text-ink">Home type</h3>
            <div className="flex flex-wrap gap-2">
              <ChipToggle
                active={!activeType}
                onClick={() => update({ type: null, home_type: null })}
              >
                All
              </ChipToggle>
              {SEARCH_PROPERTY_TYPES.map((type) => (
                <ChipToggle
                  key={type}
                  active={activeType === type}
                  onClick={() =>
                    update({
                      type: activeType === type ? null : type,
                      home_type: null,
                    })
                  }
                >
                  {type}
                </ChipToggle>
              ))}
            </div>
          </section>

          <section className="space-y-3 border-t border-line pt-6">
            <Field label="Sort by" htmlFor="sheet-sort">
              <Select
                id="sheet-sort"
                aria-label="Sort listings"
                value={
                  params.get("sort") ??
                  (paramGet(params, "semantic", "ai") ? RELEVANCE_SORT.value : "newest")
                }
                onChange={(event) => update({ sort: event.target.value })}
              >
                {(paramGet(params, "semantic", "ai")
                  ? [RELEVANCE_SORT, ...LISTING_SORTS]
                  : LISTING_SORTS
                ).map(
                  (option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ),
                )}
              </Select>
            </Field>
            <SaveSearchButton query={listingQuery} className="w-full justify-center" />
          </section>

          <section className="space-y-4 border-t border-line pt-6">
            <div>
              <h3 className="text-small font-semibold text-ink">Details</h3>
              <p className="mt-1 text-caption text-ink-muted">
                {dirty
                  ? "Change as many as you like, then tap Show homes."
                  : `${resultCount.toLocaleString("en-CA")} matching ${resultCount === 1 ? "home" : "homes"}`}
              </p>
            </div>
            <FilterFields
              draft={draft}
              setDraft={setDraft}
              isRent={isRent}
              isStaff={Boolean(user?.isStaff)}
              postalError={postalError}
              clearPostalError={() => setPostalError(null)}
            />
          </section>
        </div>
      </SideSheet>
    </div>
  );
}

function FilterFields({
  draft,
  setDraft,
  isRent,
  isStaff,
  postalError,
  clearPostalError,
}: {
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  isRent: boolean;
  isStaff: boolean;
  postalError: string | null;
  clearPostalError: () => void;
}) {
  const statusTabs = listingStatusTabs(isStaff);
  return (
    <div className="grid grid-cols-1 gap-4">
      <Field label={isRent ? "Min rent / month" : "Min price"} htmlFor="sheet-price-min">
        <NumericInput
          id="sheet-price-min"
          min={0}
          max={100000000}
          placeholder="No min"
          value={draft.priceMin}
          onChange={(event) => setDraft((d) => ({ ...d, priceMin: event.target.value }))}
        />
      </Field>

      <Field label={isRent ? "Max rent / month" : "Max price"} htmlFor="sheet-price-max">
        <NumericInput
          id="sheet-price-max"
          min={0}
          max={100000000}
          placeholder="No max"
          value={draft.priceMax}
          onChange={(event) => setDraft((d) => ({ ...d, priceMax: event.target.value }))}
        />
      </Field>

      <Field label="City" htmlFor="sheet-city">
        <Input
          id="sheet-city"
          placeholder="e.g. Toronto"
          value={draft.city}
          onChange={(event) => setDraft((d) => ({ ...d, city: event.target.value }))}
        />
      </Field>

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

      <ChipField
        label="Bedrooms"
        value={draft.beds}
        options={BED_OPTIONS}
        suffix="+"
        onChange={(beds) => setDraft((d) => ({ ...d, beds }))}
      />

      <ChipField
        label="Bathrooms"
        value={draft.baths}
        options={BATH_OPTIONS}
        suffix="+"
        onChange={(baths) => setDraft((d) => ({ ...d, baths }))}
      />

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

      <ChipField
        label="Garages"
        value={draft.garages}
        options={GARAGE_OPTIONS}
        suffix="+"
        onChange={(garages) => setDraft((d) => ({ ...d, garages }))}
      />

      <ChipField
        label="Floors"
        value={draft.floors}
        options={FLOOR_OPTIONS}
        suffix="+"
        onChange={(floors) => setDraft((d) => ({ ...d, floors }))}
      />

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

      <div className="space-y-1.5">
        <span className="block text-small font-medium text-ink">Property age</span>
        <div className="flex flex-wrap gap-2">
          <ChipToggle
            active={!draft.yearBuiltMin}
            onClick={() => setDraft((d) => ({ ...d, yearBuiltMin: "" }))}
          >
            Any
          </ChipToggle>
          {YEAR_BUILT_MIN_OPTIONS.map((year) => (
            <ChipToggle
              key={year}
              active={draft.yearBuiltMin === String(year)}
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  yearBuiltMin: d.yearBuiltMin === String(year) ? "" : String(year),
                }))
              }
            >
              {year}+
            </ChipToggle>
          ))}
        </div>
      </div>

      <Field label="Built in or before" htmlFor="sheet-year-max" hint="Few listings publish a year built.">
        <NumericInput
          id="sheet-year-max"
          min={1800}
          max={2100}
          placeholder="Any year"
          value={draft.yearBuiltMax}
          onChange={(event) => setDraft((d) => ({ ...d, yearBuiltMax: event.target.value }))}
        />
      </Field>

      <ChipField
        label="Most floors"
        value={draft.floorsMax}
        options={FLOOR_OPTIONS}
        onChange={(floorsMax) => setDraft((d) => ({ ...d, floorsMax }))}
      />

      <fieldset>
        <legend className="text-small font-medium text-ink">Maintenance fees (monthly)</legend>
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

      <Field label="Listed since" htmlFor="sheet-listed-since">
        <Input
          id="sheet-listed-since"
          type="date"
          value={draft.listedSince}
          onChange={(event) => setDraft((d) => ({ ...d, listedSince: event.target.value }))}
        />
      </Field>

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
          {draft.keywords && !KEYWORD_OPTIONS.some((option) => option.value === draft.keywords) ? (
            <option value="__custom__">{keywordPillLabel(draft.keywords)}</option>
          ) : null}
        </Select>
      </Field>

      <div className="space-y-1.5">
        <span className="block text-small font-medium text-ink">Listing status</span>
        <div className="flex flex-wrap gap-2">
          <ChipToggle
            active={!draft.status}
            onClick={() => setDraft((d) => ({ ...d, status: "" }))}
          >
            All
          </ChipToggle>
          {statusTabs.map((tab) => (
            <ChipToggle
              key={tab.param}
              active={draft.status.toLowerCase() === tab.param.toLowerCase()}
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  status: d.status.toLowerCase() === tab.param.toLowerCase() ? "" : tab.param,
                }))
              }
            >
              {isRent && tab.group === "active"
                ? "For Lease"
                : isRent && tab.group === "sold"
                  ? "Leased"
                  : tab.label}
            </ChipToggle>
          ))}
        </div>
      </div>

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
      return value === "rent" ? "For rent" : value;
    case "home_type":
      return value;
    case "beds_min":
      return `${value}+ beds`;
    case "baths_min":
      return `${value}+ baths`;
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
    case "year_built_min":
      return `Built ${value}+`;
    case "year_built_max":
      return `Built ${value} or earlier`;
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
