"use client";

import { PropertyCard } from "@/components/property/PropertyCard";
import { absoluteUrl, JsonLd } from "@/components/seo/JsonLd";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState, PropertyGridSkeleton } from "@/components/ui/States";
import { compareProperties, searchProperties } from "@/lib/api/properties";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";
import { propertyPath } from "@/lib/seo/urls";
import { curatedPath, type CuratedPage } from "@/lib/seo/curatedPages";
import type { PropertySummary } from "@/lib/types/domain";

const PAGE_SIZE = 12;

type ResultsPayload = {
  items: PropertySummary[];
  total: number;
  approximate: boolean;
  failed: boolean;
};

/**
 * Curated `/homes/[slug]` results. Search / compare fetch in the browser via
 * `/api/mls/…` so Network shows JSON.
 */
export function CuratedResults({
  page,
  pageNumber,
}: {
  page: CuratedPage;
  pageNumber: number;
}) {
  const listingKeys = page.listingKeys ?? [];
  const { data, isPending } = useMlsQuery<ResultsPayload>(
    ["homes", page.slug, pageNumber, listingKeys.join(",")],
    async () => {
      try {
        if (listingKeys.length) {
          const pinned = await loadPinnedListings(listingKeys);
          const start = (pageNumber - 1) * PAGE_SIZE;
          return {
            items: pinned.slice(start, start + PAGE_SIZE),
            total: pinned.length,
            approximate: false,
            failed: false,
          };
        }
        const result = await searchProperties(
          { ...page.query, limit: PAGE_SIZE, offset: (pageNumber - 1) * PAGE_SIZE },
          { revalidate: 600 },
        );
        return {
          items: result.items,
          total: result.total,
          approximate: result.approximate,
          failed: false,
        };
      } catch {
        return { items: [], total: 0, approximate: false, failed: true };
      }
    },
    { items: [], total: 0, approximate: false, failed: false },
  );

  if (isPending && !data) {
    return <PropertyGridSkeleton count={6} />;
  }

  if (data?.failed) {
    return (
      <ErrorState title="Listings are unavailable" description="Please try again in a moment." />
    );
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const approximate = data?.approximate ?? false;

  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing matches right now"
        description={
          listingKeys.length
            ? "None of the pinned MLS® numbers are available in the live feed right now."
            : page.query.keywords
              ? "No current listings mention this in their description. New listings arrive daily, so check back soon."
              : "No current listings match. Try a nearby search."
        }
        action={{ label: "Browse all listings", href: "/listings" }}
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (next: number) =>
    next > 1 ? `${curatedPath(page)}?page=${next}` : curatedPath(page);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: page.h1,
          itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            position: (pageNumber - 1) * PAGE_SIZE + index + 1,
            url: absoluteUrl(propertyPath(item.id)),
          })),
        }}
      />
      <p className="mb-4 text-small text-ink-muted" aria-live="polite">
        {approximate ? "About " : ""}
        <span className="font-medium text-ink">{total.toLocaleString("en-CA")}</span>{" "}
        {total === 1 ? "home" : "homes"}
        {totalPages > 1 && ` · page ${pageNumber} of ${totalPages}`}
      </p>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((property, index) => (
          <li key={property.id}>
            <PropertyCard property={property} priority={index < 3} />
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <div className="mt-8">
          <Pagination page={pageNumber} totalPages={totalPages} buildHref={pageHref} />
        </div>
      )}
    </>
  );
}

/** Fetch pinned MLS® / listing keys and keep the admin's order; drop missing quietly. */
async function loadPinnedListings(listingKeys: string[]): Promise<PropertySummary[]> {
  let details: Awaited<ReturnType<typeof compareProperties>> = [];
  try {
    details = await compareProperties(listingKeys, { revalidate: 600 });
  } catch {
    return [];
  }
  const byKey = new Map<string, PropertySummary>();
  for (const item of details) {
    const summary = item as PropertySummary;
    byKey.set(summary.id.toUpperCase(), summary);
    if (summary.mls) byKey.set(summary.mls.toUpperCase(), summary);
  }
  const ordered: PropertySummary[] = [];
  const seen = new Set<string>();
  for (const key of listingKeys) {
    const hit = byKey.get(key.toUpperCase());
    if (!hit || seen.has(hit.id)) continue;
    seen.add(hit.id);
    ordered.push(hit);
  }
  return ordered;
}
