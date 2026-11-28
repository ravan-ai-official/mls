"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { IconButton } from "@/components/ui/Button";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { cn } from "@/lib/utils/cn";

/** Open sheets, innermost last — only the top one handles Escape and Tab. */
const stack: symbol[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const MOBILE_SHEET_VH = 85;
/** Drag down past this fraction of the sheet height → dismiss. */
const DISMISS_FRACTION = 0.35;

/**
 * Filter / secondary-tool sheet.
 * Phones: draggable bottom sheet. `sm+`: right-side panel.
 * z-index sits above the map results drawer so the two never fight.
 */
export function SideSheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const token = useRef(Symbol("side-sheet"));
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    lastY: number;
    lastT: number;
    velocityY: number;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      setDragOffset(0);
      setDragging(false);
      dragRef.current = null;
    }
  }, [open]);

  useScrollLock(open);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (stack[stack.length - 1] !== token.current) return;
    if (event.key === "Escape") {
      event.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;

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
  }, []);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const self = token.current;
    stack.push(self);
    document.addEventListener("keydown", handleKeyDown, true);

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

  const onHandlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Desktop rail — no drag.
    if (window.matchMedia("(min-width: 640px)").matches) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastT: performance.now(),
      velocityY: 0,
    };
    setDragging(true);
  };

  const onHandlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const now = performance.now();
    const dt = Math.max(now - drag.lastT, 1);
    drag.velocityY = (event.clientY - drag.lastY) / dt;
    drag.lastY = event.clientY;
    drag.lastT = now;
    const delta = Math.max(0, event.clientY - drag.startY);
    setDragOffset(delta);
  };

  const endHandleDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // already released
    }
    const sheetPx = (MOBILE_SHEET_VH / 100) * window.innerHeight;
    const shouldClose =
      dragOffset > sheetPx * DISMISS_FRACTION || drag.velocityY > 0.7;
    dragRef.current = null;
    setDragging(false);
    if (shouldClose) {
      onClose();
      return;
    }
    setDragOffset(0);
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn(
        // Above map results (z-450), map chrome (z-480), and navbar (z-520).
        "fixed inset-0 z-[600] flex overscroll-contain",
        "items-end justify-center sm:items-stretch sm:justify-end",
        className,
      )}
    >
      <div
        className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
        style={{ opacity: dragOffset > 0 ? Math.max(0.15, 1 - dragOffset / 400) : 1 }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex w-full flex-col overflow-hidden bg-surface shadow-pop",
          "h-[min(85dvh,100%)] max-w-none rounded-t-2xl",
          "sm:h-full sm:max-w-lg sm:rounded-none",
          !dragging && "transition-[height] duration-300 ease-out sm:transition-none",
          !dragging && dragOffset === 0 && "animate-sheet-in",
        )}
        style={
          dragOffset > 0
            ? {
                height: `calc(${MOBILE_SHEET_VH}dvh - ${dragOffset}px)`,
                maxHeight: "100%",
              }
            : undefined
        }
      >
        <div
          role="presentation"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={endHandleDrag}
          onPointerCancel={endHandleDrag}
          className="touch-none flex shrink-0 cursor-grab flex-col items-center py-3 active:cursor-grabbing sm:hidden"
        >
          <span className="h-1 w-10 rounded-full bg-ink-subtle" />
        </div>

        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 pb-4 pt-0 sm:px-6 sm:pt-4">
          <div>
            <h2 id={titleId} className="text-h3 text-ink">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-caption text-ink-muted">
                {description}
              </p>
            )}
          </div>
          <IconButton label="Close" variant="ghost" size="sm" onClick={onClose}>
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

        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
          {children}
        </div>

        {footer && (
          <footer className="shrink-0 border-t border-line bg-surface px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
