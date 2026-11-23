import type { Metadata } from "next";
import { Suspense } from "react";
import { BlogPostList, PostsSkeleton } from "@/components/blog/BlogPostList";
import { PendingNavigationProvider } from "@/components/navigation/PendingNavigation";
import { Eyebrow } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "Research & insights",
  description:
    "Market analysis, buying guides and neighbourhood research from the HomeAtlas team.",
  alternates: { canonical: "/blog" },
};

export const revalidate = 900;

export default async function BlogIndexPage({ searchParams }: PageProps<"/blog">) {
  const params = await searchParams;
  const rawCategory = Array.isArray(params.category)
    ? params.category[0]
    : params.category;

  return (
    <>
      <header className="border-b border-line bg-surface-alt py-8 sm:py-12">
        <div className="container-page">
          <Eyebrow>Research</Eyebrow>
          <h1 className="mt-3 text-h1 text-ink">Insights &amp; guides</h1>
          <p className="mt-2 max-w-2xl text-small text-ink-muted">
            Market analysis and buying guides from our team.
          </p>
        </div>
      </header>

      {/* Category chips select on click; the posts show a skeleton while
          the new category loads (PendingNavigation). */}
      <PendingNavigationProvider>
        <div className="container-page py-10">
          <Suspense fallback={<PostsSkeleton />}>
            <BlogPostList category={rawCategory?.trim() || null} />
          </Suspense>
        </div>
      </PendingNavigationProvider>
    </>
  );
}
