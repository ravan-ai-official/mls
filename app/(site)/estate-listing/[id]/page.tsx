import type { Metadata } from "next";
import { EstateListingBody } from "@/components/property/EstateListingBody";
import { getPublicEstateListing } from "@/lib/api/estateListings";
import { estateListingPath } from "@/lib/seo/urls";

export const revalidate = 60;

type PageProps = { params: Promise<{ id: string }> };

async function load(idParam: string) {
  const id = Number(idParam);
  if (!Number.isFinite(id) || id <= 0) return null;
  return getPublicEstateListing(id);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const listing = await load((await params).id);
  if (!listing) return { title: "Listing not found", robots: { index: false, follow: false } };
  const title = listing.title;
  const description =
    listing.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160) ||
    [listing.address, listing.city].filter(Boolean).join(", ");
  const path = estateListingPath(listing.id);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      images: listing.images[0] ? [{ url: listing.images[0] }] : undefined,
    },
  };
}

export default async function EstateListingPage({ params }: PageProps) {
  const idParam = (await params).id;
  const id = Number(idParam);
  if (!Number.isFinite(id) || id <= 0) {
    return <EstateListingBody id={0} />;
  }
  return <EstateListingBody id={id} />;
}
