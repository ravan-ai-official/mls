/**
 * Server fetchers for the homepage feeds (/api/home/… on mls-backend).
 *
 * Every fetcher resolves to `null` on any failure (network, timeout, 503 from
 * an AMPRE-backed feed) so a section can hide or degrade instead of taking
 * down the page. Sold-below never falls back to mock cards — empty means hide.
 * Timeouts are short: these are optional rails and ISR re-renders them anyway.
 */

import { apiFetch, safeFetch, type RequestOptions } from "./client";
import {
  mapCommunityImages,
  mapDeals,
  mapIncentives,
  mapInvestorPicks,
  mapMarketSnapshot,
  mapNeighbourActivity,
  mapPartners,
  mapProfitableInvestments,
  mapSoldBelow,
  type Incentive,
  type InvestorPicksFeed,
  type MarketSnapshot,
  type NeighbourActivityItem,
  type Partner,
  type PriceDropDeal,
  type ProfitableInvestmentsFeed,
  type SoldBelowFeed,
} from "./homeMappers";

const HOME = "/api/home";
/** Derived feeds (picks, deals, sold, snapshot). */
const FEED_REVALIDATE = 900;
/** Admin-edited content (incentives, partners, community photos). */
const CONTENT_REVALIDATE = 3600;
const TIMEOUT_MS = 6_000;

async function get<T>(
  path: string,
  revalidate: number,
  map: (payload: unknown) => T,
  params?: RequestOptions["params"],
  tags?: string[],
  options: RequestOptions = {},
): Promise<T | null> {
  return safeFetch(
    apiFetch<unknown>(`${HOME}/${path}`, {
      revalidate,
      timeoutMs: TIMEOUT_MS,
      params,
      tags,
      ...options,
    }).then(map),
    null,
    `home:${path}`,
  );
}

const CONTENT_TAGS = ["home-content"];

/** Max rows the investor-picks View All endpoint returns. */
export const INVESTOR_PICKS_MAX = 48;

/**
 * Homepage High Return rail + `/high-return` View All.
 * Always `GET /api/home/investor-picks/` — never MLS filter/catalogue search.
 */
export function getInvestorPicks(
  limit = 3,
  options: {
    cities?: string[];
    headers?: Record<string, string>;
    cache?: RequestCache;
  } = {},
): Promise<InvestorPicksFeed | null> {
  const { cities, headers, cache } = options;
  const capped = Math.min(Math.max(1, limit), INVESTOR_PICKS_MAX);
  // Cold rank can score hundreds of sale rows against rental comps.
  return get(
    "investor-picks/",
    cities?.length || cache === "no-store" ? 60 : FEED_REVALIDATE,
    mapInvestorPicks,
    {
      limit: capped,
      city: cities?.[0],
      cities: cities?.length ? cities.join(",") : undefined,
    },
    undefined,
    {
      headers,
      cache,
      timeoutMs: 15_000,
    },
  );
}

export function getMarketDeals(limit = 4): Promise<PriceDropDeal[] | null> {
  return get("deals/", FEED_REVALIDATE, mapDeals, { limit });
}

export function getSoldBelowPurchase(
  limit = 3,
  options: { cities?: string[]; headers?: Record<string, string>; cache?: RequestCache } = {},
): Promise<SoldBelowFeed | null> {
  const { cities, headers, cache } = options;
  return get(
    "sold-below-purchase/",
    cities?.length ? 120 : FEED_REVALIDATE,
    mapSoldBelow,
    {
      limit,
      cities: cities?.length ? cities.join(",") : undefined,
    },
    undefined,
    {
      headers,
      cache,
      // AMPRE fill can take longer than the default homepage timeout.
      timeoutMs: 12_000,
    },
  );
}

/** Homes that sold again above their previous close (last 12 months). */
export function getProfitableInvestments(
  limit = 3,
  options: { headers?: Record<string, string>; cache?: RequestCache } = {},
): Promise<ProfitableInvestmentsFeed | null> {
  const { headers, cache } = options;
  return get(
    "profitable-investments/",
    FEED_REVALIDATE,
    mapProfitableInvestments,
    { limit },
    undefined,
    {
      headers,
      cache,
      timeoutMs: 12_000,
    },
  );
}

export function getMarketSnapshot(): Promise<MarketSnapshot | null> {
  return get("market-snapshot/", FEED_REVALIDATE, mapMarketSnapshot);
}

export function getNeighbourActivity(
  limit = 4,
  options: { cities?: string[]; headers?: Record<string, string>; cache?: RequestCache } = {},
): Promise<NeighbourActivityItem[] | null> {
  const { cities, headers, cache } = options;
  return get(
    "neighbour-activity/",
    cities?.length ? 120 : FEED_REVALIDATE,
    mapNeighbourActivity,
    {
      limit,
      cities: cities?.length ? cities.join(",") : undefined,
    },
    undefined,
    {
      headers,
      cache,
      // Mixed activity queries several status streams; give the feed room.
      timeoutMs: 12_000,
    },
  );
}

export function getIncentives(): Promise<Incentive[] | null> {
  return get("incentives/", CONTENT_REVALIDATE, mapIncentives, undefined, CONTENT_TAGS);
}

export function getPartners(): Promise<Partner[] | null> {
  return get("partners/", CONTENT_REVALIDATE, mapPartners, undefined, CONTENT_TAGS);
}

export function getCommunityImages(): Promise<Record<string, string> | null> {
  return get("community-images/", CONTENT_REVALIDATE, mapCommunityImages, undefined, CONTENT_TAGS);
}
