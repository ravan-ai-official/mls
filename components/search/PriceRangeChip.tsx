"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { NumericInput } from "@/components/ui/Field";
import { FilterChipMenu, FilterChipOption } from "@/components/search/FilterChipMenu";
import type { FilterSchemaPriceOption } from "@/lib/search/filterSchema";
import { formatPrice } from "@/lib/utils/format";

/**
 * One control for min+max price — avoids two bulky selects on the search rail.
 */
export function PriceRangeChip({
  id,
  isRent,
  min,
  max,
  options,
  onChange,
}: {
  id: string;
  isRent: boolean;
  min: string;
  max: string;
  options: FilterSchemaPriceOption[];
  onChange: (next: { min: string | null; max: string | null }) => void;
}) {
  const active = Boolean(min || max);
  const display = priceChipLabel(min, max, isRent);

  return (
    <FilterChipMenu
      id={id}
      label={isRent ? "Rent range" : "Price range"}
      display={display}
      active={active}
      panelClassName="w-[min(20rem,calc(100vw-2rem))]"
    >
      {(close) => (
        <PriceRangePanel
          isRent={isRent}
          min={min}
          max={max}
          options={options}
          onApply={(next) => {
            onChange(next);
            close();
          }}
        />
      )}
    </FilterChipMenu>
  );
}

function PriceRangePanel({
  isRent,
  min,
  max,
  options,
  onApply,
}: {
  isRent: boolean;
  min: string;
  max: string;
  options: FilterSchemaPriceOption[];
  onApply: (next: { min: string | null; max: string | null }) => void;
}) {
  const [draftMin, setDraftMin] = useState(min);
  const [draftMax, setDraftMax] = useState(max);

  useEffect(() => {
    setDraftMin(min);
    setDraftMax(max);
  }, [min, max]);

  function submitCustom(event: FormEvent) {
    event.preventDefault();
    onApply({
      min: normalizeAmount(draftMin),
      max: normalizeAmount(draftMax),
    });
  }

  return (
    <div className="flex max-h-80 flex-col">
      <div className="border-b border-line px-4 py-2.5">
        <p className="text-caption font-semibold tracking-wide text-ink-muted uppercase">
          {isRent ? "Rent" : "Price"}
        </p>
      </div>

      <form
        onSubmit={submitCustom}
        className="space-y-3 border-b border-line bg-surface-alt/60 p-3.5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grid grid-cols-2 gap-2.5">
          <label className="space-y-1.5">
            <span className="block text-caption font-medium text-ink-muted">Minimum</span>
            <NumericInput
              aria-label={isRent ? "Minimum rent" : "Minimum price"}
              placeholder="No min"
              value={draftMin}
              onChange={(event) => setDraftMin(event.target.value)}
              className="h-9 bg-surface px-2.5"
            />
          </label>
          <label className="space-y-1.5">
            <span className="block text-caption font-medium text-ink-muted">Maximum</span>
            <NumericInput
              aria-label={isRent ? "Maximum rent" : "Maximum price"}
              placeholder="No max"
              value={draftMax}
              onChange={(event) => setDraftMax(event.target.value)}
              className="h-9 bg-surface px-2.5"
            />
          </label>
        </div>
        <Button type="submit" variant="primary" size="sm" className="w-full">
          Apply range
        </Button>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto py-1.5" role="listbox">
        <p className="px-4 pb-1 pt-2 text-caption font-medium text-ink-muted">
          Quick picks
        </p>
        <FilterChipOption
          selected={!min && !max}
          onClick={() => onApply({ min: null, max: null })}
        >
          Any price
        </FilterChipOption>
        {options.map((option) => {
          const key = String(option.value);
          const selected = min === key && !max;
          return (
            <FilterChipOption
              key={key}
              selected={selected}
              onClick={() => onApply({ min: key, max: null })}
            >
              {option.label}+
            </FilterChipOption>
          );
        })}
      </div>
    </div>
  );
}

export function priceChipLabel(min: string, max: string, isRent: boolean): string {
  if (!min && !max) return isRent ? "Rent" : "Price";
  const minLabel = min ? compactPrice(Number(min)) : null;
  const maxLabel = max ? compactPrice(Number(max)) : null;
  if (minLabel && maxLabel) return `${minLabel}–${maxLabel}`;
  if (minLabel) return `${minLabel}+`;
  return `Up to ${maxLabel}`;
}

function compactPrice(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return formatPrice(value);
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `$${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
  }
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return formatPrice(value);
}

function normalizeAmount(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const amount = Number(digits);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return String(amount);
}
