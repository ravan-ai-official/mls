"use client";

import { useId, useState, type FormEvent } from "react";
import {
  DEFAULT_SCHOOL_RADIUS_KM,
  SCHOOL_RADIUS_OPTIONS_KM,
  SCHOOL_SEARCH_MIN_CHARS,
  type SchoolSearchHit,
} from "@/lib/api/schools";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useSchoolSearch } from "@/lib/queries/schools";
import { cn } from "@/lib/utils/cn";

const EMPTY: SchoolSearchHit[] = [];

/**
 * Typeahead for Ontario schools. Selecting a result asks the parent to open
 * homes near that location — proximity only, not board catchment.
 */
export function SchoolSearchBox({
  onSelect,
  radiusKm = DEFAULT_SCHOOL_RADIUS_KM,
  onRadiusChange,
  variant = "default",
  className,
  autoFocus = false,
}: {
  onSelect: (school: SchoolSearchHit, radiusKm: number) => void;
  radiusKm?: number;
  onRadiusChange?: (km: number) => void;
  variant?: "default" | "hero" | "compact";
  className?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [radius, setRadius] = useState(radiusKm);
  const debounced = useDebouncedValue(query, 300);
  const search = useSchoolSearch(debounced);
  const results = search.isEnabled ? (search.data ?? EMPTY) : EMPTY;
  const settled = search.isEnabled && !search.isFetching && !search.isPlaceholderData;
  const hero = variant === "hero";

  function choose(school: SchoolSearchHit) {
    setQuery(school.name);
    setOpen(false);
    onSelect(school, radius);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (results[0]) choose(results[0]);
  }

  function setKm(km: number) {
    setRadius(km);
    onRadiusChange?.(km);
  }

  const [shownData, setShownData] = useState(search.data);
  if (search.data !== shownData) {
    setShownData(search.data);
    if (!search.isPlaceholderData && search.data) setOpen(search.data.length > 0);
  }

  return (
    <form onSubmit={submit} className={cn("w-full", className)}>
      <label htmlFor={id} className="sr-only">
        Search by school name
      </label>
      <div className="relative">
        <input
          id={id}
          role="combobox"
          aria-expanded={open && query.trim().length >= SCHOOL_SEARCH_MIN_CHARS}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          autoFocus={autoFocus}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder={
            hero
              ? "e.g. John Fraser Secondary School, Mississauga"
              : "Search a school name…"
          }
          className={cn(
            "w-full rounded-control border border-line bg-surface text-ink outline-none placeholder:text-ink-subtle focus:border-navy/35 focus:ring-2 focus:ring-navy/10",
            hero ? "h-12 px-4 text-small" : "h-11 px-3.5 text-small",
          )}
        />

        {open && query.trim().length >= SCHOOL_SEARCH_MIN_CHARS && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-control border border-line bg-surface shadow-pop"
          >
            {results.map((school) => (
              <li key={school.id} role="option">
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(school)}
                  className="flex w-full items-start justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-alt"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-small font-medium text-ink">
                      {school.name}
                    </span>
                    <span className="mt-0.5 block truncate text-caption text-ink-muted">
                      {[school.city, school.level || school.kind, school.board]
                        .filter(Boolean)
                        .join(" · ") || "Ontario school"}
                    </span>
                  </span>
                  {school.eqaoPercent !== null ? (
                    <span
                      className="shrink-0 text-small font-semibold text-ink"
                      title={school.eqaoLabel || "Published EQAO average"}
                    >
                      {school.eqaoPercent}%
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
            {settled && results.length === 0 && (
              <li className="px-3.5 py-2.5 text-caption text-ink-muted">
                No schools matched. Try the full name, city, or “Secondary School”.
              </li>
            )}
            {search.isError && (
              <li className="px-3.5 py-2.5 text-caption text-ink-muted">
                School search is unavailable right now.
              </li>
            )}
            {search.isFetching && results.length === 0 && (
              <li className="px-3.5 py-2.5 text-caption text-ink-muted">Searching schools…</li>
            )}
          </ul>
        )}
      </div>

      {variant !== "compact" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-caption text-ink-muted">Homes within</span>
          {SCHOOL_RADIUS_OPTIONS_KM.map((km) => (
            <button
              key={km}
              type="button"
              onClick={() => setKm(km)}
              className={cn(
                "h-8 rounded-control border px-2.5 text-caption font-medium transition-colors",
                radius === km
                  ? "border-navy bg-navy text-white"
                  : "border-line bg-surface text-ink hover:border-navy",
              )}
            >
              {km} km
            </button>
          ))}
        </div>
      )}

      <p className="mt-2 text-caption text-ink-muted">
        Shows homes near the school location. Ontario boards assign by attendance
        area — living nearby does not guarantee admission. Confirm with the board.
      </p>
    </form>
  );
}
