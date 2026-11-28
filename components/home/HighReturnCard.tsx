import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { SafeImage } from "@/components/ui/SafeImage";
import type { InvestorPick } from "@/lib/api/homeMappers";
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
  ].filter(Boolean);
  if (pick.compsUsed) facts.push(`rent from ${pick.compsUsed} comparable rentals`);

  const dark = tone === "dark";
  const stats = [
    {
      label: "Est. Monthly Rent",
      value: pick.estimatedMonthlyRent === null ? "—" : formatPrice(pick.estimatedMonthlyRent),
    },
    { label: "Gross Yield", value: pct(pick.grossYieldPct) },
    { label: "Cap Rate", value: pct(pick.capRatePct) },
  ];

  return (
    <Link
      href={`/property/${encodeURIComponent(pick.listingKey)}`}
      className={
        dark
          ? "group overflow-hidden rounded-surface border border-white/10 bg-white/10 transition-colors hover:bg-white/15"
          : "group overflow-hidden rounded-surface border border-line bg-surface shadow-card transition-shadow hover:shadow-card-hover"
      }
    >
      <div
        className={
          dark
            ? "relative h-[200px] overflow-hidden bg-linear-to-br from-navy to-navy-deep"
            : "relative h-[200px] overflow-hidden bg-surface-alt"
        }
      >
        <SafeImage
          src={pick.imageUrl}
          alt={pick.address}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {pick.grossYieldPct !== null && (
          <Badge tone="gold" className="absolute left-3 top-3 font-bold">
            {pct(pick.grossYieldPct)} Yield
          </Badge>
        )}
      </div>
      <div className="p-5">
        <p className={dark ? "mb-1 text-h2 text-white" : "mb-1 text-h2 text-ink"}>
          {formatPrice(pick.listPrice)}
        </p>
        <p
          className={
            dark
              ? "mb-1 truncate text-small font-medium text-white/80"
              : "mb-1 truncate text-small font-medium text-ink"
          }
        >
          {pick.address}
        </p>
        <p className={dark ? "mb-4 text-caption text-white/50" : "mb-4 text-caption text-ink-muted"}>
          {facts.join(" · ")}
        </p>
        <dl className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className={
                dark
                  ? "flex flex-col-reverse rounded-control bg-white/10 p-2.5 text-center"
                  : "flex flex-col-reverse rounded-control bg-surface-alt p-2.5 text-center"
              }
            >
              <dt
                className={
                  dark
                    ? "mt-0.5 text-eyebrow font-normal tracking-normal text-white/50"
                    : "mt-0.5 text-eyebrow font-normal tracking-normal text-ink-muted"
                }
              >
                {s.label}
              </dt>
              <dd className="text-small font-semibold text-gold">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Link>
  );
}
