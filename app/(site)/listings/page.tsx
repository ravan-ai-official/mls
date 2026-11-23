import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PendingContent, PendingNavigationProvider } from "@/components/navigation/PendingNavigation";
import { ListingFiltersChrome } from "@/components/property/ListingFiltersChrome";
import { ListingsResults } from "@/components/property/ListingsResults";
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
  const rent = parseListingParams(params).transaction === "rent";
  const user = await getCurrentUser();
  const isStaff = Boolean(user?.isStaff);

  return (
    <>
      <header className="border-b border-line bg-surface-alt py-4 sm:py-10">
        <div className="container-page">
          <h1 className="text-h2 sm:text-h1 text-ink">
            {rent ? "GTA homes for rent" : "GTA homes for sale"}
          </h1>
          <p className="mt-0.5 hidden text-small text-ink-muted sm:mt-1 sm:block">
            Live MLS® data, updated daily.
          </p>
        </div>
      </header>

      <PendingNavigationProvider>
        <div className="container-page py-4 sm:py-8">
          <Suspense fallback={<div className="h-24" />}>
            <ListingFiltersChrome />
          </Suspense>

          <div className="mt-4 sm:mt-8">
            <PendingContent fallback={<PropertyGridSkeleton />}>
              <Suspense fallback={<PropertyGridSkeleton />}>
                <ListingsResults isStaff={isStaff} />
              </Suspense>
            </PendingContent>
          </div>
        </div>
      </PendingNavigationProvider>
    </>
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
