import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { SafeImage } from "@/components/ui/SafeImage";
import type { ProfitableInvestmentRow } from "@/lib/api/homeMappers";
import { formatPrice } from "@/lib/utils/format";

function compactGain(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    return `$${millions >= 10 ? Math.round(millions) : millions.toFixed(1)}M`;
  }
  return `$${Math.round(abs / 1000)}K`;
}

/** Sold-above card — mirrors Sold Below, with gain instead of loss. */
export function ProfitableInvestmentCard({ row }: { row: ProfitableInvestmentRow }) {
  const pct = ((row.gainAmount / row.previousClosePrice) * 100).toFixed(1);
  const href = `/property/${encodeURIComponent(row.listingKey)}`;
  const bottomLine = `Sold ${compactGain(row.gainAmount)} above previous purchase`;

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
          {pct}% above last purchase
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
          <Badge tone="gold" className="shrink-0 px-2 py-0.5 font-bold">
            Gained {formatPrice(row.gainAmount)}
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
