import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CuratedResults } from "@/components/homes/CuratedResults";
import { KeywordLinks } from "@/components/search/KeywordLinks";
import { breadcrumbJsonLd, JsonLd } from "@/components/seo/JsonLd";
import { Eyebrow } from "@/components/ui/Badge";
import { PropertyGridSkeleton } from "@/components/ui/States";
import { curatedPath, CURATED_PAGES, getCuratedPage } from "@/lib/seo/curatedPages";
import { getCuratedPages } from "@/lib/site/load";
import { buildListingHref } from "@/lib/utils/searchParams";

export const revalidate = 600;
/** Studio can add new slugs after build; resolve them at request time. */
export const dynamicParams = true;

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
export default async function CuratedListingsPage({
  params,
  searchParams,
}: PageProps<"/homes/[slug]">) {
  const { slug } = await params;
  const pages = await getCuratedPages();
  const page = getCuratedPage(slug, pages);
  if (!page) notFound();
  const query = await searchParams;
  const pageNumber = Math.max(
    1,
    Number(Array.isArray(query.page) ? query.page[0] : query.page) || 1,
  );
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
          <CuratedResults page={page} pageNumber={pageNumber} />
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
