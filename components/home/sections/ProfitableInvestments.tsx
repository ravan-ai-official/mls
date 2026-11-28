"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ProfitableInvestmentCard } from "@/components/home/ProfitableInvestmentCard";
import { useAuth } from "@/components/providers/AuthProvider";
import { SoldLockedEmptyState } from "@/components/sold/SoldLockedOverlay";
import { Section } from "@/components/ui/Section";
import { EmptyState, PropertyGridSkeleton } from "@/components/ui/States";
import { getProfitableInvestments } from "@/lib/api/home";
import type { ProfitableInvestmentsFeed } from "@/lib/api/homeMappers";
import { HOME_RAIL_LIMIT } from "@/lib/home/rails";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";
import { textOf } from "@/lib/site/read";

/**
 * Profitable Investments rail — homes that sold again above their previous
 * close in the last 12 months. Opposite of Sold Below Last Purchase.
 */
export function ProfitableInvestments({ content }: { content?: Record<string, unknown> }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: feed, isPending } = useMlsQuery<ProfitableInvestmentsFeed | null>(
    ["home", "profitable-investments", HOME_RAIL_LIMIT, user?.id ?? "anon"],
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

  const refetch = () => {
    void queryClient.invalidateQueries({ queryKey: ["home", "profitable-investments"] });
  };

  if (isPending && !feed) {
    return (
      <Section eyebrow={eyebrow} title={title}>
        <PropertyGridSkeleton count={HOME_RAIL_LIMIT} />
      </Section>
    );
  }

  const locked = Boolean(!user || feed?.soldLocked);
  const displayRows = (feed?.rows ?? [])
    .filter((row) => Boolean(row.imageUrl))
    .slice(0, HOME_RAIL_LIMIT);

  return (
    <Section eyebrow={eyebrow} title={title} description={description} action={action}>
      {locked && displayRows.length === 0 ? (
        <SoldLockedEmptyState onUnlocked={refetch} />
      ) : displayRows.length === 0 ? (
        <EmptyState
          title="No profitable re-sales available"
          description="We don't have recent homes that sold above their previous purchase right now."
          action={action}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {displayRows.map((row) => (
            <ProfitableInvestmentCard
              key={row.listingKey}
              row={row}
              locked={locked || row.soldLocked}
            />
          ))}
        </div>
      )}
    </Section>
  );
}
