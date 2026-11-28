"use client";

import { ProfitableInvestmentCard } from "@/components/home/ProfitableInvestmentCard";
import { Section } from "@/components/ui/Section";
import { EmptyState, PropertyGridSkeleton } from "@/components/ui/States";
import { getProfitableInvestments } from "@/lib/api/home";
import type { ProfitableInvestmentRow } from "@/lib/api/homeMappers";
import { HOME_RAIL_LIMIT } from "@/lib/home/rails";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";
import { textOf } from "@/lib/site/read";

/**
 * Profitable Investments rail — homes that sold again above their previous
 * close in the last 12 months. Opposite of Sold Below Last Purchase.
 */
export function ProfitableInvestments({ content }: { content?: Record<string, unknown> }) {
  const { data: rows, isPending } = useMlsQuery<ProfitableInvestmentRow[] | null>(
    ["home", "profitable-investments", HOME_RAIL_LIMIT],
    () => getProfitableInvestments(HOME_RAIL_LIMIT, { cache: "no-store" }),
    null,
  );

  const eyebrow = textOf(content, "eyebrow", "For investors");
  const title = textOf(content, "title", "Profitable Investments");
  const description = textOf(
    content,
    "description",
    "Homes that sold again for more than their previous sale price in the last 12 months.",
  );
  const action = {
    label: textOf(content, "actionLabel", "View All"),
    href: textOf(content, "actionHref", "/profitable-investments"),
  };

  if (isPending && !rows) {
    return (
      <Section eyebrow={eyebrow} title={title}>
        <PropertyGridSkeleton count={HOME_RAIL_LIMIT} />
      </Section>
    );
  }

  const displayRows = (rows ?? [])
    .filter((row) => Boolean(row.imageUrl))
    .slice(0, HOME_RAIL_LIMIT);

  return (
    <Section eyebrow={eyebrow} title={title} description={description} action={action}>
      {displayRows.length === 0 ? (
        <EmptyState
          title="No profitable re-sales available"
          description="We don't have recent homes that sold above their previous purchase right now."
          action={action}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {displayRows.map((row) => (
            <ProfitableInvestmentCard key={row.listingKey} row={row} />
          ))}
        </div>
      )}
    </Section>
  );
}
