"use client";

import { AssignmentCard } from "@/components/assignments/AssignmentCard";
import {
  getSimilarAssignments,
  listingHasPhoto,
  type PublicListing,
} from "@/lib/api/assignments";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";

/**
 * Rail of similar approved assignments. Live API only; renders nothing when empty.
 */
export function SimilarAssignments({ id }: { id: number }) {
  const { data: similar = [] } = useMlsQuery<PublicListing[]>(
    ["assignments", "similar", id],
    async () => {
      try {
        return await getSimilarAssignments(id);
      } catch {
        return [] as PublicListing[];
      }
    },
    [],
  );

  const rows = similar.filter(listingHasPhoto);
  if (rows.length === 0) return null;

  return (
    <section className="mt-12" aria-labelledby="similar-assignments">
      <h2 id="similar-assignments" className="text-h2 text-ink">
        Similar assignments
      </h2>
      <ul className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((item) => (
          <li key={item.id}>
            <AssignmentCard listing={item} headingLevel="h3" />
          </li>
        ))}
      </ul>
    </section>
  );
}
