import { SafeImage } from "@/components/ui/SafeImage";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Section } from "@/components/ui/Section";
import { GTA_NEWS_MORE_HREF } from "@/lib/api/gtaNews";
import { getNews, type HomeNewsArticle } from "@/lib/api/homeForms";
import { newsArticles } from "@/lib/home/contentSections";
import { textOf } from "@/lib/site/read";
import { NewsGlyph } from "./contentIcons";
import { NewsletterForm } from "./NewsletterForm";

/**
 * "Daily Real Estate & Financial News" — HomeAtlasUI HomePage L1130-1189.
 *
 * Live headlines come from free GTA real-estate RSS (Google News / CBC),
 * cached ~15 minutes. Each card opens the original article. When the feed is
 * empty, sample headlines render and link to the blog.
 */
export async function DailyNews({ content }: { content?: Record<string, unknown> }) {
  const news = await getNews(4);
  // Only http(s) links are rendered; anything else is dropped, not linked.
  const safe = (news ?? []).filter((article) => /^https?:\/\//i.test(article.url));
  const live = safe.length > 0 ? safe : null;

  return (
    <Section
      eyebrow={textOf(content, "eyebrow", "Stay informed")}
      title={textOf(content, "title", "Daily Real Estate & Financial News")}
      description={textOf(
        content,
        "description",
        "Latest updates on GTA housing, mortgage rates, and investment trends",
      )}
      action={{
        label: textOf(content, "actionLabel", "All News"),
        href: textOf(content, "actionHref", GTA_NEWS_MORE_HREF),
      }}
    >
      {live ? <LiveNews articles={live} /> : <SampleNews />}

      <div className="flex flex-col items-start justify-between gap-5 rounded-surface bg-surface-alt p-6 sm:flex-row sm:items-center sm:p-8">
        <div>
          <h3 className="text-h3 text-ink">{textOf(content, "newsletterTitle", "Get Daily Market Updates in Your Inbox")}</h3>
          <p className="mt-1 text-small text-ink-muted">
            {textOf(content, "newsletterDescription", "GTA market news, rate changes, and investment opportunities — every morning.")}
          </p>
        </div>
        <div className="w-full shrink-0 sm:w-auto">
          <NewsletterForm />
        </div>
      </div>
    </Section>
  );
}

const CARD =
  "group flex h-full flex-col overflow-hidden rounded-control border border-line transition-shadow hover:shadow-card-hover";
const GRID = "mb-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4";

function relativeTime(value: string | null): string | null {
  if (!value) return null;
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return null;
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (minutes < 60) return minutes <= 1 ? "Just now" : `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(value).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

function LiveNews({ articles }: { articles: HomeNewsArticle[] }) {
  return (
    <ul
      className={
        articles.length >= 4 ? GRID : "mb-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
      }
    >
      {articles.map((article) => {
        const when = relativeTime(article.published_at);
        return (
          <li key={article.id}>
            <a href={article.url} target="_blank" rel="noopener noreferrer" className={CARD}>
              <div className="relative flex h-35 items-center justify-center overflow-hidden bg-surface-alt">
                {article.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- publisher images come from arbitrary hosts
                  <img
                    src={article.image_url}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <NewsGlyph className="h-10 w-10 text-ink-subtle" />
                )}
                {article.tag && (
                  <Badge tone="navy" className="absolute left-3 top-3">
                    {article.tag}
                  </Badge>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="line-clamp-3 text-small font-semibold text-ink">{article.title}</h3>
                <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                  <span className="truncate text-caption text-ink-subtle">
                    {[article.source, when].filter(Boolean).join(" · ")}
                  </span>
                  <span className="shrink-0 text-caption font-medium text-gold group-hover:underline">
                    Read <span aria-hidden="true">↗</span>
                    <span className="sr-only">(opens in a new tab)</span>
                  </span>
                </div>
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** Reference sample headlines — only when the live feed has nothing. */
function SampleNews() {
  return (
    <ul className={GRID}>
      {newsArticles.map((article) => (
        <li key={article.title}>
          <Link href="/blog" className={CARD}>
            <div className="relative flex h-35 items-center justify-center overflow-hidden bg-surface-alt">
              <SafeImage
                src={article.img}
                alt=""
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {article.tag && (
                <Badge tone="navy" className="absolute left-3 top-3">
                  {article.tag}
                </Badge>
              )}
            </div>
            <div className="flex flex-1 flex-col p-4">
              <h3 className="line-clamp-3 text-small font-semibold text-ink">{article.title}</h3>
              <div className="mt-auto flex items-center justify-between pt-3">
                <span className="text-caption text-ink-subtle">{article.time}</span>
                <span className="text-caption font-medium text-gold group-hover:underline">
                  Read →
                </span>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
