"use client";

import { getListingSyncStatus } from "@/lib/api/market";
import { searchProperties } from "@/lib/api/properties";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";
import { formatNumber, formatTorontoDateTime } from "@/lib/utils/format";

const LINE_CLASS = "mt-6 flex items-center gap-2 text-small text-white/75";

/**
 * Hero "live listings · updated …" line — client fetch so Network shows JSON.
 */
export function ListingsFreshness() {
  const { data } = useMlsQuery(
    ["home", "listings-freshness"],
    async () => {
      const [status, active] = await Promise.all([
        getListingSyncStatus({ cache: "no-store", timeoutMs: 8_000 }).catch(() => null),
        searchProperties(
          { status: "Active", limit: 1 },
          { cache: "no-store", timeoutMs: 8_000 },
        ).catch(() => null),
      ]);
      return { status, active };
    },
    { status: null, active: null },
  );

  const status = data?.status ?? null;
  const active = data?.active ?? null;
  const countFromSearch =
    active && Number.isFinite(active.total) && active.total > 0 ? active.total : null;
  const countFromSync =
    status?.activeListingCount && status.activeListingCount > 0
      ? status.activeListingCount
      : null;
  const count = countFromSearch ?? countFromSync;
  const updatedAt = status?.lastSuccessfulAt ?? null;

  if (!count && !updatedAt) return <ListingsFreshnessFallback />;

  return (
    <p className={LINE_CLASS}>
      <LiveDot />
      <span>
        {count ? `${formatNumber(count)} live MLS® listings` : "Live MLS® listings"}
        {updatedAt ? (
          <>
            {" "}
            · updated <time dateTime={updatedAt}>{formatTorontoDateTime(updatedAt)}</time>
          </>
        ) : null}
      </span>
    </p>
  );
}

export function ListingsFreshnessFallback() {
  return (
    <p className={LINE_CLASS}>
      <LiveDot />
      <span>Live MLS® listings across the Greater Toronto Area</span>
    </p>
  );
}

function LiveDot() {
  return <span className="size-2 shrink-0 rounded-full bg-gold" aria-hidden="true" />;
}
