import type { Metadata } from "next";
import { ProfitableInvestmentsBrowse } from "@/components/home/RailBrowse";

export const metadata: Metadata = {
  title: "Profitable Investments",
  description:
    "Homes that sold again for more than their previous sale price in the last 12 months.",
  alternates: { canonical: "/profitable-investments" },
};

/** Dedicated View All for the homepage Profitable Investments rail. */
export default function ProfitableInvestmentsPage() {
  return <ProfitableInvestmentsBrowse />;
}
