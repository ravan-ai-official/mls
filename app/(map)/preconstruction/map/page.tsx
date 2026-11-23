import type { Metadata } from "next";
import { PreconMapSearchClient } from "@/components/map/PreconMapSearchClient";
import { safeFetch } from "@/lib/api/client";
import { getPreconProjects, type PreconProject } from "@/lib/api/preconstruction";

export const metadata: Metadata = {
  title: "Preconstruction map",
  description:
    "Search new preconstruction condo and home projects across the GTA on a map: pan, zoom, or draw the area you want.",
  alternates: { canonical: "/preconstruction/map" },
};

export const revalidate = 300;

export default async function PreconstructionMapPage() {
  const { items } = await safeFetch(
    getPreconProjects({ limit: 100 }),
    { items: [] as PreconProject[], total: 0, hasSearchHistory: false, cities: [] },
    "precon:map",
  );
  return <PreconMapSearchClient projects={items} />;
}
