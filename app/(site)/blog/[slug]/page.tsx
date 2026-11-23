import type { Metadata } from "next";
import { BlogPostBody } from "@/components/blog/BlogPostBody";
import { getBlogPost } from "@/lib/api/blog";
import { blogPath } from "@/lib/seo/urls";
import { truncateText } from "@/lib/utils/markdown";

export const revalidate = 1800;

export async function generateMetadata({
  params,
}: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return { title: "Article not found" };

  // The CMS carries dedicated SEO fields; fall back to the post's own copy.
  const description =
    post.seoDescription ?? (post.excerpt ? truncateText(post.excerpt, 160) : undefined);
  return {
    title: post.seoTitle ?? post.title,
    description,
    // An editor-set canonical wins (syndicated posts); otherwise the post's own URL.
    alternates: { canonical: post.seoCanonicalUrl ?? blogPath(post.slug) },
    robots: post.noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      title: post.seoTitle ?? post.title,
      description,
      type: "article",
      publishedTime: post.publishedAt ?? undefined,
      images: post.thumbnail ? [post.thumbnail] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  return <BlogPostBody slug={slug} />;
}
