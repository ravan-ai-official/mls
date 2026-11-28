import type { ListingQuery, PropertyDetail, PropertySummary } from "@/lib/types/domain";

export const EMPTY_LISTINGS = {
  items: [] as PropertySummary[],
  total: 0,
  nextOffset: null,
  previousOffset: null,
  approximate: false,
  truncated: false,
  soldLocked: false,
};

/** ~km box around a point for peer searches when the comps API is unavailable. */
function nearbyBounds(lat: number, lng: number, km: number) {
  const dlat = km / 111;
  const dlng = km / Math.max(111 * Math.cos((lat * Math.PI) / 180), 1e-6);
  return {
    latMin: lat - dlat,
    latMax: lat + dlat,
    lngMin: lng - dlng,
    lngMax: lng + dlng,
  };
}

/** Tight peer query: same type/beds/price band, nearby when coords exist. */
export function peerQuery(
  property: PropertyDetail,
  extras: ListingQuery = {},
): ListingQuery {
  const price = property.price;
  const query: ListingQuery = {
    city: property.community ?? undefined,
    type: property.uiType ?? undefined,
    bedsMin: property.beds != null ? Math.max(0, property.beds - 1) : undefined,
    bathsMin: property.baths != null ? Math.max(0, property.baths - 1) : undefined,
    limit: extras.limit ?? 6,
    ...extras,
  };
  if (price != null && price > 0 && !property.isLease) {
    query.priceMin = Math.round(price * 0.7);
    query.priceMax = Math.round(price * 1.35);
  }
  if (
    property.latitude != null &&
    property.longitude != null &&
    Number.isFinite(property.latitude) &&
    Number.isFinite(property.longitude)
  ) {
    query.bounds = nearbyBounds(property.latitude, property.longitude, 8);
  }
  return query;
}
