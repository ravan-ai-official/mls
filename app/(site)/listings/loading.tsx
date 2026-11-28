import {
  ListingsFilterSkeleton,
  PropertyGridSkeleton,
  Skeleton,
} from "@/components/ui/States";

/**
 * Route-level placeholder for /listings.
 * Mirrors the live page: sticky filter chrome + results header + card grid.
 * (The old version invented a page hero the real route does not have.)
 */
export default function ListingsLoading() {
  return (
    <div
      className="container-page pb-24 pt-4 sm:pb-8 sm:py-8 md:pb-8"
      role="status"
      aria-label="Loading listings"
      aria-busy="true"
    >
      <div className="sticky top-[72px] z-30 -mx-4 border-b border-line bg-surface px-4 py-3 sm:-mx-8 sm:px-8 lg:top-20">
        <ListingsFilterSkeleton />
      </div>

      <div className="mt-4 space-y-6 sm:mt-6 sm:space-y-8">
        <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-5 w-36 sm:w-44" />
            <Skeleton className="h-3 w-28 sm:w-48" />
          </div>
          <Skeleton className="hidden h-9 w-24 md:block" />
        </div>

        <PropertyGridSkeleton count={12} />
      </div>

      <span className="sr-only">Loading listings…</span>
    </div>
  );
}
