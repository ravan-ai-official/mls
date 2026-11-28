"use client";

import Link from "next/link";
import { NavChip } from "@/components/navigation/NavChip";
import { PendingContent } from "@/components/navigation/PendingNavigation";
import { Eyebrow } from "@/components/ui/Badge";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import {
  getAllBlogPosts,
  getBlogCategories,
  type BlogCategory,
  type BlogPost,
} from "@/lib/api/blog";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";
import { formatDate } from "@/lib/utils/format";

type BlogListPayload = {
  posts: BlogPost[] | null;
  categories: BlogCategory[];
};

/**
 * Blog index list + category chips. Fetches in the browser via `/api/vlog/…`.
 */
export function BlogPostList({ category }: { category: string | null }) {
  const { data, isPending } = useMlsQuery<BlogListPayload>(
    ["blog", "list"],
    async () => {
      const [posts, categories] = await Promise.all([
        getAllBlogPosts().catch(() => null),
        getBlogCategories(),
      ]);
      return { posts, categories };
    },
    { posts: null, categories: [] },
  );

  if (isPending && !data) {
    return <PostsSkeleton />;
  }

  const posts = data?.posts ?? null;
  const categories = data?.categories ?? [];

  if (posts === null) {
    return (
      <ErrorState
        title="Articles unavailable"
        description="We couldn't load articles right now. Please try again in a moment."
      />
    );
  }

  const filtered = category
    ? posts.filter(
        (post) =>
          post.categorySlug === category ||
          post.category?.toLowerCase() === category.toLowerCase(),
      )
    : posts;

  if (posts.length === 0) {
    return (
      <EmptyState
        title="No articles yet"
        description="New market research and guides will appear here as they're published."
      />
    );
  }

  return (
    <div className="space-y-8">
      {categories.length > 0 && (
        <nav aria-label="Filter articles by category" className="flex flex-wrap gap-2">
          <NavChip href="/blog" current={category === null} scroll={false}>
            All
          </NavChip>
          {categories.map((item) => (
            <NavChip
              key={item.id}
              href={`/blog?category=${encodeURIComponent(item.slug)}`}
              current={category === item.slug}
              scroll={false}
            >
              {item.name}
            </NavChip>
          ))}
        </nav>
      )}

      <PendingContent fallback={<PostsSkeleton />}>
        {filtered.length === 0 ? (
          <EmptyState
            title="No articles in this category"
            description="Try another category, or browse everything we've published."
            action={{ label: "All articles", href: "/blog" }}
          />
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((post) => (
              <li key={post.id}>
                <PostCard post={post} />
              </li>
            ))}
          </ul>
        )}
      </PendingContent>
    </div>
  );
}

function PostCard({ post }: { post: BlogPost }) {
  return (
    <article className="h-full">
      <Link
        href={`/blog/${post.slug}`}
        className="group flex h-full flex-col overflow-hidden rounded-surface border border-line bg-surface transition-colors hover:border-navy focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-navy/40"
      >
        {post.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.thumbnail}
            alt={post.title}
            className="aspect-[16/9] w-full object-cover"
            loading="lazy"
          />
        )}
        <div className="flex flex-1 flex-col p-5">
          {post.category && <Eyebrow>{post.category}</Eyebrow>}
          <h2 className="mt-2 text-h3 text-ink group-hover:text-navy">{post.title}</h2>
          {post.excerpt && (
            <p className="mt-2 line-clamp-3 text-small text-ink-muted">{post.excerpt}</p>
          )}
          <p className="mt-auto pt-4 text-caption text-ink-subtle">
            {[post.author, post.publishedAt ? formatDate(post.publishedAt) : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </Link>
    </article>
  );
}

export function PostsSkeleton() {
  return (
    <div
      className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-label="Loading articles"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-72" />
      ))}
    </div>
  );
}
