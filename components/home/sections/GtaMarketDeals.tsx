import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Section } from "@/components/ui/Section";
import { marketDeals } from "@/lib/home/staticSections";
import { textOf } from "@/lib/site/read";
import { DealGlyph } from "./sectionIcons";

/**
 * "GTA Market Deals" — HomeAtlasUI HomePage L540-612 ("DEALS SECTION").
 *
 * Four keyword category cards (Below-Market, Detached Under $1M, Power of Sale,
 * Just Sold). Each opens the matching curated `/homes/...` search or sold
 * listings, same layout as the reference.
 */
export function GtaMarketDeals({ content }: { content?: Record<string, unknown> }) {
  return (
    <Section
      tone="alt"
      eyebrow={textOf(content, "eyebrow", "Below-Market Deals")}
      title={textOf(content, "title", "GTA Market Deals")}
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {marketDeals.map((deal) => (
          <Link
            key={deal.title}
            href={deal.href}
            className="group flex flex-col rounded-surface border border-line bg-surface p-6 transition-all hover:border-gold/30 hover:shadow-card-hover"
          >
            <div className="mb-4 flex items-start justify-between">
              <DealGlyph icon={deal.icon} className="h-8 w-8 text-gold" />
              <Badge tone={deal.badgeTone} className="text-eyebrow font-bold">
                {deal.badge}
              </Badge>
            </div>
            <h3 className="mb-2 text-h3 text-ink">{deal.title}</h3>
            <p className="mb-4 flex-1 text-small text-ink-muted">{deal.desc}</p>
            <div className="flex items-center justify-between">
              <span className="text-caption font-semibold text-navy">{deal.count}</span>
              <span className="text-small font-medium text-ink transition-colors group-hover:text-gold">
                Browse →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}
