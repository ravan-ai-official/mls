import type { Metadata } from "next";
import Link from "next/link";
import { PreconProjectsGrid } from "@/components/precon/PreconProjectsGrid";
import { VipAccessForm } from "@/components/precon/VipAccessForm";
import { Eyebrow } from "@/components/ui/Badge";
import { type PreconDealsQuery } from "@/lib/api/preconstruction";

export const metadata: Metadata = {
  title: "Preconstruction projects",
  description:
    "Explore new preconstruction condo and home projects across the Greater Toronto Area.",
  alternates: { canonical: "/preconstruction" },
};

export const revalidate = 300;

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function intParam(value: string | string[] | undefined): number | undefined {
  const raw = first(value);
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/** Same filters as the homepage Pre-construction deals rail (no IP inventing). */
function dealsFromSearchParams(params: Params): PreconDealsQuery {
  const citiesCsv = first(params.cities)?.trim();
  const city = first(params.city)?.trim();
  const cities = citiesCsv
    ? citiesCsv.split(",").map((part) => part.trim()).filter(Boolean).slice(0, 5)
    : city
      ? [city]
      : undefined;
  return {
    cities,
    bedsMin: intParam(params.beds_min) ?? intParam(params.beds),
    bathsMin: intParam(params.baths_min) ?? intParam(params.baths),
    priceMin: intParam(params.price_min) ?? intParam(params.priceMin),
    priceMax: intParam(params.price_max) ?? intParam(params.priceMax),
  };
}

function hasDealsFilters(deals: PreconDealsQuery): boolean {
  return Boolean(
    deals.cities?.length ||
      deals.bedsMin ||
      deals.bathsMin ||
      deals.priceMin ||
      deals.priceMax,
  );
}

export default async function PreconstructionPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const deals = dealsFromSearchParams(params);
  const filtered = hasDealsFilters(deals);
  const citiesLabel = deals.cities?.join(", ");

  return (
    <>
      <section className="border-b border-line bg-surface-alt py-8 sm:py-12">
        <div className="container-page">
          <Eyebrow>New developments</Eyebrow>
          <h1 className="mt-3 text-h1 text-ink">
            {citiesLabel ? `Preconstruction in ${citiesLabel}` : "Pre-construction deals"}
          </h1>
          <p className="mt-2 max-w-2xl text-small text-ink-muted">
            {filtered
              ? "Featured projects matching your search — pinned first, then newest."
              : "Featured preconstruction across the GTA — pinned first, then newest."}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/preconstruction/map"
              className="inline-flex h-11 items-center rounded-control border border-line bg-surface px-4 text-small font-medium text-ink transition-colors hover:border-navy hover:text-navy"
            >
              Search on map
            </Link>
            {filtered ? (
              <Link
                href="/preconstruction"
                className="text-small font-medium text-navy hover:underline"
              >
                Clear filters
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <div className="container-page space-y-16 py-10">
        <PreconProjectsGrid key={JSON.stringify(deals)} deals={deals} />
        <VipAccessForm />
      </div>
    </>
  );
}
