import type { Metadata } from "next";
import { TodaysNewBrowse } from "@/components/home/RailBrowse";

export const metadata: Metadata = {
  title: "Today's New Listings",
  description: "Homes first listed in the last 24 hours across the GTA.",
  alternates: { canonical: "/todays-new" },
};

/** Dedicated View All for the homepage Today's New rail — no listings filters. */
export default function TodaysNewPage() {
  return <TodaysNewBrowse />;
}
