import { PropertyCard } from "@/components/property/PropertyCard";
import { Section } from "@/components/ui/Section";
import { EmptyState } from "@/components/ui/States";
import { safeFetch } from "@/lib/api/client";
import {
  getExclusiveProperties,
  getFeaturedProperties,
  getNewlyListed,
} from "@/lib/api/properties";
import { getVisitorPersonalization } from "@/lib/personalize/visitorContext";
import { boolOf, textOf } from "@/lib/site/read";
import type { PropertySummary } from "@/lib/types/domain";

const FEATURED_LIMIT = 12;

/**
 * Featured MLS rail. Admin pins always lead; remaining slots follow last-search
 * filters when present (price low→high, featured_source=history), else IP city
 * / curated defaults on the backend. Client never invents cities or re-applies
 * curated year/storeys/sqft rules. CTA label is always "View all".
 */
export async function FeaturedListings({ content }: { content?: Record<string, unknown> }) {
  const visitor = await getVisitorPersonalization();
  const featured = await safeFetch(
    getFeaturedProperties(FEATURED_LIMIT, {
      historyParams: visitor.hasSearchHistory ? visitor.featuredParams : undefined,
      headers: visitor.headers,
      cache: "no-store",
    }),
    {
      listings: [],
      pinnedCount: 0,
      localCount: 0,
      historyCount: 0,
      curatedCount: 0,
      hasSearchHistory: false,
    },
    "home:featured",
  );
  let listings: PropertySummary[] = featured.listings;
  const automatic = boolOf(content, "useAutomaticDescription", true);
  let description = automatic
    ? featured.pinnedCount > 0 && featured.historyCount === 0 && featured.localCount === 0
      ? "Hand-picked homes from the HomeAtlas team."
      : featured.historyCount > 0
        ? "Homes that match what you’ve been searching for."
        : featured.localCount > 0
          ? "Homes near you."
          : featured.curatedCount > 0
            ? "Featured homes for sale across the GTA."
            : "Homes offered directly through HomeAtlas."
    : textOf(content, "description", "Hand-picked homes from the HomeAtlas team.");

  if (listings.length === 0) {
    listings = await safeFetch<PropertySummary[]>(
      getExclusiveProperties(FEATURED_LIMIT),
      [],
      "home:featured-exclusive",
    );
  }
  if (listings.length === 0) {
    listings = await safeFetch<PropertySummary[]>(
      getNewlyListed(FEATURED_LIMIT),
      [],
      "home:featured-newest",
    );
    if (automatic) description = "The newest homes on the market.";
  }

  const viewAllHref = visitor.hasSearchHistory ? visitor.listingsHref : "/listings";

  return (
    <Section
      eyebrow={textOf(content, "eyebrow", "Curated for you")}
      title={textOf(content, "title", "Featured MLS® Listings")}
      description={description}
      action={{
        label: "View all",
        href: viewAllHref,
      }}
    >
      {listings.length === 0 ? (
        <EmptyState
          title="Listings are unavailable right now"
          description="We couldn't reach the listing service. Please try again shortly."
          action={{ label: "View all", href: "/listings" }}
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.slice(0, FEATURED_LIMIT).map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}
    </Section>
  );
}
