"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSoldLock } from "@/components/sold/useSoldLock";
import type { PropertyStatus } from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";

/**
 * Detail-page sold gate: keeps the teaser (address, beds, …) visible and shows a
 * clear Sign in strip when sold dollars / history must stay locked.
 */
export function SoldDetailGate({
  status,
  soldLocked,
  children,
  className,
}: {
  status: PropertyStatus;
  soldLocked?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const { openAuth } = useAuth();
  const { locked } = useSoldLock({ status, soldLocked });

  if (!locked) return <>{children}</>;

  return (
    <div className={cn("space-y-4", className)}>
      {children}
      <div className="rounded-xl border border-navy/15 bg-navy/[0.04] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-ink">
              Sign in to unlock sold price and history
            </p>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              MLS® rules require a free account before sold prices, over/under asking, and
              buy/sell history can be shown.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openAuth("login")}
              className="rounded-control bg-navy px-4 py-2 text-caption font-semibold text-white transition hover:bg-navy-deep"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => openAuth("signup")}
              className="rounded-control border border-line bg-surface px-4 py-2 text-caption font-semibold text-ink transition hover:bg-surface-alt"
            >
              Register
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Filters price-context chips that would leak sold-derived dollars when locked.
 */
export function SoldLockedPriceContext({
  status,
  soldLocked,
  items,
}: {
  status: PropertyStatus;
  soldLocked?: boolean;
  items: Array<{ label: string; value: string }>;
}) {
  const { locked } = useSoldLock({ status, soldLocked });
  const visible = locked
    ? items.filter((item) => !/per sq ft/i.test(item.label))
    : items;

  if (visible.length === 0) return null;

  return (
    <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-b border-line-soft pb-3 text-[13px] text-ink-muted">
      {visible.map((item) => (
        <div key={item.label} className="inline-flex items-baseline gap-1.5">
          <dt>{item.label}</dt>
          <dd className="font-medium text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
