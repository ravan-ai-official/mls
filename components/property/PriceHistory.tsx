import { statusLabel, normalizeStatus } from "@/lib/api/mappers";
import type { PriceSnapshot } from "@/lib/api/neighbourhood";
import { EMPTY, formatDate, formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * Buy/Sell history table from HomeAtlasUI.
 * Prefer API history[] fields: date_start, date_end, price, event, listing_id.
 * Never put event/status text in the Date End column.
 */
export function PriceHistory({
  snapshots,
  listingId,
}: {
  snapshots: PriceSnapshot[];
  listingId: string;
}) {
  const ordered = [...snapshots].sort((a, b) =>
    (a.dateStart ?? a.recordedAt ?? "") < (b.dateStart ?? b.recordedAt ?? "") ? -1 : 1,
  );
  const newestFirst = [...ordered].reverse();
  const changes = ordered.filter((row, index) => {
    const previous = ordered[index - 1];
    return previous?.listPrice != null && row.listPrice != null && row.listPrice !== previous.listPrice;
  });

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-line">
        <div className="border-b border-line bg-surface-alt px-4 py-4 sm:px-6">
          <h2 className="text-[18px] font-semibold text-ink">Buy/Sell History</h2>
        </div>
        {newestFirst.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-ink-muted sm:px-6">
            No recorded history for this listing yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead className="border-b border-line bg-surface-alt/60">
                <tr>
                  {["Date Start", "Date End", "Price", "Event", "Listing ID"].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-left font-medium text-ink-muted sm:px-6">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {newestFirst.map((row, index) => {
                  const start = row.dateStart ?? row.recordedAt;
                  const end = row.dateEnd ? formatDate(row.dateEnd) : EMPTY;
                  const eventText = row.event ?? row.status;
                  const rowListingId = row.listingId || listingId || EMPTY;
                  return (
                    <tr key={`${start}-${index}`} className="border-b border-line-soft">
                      <td className="px-4 py-4 sm:px-6">{formatDate(start)}</td>
                      <td className="px-4 py-4 text-ink-muted sm:px-6">{end}</td>
                      <td className="px-4 py-4 font-semibold text-navy sm:px-6">
                        {formatPrice(row.listPrice)}
                      </td>
                      <td className="px-4 py-4 sm:px-6">
                        <EventBadge event={eventText} />
                      </td>
                      <td className="px-4 py-4 text-ink-muted sm:px-6">{rowListingId}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-line p-4 sm:p-6">
        <h3 className="mb-2 text-[16px] font-semibold text-ink">Price Changes ({changes.length})</h3>
        {changes.length === 0 ? (
          <p className="text-[13px] text-ink-muted">No price changes recorded for this listing.</p>
        ) : (
          <ul className="space-y-2 text-[13px]">
            {changes.map((row) => (
              <li key={row.dateStart ?? row.recordedAt ?? String(row.listPrice)} className="flex justify-between gap-3">
                <span className="text-ink-muted">{formatDate(row.dateStart ?? row.recordedAt)}</span>
                <span className="font-medium text-ink">{formatPrice(row.listPrice)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EventBadge({ event }: { event: string | null }) {
  if (!event) {
    return <span className="text-ink-muted">{EMPTY}</span>;
  }
  const normalized = normalizeStatus(event);
  const label = statusLabel(normalized);
  // If normalizeStatus collapses unknown strings to "other", keep the feed event text.
  const display = normalized === "other" && event.trim() ? event.trim() : label;
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
        normalized === "sold" && "bg-red-100 text-red-600",
        normalized === "active" && "bg-green-100 text-green-700",
        normalized !== "sold" && normalized !== "active" && "bg-surface-alt text-ink-muted",
      )}
    >
      {display}
    </span>
  );
}
