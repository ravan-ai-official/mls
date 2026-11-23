import type { Metadata } from "next";
import { Eyebrow } from "@/components/ui/Badge";
import { SchoolsDirectory } from "@/components/schools/SchoolsDirectory";
import { getTopSchools, schoolSearchHistoryCities } from "@/lib/api/schools";
import { getVisitorPersonalization } from "@/lib/personalize/visitorContext";

export const metadata: Metadata = {
  title: "Schools",
  description:
    "Search Ontario schools by name and find nearby homes. EQAO results from the Ministry of Education open file.",
  alternates: { canonical: "/schools" },
};

export const revalidate = 86_400;

export default async function SchoolsPage() {
  const visitor = await getVisitorPersonalization();
  const historyCities = schoolSearchHistoryCities(
    visitor.searchHistoryCities,
    visitor.lastSearch.city,
  );
  // View all: higher limit (API max 100). Same cities rules as homepage rail.
  const initialSchools = await getTopSchools({
    limit: 100,
    cities: historyCities.length > 0 ? historyCities : undefined,
    cache: "no-store",
  }).catch(() => []);

  return (
    <>
      <header className="border-b border-line bg-surface-alt py-8 sm:py-12">
        <div className="container-page">
          <Eyebrow>Schools &amp; families</Eyebrow>
          <h1 className="mt-3 text-h1 text-ink">GTA Secondary Schools</h1>
          <p className="mt-2 max-w-2xl text-small text-ink-muted">
            {historyCities.length > 0
              ? `Top secondary schools by published EQAO in ${historyCities.join(", ")}. Pick a school to see homes nearby.`
              : "Top secondary schools across the GTA by published EQAO. Pick a school to see homes nearby."}
          </p>
        </div>
      </header>

      <div className="container-page py-10">
        <SchoolsDirectory initialSchools={initialSchools} />
      </div>
    </>
  );
}
