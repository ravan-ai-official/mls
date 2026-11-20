import { NextResponse } from "next/server";
import { searchProperties } from "@/lib/api/properties";
import { parseListingSearch } from "@/lib/utils/searchParams";

/**
 * GET /api/properties/search?[listing params]
 *
 * Browser-facing listings search for React Query. Same filter semantics as
 * `/listings` so client caches stay aligned with the server-rendered grid.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = parseListingSearch(params);

  try {
    const result = await searchProperties(query);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json({ error: "Could not load listings." }, { status: 502 });
  }
}
