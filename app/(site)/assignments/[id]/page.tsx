import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SimilarAssignments } from "@/components/assignments/SimilarAssignments";
import { Gallery } from "@/components/property/Gallery";
import { assignmentLeadKey, InquiryForm } from "@/components/property/InquiryForm";
import { absoluteUrl, breadcrumbJsonLd, JsonLd } from "@/components/seo/JsonLd";
import { Badge } from "@/components/ui/Badge";
import { KeyFacts, SectionCard } from "@/components/ui/SectionCard";
import {
  assignmentPath,
  assignmentTitle,
  getPublicAssignment,
  type PublicListing,
} from "@/lib/api/assignments";
import { ApiError } from "@/lib/api/client";
import { sampleAssignment, USE_ASSIGNMENT_SAMPLES } from "@/lib/demo/assignments";
import { preconPath } from "@/lib/seo/urls";
import { formatDate, formatNumber, formatPrice } from "@/lib/utils/format";

export const revalidate = 300;

/** Null only for a genuine 404 (or a non-numeric id); other failures surface as errors. */
async function load(segment: string): Promise<PublicListing | null> {
  const id = Number(segment);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (USE_ASSIGNMENT_SAMPLES) return sampleAssignment(id);
  try {
    return await getPublicAssignment(id);
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) return null;
    throw error;
  }
}

function describe(listing: PublicListing): string {
  const parts = [
    `${listing.propertyType || "Home"} assignment in ${listing.city}`,
    listing.builderName ? `by ${listing.builderName}` : null,
    listing.askingPrice ? `asking ${formatPrice(listing.askingPrice)}` : null,
    listing.occupancyDate ? `occupancy ${formatDate(listing.occupancyDate)}` : null,
  ].filter(Boolean);
  return `${parts.join(", ")}.`;
}

export async function generateMetadata({ params }: PageProps<"/assignments/[id]">): Promise<Metadata> {
  const { id } = await params;
  let listing: PublicListing | null = null;
  try {
    listing = await load(id);
  } catch {
    return { title: "Assignment unavailable" };
  }
  if (!listing) return { title: "Assignment not found" };
  const title = `${assignmentTitle(listing)} assignment, ${listing.city}`;
  const description = describe(listing);
  return {
    title,
    description,
    alternates: { canonical: assignmentPath(listing) },
    openGraph: {
      title,
      description,
      url: assignmentPath(listing),
      ...(listing.photos[0] ? { images: [{ url: listing.photos[0] }] } : {}),
    },
  };
}

export default async function AssignmentPage({ params }: PageProps<"/assignments/[id]">) {
  const { id } = await params;
  const listing = await load(id);
  if (!listing) notFound();

  const title = assignmentTitle(listing);
  const address = [listing.addressLine1, listing.addressLine2, listing.city].filter(Boolean).join(", ");

  return (
    <article className="container-page py-8">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "RealEstateListing",
            name: `${title} assignment`,
            description: describe(listing),
            url: absoluteUrl(assignmentPath(listing)),
            ...(listing.publishedAt ? { datePosted: listing.publishedAt } : {}),
            ...(listing.photos.length ? { image: listing.photos } : {}),
            ...(listing.askingPrice
              ? { offers: { "@type": "Offer", price: listing.askingPrice, priceCurrency: "CAD" } }
              : {}),
          },
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Assignments", path: "/assignments" },
            { name: title, path: assignmentPath(listing) },
          ]),
        ]}
      />

      <nav aria-label="Breadcrumb" className="mb-5">
        <Link href="/assignments" className="text-small text-ink-muted transition-colors hover:text-ink">
          ← Back to assignments
        </Link>
      </nav>

      {listing.photos.length > 0 && (
        <Gallery
          images={listing.photos.map((url) => ({ url, category: null, isPreferred: false }))}
          address={title}
        />
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">Assignment</Badge>
              {listing.sourceLabel && <Badge tone="neutral">Listed by {listing.sourceLabel.toLowerCase()}</Badge>}
            </div>
            <h1 className="mt-3 text-h1 text-ink">{title}</h1>
            {address && <p className="mt-1 text-small text-ink-muted">{address}</p>}
            <p className="mt-4 text-h2 text-ink">{formatPrice(listing.askingPrice)}</p>
          </header>

          <SectionCard title="Key facts">
            <KeyFacts
              items={[
                { label: "Project", value: listing.projectName || null },
                { label: "Builder", value: listing.builderName || null },
                { label: "Occupancy", value: listing.occupancyDate ? formatDate(listing.occupancyDate) : null },
                { label: "Home type", value: listing.propertyType || null },
                { label: "Bedrooms", value: listing.beds !== null ? formatNumber(listing.beds) : null },
                { label: "Bathrooms", value: listing.baths !== null ? formatNumber(listing.baths) : null },
                { label: "Interior", value: listing.sqft ? `${formatNumber(listing.sqft)} sq ft` : null },
                { label: "Listed", value: listing.publishedAt ? formatDate(listing.publishedAt) : null },
              ]}
            />
            {listing.preconProjectId && (
              <p className="mt-4 text-small">
                <Link
                  href={preconPath(listing.preconProjectId, listing.projectName)}
                  className="font-medium text-navy underline underline-offset-2"
                >
                  See the {listing.projectName || "project"} page
                </Link>
              </p>
            )}
          </SectionCard>

          {listing.description && (
            <SectionCard title="About this assignment">
              <p className="whitespace-pre-line text-body leading-relaxed text-ink-soft">{listing.description}</p>
            </SectionCard>
          )}

          <p className="text-caption text-ink-subtle">
            Assignment listings are submitted by their owners, agents or builders and reviewed by our team. They are not
            MLS® listings. Confirm all details, including the builder&apos;s assignment terms, before you buy.
          </p>
        </div>

        <aside className="lg:sticky lg:top-28 lg:h-fit">
          <InquiryForm listingKey={assignmentLeadKey(listing.id)} address={title} variant="assignment" />
        </aside>
      </div>

      <Suspense fallback={null}>
        <SimilarAssignments id={listing.id} />
      </Suspense>
    </article>
  );
}
