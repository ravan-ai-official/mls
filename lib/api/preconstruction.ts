/**
 * Preconstruction projects.
 *
 * `developer_name` and `sales_stage` landed with API_GAPS G9, so the cards can
 * now show the developer and a real sales stage. Both are BLANK on rows the
 * brokerage has not filled in yet — the serializer defaults them to "" — so the
 * mapper nulls empty strings and the UI omits the chip rather than rendering an
 * empty badge. `status` remains the CMS publish state and is still not a sales
 * stage; do not display it as one.
 */

import { apiFetch, type RequestOptions } from "@/lib/api/client";
import { toNumber } from "@/lib/utils/format";
import {
  getOverviewHtml,
  parseDocuments,
  parsePreconMeta,
  splitAttachments,
  text,
  toMeta,
  type PreconAttachment,
  type PreconDocuments,
  type PreconMetaFields,
} from "@/lib/precon/parse";

const MLS = "/api/mls";

/** Backend enum; the UI renders the label, never the raw key. */
export type PreconSalesStage =
  | "coming_soon"
  | "vip_release"
  | "now_selling"
  | "sold_out";

const SALES_STAGE_LABELS: Record<PreconSalesStage, string> = {
  coming_soon: "Coming Soon",
  vip_release: "VIP Release",
  now_selling: "Now Selling",
  sold_out: "Sold Out",
};

export function salesStageLabel(stage: PreconSalesStage | null): string | null {
  return stage ? SALES_STAGE_LABELS[stage] : null;
}

export interface PreconProject {
  id: number;
  title: string;
  slug: string | null;
  address: string | null;
  /** Null when the brokerage has not recorded one (G9). */
  developer: string | null;
  salesStage: PreconSalesStage | null;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area: number | null;
  image: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface BackendPrecon {
  id: number;
  title: string | null;
  slug: string | null;
  address: string | null;
  price: string | number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  garages: number | null;
  area: string | number | null;
  lot_size: string | number | null;
  developer_name?: string | null;
  sales_stage?: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  featured_image_url: string | null;
}

function mapPrecon(raw: BackendPrecon): PreconProject {
  return {
    id: raw.id,
    title: raw.title?.trim() || `Project #${raw.id}`,
    slug: raw.slug ?? null,
    address: raw.address?.trim() || null,
    developer: raw.developer_name?.trim() || null,
    // Guarded: an unrecognised value is dropped rather than shown raw.
    salesStage:
      raw.sales_stage && raw.sales_stage in SALES_STAGE_LABELS
        ? (raw.sales_stage as PreconSalesStage)
        : null,
    price: toNumber(raw.price),
    bedrooms: raw.bedrooms ?? null,
    bathrooms: raw.bathrooms ?? null,
    area: toNumber(raw.area),
    image: raw.featured_image_url?.trim() || null,
    latitude: toNumber(raw.latitude),
    longitude: toNumber(raw.longitude),
  };
}

/** Homepage / browse filters for featured precon deals (search history only). */
export type PreconDealsQuery = {
  cities?: string[];
  bedsMin?: number;
  bathsMin?: number;
  priceMin?: number;
  priceMax?: number;
};

/** Query params for GET /precon-properties/ featured deals + View all href. */
export function toPreconDealsParams(
  query: PreconDealsQuery = {},
  options: { pageSize?: number; page?: number } = {},
): Record<string, string | number | undefined> {
  const cities = (query.cities ?? []).map((city) => city.trim()).filter(Boolean);
  return {
    ordering: "featured",
    exclude_stage: "sold_out",
    page_size: options.pageSize,
    page: options.page,
    ...(cities.length === 1
      ? { city: cities[0] }
      : cities.length > 1
        ? { cities: cities.join(",") }
        : {}),
    beds_min: query.bedsMin,
    baths_min: query.bathsMin,
    price_min: query.priceMin,
    price_max: query.priceMax,
  };
}

/** /preconstruction?… with the same filters as the homepage deals rail. */
export function buildPreconDealsHref(query: PreconDealsQuery = {}): string {
  const params = toPreconDealsParams(query);
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `/preconstruction?${qs}` : "/preconstruction";
}

export async function getPreconProjects(
  options: RequestOptions & {
    limit?: number;
    page?: number;
    city?: string;
    /** Search-history filters for the featured deals rail. Never pass IP city. */
    deals?: PreconDealsQuery;
  } = {},
): Promise<{
  items: PreconProject[];
  total: number;
  hasSearchHistory: boolean;
  cities: string[];
}> {
  const { limit = 12, page = 1, city, deals, ...rest } = options;
  const dealsParams = deals
    ? toPreconDealsParams(deals, { pageSize: limit, page })
    : {
        page_size: limit,
        page,
        city: city?.trim() || undefined,
      };
  const personalized = Boolean(
    deals?.cities?.length ||
      deals?.bedsMin ||
      deals?.bathsMin ||
      deals?.priceMin ||
      deals?.priceMax,
  );

  const data = await apiFetch<{
    count?: number;
    results?: BackendPrecon[];
    has_search_history?: boolean;
    cities?: string[];
  }>(`${MLS}/precon-properties/`, {
    revalidate: personalized ? 60 : 300,
    ...rest,
    params: { ...dealsParams, ...rest.params },
  });

  const rows = data.results ?? [];
  return {
    items: rows.map(mapPrecon),
    total: data.count ?? rows.length,
    hasSearchHistory: Boolean(data.has_search_history),
    cities: Array.isArray(data.cities)
      ? data.cities.filter((row): row is string => typeof row === "string" && row.trim().length > 0)
      : [],
  };
}

/**
 * Similar projects for the detail page rail. Same list shape as the index;
 * the backend scores by shared title/address terms and price proximity.
 */
export async function getSimilarPrecon(
  id: number,
  options: RequestOptions = {},
): Promise<PreconProject[]> {
  const rows = await apiFetch<BackendPrecon[]>(
    `${MLS}/precon-properties/${id}/recommendations/`,
    { revalidate: 300, ...options, params: { limit: 4 } },
  );
  return Array.isArray(rows) ? rows.map(mapPrecon) : [];
}

/**
 * One project, with the extra fields the detail endpoint adds over the list:
 * long-form `body`, `excerpt`, gallery images, and the typed view of `meta`
 * (see lib/precon/parse.ts). Gated document URLs are never on this object —
 * only `documents` flags; the URL comes from `document-intent/` on click.
 */
export interface PreconProjectDetail extends PreconProject, PreconMetaFields {
  body: string | null;
  /** `body` with the sections the page renders from meta cut out. */
  overviewHtml: string | null;
  excerpt: string | null;
  garages: number | null;
  lotSize: number | null;
  publishedAt: string | null;
  /** Last time the listing was saved; falls back to published date. */
  updatedAt: string | null;
  images: string[];
  attachmentsDocuments: PreconAttachment[];
  documents: PreconDocuments;
}

interface BackendPreconDetail extends Omit<BackendPrecon, "featured_image_url"> {
  featured_image_url?: string | null;
  body?: string | null;
  excerpt?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
  attachments?: unknown;
  meta?: unknown;
  has_floor_plan?: boolean;
  has_price_list?: boolean;
  has_brochure?: boolean;
}

/** Pure mapper, exported for tests. */
export function mapPreconDetail(raw: BackendPreconDetail): PreconProjectDetail {
  const meta = toMeta(raw.meta);
  const base = mapPrecon({ ...raw, featured_image_url: raw.featured_image_url ?? null });
  const { images, documents } = splitAttachments(raw.attachments);
  // The detail serializer only gained developer / featured image recently;
  // fall back to the meta the WP importer writes so older backends still show them.
  const featured = base.image ?? text(meta.featured_image_url);
  const overview = getOverviewHtml(raw.body);

  return {
    ...base,
    developer: base.developer ?? text(meta.developer),
    image: featured,
    ...parsePreconMeta(meta, {
      bedrooms: base.bedrooms,
      bathrooms: base.bathrooms,
      area: base.area,
      garages: raw.garages ?? null,
    }),
    body: raw.body?.trim() || null,
    overviewHtml: overview.trim() || null,
    excerpt: raw.excerpt?.trim() || null,
    garages: raw.garages ?? null,
    lotSize: toNumber(raw.lot_size),
    publishedAt: raw.published_at ?? null,
    updatedAt: raw.updated_at ?? raw.published_at ?? null,
    // The featured image may not be in `attachments`; lead with it when present.
    images: Array.from(new Set([...(featured ? [featured] : []), ...images])),
    attachmentsDocuments: documents,
    documents: parseDocuments(raw, meta),
  };
}

export async function getPreconProject(
  id: number | string,
  options: RequestOptions = {},
): Promise<PreconProjectDetail> {
  const raw = await apiFetch<BackendPreconDetail>(
    `${MLS}/precon-properties/${encodeURIComponent(String(id))}/`,
    { revalidate: 300, ...options },
  );
  return mapPreconDetail(raw);
}

export type PreconDocumentType = "floor_plan" | "price_list" | "brochure";

/** Server-side call behind app/api/precon/[id]/document. */
export async function requestPreconDocument(
  token: string,
  id: number,
  type: PreconDocumentType,
): Promise<{ access_url: string }> {
  return apiFetch<{ access_url: string }>(
    `${MLS}/precon-properties/${id}/document-intent/`,
    { method: "POST", token, body: { type } },
  );
}
