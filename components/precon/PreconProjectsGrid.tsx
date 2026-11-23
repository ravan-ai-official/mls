"use client";

import { PreconCard } from "@/components/precon/PreconCard";
import { EmptyState, Skeleton } from "@/components/ui/States";
import {
  getPreconProjects,
  type PreconDealsQuery,
  type PreconProject,
} from "@/lib/api/preconstruction";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";

function hasDealsFilters(deals: PreconDealsQuery): boolean {
  return Boolean(
    deals.cities?.length ||
      deals.bedsMin ||
      deals.bathsMin ||
      deals.priceMin ||
      deals.priceMax,
  );
}

type PreconListPayload = {
  items: PreconProject[];
  total: number;
  hasSearchHistory: boolean;
  cities: string[];
};

export function PreconProjectsGrid({ deals }: { deals: PreconDealsQuery }) {
  const empty: PreconListPayload = {
    items: [],
    total: 0,
    hasSearchHistory: false,
    cities: [],
  };
  const { data, isPending } = useMlsQuery<PreconListPayload>(
    ["precon", "list", JSON.stringify(deals)],
    () =>
      getPreconProjects({
        limit: 24,
        deals,
        cache: "no-store",
      }).catch(() => empty),
    empty,
  );

  const items = data?.items ?? [];
  if (isPending && items.length === 0) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading projects">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="aspect-[4/3] w-full rounded-card" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    const filtered = hasDealsFilters(deals);
    return (
      <EmptyState
        title={filtered ? "No matching projects" : "No projects available"}
        description={
          filtered
            ? "Try clearing filters, or browse the full preconstruction list."
            : "There are no published preconstruction projects right now. Check back soon."
        }
        action={
          filtered
            ? { label: "Show all projects", href: "/preconstruction" }
            : { label: "Browse resale listings", href: "/listings" }
        }
      />
    );
  }

  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((project) => (
        <li key={project.id}>
          <PreconCard project={project} />
        </li>
      ))}
    </ul>
  );
}
