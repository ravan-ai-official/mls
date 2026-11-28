import type { Metadata } from "next";
import { FeaturedListingsBrowse } from "@/components/home/RailBrowse";

export const metadata: Metadata = {
  title: "Featured MLS® Listings",
  description: "Hand-picked and personalized featured homes for sale across the GTA.",
  alternates: { canonical: "/featured-listings" },
};

/** Dedicated View All for the homepage Featured MLS® rail — no listings filters. */
export default function FeaturedListingsPage() {
  return <FeaturedListingsBrowse />;
}
