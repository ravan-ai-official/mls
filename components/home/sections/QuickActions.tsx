import Link from "next/link";
import type { ComponentType } from "react";
import {
  IconArrowRight,
  IconBuy,
  IconPrecon,
  IconRent,
  IconSell,
} from "@/components/home/icons";
import { listOf } from "@/lib/site/read";

/**
 * Quick-action cards under the hero (HomeAtlasUI HomePage L204-232).
 * Static by design — these are entry points, not data. Each card is a real
 * link (the reference used onClick buttons), so it is crawlable and
 * middle-clickable.
 */
const ACTIONS: Array<{
  label: string;
  desc: string;
  href: string;
  Icon: ComponentType<{ className?: string }>;
}> = [
  { label: "Buy", desc: "Browse MLS® listings", href: "/listings?status=Active", Icon: IconBuy },
  { label: "Rent", desc: "Find rental homes", href: "/listings?transaction_type=rent", Icon: IconRent },
  { label: "Preconstruction", desc: "Invest early", href: "/preconstruction", Icon: IconPrecon },
  { label: "Sell", desc: "Request a home valuation", href: "/sell", Icon: IconSell },
];

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  buy: IconBuy,
  rent: IconRent,
  precon: IconPrecon,
  sell: IconSell,
};

export function QuickActions({ content }: { content?: Record<string, unknown> }) {
  const custom = listOf<{ icon?: string; label?: string; description?: string; href?: string }>(
    content,
    "items",
    [],
  );
  const actions = custom.length
    ? custom.map((item) => ({
        label: item.label || "Explore",
        desc: item.description || "",
        href: item.href || "/listings",
        Icon: ICONS[item.icon || "buy"] ?? IconBuy,
      }))
    : ACTIONS;

  return (
    <section aria-label="Quick actions" className="bg-surface py-6 sm:py-12 lg:py-16">
      <div className="container-page">
        <ul
          className={`grid grid-cols-2 gap-2.5 sm:gap-4 lg:gap-5 ${
            actions.length > 4 ? "lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"
          }`}
        >
          {actions.map(({ label, desc, href, Icon }) => (
            <li key={label} className="min-w-0">
              <Link
                href={href}
                className="group flex h-full flex-row items-start gap-3 rounded-control border border-line bg-surface p-3 transition-all hover:border-gold/30 hover:shadow-card-hover focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-navy/40 sm:flex-col sm:gap-4 sm:p-5 lg:gap-5 lg:p-6"
              >
                <Icon className="mt-0.5 shrink-0 transition-transform group-hover:scale-110 sm:mt-0" />
                <span className="flex min-w-0 flex-1 flex-col gap-1 sm:gap-0 sm:contents">
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold leading-tight text-ink sm:text-h3 lg:text-h2">
                      {label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-ink-muted sm:text-small">
                      {desc}
                    </span>
                  </span>
                  <span className="mt-1 flex items-center gap-1 text-[12px] font-medium text-ink group-hover:text-navy sm:mt-auto sm:text-small">
                    Explore
                    <IconArrowRight className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
