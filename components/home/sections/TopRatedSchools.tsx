import Link from "next/link";
import { Section } from "@/components/ui/Section";
import { homesNearSchoolHref, type OfficialSchool } from "@/lib/api/schools";
import { textOf } from "@/lib/site/read";

const SOURCE_URL = "https://data.ontario.ca/dataset/school-information-and-student-demographics";
const LIVE_DESCRIPTION =
  "Published EQAO results for GTA secondary schools. The percentage is the average of Grade 9 math and the literacy test. These are school locations, not attendance boundaries.";

/**
 * Homepage school cards. Live pages pass Ministry results. The studio preview
 * has no school list, so it does not show the sample ratings stored on the section.
 */
export function TopRatedSchools({
  content,
  schools,
}: {
  content?: Record<string, unknown>;
  schools?: OfficialSchool[];
}) {
  const eyebrow = textOf(content, "eyebrow", "Schools & families");
  const title = "GTA Secondary Schools";

  if (!schools) {
    return (
      <Section
        tone="alt"
        eyebrow={eyebrow}
        title={title}
        description={LIVE_DESCRIPTION}
        action={{ label: "View all", href: "/schools" }}
      >
        <p className="text-small text-ink-muted">
          The public homepage loads these results from the Ministry of Education. Sample ratings are not shown.
        </p>
      </Section>
    );
  }

  return (
    <Section
      tone="alt"
      eyebrow={eyebrow}
      title={title}
      description={LIVE_DESCRIPTION}
      action={{ label: "View all", href: "/schools" }}
    >
      {schools.length === 0 ? (
        <p className="text-small text-ink-muted">EQAO results are unavailable right now.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {schools.map((school) => {
              const homesHref =
                school.latitude !== null && school.longitude !== null
                  ? homesNearSchoolHref(school.latitude, school.longitude, {
                      name: school.name,
                    })
                  : null;
              const place = [school.city, school.board].filter(Boolean).join(" · ");
              const score = school.eqaoPercent === null ? "—" : `${school.eqaoPercent}%`;
              return (
                <article
                  key={school.id}
                  className="rounded-surface border border-line bg-surface p-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-small font-semibold leading-snug text-ink">{school.name}</h3>
                      {place ? (
                        <p className="mt-0.5 truncate text-caption text-ink-muted">{place}</p>
                      ) : null}
                    </div>
                    <p
                      className="shrink-0 text-[22px] font-bold leading-none text-ink"
                      title={
                        school.eqaoPercent === null
                          ? "No EQAO result published"
                          : school.eqaoLabel
                      }
                    >
                      {score}
                    </p>
                  </div>
                  {homesHref ? (
                    <Link
                      href={homesHref}
                      className="mt-3 inline-block text-caption font-medium text-navy hover:underline"
                    >
                      Homes within 2 km →
                    </Link>
                  ) : null}
                </article>
              );
            })}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-caption text-ink-muted">
              Ontario Ministry of Education, School information and student demographics, 2024–25.{" "}
              <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline">
                Open Government Licence – Ontario
              </a>
              .
            </p>
            <Link
              href="/schools"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-control bg-navy px-4 text-small font-semibold text-white transition-colors hover:bg-navy/90"
            >
              View all
            </Link>
          </div>
        </>
      )}
    </Section>
  );
}
