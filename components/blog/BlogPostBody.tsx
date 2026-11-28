"use client";

import Link from "next/link";
import { Eyebrow } from "@/components/ui/Badge";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import {
  getAllBlogPosts,
  getBlogPost,
  type BlogPost,
  type BlogPostDetail,
} from "@/lib/api/blog";
import { ArticleBody } from "@/components/studio/ArticleBody";
import { VideoEmbed } from "@/components/media/VideoEmbed";
import { JsonLd, absoluteUrl, breadcrumbJsonLd } from "@/components/seo/JsonLd";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";
import { blogPath } from "@/lib/seo/urls";
import { getVideoEmbed } from "@/lib/utils/video";
import { truncateText } from "@/lib/utils/markdown";
import { formatDate } from "@/lib/utils/format";

type BlogBodyPayload = {
  post: BlogPostDetail | null;
  related: BlogPost[];
  failed: boolean;
};

/**
 * Blog post body (not metadata). Fetches the article + related posts in the
 * browser via `/api/vlog/…` so Network shows JSON.
 */
export function BlogPostBody({ slug }: { slug: string }) {
  const fallback: BlogBodyPayload = { post: null, related: [], failed: false };
  const { data, isPending } = useMlsQuery<BlogBodyPayload>(
    ["blog", "post", slug],
    async (): Promise<BlogBodyPayload> => {
      try {
        const post = await getBlogPost(slug);
        if (!post) return { post: null, related: [], failed: false };
        const related = (await getAllBlogPosts().catch(() => [] as BlogPost[]))
          .filter((item) => item.slug !== post.slug)
          .slice(0, 3);
        return { post, related, failed: false };
      } catch {
        return { post: null, related: [], failed: true };
      }
    },
    fallback,
  );

  if (isPending && !data) {
    return <BlogBodySkeleton />;
  }

  if (data?.failed) {
    return (
      <div className="container-page py-16">
        <ErrorState
          title="Article unavailable"
          description="We couldn't load this article right now. Please try again in a moment."
        />
      </div>
    );
  }

  const post = data?.post ?? null;
  if (!post) {
    return (
      <div className="container-page py-16">
        <EmptyState
          title="Article not found"
          description="This article may have been removed or the link is incorrect."
          action={{ label: "All articles", href: "/blog" }}
        />
      </div>
    );
  }

  const embed = getVideoEmbed(post.videoUrl);
  const related = data?.related ?? [];

  return (
    <article className="pb-16">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.seoTitle ?? post.title,
            description:
              post.seoDescription ?? (post.excerpt ? truncateText(post.excerpt, 300) : undefined),
            image: post.thumbnail ? [post.thumbnail] : undefined,
            datePublished: post.publishedAt ?? undefined,
            dateModified: post.updatedAt ?? post.publishedAt ?? undefined,
            author: post.author
              ? { "@type": "Person", name: post.author }
              : { "@type": "Organization", name: "HomeAtlas" },
            publisher: {
              "@type": "Organization",
              name: "HomeAtlas",
              url: absoluteUrl("/"),
            },
            mainEntityOfPage: absoluteUrl(blogPath(post.slug)),
            keywords: post.tags.length > 0 ? post.tags.join(", ") : undefined,
          },
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: post.title, path: blogPath(post.slug) },
          ]),
        ]}
      />
      <header className="border-b border-line bg-surface-alt py-8 sm:py-12">
        <div className="container-page max-w-3xl">
          <Link
            href="/blog"
            className="text-caption text-ink-muted underline-offset-4 hover:text-navy hover:underline"
          >
            ← All articles
          </Link>
          {post.category && (
            <div className="mt-4">
              <Eyebrow>{post.category}</Eyebrow>
            </div>
          )}
          <h1 className="mt-2 text-h1 text-ink">{post.title}</h1>
          {post.excerpt && (
            <p className="mt-3 line-clamp-3 text-body text-ink-muted">{post.excerpt}</p>
          )}
          <p className="mt-4 text-caption text-ink-subtle">
            {[post.author, post.publishedAt ? formatDate(post.publishedAt) : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </header>

      <div className="container-page max-w-3xl py-10">
        {embed && post.videoUrl ? (
          <VideoEmbed url={post.videoUrl} title={post.title} className="mb-8" />
        ) : post.videoUrl ? (
          <div className="mb-8 overflow-hidden rounded-surface border border-line">
            <video src={post.videoUrl} controls className="w-full" />
          </div>
        ) : post.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.thumbnail}
            alt={post.title}
            className="mb-8 w-full rounded-surface border border-line object-cover"
          />
        ) : null}

        <ArticleBody html={post.content} />

        {post.tags.length > 0 && (
          <ul className="mt-10 flex flex-wrap gap-2" aria-label="Tags">
            {post.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-line bg-surface-alt px-3 py-1 text-caption text-ink-muted"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
      </div>

      {related.length > 0 && (
        <aside className="container-page max-w-3xl">
          <h2 className="text-h2 text-ink">More reading</h2>
          <ul className="mt-5 divide-y divide-line border-t border-line">
            {related.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/blog/${item.slug}`}
                  className="group flex flex-col gap-1 py-4 focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-navy/40"
                >
                  <span className="text-h3 text-ink group-hover:text-navy">{item.title}</span>
                  {item.publishedAt && (
                    <span className="text-caption text-ink-subtle">
                      {formatDate(item.publishedAt)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </article>
  );
}

function BlogBodySkeleton() {
  return (
    <div className="container-page max-w-3xl space-y-6 py-16" role="status" aria-label="Loading article">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-12 w-3/4" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
