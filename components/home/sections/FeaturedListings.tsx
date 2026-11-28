"use client";

import { PropertyCard } from "@/components/property/PropertyCard";
import { Section } from "@/components/ui/Section";
import { EmptyState, PropertyGridSkeleton } from "@/components/ui/States";
import { HOME_RAIL_LIMIT, loadFeaturedRail } from "@/lib/home/rails";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";
import { boolOf, textOf } from "@/lib/site/read";

/**
 * Featured MLS rail — exactly three cards. "View all" opens /featured-listings
 * (same feed, longer), not the filtered /listings catalogue.
 */
export function FeaturedListings({ content }: { content?: Record<string, unknown> }) {
  const viewAllHref = textOf(content, "actionHref", "/featured-listings");
  const viewAllLabel = textOf(content, "actionLabel", "View All");
  const { data, isPending } = useMlsQuery(
    ["home", "featured", HOME_RAIL_LIMIT],
    () =>
      loadFeaturedRail(HOME_RAIL_LIMIT, {
        automaticDescription: boolOf(content, "useAutomaticDescription", true),
        descriptionFallback: textOf(
          content,
          "description",
          "Hand-picked homes from the HomeAtlas team.",
        ),
      }),
    {
      listings: [],
      description: textOf(content, "description", "Hand-picked homes from the HomeAtlas team."),
    },
  );

  if (isPending && !data) {
    return (
      <Section
        eyebrow={textOf(content, "eyebrow", "Curated for you")}
        title={textOf(content, "title", "Featured MLS® Listings")}
      >
        <PropertyGridSkeleton count={HOME_RAIL_LIMIT} />
      </Section>
    );
  }

  const listings = data?.listings ?? [];
  const description = data?.description ?? "";

  return (
    <Section
      eyebrow={textOf(content, "eyebrow", "Curated for you")}
      title={textOf(content, "title", "Featured MLS® Listings")}
      description={description}
      action={{ label: viewAllLabel, href: viewAllHref }}
    >
      {listings.length === 0 ? (
        <EmptyState
          title="Listings are unavailable right now"
          description="We couldn't reach the listing service. Please try again shortly."
          action={{ label: viewAllLabel, href: viewAllHref }}
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.slice(0, HOME_RAIL_LIMIT).map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}
    </Section>
  );
}
