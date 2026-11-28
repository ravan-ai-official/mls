import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import { BackToListingsLink } from "@/components/property/BackToListingsLink";
import { ExpandableText } from "@/components/property/ExpandableText";
import { InquiryForm } from "@/components/property/InquiryForm";
import {
  SoldDetailGate,
  SoldLockedPriceContext,
} from "@/components/sold/SoldDetailGate";
import { SoldLockedGallery } from "@/components/sold/SoldLockedGallery";
import { SoldPropertyLeadPrice } from "@/components/sold/SoldPropertyLeadPrice";
import { SoldSessionRefresh } from "@/components/sold/SoldSessionRefresh";
import { ListingShareActions, ListingWhatsAppCard } from "@/components/property/ListingShareActions";
import { KeyFacts } from "@/components/property/KeyFacts";
import { EstimatesPanel } from "@/components/property/EstimatesPanel";
import { CommunityPanel } from "@/components/property/CommunityPanel";
import { ClimateRisk } from "@/components/property/ClimateRisk";
import { ClimateRiskPanel } from "@/components/property/ClimateRiskPanel";
import { ComparablesSection } from "@/components/property/ComparablesSection";
import { DemandPanel } from "@/components/property/DemandPanel";
import { PriceHistorySection } from "@/components/property/PriceHistorySection";
import { PropertyMobileCta } from "@/components/property/PropertyMobileCta";
import { PropertyNote } from "@/components/property/PropertyNote";
import { PropertyTabs } from "@/components/property/PropertyTabs";
import { RoomsSection } from "@/components/property/RoomsSection";
import { WashroomsSection } from "@/components/property/WashroomsSection";
import { SaveButton } from "@/components/property/SaveButton";
import { SchoolsPanel } from "@/components/property/SchoolsPanel";
import { SimilarHomes } from "@/components/property/SimilarHomes";
import { TouredButton } from "@/components/property/TouredButton";
import { ViewTracker } from "@/components/property/ViewTracker";
import { PropertyGridSkeleton, Skeleton, UnavailableNote } from "@/components/ui/States";
import { ApiError } from "@/lib/api/client";
import { getProperty } from "@/lib/api/properties";
import { ACCESS_COOKIE } from "@/lib/auth/session";
import {
  EMPTY,
  formatDate,
  formatLeasePrice,
  formatNumber,
  formatPrice,
} from "@/lib/utils/format";
import type { PropertyDetail } from "@/lib/types/domain";
import { absoluteUrl, JsonLd } from "@/components/seo/JsonLd";
import { propertyJsonLd } from "@/lib/seo/jsonld";
import { propertyPath } from "@/lib/seo/urls";
import { cookies } from "next/headers";

export const revalidate = 300;

/**
 * Returns null only when the backend genuinely reports the listing is missing.
 * A network/timeout failure (status 0 or 5xx) is re-thrown so the error
 * boundary shows "something went wrong" — telling a user the home does not
 * exist when the API is merely unreachable would be wrong.
 */
/** Shared across generateMetadata + page so the detail is fetched once per request. */
const load = cache(async (listingKey: string): Promise<PropertyDetail | null> => {
  try {
    const token = (await cookies()).get(ACCESS_COOKIE)?.value;
    return await getProperty(decodeURIComponent(listingKey), {
      // Auth cookie unlocks sold fields; never cache personalized sold payloads.
      token: token || undefined,
      cache: token ? "no-store" : undefined,
      revalidate: token ? undefined : 300,
    });
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) return null;
    throw error;
  }
});

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

  const price =
    property.status === "sold" && (property.soldLocked || property.closePrice == null)
      ? "Sold"
      : property.isLease
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
  // Never use close_price in SSR chrome for sold/anonymous — client gate +
  // SoldSessionRefresh reveal dollars after auth.
  const soldClose =
    property.status === "sold" && !property.soldLocked ? property.closePrice : null;
  const similarHref = property.community
    ? `/listings?city=${encodeURIComponent(property.community)}`
    : "/listings";
  const hasLocation = property.latitude !== null && property.longitude !== null;
  // Sold listings: no $/sqft from close or list while locked (avoids leaking sold $).
  const priceBasis =
    property.status === "sold"
      ? soldClose
      : property.price;
  const pricePerSqft =
    priceBasis !== null && property.sqft !== null && property.sqft > 0
      ? Math.round(priceBasis / property.sqft)
      : null;
  const priceContext: { label: string; value: string }[] = [];
  if (property.daysOnMarket !== null) {
    priceContext.push({
      label: "On market",
      value: `${property.daysOnMarket} day${property.daysOnMarket === 1 ? "" : "s"}`,
    });
  } else if (property.listedAt) {
    priceContext.push({ label: "Listed", value: formatDate(property.listedAt) });
  }
  if (pricePerSqft !== null) {
    priceContext.push({
      label: property.isLease ? "Per sq ft / mo" : "Per sq ft",
      value: formatPrice(pricePerSqft),
    });
  }
  if (property.taxAnnualAmount !== null) {
    priceContext.push({
      label: "Taxes / yr",
      value: formatPrice(property.taxAnnualAmount),
    });
  }
  if (property.associationFee !== null) {
    const freq = property.associationFeeFrequency
      ? ` / ${property.associationFeeFrequency.toLowerCase()}`
      : "/mo";
    priceContext.push({
      label: "Condo fee",
      value: `${formatPrice(property.associationFee)}${freq}`,
    });
  } else if (property.potlMonthlyFees !== null) {
    priceContext.push({
      label: "POTL / mo",
      value: formatPrice(property.potlMonthlyFees),
    });
  }

  return (
    <article className="min-w-0 overflow-x-clip pb-8">
      <JsonLd data={propertyJsonLd(property)} />
      <SoldSessionRefresh
        active={property.status === "sold" || property.soldLocked}
      />
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
        <BackToListingsLink className="inline-flex items-center gap-1.5 text-small text-ink-muted transition-colors hover:text-ink" />
      </nav>
      </div>

      <PropertyTabs
        hero={
          <SoldLockedGallery
            images={property.images}
            address={property.address}
            status={property.status}
            soldLocked={property.soldLocked}
          />
        }
        lead={
      <SoldDetailGate status={property.status} soldLocked={property.soldLocked}>
      <header>
        <SoldPropertyLeadPrice
          status={property.status}
          soldLocked={property.soldLocked}
          closePrice={property.closePrice}
          listPrice={property.price}
          isLease={property.isLease}
          mls={property.mls}
        />
        <h1 className="mt-1 text-[15px] font-medium text-ink">{property.address}</h1>
        <p className="text-[13px] text-ink-muted">{location || EMPTY}</p>

        <SoldLockedPriceContext
          status={property.status}
          soldLocked={property.soldLocked}
          items={priceContext}
        />

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

        <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
          {property.type && (
            <span className="inline-flex items-center gap-2 rounded-xl bg-surface-alt px-3.5 py-2.5 text-[14px] sm:px-4">
              <span className="font-semibold text-ink">{property.type}</span>
              <span className="text-[12px] text-ink-muted">Type</span>
            </span>
          )}
          <Link
            href="/preconstruction"
            className="inline-flex max-w-full items-center gap-2 rounded-xl bg-gold px-3.5 py-2.5 text-[13px] font-bold text-navy hover:bg-gold-deep sm:px-5"
          >
            <span className="sm:hidden">Similar preconstruction</span>
            <span className="hidden sm:inline">Browse Similar Preconstruction</span>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
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
      </SoldDetailGate>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
            {property.status === "active" && (
              <span className="hidden lg:contents">
                <SaveButton
                  variant="inline"
                  listingKey={property.id}
                  address={property.address}
                />
              </span>
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
            <div id="property-inquiry">
              <InquiryForm
                listingKey={property.id}
                mls={property.mls}
                address={property.address}
              />
            </div>
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
              <SimilarHomes property={property} />
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
                          <ExpandableText text={property.description} />
                        </section>
                      )}
                      {property.features.length > 0 && (
                        <section>
                          <h2 className="mb-3 text-[18px] font-semibold text-ink">Features</h2>
                          <ul className="flex flex-wrap gap-2">
                            {property.features.map((feature) => (
                              <li
                                key={feature}
                                className="rounded-xl bg-surface-alt px-3 py-1.5 text-[13px] text-ink"
                              >
                                {feature}
                              </li>
                            ))}
                          </ul>
                        </section>
                      )}
                      {property.rooms.length > 0 && <RoomsSection rooms={property.rooms} />}
                      {(property.washroomInfo.length > 0 || property.washrooms.length > 0) && (
                        <WashroomsSection
                          washroomInfo={property.washroomInfo}
                          washrooms={property.washrooms}
                          bathroomsTotal={property.bathroomsTotal}
                          bathroomsFull={property.bathroomsFull}
                          bathroomsPartial={property.bathroomsPartial}
                        />
                      )}
                      {(property.inclusionsText ||
                        property.inclusionsList.length > 0 ||
                        property.rentalItems) && (
                        <section className="rounded-2xl border border-line p-4 sm:p-6">
                          <h2 className="mb-3 text-[18px] font-semibold text-ink">Inclusions</h2>
                          {property.inclusionsText ? (
                            <p className="text-[14px] leading-relaxed text-ink-muted">
                              {property.inclusionsText}
                            </p>
                          ) : property.inclusionsList.length > 0 ? (
                            <ul className="flex flex-wrap gap-2">
                              {property.inclusionsList.map((item) => (
                                <li
                                  key={item}
                                  className="rounded-xl bg-surface-alt px-3 py-1.5 text-[13px] text-ink"
                                >
                                  {item}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {property.rentalItems ? (
                            <p
                              className={
                                property.inclusionsText || property.inclusionsList.length > 0
                                  ? "mt-3 text-[14px] leading-relaxed text-ink-muted"
                                  : "text-[14px] leading-relaxed text-ink-muted"
                              }
                            >
                              <span className="font-medium text-ink">Rental Items: </span>
                              {property.rentalItems}
                            </p>
                          ) : null}
                        </section>
                      )}
                      {hasLocation ? (
                        <Suspense fallback={<SectionSkeleton label="Loading climate risk" />}>
                          <ClimateRiskPanel
                            latitude={property.latitude ?? 0}
                            longitude={property.longitude ?? 0}
                          />
                        </Suspense>
                      ) : (
                        <ClimateRisk
                          risks={[]}
                          unavailable
                          emptyMessage="This listing has no map coordinates yet, so climate projections cannot be calculated."
                        />
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
                      <PriceHistorySection
                        listingKey={property.id}
                        listingId={property.mls}
                        soldLocked={property.soldLocked}
                        status={property.status}
                      />
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
                      <ComparablesSection
                        property={property}
                        lockSoldComps={
                          property.status === "sold" || property.soldLocked
                        }
                      />
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
                        gateSoldTrends={
                          property.status === "sold" || property.soldLocked
                        }
                      />
                    </Suspense>
                  ),
                },
              ]}
      />

      <PropertyMobileCta
        listingKey={property.id}
        address={property.address}
        url={shareUrl}
        canSave={property.status === "active"}
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

function SectionSkeleton({ label }: { label: string }) {
  return (
    <div className="mt-10 space-y-3" role="status" aria-label={label}>
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
