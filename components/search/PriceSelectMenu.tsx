"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Menu } from "@/components/ui/Menu";
import { Button } from "@/components/ui/Button";
import { NumericInput } from "@/components/ui/Field";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/format";
import type { FilterSchemaPriceOption } from "@/lib/search/filterSchema";

/**
 * Min/Max price control: preset list plus a free-typed amount.
 * Keeps the compact bar footprint of a select while allowing custom values.
 */
export function PriceSelectMenu({
  id,
  label,
  placeholder,
  value,
  options,
  onChange,
  className,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  options: FilterSchemaPriceOption[];
  onChange: (next: string | null) => void;
  className?: string;
}) {
  const selected = options.find((option) => String(option.value) === value);
  const display = value
    ? selected?.label ?? formatPrice(Number(value))
    : placeholder;

  return (
    <Menu
      align="left"
      role="dialog"
      label={label}
      panelClassName="w-56"
      trigger={({ open, buttonProps }) => (
        <button
          {...buttonProps}
          id={id}
          type="button"
          aria-label={label}
          className={cn(
            "inline-flex h-11 w-full items-center justify-between gap-1 rounded-control border border-line bg-surface px-3 text-left text-small text-ink transition-colors",
            "hover:border-ink-subtle focus:border-navy/35 focus:outline-none focus:ring-2 focus:ring-navy/10",
            className,
          )}
        >
          <span className={cn("truncate", !value && "text-ink-muted")}>{display}</span>
          <Chevron open={open} />
        </button>
      )}
    >
      {(close) => (
        <PriceMenuPanel
          value={value}
          options={options}
          placeholder={placeholder}
          onPick={(next) => {
            onChange(next);
            close();
          }}
        />
      )}
    </Menu>
  );
}

function PriceMenuPanel({
  value,
  options,
  placeholder,
  onPick,
}: {
  value: string;
  options: FilterSchemaPriceOption[];
  placeholder: string;
  onPick: (next: string | null) => void;
}) {
  const [custom, setCustom] = useState(value);

  useEffect(() => {
    setCustom(value);
  }, [value]);

  function submitCustom(event: FormEvent) {
    event.preventDefault();
    const digits = custom.replace(/[^\d]/g, "");
    if (!digits) {
      onPick(null);
      return;
    }
    const amount = Number(digits);
    if (!Number.isFinite(amount) || amount <= 0) return;
    onPick(String(amount));
  }

  return (
    <div className="flex max-h-72 flex-col">
      <form
        onSubmit={submitCustom}
        className="flex items-center gap-2 border-b border-line p-2"
        onClick={(event) => event.stopPropagation()}
      >
        <NumericInput
          aria-label="Custom price"
          placeholder="Type amount"
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          className="h-9 flex-1 px-2.5"
        />
        <Button type="submit" variant="secondary" size="sm" className="shrink-0">
          Apply
        </Button>
      </form>
      <div className="min-h-0 flex-1 overflow-y-auto py-1" role="listbox">
        <button
          type="button"
          role="option"
          aria-selected={!value}
          onClick={() => onPick(null)}
          className={cn(
            "block w-full px-4 py-2 text-left text-small transition-colors hover:bg-surface-alt",
            !value ? "bg-navy-tint font-medium text-navy" : "text-ink",
          )}
        >
          {placeholder}
        </button>
        {options.map((option) => {
          const key = String(option.value);
          const active = value === key;
          return (
            <button
              key={key}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onPick(key)}
              className={cn(
                "block w-full px-4 py-2 text-left text-small transition-colors hover:bg-surface-alt",
                active ? "bg-navy-tint font-medium text-navy" : "text-ink",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0 text-ink-muted transition-transform", open && "rotate-180")}
    >
      <path
        d="M4 6L8 10L12 6"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
