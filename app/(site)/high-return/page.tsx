import type { Metadata } from "next";
import { HighReturnBrowse } from "@/components/home/RailBrowse";

export const metadata: Metadata = {
  title: "High Return Properties",
  description: "Active GTA listings ranked by estimated gross rental yield.",
  alternates: { canonical: "/high-return" },
};

/** Dedicated View All for the homepage High Return rail — no listings filters. */
export default function HighReturnPage() {
  return <HighReturnBrowse />;
}
