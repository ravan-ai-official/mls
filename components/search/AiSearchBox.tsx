"use client";

import { useId, useState, type FormEvent } from "react";
import { usePendingNavigation } from "@/components/navigation/PendingNavigation";
import { Button } from "@/components/ui/Button";
import { AI_QUERY_MAX_CHARS, aiFiltersToQuery, queryToAiFilters } from "@/lib/api/aiSearch";
import {
  DEFAULT_SCHOOL_RADIUS_KM,
  extractSchoolQuery,
  schoolSearchArea,
  type SchoolSearchHit,
} from "@/lib/api/schools";
import { saveAiSearchNotice, useAiSearch } from "@/lib/queries/aiSearch";
import { rememberLastSearch } from "@/lib/personalize/lastSearch";
import { cityFromText, rememberPlace } from "@/lib/personalize/places";
import { fetchJson, HttpError } from "@/lib/queries/fetcher";
import type { ListingQuery } from "@/lib/types/domain";
import { buildListingQueryString, hasActiveFilters } from "@/lib/utils/searchParams";
import { cn } from "@/lib/utils/cn";

/** Inline AI search starts collapsed on phones so listings stay above the fold. */

const DEFAULT_EXAMPLES = [
  "3 bed condo under $900K near a subway in Toronto",
  "Family home near John Fraser Secondary School in Mississauga",
  "2 bedroom rental downtown under $3,000/month with parking",
  "Detached house in Vaughan with a basement apartment",
];

/** Resolve a named school in the prompt into a proximity polygon when possible. */
async function attachSchoolFromPrompt(
  query: ListingQuery,
  prompt: string,
  unsupported: string[],
): Promise<{ query: ListingQuery; unsupported: string[] }> {
  const fromUnsupported = unsupported.map(extractSchoolQuery).find(Boolean) ?? null;
  const schoolName = extractSchoolQuery(prompt) ?? fromUnsupported;
  if (!schoolName) return { query, unsupported };

  try {
    const hits = await fetchJson<SchoolSearchHit[]>(
      `/api/schools/search?q=${encodeURIComponent(schoolName)}`,
    );
    const hit = hits[0];
    if (!hit) return { query, unsupported };
    const cleaned = unsupported.filter((item) => {
      const low = item.toLowerCase();
      return !low.includes("school") && !low.includes(schoolName.toLowerCase());
    });
    return {
      query: {
        ...query,
        polygon: schoolSearchArea(hit.latitude, hit.longitude, DEFAULT_SCHOOL_RADIUS_KM),
        schoolLabel: hit.name,
        schoolKm: DEFAULT_SCHOOL_RADIUS_KM,
      },
      unsupported: cleaned,
    };
  } catch {
    return { query, unsupported };
  }
}

/**
 * AI search box: a sentence becomes ordinary listing filters (backend +
 * OpenAI), then we navigate to the normal results page, where each filter is
 * a removable pill and "Best match" ranks by the soft preferences.
 *
 * `current` switches on refine mode ("cheaper", "add a garage"): the
 * visitor's applied filters are sent along so the AI edits them rather than
 * starting over; a checkbox lets them start fresh instead. A drawn map area
 * is always kept — the AI can't draw one.
 *
 * If the AI is unavailable the sentence runs as a plain keyword search, so
 * the box never dead-ends. Only a rate limit stops the navigation.
 */
export function AiSearchBox({
  basePath = "/listings",
  current,
  variant = "hero",
  className,
  onSearched,
  examples = DEFAULT_EXAMPLES,
}: {
  basePath?: "/listings" | "/map-search";
  current?: ListingQuery;
  /** `panel` stays expanded — for filter sheets. `inline` collapses on phones. */
  variant?: "hero" | "inline" | "panel";
  className?: string;
  /** Fired after a successful navigate so a parent sheet can close. */
  onSearched?: () => void;
  /** Hero “Try” chips — editable from the site studio hero section. */
  examples?: string[];
}) {
  // On /listings and /map-search this shows the skeleton while results load.
  const { navigate } = usePendingNavigation();
  const id = useId();
  const search = useAiSearch();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(variant === "hero" || variant === "panel");
  const canRefine = Boolean(current && hasActiveFilters(current));
  const [keepFilters, setKeepFilters] = useState(true);
  const refining = canRefine && keepFilters;
  const hero = variant === "hero";
  const collapsed = variant === "inline" && !open;

  async function go(
    query: ListingQuery,
    notice: { unsupported: string[]; fallback: boolean },
    prompt: string,
  ) {
    const attached = await attachSchoolFromPrompt(query, prompt, notice.unsupported);
    const next: ListingQuery = {
      ...attached.query,
      // Keep a hand-drawn / school area unless this prompt just set a new one.
      polygon: attached.query.polygon ?? current?.polygon,
      schoolLabel: attached.query.schoolLabel ?? current?.schoolLabel,
      schoolKm: attached.query.schoolKm ?? current?.schoolKm,
      view: current?.view,
    };
    // Prefer map when the search is school-anchored.
    const path =
      basePath === "/listings" && next.schoolLabel && next.polygon?.length
        ? "/map-search"
        : basePath;
    const qs = buildListingQueryString(next);
    saveAiSearchNotice({
      qs,
      prompt,
      unsupported: attached.unsupported,
      fallback: notice.fallback,
    });
    rememberPlace(next.city ?? cityFromText(prompt));
    rememberLastSearch(next);
    navigate(qs ? `${path}?${qs}` : path);
    onSearched?.();
  }

  function submit(prompt: string) {
    const trimmed = prompt.trim().slice(0, AI_QUERY_MAX_CHARS);
    if (!trimmed || search.isPending) return;
    setError(null);
    search.mutate(
      { query: trimmed, currentFilters: refining && current ? queryToAiFilters(current) : null },
      {
        onSuccess: (result) => {
          void go(
            aiFiltersToQuery(result.filters ?? {}),
            { unsupported: result.unsupported ?? [], fallback: Boolean(result.fallback) },
            trimmed,
          );
        },
        onError: (err) => {
          if (err instanceof HttpError && (err.status === 429 || err.status === 400)) {
            setError(
              err.status === 429
                ? "You've run a lot of AI searches — please wait a few minutes, or use the filters."
                : err.message,
            );
            return;
          }
          // AI down: the words still search, as keywords.
          void go({ search: trimmed.slice(0, 120) }, { unsupported: [], fallback: true }, trimmed);
        },
      },
    );
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    submit(text);
  }

  const placeholder = refining
    ? variant === "panel"
      ? "e.g. cheaper, add a garage…"
      : "Refine these results — e.g. “cheaper”, “add a garage”, “only Mississauga”"
    : variant === "panel"
      ? "e.g. 3 bed condo under $900K near a subway"
      : "Describe your ideal home — e.g. “3 bed condo under $900K near a subway”";

  const multiline = hero || variant === "panel";

  return (
    <div className={cn("w-full min-w-0", className)}>
      {collapsed && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between gap-3 rounded-control border border-line bg-surface px-3.5 py-2.5 text-left text-small text-ink transition-colors hover:border-navy sm:hidden"
        >
          <span className="flex items-center gap-1.5 font-medium">
            <SparkleIcon />
            Search with AI
          </span>
          <span className="text-caption text-ink-muted">Optional</span>
        </button>
      )}

      <form
        onSubmit={onSubmit}
        className={cn("w-full min-w-0", collapsed && "hidden sm:block")}
        aria-busy={search.isPending}
      >
      <div className={cn("mb-1.5 flex items-center justify-between gap-2", hero && "sr-only")}>
        <label htmlFor={id} className="flex min-w-0 items-center gap-1.5 text-small font-medium text-ink">
          <SparkleIcon />
          {refining ? "Refine with AI" : "Search with AI"}
        </label>
        {variant === "inline" && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-caption font-medium text-ink-muted underline underline-offset-2 hover:text-ink sm:hidden"
          >
            Hide
          </button>
        )}
      </div>
      <div
        className={cn(
          "flex min-w-0 gap-2",
          multiline ? "flex-col" : "flex-col sm:flex-row",
        )}
      >
        {multiline ? (
          <textarea
            id={id}
            rows={variant === "panel" ? 6 : 3}
            maxLength={AI_QUERY_MAX_CHARS}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              // Enter searches; Shift+Enter keeps a newline.
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit(text);
              }
            }}
            placeholder={placeholder}
            className={cn(
              "box-border w-full min-w-0 max-w-full resize-none rounded-control border border-line bg-surface text-ink placeholder:text-ink-subtle focus:border-navy/35 focus:outline-none focus:ring-2 focus:ring-navy/10",
              variant === "panel"
                ? "min-h-[9.5rem] px-3.5 py-3 text-small leading-relaxed"
                : "min-h-[4.75rem] px-3 py-2.5 text-small sm:min-h-[6rem] sm:px-4 sm:py-3 sm:text-body",
            )}
          />
        ) : (
          <input
            id={id}
            type="search"
            maxLength={AI_QUERY_MAX_CHARS}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={placeholder}
            className="box-border h-11 w-full min-w-0 max-w-full flex-1 rounded-control border border-line bg-surface px-3.5 text-small text-ink placeholder:text-ink-subtle focus:border-navy/35 focus:outline-none focus:ring-2 focus:ring-navy/10 [&::-webkit-search-cancel-button]:appearance-none"
          />
        )}
        <Button
          type="submit"
          variant={hero ? "dark" : "primary"}
          size={hero ? "lg" : "md"}
          block={multiline}
          disabled={!text.trim() || search.isPending}
          className="w-full shrink-0"
        >
          {search.isPending ? "Understanding your search…" : hero ? "Search with AI" : "Ask AI"}
          {!search.isPending && <SparkleIcon />}
        </Button>
      </div>

      {canRefine && (
        <label className="mt-2 flex items-center gap-2 text-caption text-ink-muted">
          <input
            type="checkbox"
            checked={keepFilters}
            onChange={(event) => setKeepFilters(event.target.checked)}
            className="h-3.5 w-3.5 accent-navy"
          />
          Keep my current filters
        </label>
      )}

      {error && (
        <p role="alert" className="mt-2 text-caption text-negative">
          {error}
        </p>
      )}

      {hero && examples.length > 0 && (
        <div className="mt-3 sm:mt-4">
          <p className="mb-1.5 text-eyebrow uppercase text-ink-muted sm:mb-2">Try</p>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                disabled={search.isPending}
                onClick={() => {
                  setText(example);
                  submit(example);
                }}
                className="max-w-full rounded-full border border-line px-2.5 py-1 text-left text-[11px] leading-snug text-ink transition-colors hover:border-gold hover:text-gold-deep disabled:opacity-50 sm:px-3 sm:py-1.5 sm:text-caption"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}
      </form>
    </div>
  );
}

export function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true" className={cn("shrink-0", className)}>
      <path
        d="M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-4.4L4 8.5l4.4-1.6L10 2.5ZM15.5 13l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z"
        fill="currentColor"
      />
    </svg>
  );
}
