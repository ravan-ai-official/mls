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
  ChipToggle,
  Field,
  Input,
  NumericInput,
  SearchInput,
  Select,
} from "@/components/ui/Field";
import { AiSearchBox } from "@/components/search/AiSearchBox";
import { SaveSearchButton } from "@/components/search/SaveSearchButton";
import { SideSheet } from "@/components/ui/SideSheet";
import {
  LISTING_SORTS,
  RELEVANCE_SORT,
  SEARCH_PROPERTY_TYPES,
  type ListingQuery,
  type ListingSort,
} from "@/lib/types/domain";
import { formatNumber, formatPrice } from "@/lib/utils/format";
import { formatPostal, looksLikePostal, parsePostalList } from "@/lib/utils/postal";
import { STATUS_TABS } from "@/lib/utils/status";

/**
 * Map search filters.
 *
 * The sidebar only shows a Filters button so the property list keeps the
 * viewport. Search, Buy/Rent, AI, type, sort, save and every detail filter
 * live in the right-side sheet (full-width on phones).
 */

const BED_OPTIONS = [1, 2, 3, 4, 5];
const BATH_OPTIONS = [1, 2, 3, 4];
const GARAGE_OPTIONS = [1, 2, 3];
const FLOOR_OPTIONS = [1, 2, 3];
const YEAR_OPTIONS = [2020, 2010, 2000, 1990, 1980];
const BASEMENT_OPTIONS: Array<{ value: "" | NonNullable<ListingQuery["basement"]>; label: string }> = [
  { value: "", label: "Any" },
  { value: "yes", label: "Yes" },
  { value: "finished", label: "Finished" },
  { value: "unfinished", label: "Unfinished" },
  { value: "apartment", label: "Apartment / walk-out" },
];

type OnQueryChange = (next: ListingQuery) => void;

interface Draft {
  search: string;
  priceMin: string;
  priceMax: string;
  city: string;
  postal: string;
  beds: string;
  baths: string;
  sqftMin: string;
  sqftMax: string;
  garages: string;
  floors: string;
  basement: string;
  yearBuiltMin: string;
  status: string;
  openHouse: boolean;
}

const EMPTY_DRAFT: Draft = {
  search: "",
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
  status: "",
  openHouse: false,
};

const str = (value: number | undefined) => (value ? String(value) : "");
const num = (value: string) => (value ? Number(value) : undefined);

function postalDraft(codes: string[] | undefined): string {
  return (codes ?? []).map(formatPostal).join(", ");
}

function draftFromQuery(query: ListingQuery): Draft {
  return {
    search: query.search ?? "",
    priceMin: str(query.priceMin),
    priceMax: str(query.priceMax),
    city: query.city ?? "",
    postal: postalDraft(query.postalCodes),
    beds: str(query.bedsMin),
    baths: str(query.bathsMin),
    sqftMin: str(query.sqftMin),
    sqftMax: str(query.sqftMax),
    garages: str(query.garagesMin),
    floors: str(query.storiesMin),
    basement: query.basement ?? "",
    yearBuiltMin: str(query.yearBuiltMin),
    status: query.status ?? "",
    openHouse: Boolean(query.openHouse),
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
    query.transaction === "rent" ? "rent" : null,
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
    query.status,
    query.openHouse,
    query.polygon?.length,
  ].filter(Boolean).length;
}

function clearedQuery(query: ListingQuery): ListingQuery {
  return {
    transaction: query.transaction,
    polygon: query.polygon,
    schoolLabel: query.schoolLabel,
    schoolKm: query.schoolKm,
    sort: query.sort,
  };
}

/** Compact Filters control for the map sidebar header — sheet holds the rest. */
export function MapFilters({
  query,
  onChange,
}: {
  query: ListingQuery;
  onChange: OnQueryChange;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftFromQuery(query));
  const [postalError, setPostalError] = useState<string | null>(null);

  const queryKey = [
    query.search,
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
    query.status,
    query.openHouse,
  ].join("|");
  const [lastQueryKey, setLastQueryKey] = useState(queryKey);
  if (queryKey !== lastQueryKey) {
    setLastQueryKey(queryKey);
    setDraft(draftFromQuery(query));
    setPostalError(null);
  }

  const rent = query.transaction === "rent";
  const dirty = !sameDraft(draft, draftFromQuery(query));
  const sheetFilterCount = countSheetFilters(query);
  const pills = appliedPills(query, onChange);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDraft(draftFromQuery(query));
      setPostalError(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sheetOpen, query]);

  const setRent = (next: boolean) => {
    if (next === rent) return;
    onChange({
      ...query,
      transaction: next ? "rent" : "sale",
      priceMin: undefined,
      priceMax: undefined,
    });
  };

  const openSheet = () => {
    setDraft(draftFromQuery(query));
    setPostalError(null);
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setDraft(draftFromQuery(query));
    setPostalError(null);
    setSheetOpen(false);
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
      status: draft.status || undefined,
      openHouse: draft.openHouse || undefined,
    });
    setSheetOpen(false);
  };

  return (
    <>
      <Button
        variant="secondary"
        size="md"
        aria-expanded={sheetOpen}
        aria-controls="map-filter-sheet"
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

      <SideSheet
        open={sheetOpen}
        onClose={closeSheet}
        title="Search & filters"
        description="Find homes on the map. Apply when you are ready."
        footer={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="md"
              className="shrink-0"
              onClick={() => {
                setDraft(EMPTY_DRAFT);
                onChange(clearedQuery(query));
              }}
            >
              Clear all
            </Button>
            <Button variant="secondary" size="md" className="flex-1" onClick={closeSheet}>
              Cancel
            </Button>
            <Button variant="primary" size="md" className="flex-1" onClick={() => applySheet()}>
              {dirty ? "Show homes" : "Done"}
            </Button>
          </div>
        }
      >
        <form id="map-filter-sheet" className="space-y-8" onSubmit={applySheet}>
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

            <div role="group" aria-label="Buy or rent" className="flex flex-wrap gap-2">
              <ChipToggle active={!rent} onClick={() => setRent(false)}>
                Buy
              </ChipToggle>
              <ChipToggle active={rent} onClick={() => setRent(true)}>
                Rent
              </ChipToggle>
            </div>
          </section>

          {pills.length > 0 && (
            <section className="space-y-2 border-t border-line pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-small font-semibold text-ink">Applied</h3>
                <button
                  type="button"
                  onClick={() => onChange(clearedQuery(query))}
                  className="text-caption font-medium text-ink-muted underline underline-offset-2 transition-colors hover:text-ink"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">{pills}</div>
            </section>
          )}

          <section className="space-y-3 border-t border-line pt-6">
            <AiSearchBox
              variant="panel"
              basePath="/map-search"
              current={query}
              onSearched={closeSheet}
            />
          </section>

          <section className="space-y-3 border-t border-line pt-6">
            <h3 className="text-small font-semibold text-ink">Home type</h3>
            <div className="flex flex-wrap gap-2">
              <ChipToggle
                active={!query.type}
                onClick={() => onChange({ ...query, type: undefined })}
              >
                All
              </ChipToggle>
              {SEARCH_PROPERTY_TYPES.map((type) => (
                <ChipToggle
                  key={type}
                  active={query.type === type}
                  onClick={() =>
                    onChange({ ...query, type: query.type === type ? undefined : type })
                  }
                >
                  {type}
                </ChipToggle>
              ))}
            </div>
          </section>

          <section className="space-y-3 border-t border-line pt-6">
            <Field label="Sort by" htmlFor="map-sheet-sort">
              <Select
                id="map-sheet-sort"
                aria-label="Sort listings"
                value={query.sort ?? (query.semantic ? RELEVANCE_SORT.value : "newest")}
                onChange={(event) =>
                  onChange({ ...query, sort: event.target.value as ListingSort })
                }
              >
                {(query.semantic ? [RELEVANCE_SORT, ...LISTING_SORTS] : LISTING_SORTS).map(
                  (option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ),
                )}
              </Select>
            </Field>
            <SaveSearchButton query={query} className="w-full justify-center" />
          </section>

          <section className="space-y-4 border-t border-line pt-6">
            <div>
              <h3 className="text-small font-semibold text-ink">Details</h3>
              <p className="mt-1 text-caption text-ink-muted">
                {dirty
                  ? "Change as many as you like, then tap Show homes."
                  : "Price, size, parking, basement and more."}
              </p>
            </div>
            <FilterFields
              draft={draft}
              setDraft={setDraft}
              isRent={rent}
              postalError={postalError}
              clearPostalError={() => setPostalError(null)}
            />
          </section>
        </form>
      </SideSheet>
    </>
  );
}

function FilterFields({
  draft,
  setDraft,
  isRent,
  postalError,
  clearPostalError,
}: {
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  isRent: boolean;
  postalError: string | null;
  clearPostalError: () => void;
}) {
  const toggle = (
    key: "beds" | "baths" | "garages" | "floors" | "yearBuiltMin" | "status",
    value: string,
  ) => setDraft((d) => ({ ...d, [key]: d[key] === value ? "" : value }));

  return (
    <div className="grid grid-cols-1 gap-4">
      <Field label={isRent ? "Min rent / month" : "Min price"} htmlFor="map-sheet-price-min">
        <NumericInput
          id="map-sheet-price-min"
          min={0}
          max={100000000}
          placeholder="No min"
          value={draft.priceMin}
          onChange={(event) => setDraft((d) => ({ ...d, priceMin: event.target.value }))}
        />
      </Field>

      <Field label={isRent ? "Max rent / month" : "Max price"} htmlFor="map-sheet-price-max">
        <NumericInput
          id="map-sheet-price-max"
          min={0}
          max={100000000}
          placeholder="No max"
          value={draft.priceMax}
          onChange={(event) => setDraft((d) => ({ ...d, priceMax: event.target.value }))}
        />
      </Field>

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
          {YEAR_OPTIONS.map((year) => (
            <ChipToggle
              key={year}
              active={draft.yearBuiltMin === String(year)}
              onClick={() => toggle("yearBuiltMin", String(year))}
            >
              {year}+
            </ChipToggle>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="block text-small font-medium text-ink">Listing status</span>
        <div className="flex flex-wrap gap-2">
          <ChipToggle active={!draft.status} onClick={() => setDraft((d) => ({ ...d, status: "" }))}>
            All
          </ChipToggle>
          {STATUS_TABS.map((tab) => (
            <ChipToggle
              key={tab.param}
              active={draft.status.toLowerCase() === tab.param.toLowerCase()}
              onClick={() => toggle("status", tab.param)}
            >
              {statusLabel(tab.param, isRent)}
            </ChipToggle>
          ))}
        </div>
      </div>

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

function appliedPills(query: ListingQuery, onChange: OnQueryChange): ReactNode[] {
  const pills: ReactNode[] = [];
  const add = (key: string, label: string, next: Partial<ListingQuery>) =>
    pills.push(
      <FilterPill key={key} label={label} onRemove={() => onChange({ ...query, ...next })} />,
    );
  const rent = query.transaction === "rent";
  const money = (value: number) => (rent ? `${formatPrice(value)}/mo` : formatPrice(value));

  if (query.semantic) {
    add("ai", `Like: ${query.semantic}`, {
      semantic: undefined,
      sort: query.sort === "relevance" ? "newest" : query.sort,
    });
  }
  if (query.search) add("q", `"${query.search}"`, { search: undefined });
  if (rent) add("tx", "For rent", { transaction: "sale", priceMin: undefined, priceMax: undefined });
  if (query.type) add("type", query.type, { type: undefined });
  if (query.city) add("city", query.city, { city: undefined });
  for (const code of query.postalCodes ?? []) {
    const rest = query.postalCodes!.filter((c) => c !== code);
    add(`postal-${code}`, formatPostal(code), { postalCodes: rest.length ? rest : undefined });
  }
  if (query.priceMin && query.priceMax) {
    add("price", `${money(query.priceMin)} – ${money(query.priceMax)}`, {
      priceMin: undefined,
      priceMax: undefined,
    });
  } else if (query.priceMin) {
    add("priceMin", `From ${money(query.priceMin)}`, { priceMin: undefined });
  } else if (query.priceMax) {
    add("priceMax", `Up to ${money(query.priceMax)}`, { priceMax: undefined });
  }
  if (query.bedsMin) add("beds", `${query.bedsMin}+ beds`, { bedsMin: undefined });
  if (query.bathsMin) add("baths", `${query.bathsMin}+ baths`, { bathsMin: undefined });
  if (query.sqftMin || query.sqftMax) {
    const lo = query.sqftMin ? formatNumber(query.sqftMin) : "0";
    const label = query.sqftMax
      ? `${lo} – ${formatNumber(query.sqftMax)} sq ft`
      : `${lo}+ sq ft`;
    add("sqft", label, { sqftMin: undefined, sqftMax: undefined });
  }
  if (query.garagesMin) add("garages", `${query.garagesMin}+ garage`, { garagesMin: undefined });
  if (query.storiesMin) add("floors", `${query.storiesMin}+ floors`, { storiesMin: undefined });
  if (query.basement) {
    const labels: Record<NonNullable<ListingQuery["basement"]>, string> = {
      yes: "Has basement",
      finished: "Finished basement",
      unfinished: "Unfinished basement",
      apartment: "Basement apartment",
      none: "No basement",
    };
    add("basement", labels[query.basement], { basement: undefined });
  }
  if (query.yearBuiltMin) add("year", `Built ${query.yearBuiltMin}+`, { yearBuiltMin: undefined });
  if (query.status) add("status", statusLabel(query.status, rent), { status: undefined });
  if (query.openHouse) add("openHouse", "Open house", { openHouse: undefined });
  if (query.polygon?.length) {
    const km = query.schoolKm ?? 2;
    const label = query.schoolLabel
      ? `Near ${query.schoolLabel} (${km} km)`
      : "Drawn area";
    add("poly", label, {
      polygon: undefined,
      schoolLabel: undefined,
      schoolKm: undefined,
    });
  }
  return pills;
}

function statusLabel(status: string, rent: boolean): string {
  const tab = STATUS_TABS.find((t) => t.param.toLowerCase() === status.toLowerCase());
  if (!tab) return status;
  if (rent && tab.group === "active") return "For Lease";
  if (rent && tab.group === "sold") return "Leased";
  return tab.label;
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface py-1 pl-3 pr-1 text-caption text-ink">
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
