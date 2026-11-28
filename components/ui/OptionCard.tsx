"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Single-choice card group (radio semantics). HomeAtlasUI HomeEvaluationPage
 * L169-186: bordered `rounded-control` cards, the selected one outlined in navy
 * on the navy tint.
 */
export interface OptionCardItem<T extends string> {
  value: T;
  title: string;
  description?: string;
  icon?: ReactNode;
}

export function OptionCardGroup<T extends string>({
  name,
  label,
  options,
  value,
  onChange,
  columns = 3,
  className,
}: {
  name: string;
  label: string;
  options: Array<OptionCardItem<T>>;
  value: T | null;
  onChange: (value: T) => void;
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  return (
    <fieldset className={className}>
      <legend className="mb-1.5 block text-small font-medium text-ink">{label}</legend>
      <div
        className={cn(
          "grid gap-3",
          columns === 2 && "sm:grid-cols-2",
          columns === 3 && "sm:grid-cols-3",
          columns === 4 && "sm:grid-cols-2 lg:grid-cols-4",
        )}
      >
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-control border p-3.5 transition-colors",
                "has-focus-visible:ring-2 has-focus-visible:ring-navy/15",
                checked
                  ? "border-navy bg-navy-tint"
                  : "border-line bg-surface hover:border-ink-subtle",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.icon && (
                <span className={cn("mt-0.5 shrink-0", checked ? "text-navy" : "text-ink-muted")}>
                  {option.icon}
                </span>
              )}
              <span className="min-w-0">
                <span className="block text-small font-medium text-ink">{option.title}</span>
                {option.description && (
                  <span className="mt-0.5 block text-caption text-ink-muted">
                    {option.description}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
