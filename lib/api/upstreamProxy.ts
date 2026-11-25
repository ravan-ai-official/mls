import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/api/client";
import { ACCESS_COOKIE } from "@/lib/auth/session";

/**
 * Headers that must not be copied from upstream onto the browser response.
 * Hop-by-hop are illegal to forward; content-length / content-encoding are
 * wrong once undici has already decoded the body (and Vercel may recompress).
 * Forwarding a stale Content-Length makes Chromium abort with "Failed to fetch"
 * on larger payloads like properties/filter — facets (tiny) still worked.
 */
const DROP_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "content-encoding",
  "content-md5",
  // Platform / framing headers — not meaningful to the browser via our proxy.
  "alt-svc",
  "server",
  "via",
  "date",
]);

/**
 * Forward a browser request to mls-backend and return the raw upstream body
 * so DevTools Network shows the real JSON (not an RSC flight payload).
 *
 * `prefix` is the backend path prefix including leading slash, e.g. `/api/mls`.
 * Upstream paths always use a trailing slash (Django/DRF).
 */
export async function proxyUpstream(
  request: Request,
  prefix: "/api/mls" | "/api/home" | "/api/vlog",
  path: string[],
): Promise<Response> {
  const incoming = new URL(request.url);
  const targetPath = path.map(encodeURIComponent).join("/");
  // DRF routes are registered with trailing slashes; always send one so the
  // upstream never 301/308s and the browser never sees a redirect hop.
  const joined = targetPath ? `${prefix}/${targetPath}/` : `${prefix}/`;
  const upstream = `${API_BASE_URL}${joined}${incoming.search}`;

  const headers = new Headers();
  for (const name of ["accept", "authorization", "content-type", "x-forwarded-for", "user-agent"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has("accept")) headers.set("Accept", "application/json");

  // Browser calls don't set Authorization; attach the httpOnly session cookie.
  if (!headers.has("authorization")) {
    try {
      const token = (await cookies()).get(ACCESS_COOKIE)?.value;
      if (token) headers.set("Authorization", `Bearer ${token}`);
    } catch {
      // cookies() can throw outside a request context; ignore.
    }
  }

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const controller = new AbortController();
  // Home evaluation needs longer than list/filter calls: AMPRE sold comps +
  // geocode + optional AI CMA. Keep other MLS routes snappy.
  const slowValuation =
    method === "POST" && targetPath.replace(/\/+$/, "").endsWith("valuation/estimate");
  const timer = setTimeout(() => controller.abort(), slowValuation ? 55_000 : 25_000);

  try {
    const upstreamRes = await fetch(upstream, {
      method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });

    // Buffer so we never advertise an upstream Content-Length that no longer
    // matches the bytes we send (decoded / recompressed).
    const body = await upstreamRes.arrayBuffer();

    const outHeaders = new Headers();
    upstreamRes.headers.forEach((value, key) => {
      if (!DROP_RESPONSE_HEADERS.has(key.toLowerCase())) outHeaders.set(key, value);
    });
    if (!outHeaders.has("content-type")) {
      outHeaders.set("Content-Type", "application/json");
    }
    outHeaders.set("Cache-Control", "private, no-store");

    return new NextResponse(body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: outHeaders,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return NextResponse.json(
      {
        error: aborted
          ? "The server took too long to respond. Please try again."
          : "Can't reach the server. Check your connection and try again.",
      },
      { status: aborted ? 504 : 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
