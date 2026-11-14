import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SafeImage } from "@/components/ui/SafeImage";
import { Gallery } from "@/components/property/Gallery";
import { InquiryForm } from "@/components/property/InquiryForm";
import { ListingShareActions, ListingWhatsAppCard } from "@/components/property/ListingShareActions";
import { ClimateRisk } from "@/components/property/ClimateRisk";
import { KeyFacts, MarketDemand } from "@/components/property/KeyFacts";
import { EstimatesPanel } from "@/components/property/EstimatesPanel";
import { CommunityPanel } from "@/components/property/CommunityPanel";
import { ComparablesBoard } from "@/components/property/ComparablesBoard";
import { SchoolsSection } from "@/components/property/Neighbourhood";
import { PriceHistory } from "@/components/property/PriceHistory";
import { PropertyNote } from "@/components/property/PropertyNote";
import { PropertyTabs } from "@/components/property/PropertyTabs";
import { SaveButton } from "@/components/property/SaveButton";
import { TouredButton } from "@/components/property/TouredButton";
import { ViewTracker } from "@/components/property/ViewTracker";
import { Badge } from "@/components/ui/Badge";
import { PropertyGridSkeleton, Skeleton, UnavailableNote } from "@/components/ui/States";
import { ApiError, safeFetch } from "@/lib/api/client";
import { getProperty, getSimilarProperties, searchProperties } from "@/lib/api/properties";
import { getListingEngagement, getPropertySnapshots } from "@/lib/api/neighbourhood";
import { getSchoolsNear } from "@/lib/api/schools";
import { statusLabel } from "@/lib/api/mappers";
import {
  EMPTY,
  formatLeasePrice,
  formatNumber,
  formatPrice,
} from "@/lib/utils/format";
import type { PropertyDetail, PropertySummary } from "@/lib/types/domain";
import { absoluteUrl, JsonLd } from "@/components/seo/JsonLd";
import { propertyJsonLd } from "@/lib/seo/jsonld";
import { propertyPath } from "@/lib/seo/urls";

export const revalidate = 300;

/**
 * Returns null only when the backend genuinely reports the listing is missing.
 * A network/timeout failure (status 0 or 5xx) is re-thrown so the error
 * boundary shows "something went wrong" — telling a user the home does not
 * exist when the API is merely unreachable would be wrong.
 */
async function load(listingKey: string): Promise<PropertyDetail | null> {
  try {
    return await getProperty(decodeURIComponent(listingKey));
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/property/[listingKey]">): Promise<Metadata> {
  const { listingKey } = await params;

  /*
   * Metadata generation must not decide the route's fate. Swallowing every
   * failure here made a backend outage look like a missing listing, so we only
   * fall back to a plain title and let the page component below classify the
   * error (404 → not-found, anything else → the error boundary).
   */
  let property: PropertyDetail | null = null;
  try {
    property = await load(listingKey);
  } catch {
    return { title: "Listing unavailable" };
  }
  if (!property) return { title: "Listing not found" };

  const price = property.isLease
    ? formatLeasePrice(property.price)
    : formatPrice(property.price);

  return {
    title: `${property.address} — ${price}`,
    description:
      property.description?.slice(0, 155) ??
      `${property.beds ?? EMPTY} bed, ${property.baths ?? EMPTY} bath home in ${property.community ?? "the GTA"}.`,
    alternates: { canonical: propertyPath(property.id) },
    openGraph: property.image
      ? { images: [{ url: property.image }], title: property.address }
      : undefined,
  };
}

export default async function PropertyPage({
  params,
}: PageProps<"/property/[listingKey]">) {
  const { listingKey } = await params;
  const property = await load(listingKey);
  if (!property) notFound();

  const location = [
    ...new Set(
      [property.neighbourhood, property.community, property.stateOrProvince].filter(Boolean),
    ),
  ].join(", ");

  const shareUrl = absoluteUrl(propertyPath(property.id));
  const priceLabel =
    property.price === null
      ? EMPTY
      : property.isLease
        ? formatLeasePrice(property.price)
        : formatPrice(property.price);
  const soldClose = property.status === "sold" ? property.closePrice : null;
  const headlinePrice =
    soldClose !== null
      ? property.isLease
        ? formatLeasePrice(soldClose)
        : formatPrice(soldClose)
      : priceLabel;
  const overAsk =
    soldClose !== null && property.price
      ? ((soldClose - property.price) / property.price) * 100
      : null;
  const similarHref = property.community
    ? `/listings?city=${encodeURIComponent(property.community)}`
    : "/listings";
  const hasLocation = property.latitude !== null && property.longitude !== null;

  return (
    <article className="pb-8">
      <JsonLd data={propertyJsonLd(property)} />
      {/* Records the view for popularity counts and "Recently Viewed". */}
      <ViewTracker
        listingKey={property.id}
        snapshot={{
          address: property.address,
          price: property.price,
          city: property.community,
          image: property.image,
          beds: property.beds,
          baths: property.baths,
        }}
      />

      <div className="container-page pt-3 sm:pt-4">
      <nav aria-label="Breadcrumb" className="mb-1 sm:mb-2">
        <Link
          href="/listings"
          className="inline-flex items-center gap-1.5 text-small text-ink-muted transition-colors hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path
              d="M14.25 9H3.75M9 14.25L3.75 9L9 3.75"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to listings
        </Link>
      </nav>
      </div>

      <PropertyTabs
        hero={<Gallery images={property.images} address={property.address} />}
        lead={
      <header>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[1.75rem] font-semibold leading-tight text-ink sm:text-[2rem]">
              {headlinePrice}
              {overAsk !== null && (
                <span
                  className={`ml-3 inline-flex rounded-full px-3 py-1 align-middle text-[13px] font-semibold ${
                    overAsk >= 0 ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"
                  }`}
                >
                  {overAsk >= 0 ? "+" : ""}
                  {overAsk.toFixed(1)}% {overAsk >= 0 ? "over asking" : "below asking"}
                </span>
              )}
            </p>
            <h1 className="mt-1 text-[15px] font-medium text-ink">{property.address}</h1>
            <p className="text-[13px] text-ink-muted">{location || EMPTY}</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[12px] text-ink-muted">
              {property.status === "sold" ? "Asking price" : "MLS®"}
            </p>
            <p
              className={
                property.status === "sold"
                  ? "text-[18px] font-medium text-ink-muted line-through"
                  : "text-[18px] font-semibold text-navy"
              }
            >
              {property.status === "sold" ? priceLabel : property.mls}
            </p>
            {property.status !== "sold" && (
              <p className="text-[12px] text-ink-muted">Listed</p>
            )}
          </div>
        </div>

        <dl className="mt-4 flex flex-wrap gap-2 sm:gap-3">
          {property.bedsLabel || property.beds !== null ? (
            <StatPill label="Bedrooms" value={property.bedsLabel ?? formatNumber(property.beds)} />
          ) : null}
          {property.baths !== null && (
            <StatPill label="Bathrooms" value={formatNumber(property.baths)} />
          )}
          {property.garageSpaces !== null && (
            <StatPill label="Garages" value={formatNumber(property.garageSpaces)} />
          )}
          {property.parkingTotal !== null && (
            <StatPill label="Parking" value={formatNumber(property.parkingTotal)} />
          )}
          {property.sqft !== null && (
            <StatPill label="Sq Ft" value={formatNumber(property.sqft)} />
          )}
          {property.stories !== null && (
            <StatPill label="Floors" value={formatNumber(property.stories)} />
          )}
          {property.yearBuilt !== null && (
            <StatPill label="Year built" value={String(property.yearBuilt)} />
          )}
          {property.kitchens !== null && (
            <StatPill label="Kitchens" value={formatNumber(property.kitchens)} />
          )}
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {property.type && (
            <span className="inline-flex items-center gap-2 rounded-xl bg-surface-alt px-4 py-2.5 text-[14px]">
              <span className="font-semibold text-ink">{property.type}</span>
              <span className="text-[12px] text-ink-muted">Type</span>
            </span>
          )}
          <span className="text-ink-subtle" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
            </svg>
          </span>
          <Link
            href="/preconstruction"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-gold px-4 py-2.5 text-[13px] font-bold text-navy hover:bg-gold-deep sm:px-5"
          >
            Browse Similar Preconstruction
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" />
            </svg>
          </Link>
          <TouredButton
            listingKey={property.id}
            snapshot={{
              address: property.address,
              price: property.price,
              city: property.community,
              image: property.image,
              beds: property.beds,
              baths: property.baths,
            }}
          />
        </div>
      </header>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
            {property.status === "active" && (
              <SaveButton
                variant="inline"
                listingKey={property.id}
                address={property.address}
              />
            )}
            <ListingShareActions
              listingKey={property.id}
              address={property.address}
              url={shareUrl}
              canCompare={property.status === "active"}
              virtualTourUrl={property.virtualTourUrl}
            />
          </div>
        }
        aside={
          <div className="space-y-4">
            <InquiryForm listingKey={property.id} address={property.address} />
            <ListingWhatsAppCard
              address={property.address}
              listingKey={property.mls}
              url={shareUrl}
            />
            <Link
              href={similarHref}
              className="block rounded-surface bg-ink p-5 text-white"
            >
              <p className="text-caption font-semibold uppercase tracking-wider text-gold">
                Nearby homes
              </p>
              <p className="mt-2 text-small font-medium">
                {property.type ?? "Homes"}
                {property.community ? ` in ${property.community}` : " across the GTA"}
              </p>
              <span className="mt-4 inline-flex rounded-control bg-gold px-3.5 py-2 text-caption font-semibold text-ink">
                Browse listings
              </span>
            </Link>
            <Suspense fallback={null}>
              <SimilarHomes listingKey={property.id} city={property.community} />
            </Suspense>
          </div>
        }
        footnote={
          <p className="mt-10 text-caption text-ink-subtle">
            MLS® {property.mls} · Listing data provided by the Canadian Real Estate
            Association. Information is deemed reliable but not guaranteed.
          </p>
        }
        tabs={[
                {
                  id: "overview",
                  label: "Overview",
                  content: (
                    <div className="space-y-8">
                      <KeyFacts groups={property.factGroups} />
                      <Suspense fallback={null}>
                        <DemandPanel listingKey={property.id} />
                      </Suspense>
                      {property.description && (
                        <section>
                          <h2 className="mb-3 text-[18px] font-semibold text-ink">Description</h2>
                          <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink-muted">
                            {property.description}
                          </p>
                        </section>
                      )}
                      <ClimateRisk />
                      {property.rooms.length > 0 && (
                        <section className="overflow-hidden rounded-2xl border border-line">
                          <div className="border-b border-line bg-surface-alt px-4 py-4 sm:px-6">
                            <h2 className="text-[18px] font-semibold text-ink">Rooms</h2>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[420px] text-[13px]">
                              <thead>
                                <tr className="border-b border-line text-left text-ink-muted">
                                  <th scope="col" className="px-4 py-3 font-medium sm:px-6">Room</th>
                                  <th scope="col" className="px-4 py-3 font-medium sm:px-6">Level</th>
                                  <th scope="col" className="px-4 py-3 font-medium sm:px-6">Dimensions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {property.rooms.map((room, index) => (
                                  <tr key={`${room.name}-${index}`} className="border-b border-line-soft">
                                    <td className="px-4 py-3 font-medium text-ink sm:px-6">{room.name}</td>
                                    <td className="px-4 py-3 text-ink-muted sm:px-6">{room.level ?? EMPTY}</td>
                                    <td className="px-4 py-3 text-ink-muted sm:px-6">{room.dimensions ?? EMPTY}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      )}
                      <PropertyNote listingKey={property.id} />
                    </div>
                  ),
                },
                {
                  id: "history",
                  label: "Listing History",
                  content: (
                    <Suspense fallback={<SectionSkeleton label="Loading price history" />}>
                      <PriceHistorySection listingKey={property.id} listingId={property.mls} />
                    </Suspense>
                  ),
                },
                {
                  id: "estimates",
                  label: "Estimates",
                  content: (
                    <Suspense fallback={<SectionSkeleton label="Loading estimate" />}>
                      <EstimatesPanel property={property} />
                    </Suspense>
                  ),
                },
                {
                  id: "comparables",
                  label: "Comparables",
                  content: (
                    <Suspense fallback={<PropertyGridSkeleton count={2} />}>
                      <ComparablesSection property={property} />
                    </Suspense>
                  ),
                },
                {
                  id: "schools",
                  label: "Schools",
                  content: hasLocation ? (
                    <Suspense fallback={<SectionSkeleton label="Loading schools" />}>
                      <SchoolsPanel
                        latitude={property.latitude ?? 0}
                        longitude={property.longitude ?? 0}
                      />
                    </Suspense>
                  ) : (
                    <LocationUnavailable
                      title="Nearby schools"
                      detail="School data needs a map location, and this listing does not include one."
                    />
                  ),
                },
                {
                  id: "community",
                  label: "Community",
                  content: (
                    <Suspense fallback={<SectionSkeleton label="Loading community" />}>
                      <CommunityPanel
                        city={property.community}
                        neighbourhood={property.neighbourhood}
                        postalCode={property.postalCode}
                        latitude={property.latitude}
                        longitude={property.longitude}
                      />
                    </Suspense>
                  ),
                },
              ]}
      />
    </article>
  );
}

function StatPill({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="inline-flex items-center gap-2 rounded-xl bg-surface-alt px-3.5 py-2.5 sm:px-4">
      <dd className="text-[14px] font-semibold text-ink">{value}</dd>
      <dt className="text-[12px] text-ink-muted">{label}</dt>
    </div>
  );
}

function LocationUnavailable({ title, detail }: { title: string; detail: string }) {
  return (
    <section>
      <h2 className="text-h2 text-ink">{title}</h2>
      <UnavailableNote className="mt-3">{detail}</UnavailableNote>
    </section>
  );
}

async function SimilarHomes({
  listingKey,
  city,
}: {
  listingKey: string;
  city: string | null;
}) {
  let similar = await safeFetch(getSimilarProperties(listingKey), [], "property:similar");
  similar = similar.filter((item) => item.id !== listingKey);

  // Fill out the sidebar when recommendations are short. Same city, active.
  if (similar.length < 3 && city) {
    const found = await safeFetch(
      searchProperties({ city, status: "Active", limit: 4 }),
      {
        items: [] as PropertySummary[],
        total: 0,
        nextOffset: null,
        previousOffset: null,
        approximate: false,
        truncated: false,
      },
      "property:similar-city",
    );
    const extra = found.items.filter(
      (item) => item.id !== listingKey && !similar.some((row) => row.id === item.id),
    );
    similar = [...similar, ...extra];
  }

  if (similar.length === 0) return null;

  return (
    <section className="rounded-2xl border border-line p-4 sm:p-5">
      <h2 className="mb-4 text-[15px] font-semibold text-ink">
        Similar{city ? ` in ${city}` : " nearby"}
      </h2>
      <ul className="space-y-1">
        {similar.slice(0, 3).map((item) => (
          <li key={item.id}>
            <CompactSimilar property={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CompactSimilar({ property }: { property: PropertySummary }) {
  const price =
    property.price === null
      ? EMPTY
      : property.isLease
        ? formatLeasePrice(property.price)
        : formatPrice(property.price);
  return (
    <Link href={propertyPath(property.id)} className="-mx-2 flex gap-3 rounded-xl p-2 hover:bg-surface-alt">
      <SafeImage
        src={property.image}
        alt=""
        width={64}
        height={48}
        className="h-12 w-16 shrink-0 rounded-lg object-cover"
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-ink">{price}</span>
        <span className="block truncate text-[11px] text-ink-muted">{property.address}</span>
        <span className="block text-[11px] text-ink-muted">
          {property.beds ?? EMPTY}bd · {property.baths ?? EMPTY}ba
          {property.type ? ` · ${property.type}` : ""}
        </span>
      </span>
    </Link>
  );
}

async function PriceHistorySection({
  listingKey,
  listingId,
}: {
  listingKey: string;
  listingId: string;
}) {
  const snapshots = await safeFetch(
    getPropertySnapshots(listingKey),
    [],
    "property:snapshots",
  );
  return <PriceHistory snapshots={snapshots} listingId={listingId} />;
}

async function SchoolsPanel({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const schools = await safeFetch(
    getSchoolsNear(latitude, longitude, { radiusKm: 8 }),
    [],
    "property:schools",
  );
  return <SchoolsSection schools={schools} />;
}

async function DemandPanel({ listingKey }: { listingKey: string }) {
  const engagement = await getListingEngagement(listingKey);
  return <MarketDemand engagement={engagement} />;
}

async function ComparablesSection({ property }: { property: PropertyDetail }) {
  const city = property.community ?? undefined;
  const empty = {
    items: [] as PropertySummary[],
    total: 0,
    nextOffset: null,
    previousOffset: null,
    approximate: false,
    truncated: false,
  };
  const [recommended, sold, rent, active, engagement] = await Promise.all([
    safeFetch(getSimilarProperties(property.id), [], "property:similar"),
    city
      ? safeFetch(searchProperties({ city, status: "Sold", limit: 4 }), empty, "property:sold-comps")
      : Promise.resolve(empty),
    city
      ? safeFetch(
          searchProperties({ city, transaction: "rent", status: "Active", limit: 4 }),
          empty,
          "property:rent-comps",
        )
      : Promise.resolve(empty),
    city
      ? safeFetch(searchProperties({ city, status: "Active", limit: 8 }), empty, "property:sale-comps")
      : Promise.resolve(empty),
    getListingEngagement(property.id),
  ]);
  const dropSelf = (items: PropertySummary[]) => items.filter((item) => item.id !== property.id);
  const sale = dropSelf(recommended);
  const citySale = dropSelf(active.items).filter((item) => !sale.some((row) => row.id === item.id));

  return (
    <ComparablesBoard
      sale={[...sale, ...citySale]}
      sold={dropSelf(sold.items)}
      rent={dropSelf(rent.items)}
      engagement={engagement}
      price={property.price}
      annualTax={property.taxAnnualAmount}
    />
  );
}

function SectionSkeleton({ label }: { label: string }) {
  return (
    <div className="mt-10 space-y-3" role="status" aria-label={label}>
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
