"use client";

import { PreconCard } from "@/components/precon/PreconCard";
import { getSimilarPrecon, type PreconProject } from "@/lib/api/preconstruction";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";

/**
 * Similar projects rail — client fetch so Network shows `/api/mls/…` JSON.
 */
export function SimilarPrecon({ projectId }: { projectId: number }) {
  const { data: similar = [] } = useMlsQuery<PreconProject[]>(
    ["precon", "similar", projectId],
    () => getSimilarPrecon(projectId).catch(() => [] as PreconProject[]),
    [],
  );
  if (similar.length === 0) return null;

  return (
    <section className="mt-16" aria-labelledby="similar-precon-heading">
      <h2 id="similar-precon-heading" className="text-h2 text-ink">
        Similar projects
      </h2>
      <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {similar.slice(0, 4).map((project) => (
          <li key={project.id}>
            <PreconCard project={project} headingLevel="h3" />
          </li>
        ))}
      </ul>
    </section>
  );
}
