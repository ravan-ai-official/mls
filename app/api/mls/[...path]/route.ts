import { NextResponse } from "next/server";
import { proxyUpstream } from "@/lib/api/upstreamProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

async function handle(request: Request, context: RouteContext) {
  const { path } = await context.params;
  if (!path?.length) {
    return NextResponse.json({ error: "Missing MLS path." }, { status: 400 });
  }
  return proxyUpstream(request, "/api/mls", path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
