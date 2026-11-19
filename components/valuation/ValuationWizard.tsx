"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { AvmReport } from "@/components/valuation/AvmReport";
import { Stepper } from "@/components/ui/Stepper";
import { Field, Input, NumericInput } from "@/components/ui/Field";
import { Badge, Eyebrow } from "@/components/ui/Badge";
import { formatPrice, formatPercent } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { AUTOCOMPLETE_MIN_CHARS } from "@/lib/api/valuation";
import type {
  AddressSuggestion,
  ValuationResult,
  ValuationSubject,
} from "@/lib/api/valuation";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { fetchJson } from "@/lib/queries/fetcher";
import {
  useAddressAutocomplete,
  useValuationEstimate,
  useValuationLookup,
} from "@/lib/queries/valuation";

type Step = "address" | "details" | "result";

const STEP_ORDER: Step[] = ["address", "details", "result"];
const STEP_LABELS = ["Address", "Details", "Estimate"];

/**
 * Home evaluation flow: address → confirm details → estimate.
 *
 * Calls run through /api/valuation/* so the browser never needs the backend
 * origin. Every number shown comes from the backend's comparable-sales model;
 * when it reports `sparse` we say the estimate is low-confidence rather than
 * presenting it as firm.
 */
export function ValuationWizard() {
  const [step, setStep] = useState<Step>("address");
  const [subject, setSubject] = useState<ValuationSubject | null>(null);
  const [result, setResult] = useState<ValuationResult | null>(null);
  const lookup = useValuationLookup();
  const estimate = useValuationEstimate();
  const busy = lookup.isPending || estimate.isPending;
  // The fixed copy is kept deliberately: backend messages here are technical.
  const error = lookup.isError
    ? "We couldn't find details for that address."
    : estimate.isError
      ? "We couldn't produce an estimate right now."
      : null;

  function handleSelectAddress(suggestion: AddressSuggestion) {
    estimate.reset();
    lookup.mutate(suggestion, {
      onSuccess: async (data) => {
        let next: ValuationSubject = {
          ...data,
          // Autocomplete may already carry coords the lookup row lacks.
          latitude: data.latitude ?? suggestion.latitude,
          longitude: data.longitude ?? suggestion.longitude,
        };
        if (next.latitude == null || next.longitude == null) {
          const query = [next.address, next.city, "Ontario", "Canada"]
            .filter(Boolean)
            .join(", ");
          try {
            const places = await fetchJson<
              Array<{ latitude: number; longitude: number }>
            >(`/api/geocode?q=${encodeURIComponent(query)}`);
            const place = places[0];
            if (place) {
              next = {
                ...next,
                latitude: place.latitude,
                longitude: place.longitude,
              };
            }
          } catch {
            // Estimate endpoint also geocodes; continue without blocking.
          }
        }
        setSubject(next);
        setStep("details");
      },
    });
  }

  function handleEstimate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subject) return;

    const data = new FormData(event.currentTarget);
    const numberOrNull = (key: string) => {
      const raw = String(data.get(key) ?? "").trim();
      if (!raw) return null;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    };

    lookup.reset();
    estimate.mutate(
      {
        listingKey: subject.listingKey,
        address: subject.address,
        latitude: subject.latitude,
        longitude: subject.longitude,
        postalCode: subject.postalCode,
        city: subject.city,
        propertySubType: subject.propertySubType,
        bedroomsTotal: numberOrNull("beds"),
        bathroomsTotal: numberOrNull("baths"),
        livingArea: numberOrNull("livingArea"),
        parkingTotal: numberOrNull("parking"),
      },
      {
        onSuccess: (estimated) => {
          setResult(estimated);
          setStep("result");
        },
      },
    );
  }

  const resultStep = step === "result";

  return (
    <div className={cn("mx-auto w-full", resultStep ? "max-w-none" : "max-w-2xl")}>
      <Stepper
        className={cn("mb-6", resultStep && "mx-auto max-w-2xl")}
        steps={STEP_LABELS}
        current={STEP_ORDER.indexOf(step)}
      />

      {error && (
        <p
          role="alert"
          className={cn(
            "mb-4 rounded-control bg-negative-soft px-4 py-3 text-small text-negative",
            resultStep && "mx-auto max-w-2xl",
          )}
        >
          {error}
        </p>
      )}

      {step === "address" && (
        <AddressStep onSelect={handleSelectAddress} busy={busy} />
      )}

      {step === "details" && subject && (
        <form onSubmit={handleEstimate} className="space-y-5 rounded-surface border border-line bg-surface p-6 shadow-card">
          <div>
            <h2 className="text-h2 text-ink">Confirm the details</h2>
            <p className="mt-1 text-small text-ink-muted">{subject.address}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bedrooms" htmlFor="val-beds">
              <NumericInput
                id="val-beds"
                name="beds"
                min={0}
                max={20}
                defaultValue={subject.bedroomsTotal ?? ""}
              />
            </Field>
            <Field label="Bathrooms" htmlFor="val-baths">
              <NumericInput
                id="val-baths"
                name="baths"
                min={0}
                max={20}
                defaultValue={subject.bathroomsTotal ?? ""}
              />
            </Field>
            <Field label="Interior area (sq ft)" htmlFor="val-area">
              <NumericInput
                id="val-area"
                name="livingArea"
                min={0}
                max={100000}
                defaultValue={subject.livingArea ?? ""}
              />
            </Field>
            <Field label="Parking spaces" htmlFor="val-parking">
              <NumericInput
                id="val-parking"
                name="parking"
                min={0}
                max={20}
                defaultValue={subject.parkingTotal ?? ""}
              />
            </Field>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep("address")}>
              Back
            </Button>
            <Button type="submit" variant="primary" className="flex-1" loading={busy}>
              Get my estimate
            </Button>
          </div>
        </form>
      )}

      {step === "result" && result && (
        <ResultCard
          result={result}
          address={subject?.address ?? ""}
          onRestart={() => {
            setStep("address");
            setResult(null);
            setSubject(null);
          }}
        />
      )}
    </div>
  );
}

/** Address search with a debounced, keyboard-navigable suggestion list. */
function AddressStep({
  onSelect,
  busy,
}: {
  onSelect: (suggestion: AddressSuggestion) => void;
  busy: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebouncedValue(query, 250);
  const autocomplete = useAddressAutocomplete(debouncedQuery);
  const loading = autocomplete.isFetching;
  // Below the minimum there are no suggestions, even if an older set is cached.
  const suggestions =
    query.trim().length >= AUTOCOMPLETE_MIN_CHARS && autocomplete.isEnabled
      ? (autocomplete.data ?? NO_SUGGESTIONS)
      : NO_SUGGESTIONS;

  // A fresh set of suggestions opens the list and resets the highlight
  // (adjusting state during render rather than in an effect).
  const [shownData, setShownData] = useState(autocomplete.data);
  if (autocomplete.data !== shownData) {
    setShownData(autocomplete.data);
    if (autocomplete.data && !autocomplete.isPlaceholderData) {
      setOpen(true);
      setHighlight(-1);
    }
  }
  // Clearing the query below the minimum closes the list.
  if (open && suggestions.length === 0 && query.trim().length < AUTOCOMPLETE_MIN_CHARS) {
    setOpen(false);
  }

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" && highlight >= 0) {
      event.preventDefault();
      onSelect(suggestions[highlight]);
      setOpen(false);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="rounded-surface border border-line bg-surface p-6 shadow-card">
      <h2 className="text-h2 text-ink">What&rsquo;s your address?</h2>
      <p className="mt-1 text-small text-ink-muted">
        We&rsquo;ll match it to recent comparable sales nearby.
      </p>

      <div className="relative mt-5" ref={containerRef}>
        <Field label="Property address" htmlFor="val-address">
          <Input
            id="val-address"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder="Start typing your street address…"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              highlight >= 0 ? `${listId}-option-${highlight}` : undefined
            }
            disabled={busy}
          />
        </Field>

        {open && suggestions.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            aria-label="Address suggestions"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-control border border-line bg-surface shadow-pop"
          >
            {suggestions.map((suggestion, index) => (
              <li key={`${suggestion.listingKey}-${index}`} role="none">
                <button
                  type="button"
                  id={`${listId}-option-${index}`}
                  role="option"
                  aria-selected={index === highlight}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => {
                    onSelect(suggestion);
                    setOpen(false);
                  }}
                  className={`block w-full px-4 py-2.5 text-left text-small transition-colors ${
                    index === highlight ? "bg-surface-alt text-ink" : "text-ink-soft"
                  }`}
                >
                  {suggestion.label}
                </button>
              </li>
            ))}
          </ul>
        )}

        {loading && (
          <p className="mt-2 text-caption text-ink-muted" role="status">
            Searching…
          </p>
        )}

        {!loading && query.trim().length >= AUTOCOMPLETE_MIN_CHARS && suggestions.length === 0 && (
          <p className="mt-2 text-caption text-ink-muted">
            No matching address found. We can only evaluate homes present in the
            MLS® catalogue today.
          </p>
        )}
      </div>
    </div>
  );
}

const NO_SUGGESTIONS: AddressSuggestion[] = [];

function friendlyEstimateMessage(message: string | null | undefined): string {
  const fallback =
    "We couldn't find enough nearby sold or active listings to price this home. Try another address, or ask an agent for a manual CMA.";
  if (!message) return fallback;
  if (/latitude|longitude|geolocat/i.test(message)) {
    return "We couldn't locate this address on the map. Try another nearby listing, or ask an agent for a manual CMA.";
  }
  return message;
}

function ResultCard({
  result,
  address,
  onRestart,
}: {
  result: ValuationResult;
  address: string;
  onRestart: () => void;
}) {
  // A zero market value means every fallback (sold, proxy, active, trend) failed.
  if (result.market <= 0) {
    return (
      <div className="rounded-surface border border-line bg-surface p-6 text-center shadow-card">
        <h2 className="text-h2 text-ink">We can&rsquo;t estimate this home yet</h2>
        <p className="mt-2 text-small text-ink-muted">
          {friendlyEstimateMessage(result.message)}
        </p>
        <Button variant="secondary" className="mt-5" onClick={onRestart}>
          Try another address
        </Button>
      </div>
    );
  }

  const trendPct =
    result.trendPct90d !== 0
      ? result.trendPct90d
      : result.trendPct12m !== 0
        ? result.trendPct12m
        : result.trendPct30d;
  const trendLabel =
    result.trendPct90d !== 0
      ? "90-day sold trend"
      : result.trendPct12m !== 0
        ? "12-month sold trend"
        : "30-day trend";
  const spark = result.trendSeries.filter((p) => p.medianSoldPrice != null);
  const sparkMax = Math.max(...spark.map((p) => p.medianSoldPrice ?? 0), 1);
  const sparkMin = Math.min(...spark.map((p) => p.medianSoldPrice ?? 0), sparkMax);

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="rounded-surface border border-line bg-surface p-6 shadow-card sm:p-8 lg:p-10">
          <Eyebrow>Estimated value</Eyebrow>
          <p className="mt-4 text-display text-ink sm:text-[3.25rem] sm:leading-none">
            {formatPrice(result.market)}
          </p>
          <p className="mt-3 text-body text-ink-muted">
            Likely range {formatPrice(result.low)} – {formatPrice(result.high)}
          </p>
          <p className="mt-2 text-small text-ink-subtle">{address}</p>

          {result.ai.used && result.ai.suggested != null && (
            <p className="mt-4 max-w-2xl text-small text-ink-soft">
              AI suggested {formatPrice(result.ai.suggested)}
              {result.ai.rationale ? ` — ${result.ai.rationale}` : ""}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {result.beta && <Badge tone="warm">Beta model</Badge>}
            {result.sparse && <Badge tone="negative">Low confidence</Badge>}
            {result.confidence && !result.sparse && (
              <Badge tone="positive">{result.confidence} confidence</Badge>
            )}
            {result.ai.used && <Badge tone="neutral">Hybrid CMA + AI</Badge>}
            {trendPct !== 0 && (
              <Badge tone="neutral">
                {trendLabel} {formatPercent(trendPct)}
              </Badge>
            )}
          </div>

          {result.sparse && (
            <p className="mt-5 rounded-control bg-surface-alt px-4 py-3 text-caption text-ink-muted">
              Fewer than five comparable sales were found nearby, so treat this
              range as indicative only. An agent can give you a firmer number.
            </p>
          )}
        </div>

        <div className="rounded-surface border border-line bg-surface p-6 shadow-card sm:p-8">
          <h3 className="text-h3 text-ink">Local sold trend</h3>
          <p className="mt-1 text-caption text-ink-muted">
            Median sold price nearby
            {trendPct !== 0 ? ` · ${trendLabel} ${formatPercent(trendPct)}` : ""}.
          </p>
          {spark.length >= 2 ? (
            <div className="mt-6" aria-hidden="true">
              <svg
                viewBox={`0 0 ${Math.max(spark.length - 1, 1) * 40} 120`}
                className="h-40 w-full text-navy"
                preserveAspectRatio="none"
              >
                <polyline
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={spark
                    .map((point, index) => {
                      const yRange = Math.max(sparkMax - sparkMin, 1);
                      const y = 100 - ((point.medianSoldPrice! - sparkMin) / yRange) * 80;
                      return `${index * 40},${y}`;
                    })
                    .join(" ")}
                />
              </svg>
              <div className="mt-3 flex justify-between text-caption text-ink-subtle">
                <span>{spark[0]?.month}</span>
                <span>{spark[spark.length - 1]?.month}</span>
              </div>
              <p className="mt-2 text-small text-ink-soft">
                Latest median {formatPrice(spark[spark.length - 1]?.medianSoldPrice ?? null)}
              </p>
            </div>
          ) : (
            <p className="mt-8 text-small text-ink-muted">
              Not enough sold-trend months to chart this neighbourhood yet.
            </p>
          )}
        </div>
      </div>

      <AvmReport result={result} />

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
        <p className="max-w-3xl text-caption text-ink-subtle">
          This automated estimate blends recent sold comps, local sold-market
          trends, and AI adjustments. It is not a formal appraisal or an offer
          to purchase.
        </p>
        <Button variant="secondary" onClick={onRestart}>
          Evaluate another home
        </Button>
      </div>
    </div>
  );
}
