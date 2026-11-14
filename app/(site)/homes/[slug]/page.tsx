import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PropertyCard } from "@/components/property/PropertyCard";
import { KeywordLinks } from "@/components/search/KeywordLinks";
import { absoluteUrl, breadcrumbJsonLd, JsonLd } from "@/components/seo/JsonLd";
import { Eyebrow } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState, PropertyGridSkeleton } from "@/components/ui/States";
import { compareProperties, searchProperties } from "@/lib/api/properties";
import { propertyPath } from "@/lib/seo/urls";
import { CURATED_PAGES, curatedPath, getCuratedPage, type CuratedPage } from "@/lib/seo/curatedPages";
import { getCuratedPages } from "@/lib/site/load";
import type { PropertySummary } from "@/lib/types/domain";
import { buildListingHref } from "@/lib/utils/searchParams";

export const revalidate = 600;
/** Studio can add new slugs after build; resolve them at request time. */
export const dynamicParams = true;

const PAGE_SIZE = 12;

export function generateStaticParams() {
  return CURATED_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: PageProps<"/homes/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const pages = await getCuratedPages();
  const page = getCuratedPage(slug, pages);
  if (!page) return { title: "Page not found" };
  return {
    title: page.h1,
    description: page.description,
    alternates: { canonical: curatedPath(page) },
    openGraph: { title: page.h1, description: page.description, url: curatedPath(page) },
  };
}

/**
 * A curated listing page (scope #6 / CR-01). `?page=` paginates; results come
 * from pinned MLS® numbers when set, otherwise the Studio search filters.
 * Keyword-only pages have no /listings equivalent, so only filter (non-keyword,
 * non-pinned) pages offer "refine these filters".
 */
export default async function CuratedListingsPage({ params, searchParams }: PageProps<"/homes/[slug]">) {
  const { slug } = await params;
  const pages = await getCuratedPages();
  const page = getCuratedPage(slug, pages);
  if (!page) notFound();
  const query = await searchParams;
  const pageNumber = Math.max(1, Number(Array.isArray(query.page) ? query.page[0] : query.page) || 1);
  const pinned = (page.listingKeys?.length ?? 0) > 0;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: page.h1, path: curatedPath(page) },
        ])}
      />
      <header className="border-b border-line bg-surface-alt py-8 sm:py-12">
        <div className="container-page">
          <Eyebrow>{page.group}</Eyebrow>
          <h1 className="mt-3 text-h1 text-ink">{page.h1}</h1>
          <p className="mt-2 max-w-2xl text-small text-ink-muted">{page.description}</p>
          {!pinned && !page.query.keywords && (
            <Link
              href={buildListingHref(page.query)}
              className="mt-4 inline-block text-small font-medium text-navy underline underline-offset-2"
            >
              Refine these filters
            </Link>
          )}
        </div>
      </header>

      <div className="container-page py-10">
        <Suspense key={pageNumber} fallback={<PropertyGridSkeleton count={6} />}>
          <Results page={page} pageNumber={pageNumber} />
        </Suspense>

        <section className="mt-16 border-t border-line pt-10" aria-labelledby="keyword-links">
          <h2 id="keyword-links" className="text-h2 text-ink">
            Search by keywords
          </h2>
          <KeywordLinks
            className="mt-6"
            pages={pages}
            includeCities={page.group === "By city"}
            currentSlug={page.slug}
          />
        </section>
      </div>
    </>
  );
}

async function Results({ page, pageNumber }: { page: CuratedPage; pageNumber: number }) {
  let items: PropertySummary[] = [];
  let total = 0;
  let approximate = false;

  try {
    if (page.listingKeys?.length) {
      const pinned = await loadPinnedListings(page.listingKeys);
      total = pinned.length;
      const start = (pageNumber - 1) * PAGE_SIZE;
      items = pinned.slice(start, start + PAGE_SIZE);
    } else {
      const result = await searchProperties(
        { ...page.query, limit: PAGE_SIZE, offset: (pageNumber - 1) * PAGE_SIZE },
        { revalidate: 600 },
      );
      items = result.items;
      total = result.total;
      approximate = result.approximate;
    }
  } catch {
    return <ErrorState title="Listings are unavailable" description="Please try again in a moment." />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing matches right now"
        description={
          page.listingKeys?.length
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
  const pageHref = (next: number) => (next > 1 ? `${curatedPath(page)}?page=${next}` : curatedPath(page));

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
