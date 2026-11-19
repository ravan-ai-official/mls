"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Anchored dropdown panel — the navbar account menu and the Watched menu.
 *
 * Styling follows HomeAtlasUI's Navbar dropdowns: `rounded-surface`, hairline
 * border, `shadow-pop`, right-aligned under the trigger. Behaviour: outside
 * mousedown and Escape close it, Escape returns focus to the trigger, and the
 * trigger carries `aria-expanded` / `aria-controls`.
 *
 * `role` defaults to "menu" for a list of actions. Use "dialog" when the panel
 * holds richer content (tabs, lists) that a menu role would misdescribe.
 */
export function Menu({
  trigger,
  children,
  align = "right",
  panelClassName,
  role = "menu",
  label,
  openOnHover = false,
}: {
  /** Render prop so the caller owns the trigger's look. */
  trigger: (props: {
    open: boolean;
    toggle: () => void;
    buttonProps: {
      "aria-expanded": boolean;
      "aria-haspopup": "menu" | "dialog";
      "aria-controls": string;
      onClick: () => void;
      ref: React.RefObject<HTMLButtonElement | null>;
    };
  }) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: "left" | "right";
  panelClassName?: string;
  role?: "menu" | "dialog";
  /** Accessible name for a dialog-role panel. */
  label?: string;
  /** Open on pointer hover (desktop nav). Click still toggles for touch/keyboard. */
  openOnHover?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const close = useCallback(() => {
    clearCloseTimer();
    setOpen(false);
  }, [clearCloseTimer]);
  const openMenu = useCallback(() => {
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer]);
  const toggle = useCallback(() => {
    clearCloseTimer();
    setOpen((value) => !value);
  }, [clearCloseTimer]);
  const scheduleClose = useCallback(() => {
    if (!openOnHover) return;
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }, [clearCloseTimer, openOnHover]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  return (
    <div
      className="relative"
      ref={rootRef}
      onMouseEnter={openOnHover ? openMenu : undefined}
      onMouseLeave={openOnHover ? scheduleClose : undefined}
    >
      {trigger({
        open,
        toggle,
        buttonProps: {
          "aria-expanded": open,
          "aria-haspopup": role,
          "aria-controls": panelId,
          onClick: toggle,
          ref: triggerRef,
        },
      })}
      {open && (
        <div
          id={panelId}
          role={role}
          aria-label={label}
          className={cn(
            // Padding bridge keeps hover alive while the pointer moves into the panel.
            "absolute top-full z-50 pt-2",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          <div
            className={cn(
              "animate-fade-up overflow-hidden rounded-surface border border-line bg-surface shadow-pop",
              panelClassName ?? "w-60",
            )}
          >
            {typeof children === "function" ? children(close) : children}
          </div>
        </div>
      )}
    </div>
  );
}
/** Row inside a `role="menu"` panel. Renders a link when `href` is set. */
export function MenuItem({
  href,
  onSelect,
  children,
  className,
  LinkComponent,
}: {
  href?: string;
  onSelect?: () => void;
  children: ReactNode;
  className?: string;
  /** Pass next/link's Link; kept injectable so this file stays router-agnostic. */
  LinkComponent?: React.ComponentType<{
    href: string;
    role?: string;
    className?: string;
    onClick?: () => void;
    children: ReactNode;
  }>;
}) {
  const classes = cn(
    "block w-full px-4 py-2.5 text-left text-small text-ink transition-colors hover:bg-surface-alt",
    className,
  );
  if (href && LinkComponent) {
    return (
      <LinkComponent href={href} role="menuitem" className={classes} onClick={onSelect}>
        {children}
      </LinkComponent>
    );
  }
  return (
    <button type="button" role="menuitem" onClick={onSelect} className={classes}>
      {children}
    </button>
  );
}
