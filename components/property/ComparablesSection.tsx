"use client";

import { ComparablesBoard } from "@/components/property/ComparablesBoard";
import { EMPTY_LISTINGS, peerQuery } from "@/components/property/listingPeers";
import { getListingEngagement, type ListingEngagement } from "@/lib/api/neighbourhood";
import {
  getPropertyComparables,
  getSimilarProperties,
  searchProperties,
} from "@/lib/api/properties";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";
import type { PropertyDetail, PropertySummary } from "@/lib/types/domain";

type ComparablesPayload = {
  sale: PropertySummary[];
  sold: PropertySummary[];
  rent: PropertySummary[];
  engagement: ListingEngagement | null;
};

const EMPTY_COMPS: ComparablesPayload = {
  sale: [],
  sold: [],
  rent: [],
  engagement: null,
};

/**
 * Comparables tab — comps + engagement fetched in the browser via `/api/mls/…`.
 */
export function ComparablesSection({ property }: { property: PropertyDetail }) {
  const { data = EMPTY_COMPS } = useMlsQuery<ComparablesPayload>(
    ["property", "comparables", property.id],
    async () => {
      const dropSelf = (items: PropertySummary[]) =>
        items.filter((item) => item.id !== property.id);
      const sameType = (items: PropertySummary[]) =>
        property.uiType
          ? items.filter((item) => !item.uiType || item.uiType === property.uiType)
          : items;

      const [comps, engagement] = await Promise.all([
        getPropertyComparables(property.id, 4).catch(() => ({
          sale: [] as PropertySummary[],
          sold: [] as PropertySummary[],
          rent: [] as PropertySummary[],
        })),
        getListingEngagement(property.id),
      ]);

      let sale = sameType(dropSelf(comps.sale));
      let sold = sameType(dropSelf(comps.sold));
      let rent = dropSelf(comps.rent);

      if (sale.length < 2 || sold.length < 2 || rent.length < 2) {
        const [recommended, soldFallback, rentFallback, saleFallback] = await Promise.all([
          sale.length < 2
            ? getSimilarProperties(property.id).catch(() => [] as PropertySummary[])
            : Promise.resolve([] as PropertySummary[]),
          sold.length < 2
            ? searchProperties(peerQuery(property, { status: "Sold", limit: 6 })).catch(
                () => EMPTY_LISTINGS,
              )
            : Promise.resolve(EMPTY_LISTINGS),
          rent.length < 2
            ? searchProperties(
                peerQuery(property, { transaction: "rent", status: "Active", limit: 6 }),
              ).catch(() => EMPTY_LISTINGS)
            : Promise.resolve(EMPTY_LISTINGS),
          sale.length < 2
            ? searchProperties(
                peerQuery(property, {
                  status: "Active",
                  transaction: "sale",
                  limit: 8,
                }),
              ).catch(() => EMPTY_LISTINGS)
            : Promise.resolve(EMPTY_LISTINGS),
        ]);

        if (sale.length < 2) {
          const fromRec = sameType(dropSelf(recommended));
          const fromSearch = sameType(dropSelf(saleFallback.items)).filter(
            (item) => !fromRec.some((row) => row.id === item.id),
          );
          sale = [...fromRec, ...fromSearch];
        }
        if (sold.length < 2) sold = sameType(dropSelf(soldFallback.items));
        if (rent.length < 2) rent = dropSelf(rentFallback.items);
      }

      return { sale, sold, rent, engagement };
    },
    EMPTY_COMPS,
  );

  return (
    <ComparablesBoard
      sale={data.sale}
      sold={data.sold}
      rent={data.rent}
      engagement={data.engagement}
      price={property.price}
      annualTax={property.taxAnnualAmount}
    />
  );
}
