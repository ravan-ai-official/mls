import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/api/client";

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
 */
export async function proxyUpstream(
  request: Request,
  prefix: "/api/mls" | "/api/home" | "/api/vlog",
  path: string[],
): Promise<Response> {
  const incoming = new URL(request.url);
  const targetPath = path.map(encodeURIComponent).join("/");
  // Preserve a trailing slash when the browser request had one (DRF style).
  const needsSlash =
    incoming.pathname.endsWith("/") && (targetPath === "" || !targetPath.endsWith("/"));
  const joined = targetPath ? `${prefix}/${targetPath}` : `${prefix}/`;
  const upstream = `${API_BASE_URL}${joined}${needsSlash && targetPath ? "/" : ""}${incoming.search}`;

  const headers = new Headers();
  for (const name of ["accept", "authorization", "content-type", "x-forwarded-for", "user-agent"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has("accept")) headers.set("Accept", "application/json");

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
