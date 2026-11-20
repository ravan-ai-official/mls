"use client";

import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import type { RecentSale } from "@/lib/api/market";
import { useRecentSales } from "@/lib/queries/market";
import { propertyPath } from "@/lib/seo/urls";
import { EMPTY, formatDate, formatNumber, formatPrice } from "@/lib/utils/format";

/**
 * The Recently Sold list (scope #7). Rendered in the browser because it is
 * sign-in gated and signing in does not re-render server components; the
 * query key is per-user, so signing out drops the cached sold prices.
 */
export function RecentSalesList({ city, days, page }: { city: string; days: number; page: number }) {
  const { user, openAuth } = useAuth();
  const query = useRecentSales(city, days, page);

  if (!user) {
    return (
      <EmptyState
        title="Sign in to see sold prices"
        description="MLS® rules require a free account before sold prices can be shown. It takes a few seconds."
        action={{ label: "Sign in", onClick: () => openAuth("login") }}
      />
    );
  }

  if (query.isPending) return <RecentSalesSkeleton />;
  if (query.isError) {
    return (
      <ErrorState
        title="Sold data is temporarily unavailable"
        description={query.error.message}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const data = query.data;
  if (data.count === 0) {
    return (
      <EmptyState
        title={`No recorded sales in ${city}`}
        description={`No closed sales were found for ${city} in the last ${days} days.`}
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(data.count / data.pageSize));
  const buildHref = (next: number) =>
    `/recently-sold?${new URLSearchParams({ city, days: String(days), ...(next > 1 ? { page: String(next) } : {}) })}`;

  return (
    <div className={query.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
      <p className="text-small text-ink-muted">
        {data.truncated ? "More than " : ""}
        {formatNumber(data.count)} homes sold in {city} in the last {days} days, newest first.
      </p>

      {/* Table from md up; stacked cards below, where 7 columns cannot fit. */}
      <div className="mt-4 hidden overflow-hidden rounded-surface border border-line md:block">
        <table className="w-full text-left text-small">
          <thead className="bg-surface-alt text-caption uppercase tracking-wide text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Address</th>
              <th scope="col" className="px-4 py-3 font-medium">Type</th>
              <th scope="col" className="px-4 py-3 font-medium">Beds / baths</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Sold for</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">vs. asking</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Days on market</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Sold on</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-surface">
            {data.results.map((sale) => (
              <tr key={sale.listingKey} className="hover:bg-surface-alt/60">
                <td className="px-4 py-3 text-ink">
                  {sale.listingKey ? (
                    <Link href={propertyPath(sale.listingKey)} className="font-medium hover:text-navy hover:underline">
                      {shortAddress(sale)}
                    </Link>
                  ) : (
                    shortAddress(sale)
                  )}
                </td>
                <td className="px-4 py-3 text-ink-muted">{sale.propertyType ?? EMPTY}</td>
                <td className="px-4 py-3 text-ink-muted">{bedsBaths(sale)}</td>
                <td className="px-4 py-3 text-right font-semibold text-ink">{formatPrice(sale.closePrice)}</td>
                <td className="px-4 py-3 text-right"><AskingDelta sale={sale} /></td>
                <td className="px-4 py-3 text-right text-ink-muted">{sale.daysOnMarket ?? EMPTY}</td>
                <td className="px-4 py-3 text-right text-ink-muted">{formatDate(sale.closeDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="mt-4 space-y-3 md:hidden">
        {data.results.map((sale) => {
          const card = (
            <>
              <div className="flex items-start justify-between gap-3">
                <p className="text-small font-medium text-ink">{shortAddress(sale)}</p>
                <AskingDelta sale={sale} />
              </div>
              <p className="mt-1 text-h3 text-ink">{formatPrice(sale.closePrice)}</p>
              <p className="mt-1 text-caption text-ink-muted">
                {[sale.propertyType, bedsBaths(sale), `Sold ${formatDate(sale.closeDate)}`]
                  .filter((part) => part && part !== EMPTY)
                  .join(" · ")}
              </p>
            </>
          );
          return (
            <li key={sale.listingKey}>
              {sale.listingKey ? (
                <Link
                  href={propertyPath(sale.listingKey)}
                  className="block rounded-surface border border-line bg-surface p-4 transition-shadow hover:shadow-card-hover"
                >
                  {card}
                </Link>
              ) : (
                <div className="rounded-surface border border-line bg-surface p-4">{card}</div>
              )}
            </li>
          );
        })}
      </ul>

      {totalPages > 1 && (
        <div className="mt-8">
          <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />
        </div>
      )}
      <p className="mt-6 text-caption text-ink-subtle">
        Source: TRREB MLS® closed sales. Sold prices are shown to signed-in users only.
      </p>
    </div>
  );
}

/** The feed's UnparsedAddress repeats city, province and postal code. */
function shortAddress(sale: RecentSale): string {
  return sale.address.split(",")[0]?.trim() || sale.address || EMPTY;
}

function bedsBaths(sale: RecentSale): string {
  if (sale.beds === null && sale.baths === null) return EMPTY;
  return `${sale.beds ?? EMPTY} bd / ${sale.baths ?? EMPTY} ba`;
}

function AskingDelta({ sale }: { sale: RecentSale }) {
  const pct = sale.overUnderAskingPct;
  if (pct === null) return <span className="text-ink-subtle">{EMPTY}</span>;
  if (pct === 0) return <Badge tone="neutral">At asking</Badge>;
  return (
    <Badge tone={pct > 0 ? "positive" : "negative"}>
      {pct > 0 ? "+" : ""}
      {pct}%
    </Badge>
  );
}

function RecentSalesSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading recent sales">
      <Skeleton className="h-4 w-64" />
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
