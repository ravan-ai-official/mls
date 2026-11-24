/**
 * Exclusive Assignments (scope #13, #2e): approved user-submitted listings from
 * mls-v2 `listing-submissions/public/`. These are not MLS® listings — owners,
 * agents and builders submit them through /sell/list and staff approve them —
 * so they get their own pages rather than /property/<key>.
 *
 * The public serializer never includes the seller's contact details, purchase
 * price, deposit or assignment fee.
 */

import { API_BASE_URL, apiFetch, type RequestOptions } from "@/lib/api/client";
import { toNumber } from "@/lib/utils/format";

const BASE = "/api/mls/listing-submissions/public";

export type SubmissionPurpose = "sale" | "rent" | "assignment";

export interface PublicListing {
  id: number;
  purpose: SubmissionPurpose;
  /** "Owner", "Agent" or "Builder". */
  sourceLabel: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  propertyType: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  askingPrice: number | null;
  availableFrom: string | null;
  description: string;
  projectName: string;
  builderName: string;
  occupancyDate: string | null;
  preconProjectId: number | null;
  publishedAt: string | null;
  photos: string[];
}

export interface PublicListingPage {
  count: number;
  page: number;
  pageSize: number;
  results: PublicListing[];
  /** Cities that currently have at least one approved assignment (from the API). */
  availableCities: string[];
}

export interface AssignmentQuery {
  city?: string;
  priceMin?: number;
  priceMax?: number;
  bedsMin?: number;
  preconProjectId?: number;
  page?: number;
  pageSize?: number;
}

/** Local-storage media comes back as a path; Cloudinary as an absolute URL. */
export function absoluteMediaUrl(url: string): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE_URL.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
}

/** next/image only optimises hosts in next.config; anything else renders as-is. */
export function isOptimizableImage(url: string): boolean {
  return /^https:\/\/res\.cloudinary\.com\//i.test(url);
}

export function mapPublicListing(row: Record<string, unknown>): PublicListing {
  const media = Array.isArray(row.media) ? (row.media as Array<Record<string, unknown>>) : [];
  const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  return {
    id: Number(row.id),
    purpose: (str(row.purpose) || "sale") as SubmissionPurpose,
    sourceLabel: str(row.source_label),
    addressLine1: str(row.address_line_1),
    addressLine2: str(row.address_line_2),
    city: str(row.city),
    province: str(row.province),
    postalCode: str(row.postal_code),
    propertyType: str(row.property_type),
    beds: toNumber(row.bedrooms),
    baths: toNumber(row.bathrooms),
    sqft: toNumber(row.interior_area_sqft),
    askingPrice: toNumber(row.asking_price),
    availableFrom: str(row.available_from) || null,
    description: str(row.description),
    projectName: str(row.project_name),
    builderName: str(row.builder_name),
    occupancyDate: str(row.occupancy_date) || null,
    preconProjectId: toNumber(row.precon_property),
    publishedAt: str(row.published_at) || null,
    photos: media.map((item) => absoluteMediaUrl(str(item.file_url))).filter(Boolean),
  };
}

/** Project name first (buyers search assignments by project), else the address. */
export function assignmentTitle(listing: PublicListing): string {
  if (listing.projectName) return listing.projectName;
  return listing.addressLine1 || `${listing.propertyType} in ${listing.city}`;
}

export function assignmentPath(listing: Pick<PublicListing, "id">): string {
  return `/assignments/${listing.id}`;
}

function parseAvailableCities(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const cities: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const city = item.trim();
    if (!city) continue;
    const key = city.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cities.push(city);
  }
  return cities;
}

/** True when the listing has at least one usable photo URL for cards/gallery. */
export function listingHasPhoto(listing: PublicListing): boolean {
  return Boolean(listing.photos[0]);
}

export async function getPublicAssignments(
  query: AssignmentQuery = {},
  options: RequestOptions = {},
): Promise<PublicListingPage> {
  const data = await apiFetch<{
    count?: number;
    page?: number;
    page_size?: number;
    results?: Array<Record<string, unknown>>;
    available_cities?: unknown;
  }>(`${BASE}/`, {
    revalidate: 300,
    ...options,
    params: {
      purpose: "assignment",
      city: query.city,
      price_min: query.priceMin,
      price_max: query.priceMax,
      beds_min: query.bedsMin,
      precon_property: query.preconProjectId,
      page: query.page,
      page_size: query.pageSize,
    },
  });
  return {
    count: data.count ?? 0,
    page: data.page ?? 1,
    pageSize: data.page_size ?? 12,
    results: (data.results ?? []).map(mapPublicListing),
    availableCities: parseAvailableCities(data.available_cities),
  };
}

export async function getPublicAssignment(id: number, options: RequestOptions = {}): Promise<PublicListing> {
  const row = await apiFetch<Record<string, unknown>>(`${BASE}/${id}/`, { revalidate: 300, ...options });
  return mapPublicListing(row);
}

export async function getSimilarAssignments(id: number, options: RequestOptions = {}): Promise<PublicListing[]> {
  const rows = await apiFetch<Array<Record<string, unknown>>>(`${BASE}/${id}/similar/`, {
    revalidate: 600,
    ...options,
    params: { limit: 4 },
  });
  return (rows ?? []).map(mapPublicListing);
}
