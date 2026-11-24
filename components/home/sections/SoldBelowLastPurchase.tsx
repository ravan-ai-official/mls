"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { SafeImage } from "@/components/ui/SafeImage";
import { Section } from "@/components/ui/Section";
import { EmptyState, PropertyGridSkeleton } from "@/components/ui/States";
import { getSoldBelowPurchase } from "@/lib/api/home";
import type { SoldBelowRow } from "@/lib/api/homeMappers";
import { readClientVisitor } from "@/lib/personalize/clientVisitor";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";
import { textOf } from "@/lib/site/read";
import { formatPrice } from "@/lib/utils/format";
import { buildListingHref } from "@/lib/utils/searchParams";

/**
 * Sold-below rail from mls-backend `/api/home/sold-below-purchase/`.
 * Client fetch so Network shows the home-feed JSON. Keeps the section visible
 * with EmptyState when the feed has no displayable rows (same pattern as Featured).
 */
export function SoldBelowLastPurchase({ content }: { content?: Record<string, unknown> }) {
  const { data: rows, isPending } = useMlsQuery<SoldBelowRow[] | null>(
    ["home", "sold-below"],
    async () => {
      const visitor = readClientVisitor();
      return getSoldBelowPurchase(3, {
        cities: visitor.cities,
        cache: "no-store",
      });
    },
    null,
  );

  const eyebrow = textOf(content, "eyebrow", "Buyer's opportunity");
  const title = textOf(content, "title", "Sold Below Last Purchase");
  const description = textOf(
    content,
    "description",
    "Properties that recently sold below their previous purchase price — potential value opportunities",
  );
  const action = {
    label: textOf(content, "actionLabel", "View All Sold Data"),
    href: textOf(content, "actionHref", buildListingHref({ status: "Sold" })),
  };

  if (isPending && !rows) {
    return (
      <Section eyebrow={eyebrow} title={title}>
        <PropertyGridSkeleton count={3} />
      </Section>
    );
  }

  // Live feed only — drop imageless rows so we never show beige placeholders.
  const displayRows = (rows ?? []).filter((row) => Boolean(row.imageUrl));

  return (
    <Section eyebrow={eyebrow} title={title} description={description} action={action}>
      {displayRows.length === 0 ? (
        <EmptyState
          title="No sold-below listings available"
          description="We don't have recent homes that sold below their previous purchase right now."
          action={action}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {displayRows.map((row) => (
            <SoldCard key={row.listingKey} row={row} />
          ))}
        </div>
      )}
    </Section>
  );
}

function compactLoss(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    return `$${millions >= 10 ? Math.round(millions) : millions.toFixed(1)}M`;
  }
  return `$${Math.round(abs / 1000)}K`;
}

function SoldCard({ row }: { row: SoldBelowRow }) {
  const pct = ((row.lossAmount / row.previousClosePrice) * 100).toFixed(1);
  const href = `/property/${encodeURIComponent(row.listingKey)}`;
  const bottomLine = `Sold ${compactLoss(row.lossAmount)} below previous purchase`;

  return (
    <Link
      href={href}
      className="group overflow-hidden rounded-surface border border-line bg-surface transition-shadow hover:shadow-card-hover"
    >
      <div className="relative h-[180px] overflow-hidden bg-surface-alt">
        <SafeImage
          src={row.imageUrl}
          alt={row.address}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <Badge tone="navy" className="absolute left-3 top-3 font-bold">
          {pct}% below last purchase
        </Badge>
      </div>
      <div className="p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <div>
            <p className="text-h3 text-ink">{formatPrice(row.closePrice)}</p>
            <p className="text-caption text-ink-muted line-through">
              Prev: {formatPrice(row.previousClosePrice)}
            </p>
          </div>
          <Badge tone="warm" className="shrink-0 px-2 py-0.5 font-bold">
            Saved {formatPrice(row.lossAmount)}
          </Badge>
        </div>
        <p className="truncate text-small font-medium text-ink">{row.address}</p>
        <p className="mt-0.5 text-caption text-ink-muted">
          {row.city} · {bottomLine}
        </p>
      </div>
    </Link>
  );
}
