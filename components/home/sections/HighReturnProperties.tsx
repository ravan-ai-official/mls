"use client";

import { SafeImage } from "@/components/ui/SafeImage";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Section } from "@/components/ui/Section";
import { getInvestorPicks } from "@/lib/api/home";
import type { InvestorPick } from "@/lib/api/homeMappers";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";
import { textOf } from "@/lib/site/read";
import { formatPrice } from "@/lib/utils/format";

/**
 * "High Return Properties" investor strip — HomeAtlasUI HomePage L483-539.
 *
 * LIVE from `/api/home/investor-picks/`: real active listings ranked by
 * estimated gross yield, each opening its property page. The caption carries
 * the backend's own `calc_basis.note` so the basis of the estimate is always
 * disclosed next to the figures.
 *
 * When the feed is down or empty the section is omitted: yield figures are
 * only ever shown for real listings, never as sample numbers. Ranking is live
 * from `/api/home/investor-picks/` (studio pins first, then highest cap rate).
 */

const DEFAULT_BASIS =
  "Estimated from asking rents of comparable rentals; excludes financing.";

interface CardView {
  key: string;
  href: string;
  image: string | null;
  address: string;
  price: string;
  desc: string;
  yieldPct: number | null;
  rent: number | null;
  capRate: number | null;
}

function pct(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function liveCard(pick: InvestorPick): CardView {
  const facts = [
    pick.bedrooms ? `${pick.bedrooms} bd` : null,
    pick.bathrooms ? `${pick.bathrooms} ba` : null,
    pick.city || null,
  ].filter(Boolean);
  if (pick.compsUsed)
    facts.push(`rent from ${pick.compsUsed} comparable rentals`);
  return {
    key: pick.listingKey,
    href: `/property/${encodeURIComponent(pick.listingKey)}`,
    image: pick.imageUrl,
    address: pick.address,
    price: formatPrice(pick.listPrice),
    desc: facts.join(" · "),
    yieldPct: pick.grossYieldPct,
    rent: pick.estimatedMonthlyRent,
    capRate: pick.capRatePct,
  };
}

export function HighReturnProperties({ content }: { content?: Record<string, unknown> }) {
  const { data: feed } = useMlsQuery(
    ["home", "investor-picks"],
    () => getInvestorPicks(3),
    null,
  );
  if (feed === null || !feed || feed.picks.length === 0) return null;
  const cards = feed.picks.map(liveCard);
  const caption = feed.basisNote ?? textOf(content, "caption", DEFAULT_BASIS);

  return (
    <Section
      tone="dark"
      eyebrow={textOf(content, "eyebrow", "For investors")}
      title={textOf(content, "title", "High Return Properties")}
      description={textOf(content, "description", "Top rental yield opportunities in the GTA — strong cash flow potential")}
      action={{
        label: textOf(content, "actionLabel", "View All Investor Properties"),
        href: textOf(content, "actionHref", "/listings"),
      }}
    >
      <p className="-mt-3 mb-6 text-caption text-white/50 sm:-mt-5 sm:mb-8">
        {caption}
      </p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const stats = [
            {
              label: "Est. Monthly Rent",
              value: card.rent === null ? "—" : formatPrice(card.rent),
            },
            { label: "Gross Yield", value: pct(card.yieldPct) },
            { label: "Cap Rate", value: pct(card.capRate) },
          ];
          return (
            <Link
              key={card.key}
              href={card.href}
              className="group overflow-hidden rounded-surface border border-white/10 bg-white/10 transition-colors hover:bg-white/15"
            >
              <div className="relative h-[200px] overflow-hidden bg-linear-to-br from-navy to-navy-deep">
                <SafeImage
                  src={card.image}
                  alt={card.address}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {card.yieldPct !== null && (
                  <Badge
                    tone="gold"
                    className="absolute left-3 top-3 font-bold"
                  >
                    {pct(card.yieldPct)} Yield
                  </Badge>
                )}
              </div>
              <div className="p-5">
                <p className="mb-1 text-h2 text-white">{card.price}</p>
                <p className="mb-1 truncate text-small font-medium text-white/80">
                  {card.address}
                </p>
                <p className="mb-4 text-caption text-white/50">{card.desc}</p>
                <dl className="grid grid-cols-3 gap-3">
                  {stats.map((s) => (
                    <div
                      key={s.label}
                      className="flex flex-col-reverse rounded-control bg-white/10 p-2.5 text-center"
                    >
                      <dt className="mt-0.5 text-eyebrow font-normal tracking-normal text-white/50">
                        {s.label}
                      </dt>
                      <dd className="text-small font-semibold text-gold">
                        {s.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Link>
          );
        })}
      </div>
    </Section>
  );
}
