import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/client";
import { getRecentSales, RECENT_SALES_DAYS } from "@/lib/api/market";
import { requireAccessToken } from "@/lib/auth/session";

function minInt(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw.replace("+", ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/** GET /api/market/recent-sales?city=&days=&page=[&property_type=&beds_min=&baths_min=] */
export async function GET(request: Request) {
  const token = await requireAccessToken();
  if (!token) return NextResponse.json({ error: "Sign in to see sold prices." }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const city = (params.get("city") ?? "").trim();
  if (!city) return NextResponse.json({ error: "Choose a city." }, { status: 400 });
  const days = Number(params.get("days"));
  const page = Math.max(1, Number(params.get("page")) || 1);

  try {
    return NextResponse.json(
      await getRecentSales(token, {
        city,
        days: (RECENT_SALES_DAYS as readonly number[]).includes(days) ? days : 30,
        page,
        propertyType: (params.get("property_type") ?? "").trim() || undefined,
        bedsMin: minInt(params.get("beds_min") ?? params.get("beds")),
        bathsMin: minInt(params.get("baths_min") ?? params.get("baths")),
      }),
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status || 500 });
    }
    return NextResponse.json({ error: "Could not load recent sales." }, { status: 500 });
  }
}
