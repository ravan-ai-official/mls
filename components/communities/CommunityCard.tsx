import { LinkButton } from "@/components/ui/Button";
import { SafeImage } from "@/components/ui/SafeImage";
import { Skeleton } from "@/components/ui/States";
import { communities as sampleCommunities } from "@/lib/home/sampleData";
import type { CityCatalogStat } from "@/lib/types/domain";
import { EMPTY, formatNumber, formatPriceCompact } from "@/lib/utils/format";
import { buildListingHref } from "@/lib/utils/searchParams";

const SAMPLE_IMAGE_BY_CITY = new Map(
  sampleCommunities.map((c) => [c.name.toLowerCase(), c.image] as const),
);

/**
 * A city's tile photo: the admin-curated one from `/api/home/community-images/`
 * first, then the reference's decorative photo. `undefined` means SafeImage
 * shows the placeholder, which also covers a photo that stops loading.
 */
export function communityImage(
  city: string,
  curated: Record<string, string> | null | undefined,
): string | undefined {
  const key = city.toLowerCase();
  return curated?.[key] ?? SAMPLE_IMAGE_BY_CITY.get(key);
}

/**
 * Communities grid card: photo with the city name, active inventory and
 * asking price, the 90-day sold summary, then View Listings / Sold Data.
 *
 * `stats` is null when the bulk request failed; the card still renders with
 * dashes so the grid keeps its shape.
 */
export function CommunityCard({
  city,
  image,
  stats,
}: {
  city: string;
  image: string | undefined;
  stats: CityCatalogStat | null;
}) {
  // The mean only arrives from newer backends; fall back to the median rather
  // than calling a median an average.
  const price = stats?.meanListPrice ?? stats?.medianListPrice ?? null;
  const priceLabel = stats?.meanListPrice != null ? "Avg. Price" : "Median Price";
  const sold = stats?.soldCount90d ?? null;
  const soldPrice = stats?.avgSoldPrice90d ?? stats?.medianSoldPrice90d ?? null;
  const soldPriceLabel = stats?.avgSoldPrice90d != null ? "Avg. sold price" : "Median sold price";
  const listingsHref = buildListingHref({ city });
  const soldHref = buildListingHref({ city, status: "Sold" });

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-surface border border-line bg-surface transition-shadow hover:shadow-card-hover">
      <div className="relative h-52 shrink-0 bg-surface-alt sm:h-56">
        <SafeImage
          src={image}
          alt={`${city} neighbourhood`}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
        {/* Bottom scrim so the name reads on light photos and the placeholder. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-t from-ink/65 via-ink/10 to-transparent"
        />
        <h2 className="absolute bottom-4 left-5 right-5 truncate text-h2 font-semibold text-white">
          {city}
        </h2>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <dl className="grid grid-cols-2 gap-3">
          <StatTile
            value={stats ? formatNumber(stats.activeCount) : EMPTY}
            label="Active Listings"
          />
          <StatTile value={price ? formatPriceCompact(price) : EMPTY} label={priceLabel} />
        </dl>

        <dl className="mt-5 space-y-2 border-t border-line pt-4 text-small">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-muted">Sold last 90 days</dt>
            <dd className="font-medium text-ink">
              {sold ? `${formatNumber(sold)} ${sold === 1 ? "home" : "homes"}` : EMPTY}
            </dd>
          </div>
          {sold && soldPrice ? (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-muted">{soldPriceLabel}</dt>
              <dd className="font-medium text-ink">{formatPriceCompact(soldPrice)}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-auto grid grid-cols-2 gap-3 pt-5">
          <LinkButton href={listingsHref} variant="dark" size="md">
            View Listings
          </LinkButton>
          <LinkButton href={soldHref} variant="secondary" size="md">
            Sold Data
          </LinkButton>
        </div>
      </div>
    </article>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-control bg-surface-alt px-2 py-4 text-center">
      {/* dt must precede dd in the markup; order-last puts the label below. */}
      <dt className="order-last mt-0.5 text-caption text-ink-muted">{label}</dt>
      <dd className="text-h3 font-semibold text-ink">{value}</dd>
    </div>
  );
}

/** Same outline as CommunityCard, so the grid doesn't jump when data lands. */
export function CommunityCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-surface border border-line bg-surface">
      <Skeleton className="h-52 rounded-none sm:h-56" />
      <div className="p-5">
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-19" />
          <Skeleton className="h-19" />
        </div>
        <div className="mt-5 space-y-3 border-t border-line pt-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
        </div>
      </div>
    </div>
  );
}
