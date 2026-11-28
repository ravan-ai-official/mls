"use client";

import { HighReturnCard } from "@/components/home/HighReturnCard";
import { Section } from "@/components/ui/Section";
import { getInvestorPicks } from "@/lib/api/home";
import { HOME_RAIL_LIMIT } from "@/lib/home/rails";
import { readClientVisitor } from "@/lib/personalize/clientVisitor";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";
import { textOf } from "@/lib/site/read";

const DEFAULT_BASIS =
  "Estimated from asking rents of comparable rentals; excludes financing.";

/**
 * High Return Properties — exactly three investor cards.
 * "View All" opens /high-return (same investor-picks feed, longer).
 */
export function HighReturnProperties({ content }: { content?: Record<string, unknown> }) {
  const viewAllHref = textOf(content, "actionHref", "/high-return");
  const viewAllLabel = textOf(content, "actionLabel", "View All");
  const { data: feed } = useMlsQuery(
    ["home", "investor-picks", HOME_RAIL_LIMIT],
    () => {
      const visitor = readClientVisitor();
      return getInvestorPicks(HOME_RAIL_LIMIT, {
        cities: visitor.cities?.length ? visitor.cities : undefined,
        cache: "no-store",
      });
    },
    null,
  );
  if (feed === null || !feed || feed.picks.length === 0) return null;
  const caption = feed.basisNote ?? textOf(content, "caption", DEFAULT_BASIS);

  return (
    <Section
      tone="dark"
      eyebrow={textOf(content, "eyebrow", "For investors")}
      title={textOf(content, "title", "High Return Properties")}
      description={textOf(
        content,
        "description",
        "Top rental yield opportunities in the GTA — strong cash flow potential",
      )}
      action={{ label: viewAllLabel, href: viewAllHref }}
    >
      <p className="-mt-3 mb-6 text-caption text-white/50 sm:-mt-5 sm:mb-8">{caption}</p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {feed.picks.slice(0, HOME_RAIL_LIMIT).map((pick) => (
          <HighReturnCard key={pick.listingKey} pick={pick} tone="dark" />
        ))}
      </div>
    </Section>
  );
}
