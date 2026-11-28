import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { SafeImage } from "@/components/ui/SafeImage";
import type { InvestorPick } from "@/lib/api/homeMappers";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/format";

function pct(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

/** Investor yield card used on the homepage rail and /high-return. */
export function HighReturnCard({
  pick,
  tone = "dark",
}: {
  pick: InvestorPick;
  tone?: "dark" | "light";
}) {
  const facts = [
    pick.bedrooms ? `${pick.bedrooms} bd` : null,
    pick.bathrooms ? `${pick.bathrooms} ba` : null,
    pick.city || null,
    pick.compsUsed ? `${pick.compsUsed} rent comps` : null,
  ].filter(Boolean);

  const dark = tone === "dark";
  const stats = [
    {
      label: "Est. rent",
      value: pick.estimatedMonthlyRent === null ? "—" : formatPrice(pick.estimatedMonthlyRent),
    },
    { label: "Gross yield", value: pct(pick.grossYieldPct) },
    { label: "Cap rate", value: pct(pick.capRatePct) },
  ];

  return (
    <Link
      href={`/property/${encodeURIComponent(pick.listingKey)}`}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-surface transition-shadow",
        dark
          ? "border border-white/10 bg-white/10 hover:bg-white/15"
          : "border border-line bg-surface shadow-card hover:shadow-card-hover",
      )}
    >
      <div
        className={cn(
          "relative aspect-[16/10] w-full shrink-0 overflow-hidden",
          dark ? "bg-linear-to-br from-navy to-navy-deep" : "bg-surface-alt",
        )}
      >
        <SafeImage
          src={pick.imageUrl}
          alt={pick.address}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {pick.grossYieldPct !== null && (
          <Badge
            tone="gold"
            className="absolute left-3 top-3 px-2.5 py-1 text-[11px] font-bold leading-none"
          >
            {pct(pick.grossYieldPct)} Yield
          </Badge>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-5">
        <p className={cn("text-h2", dark ? "text-white" : "text-ink")}>
          {formatPrice(pick.listPrice)}
        </p>
        <p
          className={cn(
            "mt-1 truncate text-small font-medium",
            dark ? "text-white/80" : "text-ink",
          )}
          title={pick.address}
        >
          {pick.address}
        </p>
        <p
          className={cn(
            "mt-0.5 truncate text-caption",
            dark ? "text-white/50" : "text-ink-muted",
          )}
          title={facts.join(" · ")}
        >
          {facts.join(" · ") || "—"}
        </p>

        <dl className="mt-auto grid grid-cols-3 gap-2 pt-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className={cn(
                "flex min-w-0 flex-col-reverse rounded-control p-2 text-center",
                dark ? "bg-white/10" : "bg-surface-alt",
              )}
            >
              <dt
                className={cn(
                  "mt-0.5 truncate text-[10px] font-normal tracking-normal",
                  dark ? "text-white/50" : "text-ink-muted",
                )}
              >
                {s.label}
              </dt>
              <dd className="truncate text-small font-semibold text-gold">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Link>
  );
}
