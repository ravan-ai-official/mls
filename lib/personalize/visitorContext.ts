import { cookies, headers } from "next/headers";
import {
  canonicalizePlace,
  parsePlacesCookie,
  PLACES_COOKIE,
} from "@/lib/personalize/places";

export interface VisitorPersonalization {
  /** Search-history cities first, then IP-derived city when distinct. */
  cities: string[];
  /** Headers to forward so the API can also resolve IP city as a fallback. */
  headers: Record<string, string>;
}

/**
 * SSR visitor context for homepage rails. Uses the ha_places cookie and
 * platform IP-city headers — never browser geolocation.
 */
export async function getVisitorPersonalization(): Promise<VisitorPersonalization> {
  const jar = await cookies();
  const hdrs = await headers();
  const fromHistory = parsePlacesCookie(jar.get(PLACES_COOKIE)?.value);

  const ipCity = canonicalizePlace(
    hdrs.get("x-vercel-ip-city") ||
      hdrs.get("cf-ipcity") ||
      hdrs.get("x-appengine-city") ||
      hdrs.get("x-geo-city"),
  );

  const cities: string[] = [...fromHistory];
  if (ipCity && !cities.some((city) => city.toLowerCase() === ipCity.toLowerCase())) {
    cities.push(ipCity);
  }

  const forward: Record<string, string> = {};
  const forwarded = hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip");
  if (forwarded) forward["X-Forwarded-For"] = forwarded;
  if (ipCity) forward["X-Visitor-City"] = ipCity;
  const agent = hdrs.get("user-agent");
  if (agent) forward["User-Agent"] = agent.slice(0, 512);

  return { cities: cities.slice(0, 5), headers: forward };
}
