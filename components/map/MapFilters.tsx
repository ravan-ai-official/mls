"use client";

import {
  useEffect,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { Button } from "@/components/ui/Button";
import {
  ChipToggle,
  Field,
  Input,
  NumericInput,
  SearchInput,
  Select,
} from "@/components/ui/Field";
import { AiSearchBox } from "@/components/search/AiSearchBox";
import { SaveSearchButton } from "@/components/search/SaveSearchButton";
import { Modal } from "@/components/ui/Modal";
import { SideSheet } from "@/components/ui/SideSheet";
import { Tabs } from "@/components/ui/Tabs";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import {
  DEFAULT_FILTER_SCHEMA,
  TRANSACTION_OPTIONS,
  isPriceAllowed,
  priceOptionsForTransaction,
  type FilterSchema,
} from "@/lib/search/filterSchema";
import {
  LISTING_SORTS,
  RELEVANCE_SORT,
  SEARCH_PROPERTY_TYPES,
  type ListingQuery,
  type ListingSort,
  type ListingTransaction,
} from "@/lib/types/domain";
import {
  PROPERTY_AGE_OPTIONS,
  matchPropertyAgePreset,
  propertyAgeToYears,
  type PropertyAgeId,
} from "@/lib/search/listingFilterOptions";
import { formatPrice } from "@/lib/utils/format";
import { formatPostal, looksLikePostal, parsePostalList } from "@/lib/utils/postal";
import { STATUS_TABS } from "@/lib/utils/status";

/**
 * Map search filters — same panel UX as listings: Filters | AI Search pills,
 * draft-until-Show-homes, dialog on md+, sheet on phone.
 */

const BED_OPTIONS = DEFAULT_FILTER_SCHEMA.option_sets.bedrooms;
const BATH_OPTIONS = DEFAULT_FILTER_SCHEMA.option_sets.bathrooms;
const GARAGE_OPTIONS = [1, 2, 3];
const FLOOR_OPTIONS = [1, 2, 3];
const BASEMENT_OPTIONS: Array<{ value: "" | NonNullable<ListingQuery["basement"]>; label: string }> = [
  { value: "", label: "Any" },
  { value: "yes", label: "Yes" },
  { value: "finished", label: "Finished" },
  { value: "unfinished", label: "Unfinished" },
  { value: "apartment", label: "Apartment / walk-out" },
];

type OnQueryChange = (next: ListingQuery) => void;
type PanelTab = "filters" | "ai";

interface Draft {
  search: string;
  transaction: ListingTransaction;
  priceMin: string;
  priceMax: string;
  city: string;
  postal: string;
  beds: string;
  baths: string;
  homeType: string;
  sort: string;
  sqftMin: string;
  sqftMax: string;
  garages: string;
  floors: string;
  basement: string;
  yearBuiltMin: string;
  yearBuiltMax: string;
  status: string;
  openHouse: boolean;
}

const str = (value: number | undefined) => (value ? String(value) : "");
const num = (value: string) => (value ? Number(value) : undefined);

function postalDraft(codes: string[] | undefined): string {
  return (codes ?? []).map(formatPostal).join(", ");
}

function draftFromQuery(query: ListingQuery): Draft {
  const hasSemantic = Boolean(query.semantic);
  return {
    search: query.search ?? "",
    transaction: query.transaction ?? "sale",
    priceMin: str(query.priceMin),
    priceMax: str(query.priceMax),
    city: query.city ?? "",
    postal: postalDraft(query.postalCodes),
    beds: str(query.bedsMin),
    baths: str(query.bathsMin),
    homeType: query.type ?? "",
    sort: query.sort ?? (hasSemantic ? RELEVANCE_SORT.value : "newest"),
    sqftMin: str(query.sqftMin),
    sqftMax: str(query.sqftMax),
    garages: str(query.garagesMin),
    floors: str(query.storiesMin),
    basement: query.basement ?? "",
    yearBuiltMin: str(query.yearBuiltMin),
    yearBuiltMax: str(query.yearBuiltMax),
    status: query.status ?? "",
    openHouse: Boolean(query.openHouse),
  };
}

function emptyDraft(transaction: ListingTransaction = "sale"): Draft {
  return {
    search: "",
    transaction,
    priceMin: "",
    priceMax: "",
    city: "",
    postal: "",
    beds: "",
    baths: "",
    homeType: "",
    sort: "newest",
    sqftMin: "",
    sqftMax: "",
    garages: "",
    floors: "",
    basement: "",
    yearBuiltMin: "",
    yearBuiltMax: "",
    status: "",
    openHouse: false,
  };
}

function sameDraft(a: Draft, b: Draft) {
  return (Object.keys(a) as Array<keyof Draft>).every((key) => a[key] === b[key]);
}

function orderedRange(lo: string, hi: string): [number | undefined, number | undefined] {
  const min = num(lo);
  const max = num(hi);
  return min !== undefined && max !== undefined && min > max ? [max, min] : [min, max];
}

function countSheetFilters(query: ListingQuery): number {
  return [
    query.search,
    query.semantic,
    query.type,
    query.transaction === "rent" || query.transaction === "sold" ? query.transaction : null,
    query.priceMin,
    query.priceMax,
    query.city,
    ...(query.postalCodes ?? []),
    query.bedsMin,
    query.bathsMin,
    query.sqftMin,
    query.sqftMax,
    query.garagesMin,
    query.storiesMin,
    query.basement,
    query.yearBuiltMin,
    query.yearBuiltMax,
    query.status,
    query.openHouse,
    query.polygon?.length,
  ].filter(Boolean).length;
}

/** Compact Filters control for the map sidebar header — sheet holds the rest. */
export function MapFilters({
  query,
  onChange,
  onOpenChange,
}: {
  query: ListingQuery;
  onChange: OnQueryChange;
  /** Lets the map collapse the listings sheet while filters are open. */
  onOpenChange?: (open: boolean) => void;
}) {
  const schema = DEFAULT_FILTER_SCHEMA;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>("filters");
  const [draft, setDraft] = useState<Draft>(() => draftFromQuery(query));
  const [postalError, setPostalError] = useState<string | null>(null);

  const queryKey = [
    query.search,
    query.transaction,
    query.type,
    query.sort,
    query.semantic,
    query.priceMin,
    query.priceMax,
    query.city,
    query.postalCodes?.join(","),
    query.bedsMin,
    query.bathsMin,
    query.sqftMin,
    query.sqftMax,
    query.garagesMin,
    query.storiesMin,
    query.basement,
    query.yearBuiltMin,
    query.yearBuiltMax,
    query.status,
    query.openHouse,
  ].join("|");
  const [lastQueryKey, setLastQueryKey] = useState(queryKey);
  if (queryKey !== lastQueryKey) {
    setLastQueryKey(queryKey);
    if (!sheetOpen) setDraft(draftFromQuery(query));
    setPostalError(null);
  }

  const useDialog = useMediaQuery("(min-width: 768px)");
  const baseline = draftFromQuery(query);
  const dirty = !sameDraft(draft, baseline);
  const sheetFilterCount = countSheetFilters(query);
  const draftRent = draft.transaction === "rent";
  const draftPriceOptions = priceOptionsForTransaction(schema, draft.transaction);
  const draftSortOptions =
    query.semantic || draft.sort === RELEVANCE_SORT.value
      ? [RELEVANCE_SORT, ...LISTING_SORTS]
      : LISTING_SORTS;

  useEffect(() => {
    if (!sheetOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDraft(draftFromQuery(query));
      setPanelTab("filters");
      setPostalError(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sheetOpen, query]);

  const openSheet = () => {
    setDraft(draftFromQuery(query));
    setPanelTab("filters");
    setPostalError(null);
    setSheetOpen(true);
    onOpenChange?.(true);
  };

  const closeSheet = () => {
    setDraft(draftFromQuery(query));
    setPanelTab("filters");
    setPostalError(null);
    setSheetOpen(false);
    onOpenChange?.(false);
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
        status: next === "sold" ? "Sold" : "Active",
        openHouse: next === "sold" ? false : current.openHouse,
      };
    });
  };

  const applySheet = (event?: FormEvent) => {
    event?.preventDefault();
    const [priceMin, priceMax] = orderedRange(draft.priceMin, draft.priceMax);
    const [sqftMin, sqftMax] = orderedRange(draft.sqftMin, draft.sqftMax);
    const postal = parsePostalList(draft.postal);
    if (postal.invalid.length > 0) {
      setPostalError(
        `Not a valid postal code: ${postal.invalid.join(", ")}. Use L7A or L7A 3K9.`,
      );
      setPanelTab("filters");
      return;
    }

    const term = draft.search.trim();
    let search: string | undefined = term || undefined;
    let postalCodes = postal.codes.length ? postal.codes : undefined;
    if (term && looksLikePostal(term)) {
      const codes = parsePostalList([...(postalCodes ?? []), term].join(",")).codes;
      postalCodes = codes.length ? codes : undefined;
      search = undefined;
    }

    setPostalError(null);
    onChange({
      ...query,
      search,
      transaction: draft.transaction,
      type: draft.homeType || undefined,
      sort: (draft.sort || undefined) as ListingSort | undefined,
      priceMin,
      priceMax,
      city: draft.city.trim() || undefined,
      postalCodes,
      bedsMin: num(draft.beds),
      bathsMin: num(draft.baths),
      sqftMin,
      sqftMax,
      garagesMin: num(draft.garages),
      storiesMin: num(draft.floors),
      basement: (draft.basement || undefined) as ListingQuery["basement"] | undefined,
      yearBuiltMin: num(draft.yearBuiltMin),
      yearBuiltMax: num(draft.yearBuiltMax),
      status:
        draft.transaction === "sold"
          ? "Sold"
          : draft.status || "Active",
      openHouse: draft.transaction === "sold" ? undefined : draft.openHouse || undefined,
      soldWithinDays: draft.transaction === "sold" ? query.soldWithinDays : undefined,
    });
    setSheetOpen(false);
    setPanelTab("filters");
    onOpenChange?.(false);
  };

  const resetDraft = () => setDraft(emptyDraft(draft.transaction));

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
        <Button variant="primary" size="md" className="flex-1" onClick={() => applySheet()}>
          Show homes
        </Button>
      </div>
    );

  const filterBody = (
    <div id="map-filter-sheet" className="space-y-5">
      <Tabs
        label="Filter panels"
        idBase="map-filters"
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
          id="map-filters-panel-ai"
          aria-labelledby="map-filters-tab-ai"
          className="space-y-3"
        >
          <p className="text-caption text-ink-muted">
            Describe what you want in plain English — we turn it into filters.
          </p>
          <AiSearchBox
            variant="panel"
            basePath="/map-search"
            current={query}
            onSearched={closeSheet}
          />
        </div>
      ) : (
        <form
          role="tabpanel"
          id="map-filters-panel-filters"
          aria-labelledby="map-filters-tab-filters"
          className="space-y-6"
          onSubmit={applySheet}
        >
          <section className="space-y-3">
            <div className="space-y-1.5">
              <span className="block text-small font-medium text-ink">Keyword search</span>
              <SearchInput
                label="Search by address, city, postal code or MLS number"
                value={draft.search}
                onValueChange={(value) => setDraft((d) => ({ ...d, search: value }))}
                placeholder="Address, city, postal or MLS…"
              />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Transaction type" htmlFor="map-transaction">
              <Select
                id="map-transaction"
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

            <Field label="Sort by" htmlFor="map-sheet-sort">
              <Select
                id="map-sheet-sort"
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
              id="map-sheet-price-min"
              label={draftRent ? "Min rent" : "Min price"}
              placeholder="No min"
              value={draft.priceMin}
              options={draftPriceOptions}
              onChange={(next) => setDraft((d) => ({ ...d, priceMin: next }))}
            />

            <PanelPriceField
              id="map-sheet-price-max"
              label={draftRent ? "Max rent" : "Max price"}
              placeholder="No max"
              value={draft.priceMax}
              options={draftPriceOptions}
              onChange={(next) => setDraft((d) => ({ ...d, priceMax: next }))}
            />

            <Field label="Bedrooms" htmlFor="map-sheet-beds">
              <Select
                id="map-sheet-beds"
                value={draft.beds}
                onChange={(event) => setDraft((d) => ({ ...d, beds: event.target.value }))}
              >
                <option value="">Any</option>
                {BED_OPTIONS.map((n) => (
                  <option key={n} value={String(n)}>
                    {n}+
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Bathrooms" htmlFor="map-sheet-baths">
              <Select
                id="map-sheet-baths"
                value={draft.baths}
                onChange={(event) => setDraft((d) => ({ ...d, baths: event.target.value }))}
              >
                <option value="">Any</option>
                {BATH_OPTIONS.map((n) => (
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
                  : "City, size, parking, basement and more."}
              </p>
            </div>
            <FilterFields
              draft={draft}
              setDraft={setDraft}
              transaction={draft.transaction}
              postalError={postalError}
              clearPostalError={() => setPostalError(null)}
            />
          </section>
        </form>
      )}
    </div>
  );

  return (
    <>
      <SaveSearchButton
        query={query}
        variant="quiet"
        className="h-10 w-10 shrink-0 sm:h-10 sm:w-10 sm:px-0 [&>span]:hidden"
      />
      <Button
        variant="secondary"
        size="md"
        aria-label={sheetFilterCount > 0 ? `Filters, ${sheetFilterCount} active` : "Filters"}
        aria-expanded={sheetOpen}
        aria-controls="map-filter-sheet"
        onClick={openSheet}
        className="relative h-10 shrink-0 gap-1.5 px-2.5 text-ink sm:px-3"
      >
        <FilterIcon />
        <span className="text-caption font-medium">Filters</span>
        {sheetFilterCount > 0 && (
          <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-navy px-1.5 text-[10px] font-semibold text-white">
            {sheetFilterCount}
          </span>
        )}
      </Button>

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
    </>
  );
}

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
  postalError,
  clearPostalError,
}: {
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  transaction: ListingTransaction;
  postalError: string | null;
  clearPostalError: () => void;
}) {
  const isRent = transaction === "rent";
  const isSold = transaction === "sold";
  const toggle = (key: "garages" | "floors" | "status", value: string) =>
    setDraft((d) => ({ ...d, [key]: d[key] === value ? "" : value }));

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="City" htmlFor="map-sheet-city">
          <Input
            id="map-sheet-city"
            placeholder="e.g. Toronto"
            value={draft.city}
            onChange={(event) => setDraft((d) => ({ ...d, city: event.target.value }))}
          />
        </Field>

        <Field
          label="Postal code"
          htmlFor="map-sheet-postal"
          hint="L7A or L7A 3K9 — separate several with commas"
          error={postalError}
        >
          <Input
            id="map-sheet-postal"
            placeholder="e.g. L7A, L6P 2K1"
            autoCapitalize="characters"
            autoComplete="postal-code"
            value={draft.postal}
            aria-invalid={postalError ? true : undefined}
            onChange={(event) => {
              clearPostalError();
              setDraft((d) => ({ ...d, postal: event.target.value }));
            }}
          />
        </Field>
      </div>

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      </div>

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

      <MapYearBuiltFields draft={draft} setDraft={setDraft} />

      {!isSold ? (
        <div className="space-y-1.5">
          <span className="block text-small font-medium text-ink">Listing status</span>
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.filter((tab) => tab.group !== "sold").map((tab) => (
              <ChipToggle
                key={tab.param}
                active={
                  tab.group === "active"
                    ? !draft.status || draft.status.toLowerCase() === "active"
                    : draft.status.toLowerCase() === tab.param.toLowerCase()
                }
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    status: tab.param,
                  }))
                }
              >
                {statusLabel(tab.param, isRent)}
              </ChipToggle>
            ))}
          </div>
        </div>
      ) : null}

      {!isSold ? (
        <div className="space-y-1.5">
          <span className="block text-small font-medium text-ink">Open house</span>
          <div className="flex flex-wrap gap-2">
            <ChipToggle
              active={draft.openHouse}
              onClick={() => setDraft((d) => ({ ...d, openHouse: !d.openHouse }))}
            >
              Has an upcoming open house
            </ChipToggle>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MapYearBuiltFields({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
}) {
  const min = draft.yearBuiltMin ? Number(draft.yearBuiltMin) : null;
  const max = draft.yearBuiltMax ? Number(draft.yearBuiltMax) : null;
  const age = matchPropertyAgePreset(min, max);
  const ageValue = age?.id ?? "";
  const yearMaxDisplay = age ? "" : draft.yearBuiltMax;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
      <Field label="Property age" htmlFor="map-property-age">
        <Select
          id="map-property-age"
          value={ageValue}
          onChange={(event) => {
            const years = propertyAgeToYears(event.target.value as PropertyAgeId | "");
            setDraft((d) => ({
              ...d,
              yearBuiltMin: years.min != null ? String(years.min) : "",
              yearBuiltMax: years.max != null ? String(years.max) : "",
            }));
          }}
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
        htmlFor="map-year-max"
        hint={
          age
            ? "Clear property age to set a specific year."
            : "Few listings publish a year built."
        }
      >
        <NumericInput
          id="map-year-max"
          min={1800}
          max={2100}
          placeholder="Any year"
          value={yearMaxDisplay}
          disabled={Boolean(age)}
          onChange={(event) =>
            setDraft((d) => ({
              ...d,
              yearBuiltMin: "",
              yearBuiltMax: event.target.value,
            }))
          }
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
  options: number[];
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

function statusLabel(status: string, rent: boolean): string {
  const tab = STATUS_TABS.find((t) => t.param.toLowerCase() === status.toLowerCase());
  if (!tab) return status;
  if (rent && tab.group === "active") return "For Lease";
  if (rent && tab.group === "sold") return "Leased";
  return tab.label;
}

function FilterIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6h16M7 12h10M10 18h4"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
    </svg>
  );
}
