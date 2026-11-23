import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/api/client";
import { ACCESS_COOKIE } from "@/lib/auth/session";

const HOP_BY_HOP = new Set([
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
  const timer = setTimeout(() => controller.abort(), 25_000);

  try {
    const upstreamRes = await fetch(upstream, {
      method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      // Follow any residual upstream redirects so the browser never sees 308.
      redirect: "follow",
      signal: controller.signal,
    });

    const outHeaders = new Headers();
    upstreamRes.headers.forEach((value, key) => {
      if (!HOP_BY_HOP.has(key.toLowerCase())) outHeaders.set(key, value);
    });
    outHeaders.set("Cache-Control", "private, no-store");

    return new NextResponse(upstreamRes.body, {
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
