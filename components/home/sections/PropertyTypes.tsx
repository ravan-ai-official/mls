"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import {
  IconCondo,
  IconDetached,
  IconLuxury,
  IconOpenHouse,
  IconSemi,
  IconTownhome,
} from "@/components/home/icons";
import { Section } from "@/components/ui/Section";
import { getPropertyTypes } from "@/lib/api/properties";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";
import type { PropertyTypeFacet, UiPropertyType } from "@/lib/types/domain";
import { textOf } from "@/lib/site/read";
import { formatNumber } from "@/lib/utils/format";

/** Canonical explore tiles — order matches GET property-types. */
const TILES: Array<{
  icon: string;
  /** Alternate CMS icon keys that map onto this tile. */
  iconAliases?: string[];
  label: string;
  href: string;
  Icon: ComponentType<{ className?: string }>;
  uiType: UiPropertyType;
}> = [
  {
    icon: "detached",
    label: "Detached",
    href: "/listings?type=Detached",
    Icon: IconDetached,
    uiType: "Detached",
  },
  {
    icon: "semiDetached",
    iconAliases: ["semi"],
    label: "Semi-Detached",
    href: "/listings?type=Semi-Detached",
    Icon: IconSemi,
    uiType: "Semi-Detached",
  },
  {
    icon: "townhome",
    label: "Townhomes",
    href: "/listings?type=Townhome",
    Icon: IconTownhome,
    uiType: "Townhome",
  },
  {
    icon: "condo",
    label: "Condos",
    href: "/listings?type=Condo",
    Icon: IconCondo,
    uiType: "Condo",
  },
  {
    icon: "luxury",
    label: "Luxury",
    // For-sale ≥3500 sq ft (type=Luxury → LUXURY_MIN_SQFT; default transaction is sale).
    href: "/listings?type=Luxury",
    Icon: IconLuxury,
    uiType: "Luxury",
  },
  {
    icon: "openHouse",
    label: "Open Houses",
    href: "/listings?openHouse=1",
    Icon: IconOpenHouse,
    uiType: "Open Houses",
  },
];

function tileKeys(tile: (typeof TILES)[number]): string[] {
  return [tile.icon, ...(tile.iconAliases ?? [])];
}

export function PropertyTypes({ content }: { content?: Record<string, unknown> }) {
  const { data: facets = [] } = useMlsQuery<PropertyTypeFacet[]>(
    ["home", "property-types"],
    () => getPropertyTypes(),
    [],
  );

  const counts = new Map<string, number>();
  for (const facet of facets) {
    if (!facet.uiType || facet.count <= 0) continue;
    counts.set(facet.uiType, (counts.get(facet.uiType) ?? 0) + facet.count);
  }

  const custom = Array.isArray(content?.items) ? content.items : [];
  const customByIcon = new Map<string, { label?: string; href?: string }>();
  for (const item of custom) {
    if (!item || typeof item !== "object") continue;
    const row = item as { icon?: string; label?: string; href?: string };
    if (row.icon) customByIcon.set(row.icon, row);
  }

  // Prefer API order when every tile has a matching facet; otherwise keep TILES order.
  const byUiType = new Map(TILES.map((tile) => [tile.uiType, tile]));
  const fromApi = facets
    .map((facet) => (facet.uiType ? byUiType.get(facet.uiType) : undefined))
    .filter((tile): tile is (typeof TILES)[number] => Boolean(tile));
  const ordered =
    fromApi.length === TILES.length
      ? fromApi
      : TILES;

  const tiles = ordered.map((tile) => {
    const override =
      tileKeys(tile)
        .map((key) => customByIcon.get(key))
        .find(Boolean) ?? undefined;
    // Luxury must stay for-sale ≥3500 sq ft regardless of CMS href.
    const href =
      tile.uiType === "Luxury" ? tile.href : override?.href || tile.href;
    return {
      ...tile,
      label: override?.label || tile.label,
      href,
    };
  });

  return (
    <Section
      tone="alt"
      title={textOf(content, "title", "Explore by Property Type")}
      className="border-y border-line"
    >
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map(({ label, href, Icon, uiType }) => {
          const count = counts.get(uiType);
          return (
            <li key={uiType} className="h-full">
              <Link
                href={href}
                className="group flex h-full flex-col items-start gap-5 rounded-control border border-transparent bg-surface p-5 shadow-card transition-all hover:border-gold/20 hover:shadow-card-hover focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-navy/40"
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
