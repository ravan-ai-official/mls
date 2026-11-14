/**
 * Free GTA / Ontario real-estate headlines for the homepage Daily News strip.
 *
 * Uses Google News RSS (no API key) with GTA housing queries. Falls back to
 * CBC Toronto when Google is unreachable. Parsed on the server only.
 */

import type { HomeNewsArticle } from "@/lib/api/homeForms";

const GOOGLE_FEEDS = [
  // Greater Toronto Area housing / real estate
  "https://news.google.com/rss/search?q=%22Greater%20Toronto%22%20(housing%20OR%20%22real%20estate%22%20OR%20condo%20OR%20homes)%20when%3A14d&hl=en-CA&gl=CA&ceid=CA:en",
  // Mortgage rates / Bank of Canada / Ontario market
  "https://news.google.com/rss/search?q=(Toronto%20OR%20GTA%20OR%20Ontario)%20(mortgage%20OR%20%22home%20prices%22%20OR%20TRREB%20OR%20CMHC)%20when%3A14d&hl=en-CA&gl=CA&ceid=CA:en",
] as const;

const CBC_TORONTO = "https://www.cbc.ca/webfeed/rss/rss-canada-toronto";

const GTA_HINT =
  /\b(toronto|gta|mississauga|vaughan|markham|oakville|brampton|hamilton|ontario|housing|real\s*estate|condo|mortgage|home\s*price|trreb|cmhc|rent)\b/i;

export const GTA_NEWS_MORE_HREF =
  "https://news.google.com/search?q=Greater+Toronto+real+estate+OR+housing&hl=en-CA&gl=CA&ceid=CA:en";

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function tagText(block: string, tag: string): string {
  const match =
    block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i")) ||
    block.match(new RegExp(`<${tag}[^>]*/>`, "i"));
  if (!match?.[1]) return "";
  return decodeXml(match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function sourceName(block: string, fallback: string): string {
  const named = tagText(block, "source");
  if (named) return named;
  // Google titles often end with " - Outlet"
  const title = tagText(block, "title");
  const dash = title.lastIndexOf(" - ");
  if (dash > 0 && dash < title.length - 3) return title.slice(dash + 3).trim();
  return fallback;
}

function cleanTitle(title: string, source: string): string {
  if (source && title.endsWith(` - ${source}`)) {
    return title.slice(0, -(source.length + 3)).trim();
  }
  return title;
}

function parseItems(xml: string, fallbackSource: string): HomeNewsArticle[] {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  const articles: HomeNewsArticle[] = [];
  for (const block of blocks) {
    const rawTitle = tagText(block, "title");
    const url = tagText(block, "link") || tagText(block, "guid");
    if (!rawTitle || !/^https?:\/\//i.test(url)) continue;
    const source = sourceName(block, fallbackSource);
    const title = cleanTitle(rawTitle, source);
    const published = tagText(block, "pubDate") || tagText(block, "published") || null;
    const summary = tagText(block, "description");
    const publishedAt = published ? new Date(published) : null;
    articles.push({
      id: Math.abs(hashString(url)) || articles.length + 1,
      title,
      url,
      summary,
      image_url: "",
      tag: "GTA",
      source,
      published_at: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt.toISOString() : null,
    });
  }
  return articles;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash;
}

async function fetchFeed(url: string, fallbackSource: string): Promise<HomeNewsArticle[]> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml, */*",
        "User-Agent": "HomeAtlasNewsBot/1.0 (+https://homeatlas.ca; daily news)",
      },
      next: { revalidate: 900 },
    });
    if (!response.ok) return [];
    const xml = await response.text();
    if (!xml.includes("<item")) return [];
    return parseItems(xml, fallbackSource);
  } catch {
    return [];
  }
}

function scoreArticle(article: HomeNewsArticle): number {
  const hay = `${article.title} ${article.summary} ${article.source}`;
  let score = 0;
  if (GTA_HINT.test(hay)) score += 5;
  if (/\b(toronto|gta|mississauga|vaughan|markham|oakville|brampton)\b/i.test(hay)) score += 4;
  if (/\b(real\s*estate|housing|condo|mortgage|home\s*price|trreb)\b/i.test(hay)) score += 3;
  if (article.published_at) {
    const ageHours = (Date.now() - new Date(article.published_at).getTime()) / 3_600_000;
    if (ageHours < 24) score += 3;
    else if (ageHours < 72) score += 2;
    else if (ageHours < 168) score += 1;
  }
  return score;
}

/** Latest GTA / Ontario real-estate headlines from free RSS (no API key). */
export async function getGtaRealEstateNews(limit = 4): Promise<HomeNewsArticle[]> {
  const batches = await Promise.all([
    ...GOOGLE_FEEDS.map((feed) => fetchFeed(feed, "Google News")),
    fetchFeed(CBC_TORONTO, "CBC Toronto").then((rows) =>
      rows.filter((row) => GTA_HINT.test(`${row.title} ${row.summary}`)),
    ),
  ]);

  const seen = new Set<string>();
  const merged: HomeNewsArticle[] = [];
  for (const batch of batches) {
    for (const article of batch) {
      const key = article.url.split("&")[0].toLowerCase();
      const titleKey = article.title.toLowerCase();
      if (seen.has(key) || seen.has(titleKey)) continue;
      seen.add(key);
      seen.add(titleKey);
      merged.push(article);
    }
  }

  return merged
    .map((article) => ({ article, score: scoreArticle(article) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aTime = a.article.published_at ? new Date(a.article.published_at).getTime() : 0;
      const bTime = b.article.published_at ? new Date(b.article.published_at).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, Math.max(1, Math.min(limit, 8)))
    .map(({ article }) => article);
}
