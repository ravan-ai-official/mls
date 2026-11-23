"use client";

import Link from "next/link";
import { AssignmentCard } from "@/components/assignments/AssignmentCard";
import { getPublicAssignments, type PublicListingPage } from "@/lib/api/assignments";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";

const EMPTY_PAGE: PublicListingPage = {
  count: 0,
  page: 1,
  pageSize: 4,
  results: [],
};

/**
 * "Assignments in this project" rail for a pre-con page (scope #2e): approved
 * assignment sales linked to this project. Renders nothing when there are none.
 * Fetches in the browser via `/api/mls/…`.
 */
export function ProjectAssignments({
  projectId,
  projectTitle,
}: {
  projectId: number;
  projectTitle: string;
}) {
  const { data = EMPTY_PAGE } = useMlsQuery<PublicListingPage>(
    ["precon", "assignments", projectId],
    () =>
      getPublicAssignments({ preconProjectId: projectId, pageSize: 4 }).catch(() => EMPTY_PAGE),
    EMPTY_PAGE,
  );

  if (data.results.length === 0) return null;

  return (
    <section className="mt-16" aria-labelledby="project-assignments-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="project-assignments-heading" className="text-h2 text-ink">
          Assignments in {projectTitle}
        </h2>
        {data.count > data.results.length && (
          <Link href="/assignments" className="text-small font-medium text-navy hover:underline">
            See all {data.count}
          </Link>
        )}
      </div>
      <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {data.results.map((listing) => (
          <li key={listing.id}>
            <AssignmentCard listing={listing} headingLevel="h3" />
          </li>
        ))}
      </ul>
    </section>
  );
}
