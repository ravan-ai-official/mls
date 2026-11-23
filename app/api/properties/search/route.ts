import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/client";
import { searchProperties } from "@/lib/api/properties";
import { getCurrentUser, requireAccessToken } from "@/lib/auth/session";
import { matchKnownCity } from "@/lib/constants/cities";
import type { ListingQuery } from "@/lib/types/domain";
import { parseListingSearch } from "@/lib/utils/searchParams";
import { backendStatusGroup } from "@/lib/utils/status";

/**
 * GET /api/properties/search?[listing params]
 *
 * Browser-facing listings search (React Query). Same filter semantics as the
 * `/listings` page so DevTools Network shows the JSON result envelope instead
 * of only the Next.js RSC flight payload from a soft navigation.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = listingQueryFromParams(params);
  const group = backendStatusGroup(query.status);

  let token: string | null = null;
  if (group === "de-listed") {
    const user = await getCurrentUser();
    if (user?.isStaff) token = await requireAccessToken();
  }

  try {
    const result = await searchProperties(query, {
      token: token ?? undefined,
      cache: "no-store",
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : "Could not load listings.";
    const status = error instanceof ApiError && error.status >= 400 ? error.status : 502;
    return NextResponse.json(
      {
        error: message,
        // Helps DevTools distinguish upstream MLS failures from an empty catalogue.
        upstream_status: error instanceof ApiError ? error.status : null,
      },
      { status: status === 401 || status === 403 ? status : 502 },
    );
  }
}

function listingQueryFromParams(params: URLSearchParams): ListingQuery {
  const parsed = parseListingSearch(params);
  const cityFromSearch =
    !parsed.city && parsed.search ? matchKnownCity(parsed.search) : null;
  const query = cityFromSearch
    ? { ...parsed, city: cityFromSearch, search: undefined }
    : parsed;
  return query.status || query.openHouse ? query : { ...query, status: "Active" };
}
