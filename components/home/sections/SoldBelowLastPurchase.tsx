import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { SafeImage } from "@/components/ui/SafeImage";
import { Section } from "@/components/ui/Section";
import { getSoldBelowPurchase } from "@/lib/api/home";
import type { SoldBelowRow } from "@/lib/api/homeMappers";
import { getVisitorPersonalization } from "@/lib/personalize/visitorContext";
import { textOf } from "@/lib/site/read";
import { formatPrice } from "@/lib/utils/format";
import { buildListingHref } from "@/lib/utils/searchParams";

/**
 * Sold-below rail from mls-backend `/api/home/sold-below-purchase/`.
 *
 * Never renders mock/demo cards. When the feed is empty (`empty`, `count` 0,
 * or no complete rows) the whole section is omitted — no title, no skeleton
 * left behind after load. Site Studio headings still apply when there is data.
 */
export async function SoldBelowLastPurchase({ content }: { content?: Record<string, unknown> }) {
  const visitor = await getVisitorPersonalization();
  const rows = await getSoldBelowPurchase(3, {
    cities: visitor.cities,
    headers: visitor.headers,
    cache: "no-store",
  });
  if (!rows || rows.length === 0) return null;

  return (
    <Section
      eyebrow={textOf(content, "eyebrow", "Buyer's opportunity")}
      title={textOf(content, "title", "Sold Below Last Purchase")}
      description={textOf(
        content,
        "description",
        "Properties that recently sold below their previous purchase price — potential value opportunities",
      )}
      action={{
        label: textOf(content, "actionLabel", "View All Sold Data"),
        href: textOf(content, "actionHref", buildListingHref({ status: "Sold" })),
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <SoldCard key={row.listingKey} row={row} />
        ))}
      </div>
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
        {/* Missing image_url → generic house placeholder; never invent listing data. */}
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
