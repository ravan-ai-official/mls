"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/cn";
import { IconButton } from "@/components/ui/Button";
import { useScrollLock } from "@/lib/hooks/useScrollLock";

/** Open dialogs, innermost last — only the top one handles Escape and Tab. */
const stack: symbol[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog.
 *
 * The reference's AuthModal had no focus trap, no Escape handler, no scroll lock
 * and no ARIA roles. This adds all four, plus focus restoration on close.
 *
 * Every overlay in the app should be this component (or `ConfirmDialog` /
 * `PromptDialog`, which wrap it) rather than a hand-rolled `fixed inset-0`
 * div, so they all lock scroll, trap focus and close the same way.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "full";
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const token = useRef(Symbol("modal"));
  // Held in a ref so a parent passing an inline `onClose` doesn't re-run the
  // open effect on every render (which would steal focus back each time).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useScrollLock(open);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // A dialog opened on top of this one owns the keyboard.
      if (stack[stack.length - 1] !== token.current) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      // Focus trap: cycle within the dialog.
      const items = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [],
  );

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const self = token.current;
    stack.push(self);

    document.addEventListener("keydown", handleKeyDown, true);

    // Focus the control marked `data-autofocus`, else the first one inside.
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      const target =
        panel?.querySelector<HTMLElement>("[data-autofocus]") ??
        panel?.querySelector<HTMLElement>(FOCUSABLE) ??
        panel;
      target?.focus();
    });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", handleKeyDown, true);
      const at = stack.lastIndexOf(self);
      if (at !== -1) stack.splice(at, 1);
      previouslyFocused.current?.focus?.();
    };
  }, [open, handleKeyDown]);

  if (!open || typeof document === "undefined") return null;

  const widths = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
    full: "h-[calc(100dvh-1rem)] max-h-none w-full max-w-[90rem] sm:h-[calc(100dvh-2rem)]",
  };

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[600] flex justify-center overscroll-contain",
        size === "full" ? "items-center p-2 sm:p-4" : "items-end sm:items-center sm:p-4",
      )}
    >
      <div
        className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "animate-fade-up relative flex w-full flex-col overflow-hidden bg-surface shadow-pop",
          "rounded-t-2xl sm:rounded-2xl",
          size === "full" ? "max-h-none" : "max-h-[92vh]",
          widths[size],
        )}
      >
        <header className={cn("flex items-start justify-between gap-4 border-b border-line px-6 py-5", size === "full" && "shrink-0")}>
          <div>
            <h2 id={titleId} className="text-h2 text-ink">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-small text-ink-muted">
                {description}
              </p>
            )}
          </div>
          <IconButton label="Close dialog" variant="ghost" size="sm" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M18 6 6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </IconButton>
        </header>

        <div
          className={cn(
            "min-h-0 flex-1",
            size === "full"
              ? "flex flex-col overflow-hidden px-4 py-4 sm:px-6"
              : "overflow-y-auto overscroll-contain px-6 py-5",
          )}
        >
          {children}
        </div>

        {footer && (
          <footer className="border-t border-line bg-surface-alt px-6 py-4">{footer}</footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
