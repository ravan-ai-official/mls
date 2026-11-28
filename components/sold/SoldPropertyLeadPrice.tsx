"use client";

import { useSoldLock } from "@/components/sold/useSoldLock";
import { statusLabel } from "@/lib/api/mappers";
import type { PropertyStatus } from "@/lib/types/domain";
import { EMPTY, formatLeasePrice, formatPrice } from "@/lib/utils/format";

/**
 * Detail-page sold / list price headline. Never renders close_price when locked.
 * Sign-in CTA lives in SoldDetailGate below the teaser.
 */
export function SoldPropertyLeadPrice({
  status,
  soldLocked,
  closePrice,
  listPrice,
  isLease,
  mls,
}: {
  status: PropertyStatus;
  soldLocked?: boolean;
  closePrice: number | null;
  listPrice: number | null;
  isLease: boolean;
  mls: string;
}) {
  const { locked, closePrice: revealedClose } = useSoldLock({
    soldLocked,
    status,
    closePrice,
  });

  const priceLabel =
    listPrice === null
      ? EMPTY
      : isLease
        ? formatLeasePrice(listPrice)
        : formatPrice(listPrice);

  const soldClose = status === "sold" && !locked ? revealedClose : null;
  const headlinePrice =
    soldClose !== null
      ? isLease
        ? formatLeasePrice(soldClose)
        : formatPrice(soldClose)
      : locked && status === "sold"
        ? "Sold"
        : priceLabel;
  const overAsk =
    soldClose !== null && listPrice
      ? ((soldClose - listPrice) / listPrice) * 100
      : null;

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[1.75rem] font-semibold leading-tight text-ink sm:text-[2rem]">
          {headlinePrice}
          {overAsk !== null && (
            <span
              className={`ml-3 inline-flex rounded-full px-3 py-1 align-middle text-[13px] font-semibold ${
                overAsk >= 0 ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"
              }`}
            >
              {overAsk >= 0 ? "+" : ""}
              {overAsk.toFixed(1)}% {overAsk >= 0 ? "over asking" : "below asking"}
            </span>
          )}
        </p>
        {locked && status === "sold" && (
          <p className="mt-2 text-[13px] text-ink-muted">
            Sign in to unlock sold price and history
          </p>
        )}
      </div>
      <div className="text-left sm:text-right">
        <p className="text-[12px] text-ink-muted">
          {status === "sold"
            ? locked
              ? "Status"
              : "Asking price"
            : status === "active"
              ? "MLS®"
              : "Status"}
        </p>
        <p
          className={
            status === "sold" && !locked
              ? "text-[18px] font-medium text-ink-muted line-through"
              : status === "active"
                ? "text-[18px] font-semibold text-navy"
                : "text-[18px] font-semibold text-ink-muted"
          }
        >
          {status === "sold"
            ? locked
              ? "Sold"
              : priceLabel
            : status === "active"
              ? mls
              : statusLabel(status)}
        </p>
        {status === "active" && (
          <p className="text-[12px] text-ink-muted">Listed</p>
        )}
        {status !== "active" && status !== "sold" && (
          <p className="text-[12px] text-ink-muted">MLS® {mls}</p>
        )}
      </div>
    </div>
  );
}
