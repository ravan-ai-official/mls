"use client";

import { PropertyCard } from "@/components/property/PropertyCard";
import { Section } from "@/components/ui/Section";
import { EmptyState, PropertyGridSkeleton } from "@/components/ui/States";
import {
  getExclusiveProperties,
  getFeaturedProperties,
  getNewlyListed,
} from "@/lib/api/properties";
import { readClientVisitor } from "@/lib/personalize/clientVisitor";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";
import { boolOf, textOf } from "@/lib/site/read";
import type { PropertySummary } from "@/lib/types/domain";

const FEATURED_LIMIT = 12;

type FeaturedPayload = {
  listings: PropertySummary[];
  description: string;
  viewAllHref: string;
};

/**
 * Featured MLS rail. Fetches in the browser via `/api/mls/…` so Network shows
 * JSON. Admin pins lead; remaining slots follow last-search cookies when set.
 */
export function FeaturedListings({ content }: { content?: Record<string, unknown> }) {
  const { data, isPending } = useMlsQuery<FeaturedPayload>(
    ["home", "featured"],
    async () => {
      const visitor = readClientVisitor();
      const featured = await getFeaturedProperties(FEATURED_LIMIT, {
        historyParams: visitor.hasSearchHistory ? visitor.featuredParams : undefined,
        cache: "no-store",
      }).catch(() => ({
        listings: [] as PropertySummary[],
        pinnedCount: 0,
        localCount: 0,
        historyCount: 0,
        curatedCount: 0,
        hasSearchHistory: false,
      }));

      let listings = featured.listings;
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
        listings = await getExclusiveProperties(FEATURED_LIMIT).catch(() => []);
      }
      if (listings.length === 0) {
        listings = await getNewlyListed(FEATURED_LIMIT).catch(() => []);
        if (automatic) description = "The newest homes on the market.";
      }

      return {
        listings,
        description,
        viewAllHref: visitor.hasSearchHistory ? visitor.listingsHref : "/listings",
      };
    },
    {
      listings: [],
      description: textOf(content, "description", "Hand-picked homes from the HomeAtlas team."),
      viewAllHref: "/listings",
    },
  );

  if (isPending && !data) {
    return (
      <Section
        eyebrow={textOf(content, "eyebrow", "Curated for you")}
        title={textOf(content, "title", "Featured MLS® Listings")}
      >
        <PropertyGridSkeleton />
      </Section>
    );
  }

  const listings = data?.listings ?? [];
  const description = data?.description ?? "";
  const viewAllHref = data?.viewAllHref ?? "/listings";

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
