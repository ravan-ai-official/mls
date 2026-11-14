import { ApiError, apiFetch } from "@/lib/api/client";

export interface ActivityRow {
  listingKey?: string;
  views: number;
  address?: string;
  city?: string;
  id?: number;
  title?: string;
  floorPlans?: number;
  pricing?: number;
  contact?: number;
}

export interface StudioActivity {
  windowDays: number;
  userId: number | null;
  topListings: ActivityRow[];
  topProjects: ActivityRow[];
  searches: { count: number; aiCount: number; topQueries: { query: string; count: number }[] };
  leads: {
    inquiries: number;
    assignmentSubmissions: number;
    newsletter: number;
    neighbourAlerts: number;
  };
  timeline: { at: string; kind: string; label: string; userEmail: string | null }[];
}

interface Raw {
  window_days?: number;
  user_id?: number | null;
  top_listings?: { listing_key?: string; views?: number; address?: string; city?: string }[];
  top_projects?: {
    id?: number;
    title?: string;
    views?: number;
    floor_plans?: number;
    pricing?: number;
    contact?: number;
  }[];
  searches?: { count?: number; ai_count?: number; top_queries?: { query?: string; count?: number }[] };
  leads?: {
    inquiries?: number;
    assignment_submissions?: number;
    newsletter?: number;
    neighbour_alerts?: number;
  };
  timeline?: { at?: string; kind?: string; label?: string; user_email?: string | null }[];
}

/** Staff activity report. Calls mls-v2 directly with the Studio token. */
export async function getStudioActivity(
  token: string,
  query: { days?: number; user?: string } = {},
): Promise<StudioActivity> {
  const user = query.user?.trim() || undefined;
  let data: Raw;
  try {
    data = await apiFetch<Raw>("/api/mls/studio/activity/", {
      token,
      params: {
        days: query.days ?? 30,
        // Backend resolves numeric id, email, or username.
        user_id: user,
      },
    });
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) {
      const payload = error.payload as { error?: string } | undefined;
      throw new ApiError(
        payload?.error || "User not found. Try their email, username, or numeric id.",
        404,
        error.payload,
      );
    }
    throw error;
  }
  return {
    windowDays: data.window_days ?? 30,
    userId: data.user_id ?? null,
    topListings: (data.top_listings ?? []).map((row) => ({
      listingKey: row.listing_key,
      views: row.views ?? 0,
      address: row.address,
      city: row.city,
    })),
    topProjects: (data.top_projects ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      views: row.views ?? 0,
      floorPlans: row.floor_plans ?? 0,
      pricing: row.pricing ?? 0,
      contact: row.contact ?? 0,
    })),
    searches: {
      count: data.searches?.count ?? 0,
      aiCount: data.searches?.ai_count ?? 0,
      topQueries: (data.searches?.top_queries ?? []).map((row) => ({
        query: row.query ?? "",
        count: row.count ?? 0,
      })),
    },
    leads: {
      inquiries: data.leads?.inquiries ?? 0,
      assignmentSubmissions: data.leads?.assignment_submissions ?? 0,
      newsletter: data.leads?.newsletter ?? 0,
      neighbourAlerts: data.leads?.neighbour_alerts ?? 0,
    },
    timeline: (data.timeline ?? []).map((row) => ({
      at: row.at ?? "",
      kind: row.kind ?? "",
      label: row.label ?? "",
      userEmail: row.user_email ?? null,
    })),
  };
}
