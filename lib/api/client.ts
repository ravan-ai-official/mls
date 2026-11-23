/**
 * HTTP client for the mls-v2 backend.
 *
 * Works in both Server Components and the browser. Auth tokens live in httpOnly
 * cookies, so server-side calls attach the access token explicitly while browser
 * calls go through the /api/auth proxy routes.
 *
 * In the browser, mls-backend prefixes (`/api/mls`, `/api/home`, `/api/vlog`)
 * are fetched same-origin through catch-all proxies so DevTools Network shows
 * the JSON instead of burying the call inside an RSC flight payload.
 */

export const API_BASE_URL = (
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8000"
).replace(/\/$/, "");

const BROWSER_PROXY_PREFIXES = ["/api/mls/", "/api/home/", "/api/vlog/"] as const;

/**
 * Browser: same-origin proxy for backend prefixes. Server (and other paths):
 * absolute `API_BASE_URL`. Next BFFs like `/api/properties/search` are not
 * reached via `apiFetch` — they use `fetchJson` directly.
 */
function resolveApiUrl(path: string, query: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const withQuery = `${normalized}${query}`;
  if (
    typeof window !== "undefined" &&
    BROWSER_PROXY_PREFIXES.some((prefix) => normalized.startsWith(prefix) || normalized === prefix.slice(0, -1))
  ) {
    return withQuery;
  }
  return `${API_BASE_URL}${withQuery}`;
}
export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }

  /** True when the caller should prompt for sign-in. */
  get isAuth() {
    return this.status === 401 || this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  /** Query params; null/undefined/"" entries are dropped. */
  params?: Record<string, string | number | boolean | null | undefined | string[]>;
  body?: unknown;
  /** Access token for server-side authenticated calls. */
  token?: string | null;
  /** Seconds; omit for no caching. Ignored when `cache` is set. */
  revalidate?: number;
  /** On-demand cache tags (paired with `revalidateTag` after studio edits). */
  tags?: string[];
  /** Abort after N ms. Defaults to 15s so a hung backend can't hang a render. */
  timeoutMs?: number;
}

export function buildQuery(
  params: RequestOptions["params"],
): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      // DRF reads repeated keys via getlist(), e.g. ?listing_key=A&listing_key=B
      for (const entry of value) {
        if (entry !== null && entry !== undefined && entry !== "") {
          search.append(key, String(entry));
        }
      }
    } else {
      search.append(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    params,
    body,
    token,
    revalidate,
    tags,
    timeoutMs = 15_000,
    headers,
    ...rest
  } = options;

  const url = resolveApiUrl(path, buildQuery(params));
  const inBrowser = typeof window !== "undefined";

  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", "application/json");
  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders.set("Content-Type", "application/json");
  }
  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers: requestHeaders,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
      signal: rest.signal ?? controller.signal,
      /*
       * ISR windows are a production optimisation. In development they are
       * actively misleading: after the backend stops, Next keeps serving the
       * last successful response for up to `revalidate` seconds, so the site
       * still shows listings that can no longer be saved or opened — it reads
       * as "hardcoded data" when it is really a stale cache. Always hit the
       * network in dev so what is on screen reflects the running backend.
       * Browser calls never use Next ISR — they go through the same-origin
       * `/api/mls` proxy (or other BFFs) with no-store.
       */
      ...(inBrowser || rest.cache
        ? inBrowser
          ? { cache: "no-store" as const }
          : {}
        : revalidate !== undefined && process.env.NODE_ENV === "production"
          ? { next: { revalidate, ...(tags?.length ? { tags } : {}) } }
          : { cache: "no-store" as const }),
    });
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("The server took too long to respond. Please try again.", 504);
    }
    // The underlying message ("fetch failed", ECONNREFUSED, a full URL) is for
    // logs, not users — keep it on the payload and show something actionable.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[api] network error:", error);
    }
    throw new ApiError(
      "Can't reach the server. Check your connection and try again.",
      0,
      error,
    );
  }
  clearTimeout(timer);

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(extractErrorMessage(payload, response.status), response.status, payload);
  }

  return payload as T;
}

/** Longest server-supplied string we will ever show a user. */
const MAX_MESSAGE_LENGTH = 200;

/**
 * True for anything that looks like a rendered error page rather than a message.
 *
 * Django with DEBUG=True returns a full HTML traceback that embeds the entire
 * settings object — SECRET_KEY, mail credentials, API tokens. Rendering that
 * verbatim leaks secrets to anyone who can trigger a 500, so server strings are
 * only trusted when they look like a short, human-written sentence.
 */
function looksLikeMarkup(value: string): boolean {
  return /<\/?[a-z!][\s\S]*>/i.test(value);
}

/** Generic text by status — never derived from the response body. */
function fallbackMessage(status: number): string {
  if (status === 0) return "Can't reach the server. Check your connection and try again.";
  if (status === 400) return "Some of those details weren't valid. Please check and try again.";
  if (status === 401) return "Your email or password is incorrect.";
  if (status === 403) return "You don't have access to that.";
  if (status === 404) return "Not found.";
  if (status === 409) return "That conflicts with something that already exists.";
  if (status === 429) return "Too many attempts. Please wait a moment and try again.";
  if (status === 504) return "The server took too long to respond. Please try again.";
  if (status >= 500) return "Something went wrong on our end. Please try again in a moment.";
  return "Something went wrong. Please try again.";
}

/**
 * Returns a server string only if it is safe and useful to display: not markup,
 * not a stack trace, and short enough to be a real message.
 */
function usableMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  if (text.length > MAX_MESSAGE_LENGTH) return null;
  if (looksLikeMarkup(text)) return null;
  // Tracebacks and settings dumps are multi-line; real messages are not.
  if (text.includes("\n")) return null;
  return text;
}

/**
 * DRF errors arrive as {detail}, {error}, or {field: [msg]} — normalize them.
 *
 * A 5xx never surfaces server text: at that point the body is a crash report,
 * not a message intended for a user.
 */
export function extractErrorMessage(payload: unknown, status: number): string {
  if (status >= 500) return fallbackMessage(status);

  const direct = usableMessage(payload);
  if (direct) return direct;

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["detail", "error", "message"]) {
      const value = usableMessage(record[key]);
      if (value) return value;
    }
    // First field error, e.g. {"email": ["Already exists."]}
    for (const value of Object.values(record)) {
      if (Array.isArray(value)) {
        const first = usableMessage(value[0]);
        if (first) return first;
      }
      const direct = usableMessage(value);
      if (direct) return direct;
    }
  }

  return fallbackMessage(status);
}

/**
 * Wraps a fetch so a failing section degrades instead of taking down the page.
 * Returns the fallback and logs server-side; used for optional homepage rails.
 */
export async function safeFetch<T>(
  promise: Promise<T>,
  fallback: T,
  label: string,
): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[api] ${label} failed:`, error instanceof Error ? error.message : error);
    }
    return fallback;
  }
}
