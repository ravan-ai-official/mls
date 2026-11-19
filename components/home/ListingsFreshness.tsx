import { getListingSyncStatus } from "@/lib/api/market";
import { searchProperties } from "@/lib/api/properties";
import { formatNumber, formatTorontoDateTime } from "@/lib/utils/format";

const LINE_CLASS = "mt-6 flex items-center gap-2 text-small text-white/75";

/**
 * Hero "live listings · updated …" line.
 *
 * Count comes from the Active catalogue (what visitors can browse). Timestamp
 * is the last successful MLS® listing sync. Both are fetched fresh on each
 * request — never a hardcoded CMS string.
 */
export async function ListingsFreshness() {
  const [status, active] = await Promise.all([
    getListingSyncStatus({ cache: "no-store", timeoutMs: 8_000 }),
    searchProperties(
      { status: "Active", limit: 1 },
      { cache: "no-store", timeoutMs: 8_000 },
    ).catch(() => null),
  ]);

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

/**
 * Suspense fallback and no-sync-on-record state. Deliberately claims no
 * cadence ("updated daily"): without a sync time that would be unverified.
 */
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
