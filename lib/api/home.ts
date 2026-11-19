/**
 * Server fetchers for the homepage feeds (/api/home/… on mls-v2).
 *
 * Every fetcher resolves to `null` on any failure (network, timeout, 503 from
 * an AMPRE-backed feed) so a section can fall back to its sample content
 * instead of taking down the page. Timeouts are short: these are optional
 * rails and ISR re-renders them in the background anyway.
 */

import { apiFetch, safeFetch, type RequestOptions } from "./client";
import {
  mapCommunityImages,
  mapDeals,
  mapIncentives,
  mapInvestorPicks,
  mapMarketSnapshot,
  mapPartners,
  mapSoldBelow,
  type Incentive,
  type InvestorPicksFeed,
  type MarketSnapshot,
  type Partner,
  type PriceDropDeal,
  type SoldBelowRow,
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

export function getInvestorPicks(limit = 3): Promise<InvestorPicksFeed | null> {
  return get("investor-picks/", FEED_REVALIDATE, mapInvestorPicks, { limit });
}

export function getMarketDeals(limit = 4): Promise<PriceDropDeal[] | null> {
  return get("deals/", FEED_REVALIDATE, mapDeals, { limit });
}

export function getSoldBelowPurchase(
  limit = 3,
  options: { cities?: string[]; headers?: Record<string, string>; cache?: RequestCache } = {},
): Promise<SoldBelowRow[] | null> {
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

export function getMarketSnapshot(): Promise<MarketSnapshot | null> {
  return get("market-snapshot/", FEED_REVALIDATE, mapMarketSnapshot);
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
