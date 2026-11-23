"use client";

import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";
import { getSimilarProperties, searchProperties } from "@/lib/api/properties";
import { EMPTY_LISTINGS, peerQuery } from "@/components/property/listingPeers";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";
import { propertyPath } from "@/lib/seo/urls";
import type { PropertyDetail, PropertySummary } from "@/lib/types/domain";
import { EMPTY, formatLeasePrice, formatPrice } from "@/lib/utils/format";

/**
 * Aside rail of similar homes — client fetch so Network shows `/api/mls/…` JSON.
 */
export function SimilarHomes({ property }: { property: PropertyDetail }) {
  const { data: similar = [] } = useMlsQuery<PropertySummary[]>(
    ["property", "similar", property.id],
    async () => {
      const [recommended, peers] = await Promise.all([
        getSimilarProperties(property.id).catch(() => [] as PropertySummary[]),
        searchProperties(
          peerQuery(property, {
            status: "Active",
            transaction: property.isLease ? "rent" : "sale",
            limit: 6,
          }),
        ).catch(() => EMPTY_LISTINGS),
      ]);

      let items = recommended.filter((item) => item.id !== property.id);
      if (items.length < 3) {
        const extra = peers.items.filter(
          (item) =>
            item.id !== property.id &&
            !items.some((row) => row.id === item.id) &&
            (property.uiType == null || item.uiType == null || item.uiType === property.uiType),
        );
        items = [...items, ...extra];
      }
      return items;
    },
    [],
  );

  if (similar.length === 0) return null;

  const city = property.community;
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
