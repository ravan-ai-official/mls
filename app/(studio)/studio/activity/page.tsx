import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  StudioAlert,
  StudioPage,
  StudioPanel,
  studioFilter,
  studioTable,
  studioTableWrap,
  studioTd,
  studioTh,
} from "@/components/studio/chrome";
import { ApiError } from "@/lib/api/client";
import { getStudioActivity, type StudioActivity } from "@/lib/api/studioActivity";
import { requireStudioAccess } from "@/lib/auth/session";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

const KIND_LABELS: Record<string, string> = {
  listing_view: "Listing view",
  precon_view: "Pre-con view",
  precon_floor_plans: "Floor plans",
  precon_pricing: "Pricing",
  precon_contact: "Contact",
  search: "Search",
  ai_assist: "Assistant",
  inquiry: "Inquiry",
};

export default async function StudioActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; days?: string }>;
}) {
  const session = await requireStudioAccess();
  if (!session || !session.user.isStaff) notFound();

  const params = await searchParams;
  // Keep email / username / id as typed — stripping non-digits made email
  // filters look like a no-op reload.
  const userQuery = (params.user || "").trim().slice(0, 120);
  const days = params.days === "7" || params.days === "90" ? Number(params.days) : 30;

  let report: StudioActivity | null = null;
  let error: string | null = null;
  try {
    report = await getStudioActivity(session.token, {
      days,
      user: userQuery || undefined,
    });
  } catch (err) {
    error =
      err instanceof ApiError
        ? err.message
        : "We couldn't load activity. Refresh to try again.";
  }

  const windowLabel = `${days} days`;
  const filterLabel = report?.userId
    ? `user #${report.userId}${userQuery && !/^\d+$/.test(userQuery) ? ` (${userQuery})` : ""}`
    : userQuery
      ? userQuery
      : null;

  return (
    <StudioPage
      title="Activity"
      description={
        filterLabel
          ? `Views, searches, and leads from the last ${windowLabel} for ${filterLabel}.`
          : `Views, searches, and leads from the last ${windowLabel}.`
      }
      toolbar={
        <form method="get" className="flex flex-wrap items-center gap-2" action="/studio/activity">
          <select name="days" defaultValue={String(days)} aria-label="Window" className={studioFilter}>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
          </select>
          <input
            name="user"
            defaultValue={userQuery}
            placeholder="Email, username, or id"
            aria-label="User email, username, or id"
            className={cn(studioFilter, "w-56")}
            autoComplete="off"
          />
          <button
            type="submit"
            className="h-9 rounded-control bg-navy px-3.5 text-caption font-medium text-white hover:bg-navy-deep"
          >
            Update
          </button>
          {userQuery ? (
            <Link
              href={`/studio/activity?days=${days}`}
              className="h-9 rounded-control border border-line px-3.5 text-caption font-medium text-ink-muted hover:border-navy hover:text-ink"
            >
              Clear user
            </Link>
          ) : null}
        </form>
      }
    >
      {error || !report ? (
        <StudioAlert>{error || "We couldn't load activity. Refresh to try again."}</StudioAlert>
      ) : (
        <>
          <section className="grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Inquiries" value={report.leads.inquiries} />
            <Stat label="Assignment submissions" value={report.leads.assignmentSubmissions} />
            <Stat label="Newsletter sign-ups" value={report.leads.newsletter} />
            <Stat label="Neighbour alerts" value={report.leads.neighbourAlerts} />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <StudioPanel title="Top listings" description="Homes people opened most.">
              {report.topListings.length === 0 ? (
                <Empty />
              ) : (
                <div className={studioTableWrap}>
                  <table className={studioTable}>
                    <thead>
                      <tr>
                        <th scope="col" className={studioTh}>
                          Listing
                        </th>
                        <th scope="col" className={cn(studioTh, "text-right")}>
                          Views
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.topListings.map((row) => (
                        <tr key={row.listingKey}>
                          <td className={studioTd}>
                            <span className="studio-cell-title">{row.address || row.listingKey}</span>
                            {row.city ? <span className="studio-cell-meta">{row.city}</span> : null}
                          </td>
                          <td className={cn(studioTd, "text-right tabular-nums text-ink-muted")}>{row.views}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </StudioPanel>
            <StudioPanel title="Top projects" description="Pre-construction pages and clicks.">
              {report.topProjects.length === 0 ? (
                <Empty />
              ) : (
                <div className={studioTableWrap}>
                  <table className={studioTable}>
                    <thead>
                      <tr>
                        <th scope="col" className={studioTh}>
                          Project
                        </th>
                        <th scope="col" className={cn(studioTh, "text-right")}>
                          Views
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.topProjects.map((row) => (
                        <tr key={row.id}>
                          <td className={studioTd}>
                            <span className="studio-cell-title">{row.title}</span>
                            <span className="studio-cell-meta">
                              Floor plans {row.floorPlans} · Pricing {row.pricing} · Contact {row.contact}
                            </span>
                          </td>
                          <td className={cn(studioTd, "text-right tabular-nums text-ink-muted")}>{row.views}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </StudioPanel>
          </section>

          <StudioPanel
            title="Searches"
            description={`${report.searches.count.toLocaleString("en-CA")} searches, including ${report.searches.aiCount.toLocaleString("en-CA")} through the assistant.`}
          >
            {report.searches.topQueries.length === 0 ? (
              <Empty />
            ) : (
              <div className={studioTableWrap}>
                <table className={studioTable}>
                  <thead>
                    <tr>
                      <th scope="col" className={studioTh}>
                        Query
                      </th>
                      <th scope="col" className={cn(studioTh, "text-right")}>
                        Count
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.searches.topQueries.map((row) => (
                      <tr key={row.query}>
                        <td className={cn(studioTd, "text-ink")}>{row.query}</td>
                        <td className={cn(studioTd, "text-right tabular-nums text-ink-muted")}>{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </StudioPanel>

          <StudioPanel
            title={
              report.userId
                ? `Timeline for user #${report.userId}`
                : "Recent timeline"
            }
          >
            {report.timeline.length === 0 ? (
              <Empty />
            ) : (
              <div className={studioTableWrap}>
                <table className={cn(studioTable, "min-w-[40rem]")}>
                  <thead>
                    <tr>
                      <th scope="col" className={studioTh}>
                        Event
                      </th>
                      <th scope="col" className={studioTh}>
                        Who
                      </th>
                      <th scope="col" className={studioTh}>
                        When
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.timeline.map((row, index) => (
                      <tr key={`${row.at}-${index}`}>
                        <td className={studioTd}>
                          <span className="studio-cell-title">{KIND_LABELS[row.kind] ?? row.kind}</span>
                          <span className="studio-cell-meta">{row.label}</span>
                        </td>
                        <td className={cn(studioTd, "text-ink-muted")}>
                          {row.userEmail ? (
                            <Link
                              href={`/studio/activity?days=${days}&user=${encodeURIComponent(row.userEmail)}`}
                              className="text-navy underline-offset-2 hover:underline"
                            >
                              {row.userEmail}
                            </Link>
                          ) : (
                            "Guest"
                          )}
                        </td>
                        <td className={cn(studioTd, "whitespace-nowrap text-ink-muted")}>
                          {row.at.slice(0, 16).replace("T", " ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </StudioPanel>
        </>
      )}
    </StudioPage>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface px-4 py-3.5">
      <p className="text-caption text-ink-muted">{label}</p>
      <p className="mt-1 text-h2 tabular-nums text-ink">{value.toLocaleString("en-CA")}</p>
    </div>
  );
}

function Empty() {
  return <p className="py-3 text-small text-ink-muted">Nothing recorded in this window yet.</p>;
}
