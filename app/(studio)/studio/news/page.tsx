import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  StudioEmpty,
  StudioPage,
  studioTable,
  studioTableWrap,
  studioTd,
  studioTh,
} from "@/components/studio/chrome";
import { getGtaRealEstateNews, GTA_NEWS_MORE_HREF } from "@/lib/api/gtaNews";
import { requireStudioAccess } from "@/lib/auth/session";

export const metadata: Metadata = { title: "News" };
export const dynamic = "force-dynamic";

/**
 * Read-only preview of the homepage Daily News strip.
 * Headlines come from free GTA real-estate RSS — admins cannot post their own.
 */
export default async function NewsPage() {
  const session = await requireStudioAccess();
  if (!session?.user.isStaff) notFound();

  const articles = await getGtaRealEstateNews(8);

  return (
    <StudioPage
      title="News"
      description="Homepage Daily News pulls free GTA / Ontario real-estate headlines automatically (Google News RSS + CBC Toronto). There is no create form — publish blog posts under Blog if you need original content."
    >
      {articles.length === 0 ? (
        <StudioEmpty title="No live headlines right now">
          Check the homepage again in a few minutes, or open{" "}
          <a href={GTA_NEWS_MORE_HREF} target="_blank" rel="noreferrer" className="text-navy underline">
            Google News — GTA real estate
          </a>
          .
        </StudioEmpty>
      ) : (
        <div className={studioTableWrap}>
          <table className={studioTable}>
            <thead>
              <tr>
                <th scope="col" className={studioTh}>
                  Headline
                </th>
                <th scope="col" className={studioTh}>
                  Source
                </th>
                <th scope="col" className={studioTh}>
                  Published
                </th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => (
                <tr key={article.id}>
                  <td className={studioTd}>
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="studio-cell-title text-navy underline-offset-2 hover:underline"
                    >
                      {article.title}
                    </a>
                  </td>
                  <td className={`${studioTd} text-ink-muted`}>{article.source || "—"}</td>
                  <td className={`${studioTd} whitespace-nowrap text-ink-muted`}>
                    {article.published_at
                      ? new Date(article.published_at).toLocaleString("en-CA", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-caption text-ink-muted">
        Public strip: homepage → Daily Real Estate &amp; Financial News.{" "}
        <a href={GTA_NEWS_MORE_HREF} target="_blank" rel="noreferrer" className="text-navy underline">
          Browse more on Google News
        </a>
        .
      </p>
    </StudioPage>
  );
}
