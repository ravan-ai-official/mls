import Link from "next/link";
import type { ComponentType } from "react";
import {
  IconCondo,
  IconDetached,
  IconLuxury,
  IconRental,
  IconSemi,
  IconTownhome,
} from "@/components/home/icons";
import { Section } from "@/components/ui/Section";
import { safeFetch } from "@/lib/api/client";
import { getPropertyTypes } from "@/lib/api/properties";
import type { UiPropertyType } from "@/lib/types/domain";
import { textOf } from "@/lib/site/read";
import { formatNumber } from "@/lib/utils/format";

/**
 * "Explore by Property Type" — six real UI types with live counts from
 * `/properties/property-types/` (structure_type / attached for home types,
 * $2M+ for Luxury, active leases for Rentals).
 */
const TILES: Array<{
  label: string;
  href: string;
  Icon: ComponentType<{ className?: string }>;
  uiType: UiPropertyType;
}> = [
  { label: "Detached", href: "/listings?type=Detached", Icon: IconDetached, uiType: "Detached" },
  { label: "Condos", href: "/listings?type=Condo", Icon: IconCondo, uiType: "Condo" },
  { label: "Townhomes", href: "/listings?type=Townhome", Icon: IconTownhome, uiType: "Townhome" },
  { label: "Luxury", href: "/listings?priceMin=2000000", Icon: IconLuxury, uiType: "Luxury" },
  {
    label: "Semi-Detached",
    href: "/listings?type=Semi-Detached",
    Icon: IconSemi,
    uiType: "Semi-Detached",
  },
  { label: "Rentals", href: "/listings?tx=rent", Icon: IconRental, uiType: "Rental" },
];

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  detached: IconDetached,
  condo: IconCondo,
  townhome: IconTownhome,
  luxury: IconLuxury,
  semi: IconSemi,
  // Legacy CMS value — treat as Semi-Detached.
  openHouse: IconSemi,
  rental: IconRental,
};

const UI_TYPES: Record<string, UiPropertyType | undefined> = {
  detached: "Detached",
  condo: "Condo",
  townhome: "Townhome",
  luxury: "Luxury",
  semi: "Semi-Detached",
  openHouse: "Semi-Detached",
  rental: "Rental",
};

const DEFAULT_HREFS: Record<string, string> = {
  detached: "/listings?type=Detached",
  condo: "/listings?type=Condo",
  townhome: "/listings?type=Townhome",
  luxury: "/listings?priceMin=2000000",
  semi: "/listings?type=Semi-Detached",
  openHouse: "/listings?type=Semi-Detached",
  rental: "/listings?tx=rent",
};

export async function PropertyTypes({ content }: { content?: Record<string, unknown> }) {
  const facets = await safeFetch(getPropertyTypes(), [], "home:property-types");
  const counts = new Map<string, number>();
  for (const facet of facets) {
    if (!facet.uiType || facet.count <= 0) continue;
    counts.set(facet.uiType, (counts.get(facet.uiType) ?? 0) + facet.count);
  }

  const custom = Array.isArray(content?.items) ? content.items : [];
  const tiles = custom.length
    ? custom.map((item) => {
        const row =
          item && typeof item === "object"
            ? (item as { icon?: string; label?: string; href?: string })
            : {};
        const icon = row.icon || "detached";
        const legacyOpenHouse = icon === "openHouse";
        return {
          label: legacyOpenHouse ? "Semi-Detached" : row.label || "Homes",
          href: legacyOpenHouse
            ? DEFAULT_HREFS.semi
            : row.href || DEFAULT_HREFS[icon] || "/listings",
          Icon: ICONS[icon] ?? IconDetached,
          uiType: UI_TYPES[icon],
        };
      })
    : TILES;

  return (
    <Section
      tone="alt"
      title={textOf(content, "title", "Explore by Property Type")}
      className="border-y border-line"
    >
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map(({ label, href, Icon, uiType }) => {
          const count = uiType ? counts.get(uiType) : undefined;
          return (
            <li key={label} className="h-full">
              <Link
                href={href}
                className="group flex h-full flex-col items-start gap-5 rounded-control border border-transparent bg-surface p-5 shadow-card transition-all hover:border-gold/20 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
              >
                <Icon className="transition-transform group-hover:scale-110" />
                <span className="flex w-full items-baseline justify-between gap-2">
                  <span className="text-small font-medium text-ink">{label}</span>
                  {count !== undefined && (
                    <span className="text-caption text-ink-muted">{formatNumber(count)}</span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
