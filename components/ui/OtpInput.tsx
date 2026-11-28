"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * One-time-code input: N single-digit boxes that behave like one field.
 *
 * - typing advances, Backspace on an empty box steps back
 * - pasting a whole code fills every box
 * - the first box carries `autocomplete="one-time-code"` so iOS / Android can
 *   offer the SMS code
 *
 * Ported from mls-v2/frontend PhoneVerificationModal's OTP step.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled,
  invalid,
  label = "Verification code",
  onComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  label?: string;
  /** Fires once every box holds a digit. */
  onComplete?: (code: string) => void;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  function commit(next: string) {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
  }

  function setDigit(index: number, digit: string) {
    const chars = digits.slice();
    chars[index] = digit;
    commit(chars.join(""));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      setDigit(index - 1, "");
      refs.current[index - 1]?.focus();
    } else if (event.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    event.preventDefault();
    commit(pasted);
    refs.current[Math.min(pasted.length, length - 1)]?.focus();
  }

  return (
    <div role="group" aria-label={label} className="flex justify-between gap-2">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={length}
          aria-label={`Digit ${index + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          value={digit}
          onPaste={onPaste}
          onKeyDown={(event) => onKeyDown(event, index)}
          onChange={(event) => {
            const typed = event.target.value.replace(/\D/g, "");
            if (typed.length > 1) {
              // Autofill drops the whole code into one box.
              commit(typed);
              refs.current[Math.min(typed.length, length - 1)]?.focus();
              return;
            }
            setDigit(index, typed);
            if (typed && index < length - 1) refs.current[index + 1]?.focus();
          }}
          onFocus={(event) => event.target.select()}
          className={cn(
            "h-12 w-full min-w-0 rounded-control border bg-surface text-center text-h3 font-semibold text-ink tabular-nums transition-colors",
            "focus:border-navy/35 focus:outline-none focus:ring-2 focus:ring-navy/10",
            "disabled:bg-surface-alt disabled:text-ink-subtle",
            invalid ? "border-negative" : "border-line",
          )}
        />
      ))}
    </div>
  );
}
