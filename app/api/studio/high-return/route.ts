import { NextResponse } from "next/server";
import { guardStaff, isGuardFailure } from "@/app/api/studio/_guard";
import { siteError, revalidateSite } from "@/app/api/studio/site/_shared";
import { apiFetch } from "@/lib/api/client";

export async function GET(request: Request) {
  const session = await guardStaff();
  if (isGuardFailure(session)) return session;
  const query = new URL(request.url).searchParams.get("q") ?? "";
  try {
    const body = await apiFetch(`/api/mls/studio/high-return/`, {
      token: session.token,
      params: { q: query },
    });
    return NextResponse.json(body);
  } catch (error) {
    return siteError(error, "Could not search listings.");
  }
}

export async function PATCH(request: Request) {
  const session = await guardStaff();
  if (isGuardFailure(session)) return session;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    const row = await apiFetch(`/api/mls/studio/high-return/`, {
      token: session.token,
      method: "PATCH",
      body,
    });
    revalidateSite();
    return NextResponse.json(row);
  } catch (error) {
    return siteError(error, "Could not update that listing.");
  }
}
