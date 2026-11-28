"use client";

import {
  forwardRef,
  useId,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils/cn";

const CONTROL_BASE =
  "w-full rounded-control border bg-surface px-3.5 text-small text-ink " +
  "placeholder:text-ink-subtle transition-colors " +
  "disabled:cursor-not-allowed disabled:bg-surface-alt disabled:text-ink-subtle";

/**
 * Subtle focus: soft navy border + light ring — enough to show the active
 * field without a heavy outline. Invalid state keeps the same shape in red.
 */
const CONTROL_STATE =
  "border-line hover:border-ink-subtle " +
  "focus:border-navy/35 focus:ring-2 focus:ring-navy/10 focus:outline-none " +
  "aria-[invalid=true]:border-negative " +
  "aria-[invalid=true]:focus:border-negative aria-[invalid=true]:focus:ring-negative/25";

/**
 * Wraps a control with a real <label>, optional hint, and an error message that
 * is wired through aria-describedby / aria-invalid.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-small font-medium text-ink">
        {label}
        {required && (
          <span className="ml-0.5 text-negative" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-caption text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} className="text-caption text-negative" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<"input">>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(CONTROL_BASE, CONTROL_STATE, "h-11", className)}
        {...props}
      />
    );
  },
);

/**
 * Numeric input that actually rejects non-numeric text.
 *
 * `type="number"` is not that control. It accepts `e`, `E`, `+` and `-` anywhere
 * in the field (exponent notation), silently reports an empty string for such a
 * value, changes on scroll-wheel over a focused field, and enforces min/max only
 * at form validation rather than while typing.
 *
 * This uses `type="text"` with `inputMode="numeric"` — which still raises the
 * numeric keypad on mobile — and filters input to digits, with an optional
 * decimal point when `decimals` is set. Paste, drag-drop and autofill all route
 * through the same filter because it runs on the change event, not on keydown.
 *
 * `min`/`max` are clamped on blur rather than per-keystroke: clamping as you type
 * makes it impossible to enter "10" in a field whose min is 5, since the leading
 * "1" would be pushed straight to 5.
 */
export const NumericInput = forwardRef<
  HTMLInputElement,
  Omit<ComponentPropsWithoutRef<"input">, "type" | "inputMode"> & {
    /** Decimal places allowed. 0 (default) restricts to whole numbers. */
    decimals?: number;
    /** Allow a leading minus sign. Off by default — most fields are quantities. */
    allowNegative?: boolean;
  }
>(function NumericInput(
  { className, decimals = 0, allowNegative = false, onChange, onBlur, min, max, ...props },
  ref,
) {
  function sanitize(raw: string): string {
    let value = raw;
    const negative = allowNegative && value.trimStart().startsWith("-");
    value = value.replace(/[^0-9.]/g, "");

    if (decimals > 0) {
      // Keep only the first decimal point, and cap the fraction length.
      const [whole, ...rest] = value.split(".");
      if (rest.length > 0) {
        value = `${whole}.${rest.join("").slice(0, decimals)}`;
      }
    } else {
      value = value.replace(/\./g, "");
    }

    return negative ? `-${value}` : value;
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode={decimals > 0 ? "decimal" : "numeric"}
      // Blocks the browser's own numeric-ish autofill suggestions.
      autoComplete={props.autoComplete ?? "off"}
      className={cn(CONTROL_BASE, CONTROL_STATE, "h-11", className)}
      onChange={(event) => {
        const clean = sanitize(event.target.value);
        if (clean !== event.target.value) {
          // Rewrite in place so React's controlled value and the DOM agree.
          event.target.value = clean;
        }
        onChange?.(event);
      }}
      onBlur={(event) => {
        const raw = event.target.value;
        if (raw !== "" && raw !== "-") {
          const parsed = Number(raw);
          if (Number.isFinite(parsed)) {
            const lo = min === undefined ? parsed : Math.max(Number(min), parsed);
            const clamped = max === undefined ? lo : Math.min(Number(max), lo);
            if (clamped !== parsed) {
              event.target.value = String(clamped);
              onChange?.(event as unknown as React.ChangeEvent<HTMLInputElement>);
            }
          }
        }
        onBlur?.(event);
      }}
      {...props}
    />
  );
});

/**
 * Phone input.
 *
 * `type="tel"` raises the right keypad but accepts arbitrary text, so letters
 * reach the backend. This permits digits and the characters real numbers are
 * written with — space, +, -, ( ), . — and nothing else. Formatting is left
 * as typed rather than auto-masked: the field has to accept international
 * numbers, whose shapes a North-American mask would mangle.
 */
export const TelInput = forwardRef<
  HTMLInputElement,
  Omit<ComponentPropsWithoutRef<"input">, "type">
>(function TelInput({ className, onChange, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="tel"
      inputMode="tel"
      className={cn(CONTROL_BASE, CONTROL_STATE, "h-11", className)}
      onChange={(event) => {
        const clean = event.target.value.replace(/[^0-9+()\-.\s]/g, "");
        if (clean !== event.target.value) event.target.value = clean;
        onChange?.(event);
      }}
      {...props}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  ComponentPropsWithoutRef<"textarea">
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(CONTROL_BASE, CONTROL_STATE, "min-h-28 py-3 leading-relaxed", className)}
      {...props}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  ComponentPropsWithoutRef<"select">
>(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          CONTROL_BASE,
          CONTROL_STATE,
          "h-11 cursor-pointer appearance-none pr-9",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M4 6l4 4 4-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
});

/**
 * Password input with a show/hide toggle.
 *
 * The toggle is a real button so it is keyboard-reachable, and its state is
 * announced via aria-pressed. Revealing is per-field and resets on unmount — we
 * never persist it, since a revealed password can outlive the user's attention.
 */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<ComponentPropsWithoutRef<"input">, "type">
>(function PasswordInput({ className, ...props }, ref) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? "text" : "password"}
        className={cn(CONTROL_BASE, CONTROL_STATE, "h-11 pr-11", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        className={cn(
          "absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center",
          "rounded-control text-ink-muted transition-colors hover:text-ink",
          "focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-navy/40",
        )}
        // Keep focus on the field: toggling should not interrupt typing.
        onMouseDown={(event) => event.preventDefault()}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
});

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M1.667 10S4.667 4.167 10 4.167 18.333 10 18.333 10 15.333 15.833 10 15.833 1.667 10 1.667 10Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M8.2 4.35A7.3 7.3 0 0 1 10 4.167c5.333 0 8.333 5.833 8.333 5.833a13.9 13.9 0 0 1-2.1 2.96M11.8 11.8a2.5 2.5 0 1 1-3.54-3.54"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.6 13.6A7.7 7.7 0 0 1 10 15.833C4.667 15.833 1.667 10 1.667 10a13.9 13.9 0 0 1 3.73-4.4M2.5 2.5l15 15"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Search input with a leading glyph and an optional clear button.
 *
 * `size` exists because a hero search wants more presence than an inline filter
 * bar, and the alternative — hand-rolling the markup per surface — is how the
 * two drifted apart in the first place. Both sizes keep one control height so
 * they still line up with buttons and selects beside them.
 */
export function SearchInput({
  value,
  onValueChange,
  label,
  size = "md",
  className,
  ...props
}: Omit<ComponentPropsWithoutRef<"input">, "onChange" | "value" | "size"> & {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  size?: "md" | "lg";
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    // The whole box is the target: the input alone is one text line tall and
    // stops short of the icon, so hovering or clicking the padding showed the
    // arrow and did nothing. A click anywhere but the clear button focuses it.
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget || (event.target as Element).closest("svg[aria-hidden]")) {
          event.preventDefault();
          inputRef.current?.focus();
        }
      }}
      className={cn(
        "flex cursor-text items-center gap-2 rounded-control border border-line bg-surface transition-colors focus-within:border-navy/35 focus-within:ring-2 focus-within:ring-navy/10",
        size === "lg" ? "h-13 px-4" : "h-11 px-3.5",
        className,
      )}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 20 20"
        fill="none"
        className="shrink-0 text-ink-muted"
        aria-hidden="true"
      >
        <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
        <path d="M16 16l-3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        ref={inputRef}
        className="h-full w-full bg-transparent text-small text-ink outline-none placeholder:text-ink-subtle"
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onValueChange("")}
          aria-label="Clear search"
          className="shrink-0 rounded-full p-0.5 text-ink-subtle transition-colors hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M18 6 6 18M6 6l12 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

/** Pill-style toggle used for filter chips throughout the design. */
export function ChipToggle({
  active,
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"button"> & { active: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-caption font-medium transition-colors",
        active
          ? "border-navy bg-navy text-white"
          : "border-line text-ink-muted hover:border-navy hover:text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
