/**
 * Shared fetch helpers for homepage rails and their dedicated View All pages.
 * Keeps limit/params identical so the page is the same feed as the rail, just longer.
 */

import { getInvestorPicks } from "@/lib/api/home";
import type { InvestorPicksFeed } from "@/lib/api/homeMappers";
import {
  getExclusiveProperties,
  getFeaturedProperties,
  getNewlyListed,
} from "@/lib/api/properties";
import { readClientVisitor } from "@/lib/personalize/clientVisitor";
import type { PropertySummary } from "@/lib/types/domain";

export const HOME_RAIL_LIMIT = 3;
export const RAIL_PAGE_LIMIT = 48;

export type FeaturedRailPayload = {
  listings: PropertySummary[];
  description: string;
};

/** Featured MLS® rail — pins + personalization (or exclusive/new fallbacks). */
export async function loadFeaturedRail(
  limit: number,
  options: {
    automaticDescription?: boolean;
    descriptionFallback?: string;
    /**
     * Homepage rail may fill empty featured with exclusive/new so the section
     * isn’t blank. View All (`/featured-listings`) must stay featured-only.
     */
    allowFallbacks?: boolean;
  } = {},
): Promise<FeaturedRailPayload> {
  const automatic = options.automaticDescription !== false;
  const allowFallbacks = options.allowFallbacks !== false;
  const fallback =
    options.descriptionFallback ?? "Hand-picked homes from the HomeAtlas team.";

  const visitor = readClientVisitor();
  const featured = await getFeaturedProperties(limit, {
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
    : fallback;

  // Never fall back to exclusive/newly-listed on View All — that mixes in the
  // full catalogue. Homepage rail may still fill so the section isn’t blank.
  if (allowFallbacks && listings.length === 0) {
    listings = await getExclusiveProperties(limit).catch(() => []);
  }
  if (allowFallbacks && listings.length === 0) {
    listings = await getNewlyListed(limit).catch(() => []);
    if (automatic) description = "The newest homes on the market.";
  }

  return { listings: listings.slice(0, limit), description };
}

/**
 * `/featured-listings` View All — only `featured-properties/` (limit 48).
 * Same personalization params as the homepage rail; no filter/ catalogue.
 */
export async function loadFeaturedListingsPage(
  limit = RAIL_PAGE_LIMIT,
): Promise<FeaturedRailPayload> {
  return loadFeaturedRail(limit, { allowFallbacks: false });
}

/**
 * `/high-return` View All — only `GET /api/home/investor-picks/?limit=48`.
 * Optional city from visitor personalization so order matches the homepage rail.
 * Never uses MLS filter / listings search.
 */
export async function loadHighReturnPage(
  limit = RAIL_PAGE_LIMIT,
): Promise<InvestorPicksFeed> {
  const visitor = readClientVisitor();
  const cities = visitor.cities?.length ? visitor.cities : undefined;
  const feed = await getInvestorPicks(limit, {
    cities,
    cache: "no-store",
  });
  return (
    feed ?? {
      picks: [],
      pinnedCount: 0,
      basisNote: null,
      generatedAt: null,
    }
  );
}

/** Today's new — last 24h when available, else newest overall. */
export async function loadTodaysNewRail(limit: number): Promise<PropertySummary[]> {
  const today = await getNewlyListed(limit, {
    params: { since_hours: 24 },
    timeoutMs: 8_000,
  }).catch(() => [] as PropertySummary[]);
  if (today.length > 0) return today.slice(0, limit);
  const newest = await getNewlyListed(limit).catch(() => [] as PropertySummary[]);
  return newest.slice(0, limit);
}
