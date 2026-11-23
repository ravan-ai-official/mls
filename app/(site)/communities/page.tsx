import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CommunityGrid,
  CommunitiesSkeleton,
} from "@/components/communities/CommunityGrid";
import { Eyebrow } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "Communities",
  description:
    "Explore GTA communities with active inventory, asking prices and recent sold activity.",
  alternates: { canonical: "/communities" },
};

export const revalidate = 1800;


export default function CommunitiesPage() {
  return (
    <>
      <header className="border-b border-line bg-surface-alt py-8 sm:py-12">
        <div className="container-page">
          <Eyebrow>Where to live</Eyebrow>
          <h1 className="mt-3 text-h1 text-ink">GTA communities</h1>
          <p className="mt-2 max-w-2xl text-small text-ink-muted">
            Active inventory, asking prices and the last 90 days of sales, by city.
          </p>
        </div>
      </header>

      <div className="container-page py-10">
        <Suspense fallback={<CommunitiesSkeleton />}>
          <CommunityGrid />
        </Suspense>
      </div>
    </>
  );
}
