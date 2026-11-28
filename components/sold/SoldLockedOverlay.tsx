"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { cn } from "@/lib/utils/cn";

/**
 * Blur/lock overlay for sold surfaces — cards, map previews, detail hero.
 * Callers put this over media (or the locked block); Sign in / Register open
 * the shared auth dialog and optionally continue via `onUnlocked`.
 */
export function SoldLockedOverlay({
  className,
  dense = false,
  message = "Sign in to view sold data",
  onUnlocked,
}: {
  className?: string;
  /** Compact copy for card thumbnails / map rows. */
  dense?: boolean;
  message?: string;
  /** Runs after a successful sign-in (refetch is usually handled globally). */
  onUnlocked?: () => void;
}) {
  const { openAuth } = useAuth();

  return (
    <div
      className={cn(
        // Stay inside the card photo only — never compete with sticky filters (z-40).
        "pointer-events-auto absolute inset-0 z-[1] flex flex-col items-center justify-center overflow-hidden bg-ink/50 text-center backdrop-blur-[6px]",
        dense ? "gap-1 px-1.5 py-2" : "gap-2 px-3",
        className,
      )}
      onClick={(event) => {
        // Keep the card/link from navigating when tapping the CTA stack.
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <LockIcon className={dense ? "h-4 w-4 shrink-0" : "h-7 w-7 shrink-0"} />
      <p
        className={cn(
          "max-w-full font-semibold text-white",
          dense ? "px-0.5 text-[10px] leading-tight" : "text-small",
        )}
      >
        {message}
      </p>
      <div
        className={cn(
          "flex max-w-full flex-wrap items-center justify-center",
          dense ? "gap-1" : "gap-2",
        )}
      >
        <button
          type="button"
          onClick={() => openAuth("login", onUnlocked)}
          className={cn(
            "rounded-control bg-white font-semibold text-navy transition hover:bg-surface-alt",
            dense ? "px-2 py-0.5 text-[10px]" : "px-3.5 py-1.5 text-caption",
          )}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => openAuth("signup", onUnlocked)}
          className={cn(
            "rounded-control border border-white/80 font-semibold text-white transition hover:bg-white/10",
            dense ? "px-2 py-0.5 text-[10px]" : "px-3.5 py-1.5 text-caption",
          )}
        >
          Register
        </button>
      </div>
    </div>
  );
}

/** Section-level empty/locked state for homepage sold rails. */
export function SoldLockedEmptyState({
  title = "Sign in to view sold data",
  description = "MLS® rules require a free account before sold prices can be shown.",
  className,
  onUnlocked,
}: {
  title?: string;
  description?: string;
  className?: string;
  onUnlocked?: () => void;
}) {
  const { openAuth } = useAuth();

  return (
    <div
      className={cn(
        "rounded-surface border border-line bg-surface px-6 py-12 text-center shadow-card",
        className,
      )}
    >
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-alt text-navy">
        <LockIcon className="h-6 w-6" />
      </div>
      <h3 className="text-body font-semibold text-ink">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-small text-ink-muted">{description}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => openAuth("login", onUnlocked)}
          className="rounded-control bg-navy px-5 py-2.5 text-small font-semibold text-white transition hover:bg-navy-deep"
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => openAuth("signup", onUnlocked)}
          className="rounded-control border border-line px-5 py-2.5 text-small font-semibold text-ink transition hover:bg-surface-alt"
        >
          Register
        </button>
      </div>
    </div>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("text-white", className)}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M7 11V7a5 5 0 0 1 10 0v4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
