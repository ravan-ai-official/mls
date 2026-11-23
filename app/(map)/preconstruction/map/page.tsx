import type { Metadata } from "next";
import { PreconMapSearchClient } from "@/components/map/PreconMapSearchClient";

export const metadata: Metadata = {
  title: "Preconstruction map",
  description:
    "Search new preconstruction condo and home projects across the GTA on a map: pan, zoom, or draw the area you want.",
  alternates: { canonical: "/preconstruction/map" },
};

export const revalidate = 300;

export default function PreconstructionMapPage() {
  return <PreconMapSearchClient />;
}
