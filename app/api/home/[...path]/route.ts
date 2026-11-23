import { NextResponse } from "next/server";
import { proxyUpstream } from "@/lib/api/upstreamProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Catch-all for mls-backend `/api/home/…` feeds (sold-below, community-images,
 * …). More specific Next handlers under `app/api/home/*` (newsletter, alerts)
 * still win over this route.
 */
type RouteContext = { params: Promise<{ path: string[] }> };

async function handle(request: Request, context: RouteContext) {
  const { path } = await context.params;
  if (!path?.length) {
    return NextResponse.json({ error: "Missing home path." }, { status: 400 });
  }
  return proxyUpstream(request, "/api/home", path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
