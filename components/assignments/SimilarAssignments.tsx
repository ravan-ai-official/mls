"use client";

import { AssignmentCard } from "@/components/assignments/AssignmentCard";
import { getSimilarAssignments, type PublicListing } from "@/lib/api/assignments";
import { sampleSimilarAssignments, USE_ASSIGNMENT_SAMPLES } from "@/lib/demo/assignments";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";

/**
 * Rail of similar approved assignments. Fetches in the browser via `/api/mls/…`.
 * Renders nothing when there are none.
 */
export function SimilarAssignments({ id }: { id: number }) {
  const { data: similar = [] } = useMlsQuery<PublicListing[]>(
    ["assignments", "similar", id],
    async () => {
      if (USE_ASSIGNMENT_SAMPLES) return sampleSimilarAssignments(id);
      return getSimilarAssignments(id).catch(() => [] as PublicListing[]);
    },
    [],
  );

  if (similar.length === 0) return null;

  return (
    <section className="mt-12" aria-labelledby="similar-assignments">
      <h2 id="similar-assignments" className="text-h2 text-ink">
        Similar assignments
      </h2>
      <ul className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {similar.map((item) => (
          <li key={item.id}>
            <AssignmentCard listing={item} headingLevel="h3" />
          </li>
        ))}
      </ul>
    </section>
  );
}
