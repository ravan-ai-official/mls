import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HighReturnManager } from "@/components/studio/site/HighReturnManager";
import { apiFetch } from "@/lib/api/client";
import { requireStudioAccess } from "@/lib/auth/session";

export const metadata: Metadata = { title: "High return homes" };
export const dynamic = "force-dynamic";

export default async function HighReturnPage() {
  const session = await requireStudioAccess();
  if (!session?.user.isStaff) notFound();
  let initial = { pins: [], results: [] };
  try {
    initial = await apiFetch("/api/mls/studio/high-return/", { token: session.token });
  } catch {
    initial = { pins: [], results: [] };
  }
  return <HighReturnManager initial={initial} />;
}
