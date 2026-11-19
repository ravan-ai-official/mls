import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PreconCard } from "@/components/precon/PreconCard";
import { VipAccessForm } from "@/components/precon/VipAccessForm";
import { Eyebrow } from "@/components/ui/Badge";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { safeFetch } from "@/lib/api/client";
import { COMMUNITY_CITIES } from "@/lib/constants/cities";
import { getPreconProjects, type PreconProject } from "@/lib/api/preconstruction";

export const metadata: Metadata = {
  title: "Preconstruction projects",
  description:
    "Explore new preconstruction condo and home projects across the Greater Toronto Area.",
  alternates: { canonical: "/preconstruction" },
};

export const revalidate = 300;

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PreconstructionPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const rawCity = first(params.city)?.trim() || "";
  const city =
    COMMUNITY_CITIES.find((option) => option.toLowerCase() === rawCity.toLowerCase()) ||
    (rawCity.length >= 2 && rawCity.length <= 40 ? rawCity : undefined);

  return (
    <>
      <section className="border-b border-line bg-surface-alt py-8 sm:py-12">
        <div className="container-page">
          <Eyebrow>New developments</Eyebrow>
          <h1 className="mt-3 text-h1 text-ink">
            {city ? `Preconstruction in ${city}` : "Preconstruction projects"}
          </h1>
          <p className="mt-2 max-w-2xl text-small text-ink-muted">
            {city
              ? `New builds near ${city}, from early registration through to final release.`
              : "New builds across the GTA, from early registration through to final release."}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/preconstruction/map"
              className="inline-flex h-11 items-center rounded-control border border-line bg-surface px-4 text-small font-medium text-ink transition-colors hover:border-navy hover:text-navy"
            >
              Search on map
            </Link>
            {city ? (
              <Link
                href="/preconstruction"
                className="text-small font-medium text-navy hover:underline"
              >
                Clear city filter
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <div className="container-page space-y-16 py-10">
        <Suspense key={city || "all"} fallback={<ProjectsSkeleton />}>
          <Projects city={city} />
        </Suspense>
        <VipAccessForm />
      </div>
    </>
  );
}

async function Projects({ city }: { city?: string }) {
  const { items } = await safeFetch(
    getPreconProjects({ limit: 24, city }),
    { items: [] as PreconProject[], total: 0 },
    "precon:list",
  );

  if (items.length === 0) {
    return (
      <EmptyState
        title={city ? `No projects near ${city}` : "No projects available"}
        description={
          city
            ? "Try another city, or browse the full preconstruction list."
            : "There are no published preconstruction projects right now. Check back soon."
        }
        action={
          city
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

function ProjectsSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading projects">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="aspect-[4/3] w-full rounded-card" />
      ))}
    </div>
  );
}
