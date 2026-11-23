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
  icon: string;
  label: string;
  href: string;
  Icon: ComponentType<{ className?: string }>;
  uiType: UiPropertyType;
}> = [
  {
    icon: "detached",
    label: "Detached",
    href: "/listings?home_type=detached",
    Icon: IconDetached,
    uiType: "Detached",
  },
  {
    icon: "semi",
    label: "Semi-Detached",
    href: "/listings?home_type=semi",
    Icon: IconSemi,
    uiType: "Semi-Detached",
  },
  {
    icon: "townhome",
    label: "Townhomes",
    href: "/listings?home_type=townhouse",
    Icon: IconTownhome,
    uiType: "Townhome",
  },
  {
    icon: "luxury",
    label: "Luxury",
    href: "/listings?price_min=2000000",
    Icon: IconLuxury,
    uiType: "Luxury",
  },
  {
    icon: "condo",
    label: "Condos",
    href: "/listings?home_type=condo",
    Icon: IconCondo,
    uiType: "Condo",
  },
  {
    icon: "rental",
    label: "Rentals",
    href: "/listings?transaction_type=rent",
    Icon: IconRental,
    uiType: "Rental",
  },
];

export async function PropertyTypes({ content }: { content?: Record<string, unknown> }) {
  const facets = await safeFetch(getPropertyTypes(), [], "home:property-types");
  const counts = new Map<string, number>();
  for (const facet of facets) {
    if (!facet.uiType || facet.count <= 0) continue;
    counts.set(facet.uiType, (counts.get(facet.uiType) ?? 0) + facet.count);
  }

  // Canonical TILES order wins over saved CMS item order (studio may still
  // have Detached → Condos → …). CMS can still override labels/hrefs.
  const custom = Array.isArray(content?.items) ? content.items : [];
  const customByIcon = new Map<string, { label?: string; href?: string }>();
  for (const item of custom) {
    if (!item || typeof item !== "object") continue;
    const row = item as { icon?: string; label?: string; href?: string };
    const icon = row.icon === "openHouse" ? "semi" : row.icon;
    if (icon) customByIcon.set(icon, row);
  }

  const tiles = TILES.map((tile) => {
    const override = customByIcon.get(tile.icon);
    return {
      ...tile,
      label: override?.label || tile.label,
      href: override?.href || tile.href,
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
