import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PendingContent, PendingNavigationProvider } from "@/components/navigation/PendingNavigation";
import { ListingFiltersChrome } from "@/components/property/ListingFiltersChrome";
import { ListingsResults } from "@/components/property/ListingsResults";
import { ListingsScrollRestore } from "@/components/property/ListingsScrollRestore";
import { PropertyGridSkeleton } from "@/components/ui/States";
import { getCurrentUser } from "@/lib/auth/session";
import { matchKnownCity } from "@/lib/constants/cities";
import type { ListingQuery } from "@/lib/types/domain";
import { backendStatusGroup } from "@/lib/utils/status";
import {
  buildListingHref,
  parseListingParams,
} from "@/lib/utils/searchParams";

export const metadata: Metadata = {
  title: "Property listings",
  description:
    "Browse active MLS® listings across the Greater Toronto Area with live filters for price, type and bedrooms.",
  alternates: { canonical: "/listings" },
};

export default async function ListingsPage({ searchParams }: PageProps<"/listings">) {
  const params = await searchParams;
  await stripDelistedForPublic(params);
  const user = await getCurrentUser();
  const isStaff = Boolean(user?.isStaff);

  return (
    <PendingNavigationProvider>
      <ListingsScrollRestore />
      <div className="container-page pb-24 pt-4 sm:pb-8 sm:py-8 md:pb-8">
        {/* Above listing cards / sold overlays (z-10); below site navbar (z-520). */}
        <div className="sticky top-[72px] z-40 -mx-4 border-b border-line bg-surface px-4 py-3 sm:-mx-8 sm:px-8 lg:top-20">
          <Suspense fallback={<div className="h-12" />}>
            <ListingFiltersChrome />
          </Suspense>
        </div>

        <div className="relative z-0 mt-4 isolate sm:mt-6">
          <PendingContent fallback={<PropertyGridSkeleton />}>
            <Suspense fallback={<PropertyGridSkeleton />}>
              <ListingsResults isStaff={isStaff} />
            </Suspense>
          </PendingContent>
        </div>
      </div>
    </PendingNavigationProvider>
  );
}

async function stripDelistedForPublic(
  params: Record<string, string | string[] | undefined>,
) {
  const query = listingQuery(params);
  if (backendStatusGroup(query.status) !== "de-listed") return;
  const user = await getCurrentUser();
  if (user?.isStaff) return;
  redirect(
    buildListingHref({
      ...query,
      status: undefined,
      page: undefined,
    }),
  );
}

function listingQuery(params: Record<string, string | string[] | undefined>): ListingQuery {
  const parsed = parseListingParams(params);
  const cityFromSearch =
    !parsed.city && parsed.search ? matchKnownCity(parsed.search) : null;
  const query = cityFromSearch
    ? { ...parsed, city: cityFromSearch, search: undefined }
    : parsed;
  return query.status || query.openHouse ? query : { ...query, status: "Active" };
}
