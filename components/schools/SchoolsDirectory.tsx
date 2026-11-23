"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DEFAULT_SCHOOL_RADIUS_KM,
  SCHOOL_RADIUS_OPTIONS_KM,
  SCHOOL_SEARCH_MIN_CHARS,
  homesNearSchoolHref,
  type OfficialSchool,
  type SchoolSearchHit,
} from "@/lib/api/schools";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useSchoolSearch } from "@/lib/queries/schools";
import { ChipToggle, SearchInput } from "@/components/ui/Field";
import { cn } from "@/lib/utils/cn";

const SOURCE_URL = "https://data.ontario.ca/dataset/school-information-and-student-demographics";

type LevelFilter = "all" | "secondary" | "elementary";

function hitToSchool(hit: SchoolSearchHit): OfficialSchool {
  return {
    id: hit.id,
    name: hit.name,
    board: hit.board,
    kind: hit.kind,
    level: hit.level,
    city: hit.city,
    distanceKm: null,
    website: null,
    eqaoPercent: hit.eqaoPercent,
    eqaoLabel: hit.eqaoLabel,
    latitude: hit.latitude,
    longitude: hit.longitude,
    imageUrl: null,
  };
}

function matchesLevel(school: OfficialSchool, filter: LevelFilter): boolean {
  if (filter === "all") return true;
  const hay = `${school.level} ${school.kind} ${school.name}`.toLowerCase();
  if (filter === "secondary") {
    return /secondary|high school|collegiate|senior/.test(hay);
  }
  return /elementary|public school|primary|junior|intermediate/.test(hay) && !/secondary|high school/.test(hay);
}

/**
 * Search Ontario schools and open nearby listings. Built as a working tool:
 * search + level + radius, then a clear “see homes” action per school.
 */
export function SchoolsDirectory({ initialSchools }: { initialSchools: OfficialSchool[] }) {
  const [query, setQuery] = useState("");
  // Top list from /schools/top/ is secondary-only; keep that as the default filter.
  const [level, setLevel] = useState<LevelFilter>("secondary");
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_SCHOOL_RADIUS_KM);
  const debounced = useDebouncedValue(query, 300);
  const search = useSchoolSearch(debounced);
  const searching = debounced.trim().length >= SCHOOL_SEARCH_MIN_CHARS;

  const baseResults = searching
    ? (search.data ?? []).map(hitToSchool)
    : initialSchools;

  const results = useMemo(
    () => baseResults.filter((school) => matchesLevel(school, level)),
    [baseResults, level],
  );

  const loading = searching && search.isFetching && results.length === 0;
  const emptySearch =
    searching &&
    !search.isFetching &&
    (search.data?.length ?? 0) === 0;
  const emptyFilter = !emptySearch && !loading && results.length === 0 && baseResults.length > 0;

  return (
    <div className="space-y-8">
      <div className="rounded-surface border border-line bg-surface p-4 sm:p-5">
        <SearchInput
          size="lg"
          label="Search by school name or city"
          value={query}
          onValueChange={setQuery}
          placeholder="Try “Fraser”, “Bayview Secondary”, or “Mississauga”"
        />

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <p className="text-caption font-medium text-ink-muted">School level</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { value: "all", label: "All" },
                  { value: "secondary", label: "Secondary" },
                  { value: "elementary", label: "Elementary" },
                ] as const
              ).map((chip) => (
                <ChipToggle
                  key={chip.value}
                  active={level === chip.value}
                  onClick={() => setLevel(chip.value)}
                >
                  {chip.label}
                </ChipToggle>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-caption font-medium text-ink-muted">Homes within</p>
            <div className="flex flex-wrap gap-2">
              {SCHOOL_RADIUS_OPTIONS_KM.map((km) => (
                <ChipToggle
                  key={km}
                  active={radiusKm === km}
                  onClick={() => setRadiusKm(km)}
                >
                  {km} km
                </ChipToggle>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-4 text-caption text-ink-muted">
          Ontario boards assign schools by attendance area. These results are
          locations from the Ministry file — living nearby does not guarantee admission.
        </p>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-h3 text-ink">
          {searching ? "Matching schools" : "Top EQAO schools in the GTA"}
        </h2>
        <p className="text-caption text-ink-muted" aria-live="polite">
          {loading
            ? "Searching…"
            : `${results.length.toLocaleString("en-CA")} ${results.length === 1 ? "school" : "schools"}`}
        </p>
      </div>

      {loading ? (
        <SchoolRowsSkeleton />
      ) : emptySearch ? (
        <EmptyState
          title={`No schools matched “${debounced.trim()}”`}
          body="Try the full school name, a shorter word, or a city like Mississauga or Markham."
        />
      ) : emptyFilter ? (
        <EmptyState
          title="No schools in this level"
          body="Switch the level filter to All, or clear your search and try again."
        />
      ) : results.length === 0 ? (
        <EmptyState
          title="No schools to show right now"
          body="EQAO results are unavailable. Search by school name above."
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-surface border border-line bg-surface">
          {results.map((school) => (
            <li key={school.id}>
              <SchoolRow school={school} radiusKm={radiusKm} />
            </li>
          ))}
        </ul>
      )}

      {!searching && initialSchools.length > 0 ? (
        <p className="text-caption text-ink-muted">
          Showing high EQAO secondary schools to start. Type a school name above to search the full Ministry list.
        </p>
      ) : null}

      <p className="text-caption text-ink-muted">
        Source:{" "}
        <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline">
          Ontario Ministry of Education school information and student demographics, 2024–25
        </a>
        .
      </p>
    </div>
  );
}

function SchoolRow({ school, radiusKm }: { school: OfficialSchool; radiusKm: number }) {
  const homesHref =
    school.latitude !== null && school.longitude !== null
      ? homesNearSchoolHref(school.latitude, school.longitude, {
          km: radiusKm,
          name: school.name,
        })
      : null;
  const place = [school.city, school.board].filter(Boolean).join(" · ");
  const meta = [school.level, school.kind].filter(Boolean).join(" · ");
  const hasScore = school.eqaoPercent !== null;

  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <div
          className={cn(
            "w-14 shrink-0 text-center",
            hasScore ? "text-ink" : "text-ink-muted",
          )}
          title={hasScore ? school.eqaoLabel : "No EQAO result published"}
        >
          <p className="text-[22px] font-bold leading-none">
            {hasScore ? `${school.eqaoPercent}%` : "—"}
          </p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
            EQAO
          </p>
        </div>
        <div className="min-w-0">
          <h3 className="text-small font-semibold text-ink">{school.name}</h3>
          {place ? <p className="mt-0.5 text-caption text-ink-muted">{place}</p> : null}
          {meta ? <p className="text-caption text-ink-muted">{meta}</p> : null}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        {homesHref ? (
          <Link
            href={homesHref}
            className="inline-flex h-10 items-center justify-center rounded-control bg-navy px-4 text-caption font-semibold text-white transition-colors hover:bg-navy/90"
          >
            See homes within {radiusKm} km
          </Link>
        ) : (
          <span className="text-caption text-ink-muted">Location unavailable</span>
        )}
      </div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-surface border border-dashed border-line bg-surface-alt px-5 py-10 text-center">
      <p className="text-small font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-caption text-ink-muted">{body}</p>
    </div>
  );
}

function SchoolRowsSkeleton() {
  return (
    <ul
      className="divide-y divide-line overflow-hidden rounded-surface border border-line bg-surface"
      role="status"
      aria-label="Searching schools"
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <li key={index} className="flex items-center gap-4 px-5 py-4">
          <div className="h-10 w-12 animate-pulse rounded bg-surface-alt" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-2/3 animate-pulse rounded bg-surface-alt" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-surface-alt" />
          </div>
          <div className="h-10 w-36 animate-pulse rounded-control bg-surface-alt" />
        </li>
      ))}
      <span className="sr-only">Searching schools…</span>
    </ul>
  );
}
