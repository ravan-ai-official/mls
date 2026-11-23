"use client";

import { AssignmentCard } from "@/components/assignments/AssignmentCard";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import {
  getPublicAssignments,
  type PublicListingPage,
} from "@/lib/api/assignments";
import { sampleAssignmentPage, USE_ASSIGNMENT_SAMPLES } from "@/lib/demo/assignments";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";

const PAGE_SIZE = 12;

type ResultsPayload = {
  data: PublicListingPage | null;
  failed: boolean;
};

/**
 * Assignments grid. Fetches in the browser via `/api/mls/…` (or sample data).
 */
export function AssignmentsResults({
  city,
  priceMax,
  page,
  buildPageHref,
}: {
  city?: string;
  priceMax?: number;
  page: number;
  buildPageHref: (page: number) => string;
}) {
  const fallback: ResultsPayload = { data: null, failed: false };
  const { data: payload, isPending } = useMlsQuery<ResultsPayload>(
    ["assignments", "list", city ?? "", priceMax ?? "", page],
    async (): Promise<ResultsPayload> => {
      if (USE_ASSIGNMENT_SAMPLES) {
        return {
          data: sampleAssignmentPage({ city, priceMax, page, pageSize: PAGE_SIZE }),
          failed: false,
        };
      }
      try {
        const pageData = await getPublicAssignments({
          city,
          priceMax,
          page,
          pageSize: PAGE_SIZE,
        });
        return { data: pageData, failed: false };
      } catch {
        return { data: null, failed: true };
      }
    },
    fallback,
  );

  if (isPending && !payload) {
    return <AssignmentsGridSkeleton />;
  }

  if (!payload || payload.failed || !payload.data) {
    return (
      <ErrorState title="Assignments are unavailable" description="Please try again in a moment." />
    );
  }

  const data = payload.data;

  if (data.count === 0) {
    const filtered = Boolean(city || priceMax);
    return (
      <EmptyState
        title={filtered ? "No assignments match these filters" : "No assignments listed yet"}
        description={
          filtered
            ? "Try another city or price range."
            : "Be the first: list your pre-construction assignment free and reach buyers across the GTA."
        }
        action={
          filtered
            ? { label: "Clear filters", href: "/assignments" }
            : { label: "List your assignment", href: "/sell/list" }
        }
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(data.count / PAGE_SIZE));
  return (
    <>
      <p className="mb-4 text-small text-ink-muted">
        {data.count} {data.count === 1 ? "assignment" : "assignments"}
      </p>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.results.map((listing) => (
          <li key={listing.id}>
            <AssignmentCard listing={listing} />
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <div className="mt-8">
          <Pagination page={page} totalPages={totalPages} buildHref={buildPageHref} />
        </div>
      )}
    </>
  );
}

export function AssignmentsGridSkeleton() {
  return (
    <div
      className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-label="Loading assignments"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-surface border border-line">
          <Skeleton className="h-[190px] rounded-none" />
          <div className="space-y-3 p-5">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
