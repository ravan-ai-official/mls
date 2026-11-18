import Link from "next/link";
import { PropertyCard } from "@/components/property/PropertyCard";
import { Badge } from "@/components/ui/Badge";
import { SafeImage } from "@/components/ui/SafeImage";
import { Section } from "@/components/ui/Section";
import { safeFetch } from "@/lib/api/client";
import { getMarketDeals } from "@/lib/api/home";
import { getNewlyListed } from "@/lib/api/properties";
import { dealHref, formatDay, type PriceDropDeal } from "@/lib/api/homeMappers";
import { marketDeals } from "@/lib/home/staticSections";
import { textOf } from "@/lib/site/read";
import { formatPrice } from "@/lib/utils/format";
import { buildListingHref } from "@/lib/utils/searchParams";
import { DealGlyph } from "./sectionIcons";

/**
 * "GTA Market Deals" — HomeAtlasUI HomePage L540-612 ("DEALS SECTION").
 *
 * LIVE from `/api/home/deals/`: the biggest recent price reductions across the
 * GTA (AMPRE), with was/now prices, the drop, and a listing photo when AMPRE
 * or the local catalogue has one. A deal that matches a listing in our
 * catalogue opens its property page; one that doesn't opens a /listings
 * search for its address.
 *
 * When the feed is down (503) or empty, the reference's category cards render
 * instead — each a real link to the search it describes; their counts are the
 * reference's sample figures.
 *
 * New GTA catalogue listings with photos sit below the deal cards. They are
 * labelled that way: they are not claimed to be price reductions.
 */
const LISTINGS_SHOWN = 4;
/** Anchored: the feed's city reads "Toronto (Moss Park)", and "Hamilton" contains "milton". */
const GTA_CITY =
  /^(toronto|mississauga|brampton|caledon|vaughan|markham|richmond hill|aurora|newmarket|king|oakville|burlington|milton|halton hills|ajax|pickering|whitby|oshawa|clarington)\b/i;

export async function GtaMarketDeals({ content }: { content?: Record<string, unknown> }) {
  const [deals, newest] = await Promise.all([
    getMarketDeals(4),
    // `newly-listed` is the feed with photos (`properties/filter/` sends media
    // null). It mixes rentals and all of Ontario, hence the wide fetch to filter.
    safeFetch(getNewlyListed(100), [], "home:deals-listings"),
  ]);
  const live = deals !== null && deals.length > 0;
  const listings = newest
    .filter((p) => p.image && !p.isLease && p.price && GTA_CITY.test(p.community ?? ""))
    // Skips the front of the feed, which "Today's New Listings" already shows.
    .slice(4, 4 + LISTINGS_SHOWN);

  return (
    <Section
      tone="alt"
      eyebrow={textOf(content, "eyebrow", "Exclusive opportunities")}
      title={textOf(content, "title", "GTA Market Deals")}
    >
      {live && (
        <p className="-mt-3 mb-6 text-caption text-ink-subtle sm:-mt-5 sm:mb-8">
          {textOf(content, "caption", "Largest recent price reductions on active GTA listings")}
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {live ? (
          deals.map((deal) => <DealCard key={deal.mlsNumber} deal={deal} />)
        ) : (
          <SampleDeals />
        )}
      </div>
      {listings.length > 0 && (
        <div className="mt-10">
          <div className="mb-5 flex items-baseline justify-between gap-4">
            <h3 className="text-h3 text-ink">New GTA homes for sale</h3>
            <Link
              href={buildListingHref({ transaction: "sale", status: "Active" })}
              className="shrink-0 text-small font-medium text-navy hover:underline"
            >
              View all →
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {listings.map((property) => (
              <PropertyCard key={property.id} property={property} className="h-full" />
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}

function DealCard({ deal }: { deal: PriceDropDeal }) {
  const facts = [
    deal.city,
    deal.propertySubType,
    deal.bedrooms ? `${deal.bedrooms} bd` : null,
    deal.bathrooms ? `${deal.bathrooms} ba` : null,
  ].filter(Boolean);
  return (
    <Link
      href={dealHref(deal)}
      className="group flex flex-col overflow-hidden rounded-surface border border-line bg-surface transition-all hover:border-gold/30 hover:shadow-card-hover"
    >
      <div className="relative h-[180px] overflow-hidden bg-surface-alt">
        <SafeImage
          src={deal.imageUrl}
          alt={deal.address || `MLS® ${deal.mlsNumber}`}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <Badge tone="gold" className="absolute right-3 top-3 text-eyebrow font-bold">
          -{deal.dropPct.toFixed(1)}%
        </Badge>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-center gap-2">
          <DealGlyph icon="distress" className="h-6 w-6 text-gold" />
          <h3 className="truncate text-h3 text-ink">
            {deal.address || `MLS® ${deal.mlsNumber}`}
          </h3>
        </div>
        <p className="mb-4 flex-1 text-small text-ink-muted">
          {facts.join(" · ")}
        </p>
        <dl className="mb-4 space-y-1 text-small">
          <div className="flex justify-between">
            <dt className="text-ink-muted">Was</dt>
            <dd className="text-ink-muted line-through">
              {formatPrice(deal.originalPrice)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Now</dt>
            <dd className="font-semibold text-ink">
              {formatPrice(deal.listPrice)}
            </dd>
          </div>
        </dl>
        <div className="flex items-center justify-between">
          <span className="text-caption font-semibold text-navy">
            {deal.changedOn
              ? `Reduced ${formatDay(deal.changedOn)}`
              : `Down ${formatPrice(deal.dropAmount)}`}
          </span>
          <span className="text-small font-medium text-ink transition-colors group-hover:text-gold">
            View →
          </span>
        </div>
      </div>
    </Link>
  );
}

function SampleDeals() {
  return marketDeals.map((deal) => (
    <Link
      key={deal.title}
      href={buildListingHref(deal.query)}
      className="group flex flex-col rounded-surface border border-line bg-surface p-6 transition-all hover:border-gold/30 hover:shadow-card-hover"
    >
      <div className="mb-4 flex items-start justify-between">
        <DealGlyph icon={deal.icon} className="h-8 w-8 text-gold" />
        <Badge tone={deal.badgeTone} className="text-eyebrow font-bold">
          {deal.badge}
        </Badge>
      </div>
      <h3 className="mb-2 text-h3 text-ink">{deal.title}</h3>
      <p className="mb-4 flex-1 text-small text-ink-muted">{deal.desc}</p>
      <div className="flex items-center justify-between">
        <span className="text-caption font-semibold text-navy">
          {deal.count}
        </span>
        <span className="text-small font-medium text-ink transition-colors group-hover:text-gold">
          Browse →
        </span>
      </div>
    </Link>
  ));
}
