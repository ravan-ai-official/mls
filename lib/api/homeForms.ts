import { apiFetch, ApiError, safeFetch } from "@/lib/api/client";
import { toFieldErrors } from "@/lib/api/listingSubmissions";

/**
 * mls-v2 `/api/home/` — the homepage's news feed and its three subscription
 * flows (newsletter, nearby-listing alerts, one-click unsubscribe).
 *
 * The feed sections live in lib/api/home.ts; this module is only the forms and
 * news. Browser code never calls these directly — it goes through the
 * `/api/home/*` route handlers, which attach the session token.
 */

const BASE = "/api/home";

/* -------------------------------------------------------------------------- */
/* Types (backend shapes)                                                      */
/* -------------------------------------------------------------------------- */

export interface HomeNewsArticle {
  id: number;
  title: string;
  url: string;
  summary: string;
  image_url: string;
  tag: string;
  source: string;
  published_at: string | null;
}

export interface NearbyAlert {
  id: number;
  label: string;
  /** DRF DecimalField — serialised as a string. */
  latitude: string;
  longitude: string;
  radius_km: string;
  created_at: string;
  last_notified_at: string | null;
}

export interface NearbyAlertInput {
  label: string;
  latitude: number;
  longitude: number;
  radius_km?: number;
  consent: true;
}

export interface NearbyAlertCreated {
  id: number;
  label: string;
  radius_km: number;
}

export interface NearbyListing {
  listing_key: string;
  address: string;
  city: string;
  list_price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  distance_km: number;
  listed_at: string | null;
}

export interface NearbyActivity {
  results: NearbyListing[];
  radius_km: number;
}

export type UnsubscribeKind = "newsletter" | "nearby";

/** Backend limits, mirrored so the proxy rejects nonsense before forwarding. */
export const NEARBY_RADIUS_MIN_KM = 0.2;
export const NEARBY_RADIUS_MAX_KM = 5;

/* -------------------------------------------------------------------------- */
/* News (Server Component read)                                                */
/* -------------------------------------------------------------------------- */

/**
 * Latest headlines for the homepage Daily News strip.
 * Prefers free GTA real-estate RSS (Google News / CBC); falls back to the
 * backend curated feed when the live RSS is empty.
 */
export async function getNews(limit = 4): Promise<HomeNewsArticle[] | null> {
  const { getGtaRealEstateNews } = await import("@/lib/api/gtaNews");
  const live = await getGtaRealEstateNews(limit).catch(() => []);
  if (live.length > 0) return live;

  return safeFetch(
    apiFetch<{ results?: HomeNewsArticle[] }>(`${BASE}/news/`, {
      params: { limit },
      revalidate: 900,
    }).then((data) => (Array.isArray(data?.results) ? data.results : [])),
    null,
    "home news",
  );
}

/* -------------------------------------------------------------------------- */
/* Writes and per-user reads (route handlers only)                             */
/* -------------------------------------------------------------------------- */

export function subscribeNewsletter(
  input: { email: string; source?: string },
  { token, clientIp }: { token: string | null; clientIp: string | null },
) {
  return apiFetch<{ subscribed: boolean }>(`${BASE}/newsletter/subscribe/`, {
    method: "POST",
    token,
    body: { email: input.email, consent: true, source: input.source || "homepage" },
    // The backend throttles and records consent per client IP.
    headers: clientIp ? { "X-Forwarded-For": clientIp } : undefined,
  });
}

export async function listNearbyAlerts(token: string): Promise<NearbyAlert[]> {
  const data = await apiFetch<{ results?: NearbyAlert[] }>(`${BASE}/nearby-alerts/`, {
    token,
    cache: "no-store",
  });
  return Array.isArray(data?.results) ? data.results : [];
}

export function createNearbyAlert(token: string, input: NearbyAlertInput) {
  return apiFetch<NearbyAlertCreated>(`${BASE}/nearby-alerts/`, {
    method: "POST",
    token,
    body: input,
  });
}

export function deleteNearbyAlert(token: string, id: number) {
  return apiFetch<void>(`${BASE}/nearby-alerts/${id}/`, { method: "DELETE", token });
}

export function getNearbyActivity(point: {
  lat: number;
  lng: number;
  radiusKm?: number;
  limit?: number;
}) {
  return apiFetch<NearbyActivity>(`${BASE}/nearby-activity/`, {
    params: {
      lat: point.lat,
      lng: point.lng,
      radius_km: point.radiusKm,
      limit: point.limit ?? 4,
    },
    revalidate: 300,
  });
}

export function unsubscribe(kind: UnsubscribeKind, token: string) {
  return apiFetch<{ unsubscribed: boolean }>(`${BASE}/unsubscribe/`, {
    method: "POST",
    body: { kind, token },
  });
}

/* -------------------------------------------------------------------------- */
/* Error shaping                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Any thrown error → `{error, fieldErrors}` + status, the shape fetchJson reads.
 * These forms have one or two inputs, so the summary line is the first field
 * message itself ("Enter a valid email address.") rather than a generic prompt.
 */
export function toHomeError(
  error: unknown,
  fallback: string,
): { body: { error: string; fieldErrors: Record<string, string> }; status: number } {
  if (error instanceof ApiError) {
    const fieldErrors = error.status === 400 ? toFieldErrors(error.payload) : {};
    return { body: { error: error.message || fallback, fieldErrors }, status: error.status || 500 };
  }
  return { body: { error: fallback, fieldErrors: {} }, status: 500 };
}
