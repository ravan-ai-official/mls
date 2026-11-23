"use client";

import Link from "next/link";
import { Eyebrow } from "@/components/ui/Badge";
import { Section } from "@/components/ui/Section";
import { getMarketSnapshot } from "@/lib/api/home";
import { snapshotStats, type SnapshotStat } from "@/lib/api/homeMappers";
import {
  gtaMarketSnapshot,
  marketReportCities,
  soldDataTeaser,
} from "@/lib/home/staticSections";
import {
  formatDate,
  formatNumber,
  formatPriceCompact,
} from "@/lib/utils/format";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";
import { headingLines, textOf } from "@/lib/site/read";
import { buildListingHref } from "@/lib/utils/searchParams";
import { ArrowGlyph } from "./sectionIcons";

/**
 * Market Intelligence — snapshot from `/api/home/market-snapshot/` in the browser.
 */
export function MarketIntelligence({ content }: { content?: Record<string, unknown> }) {
  const { data: snapshot = null } = useMlsQuery(
    ["home", "market-snapshot"],
    () => getMarketSnapshot(),
    null,
  );
  const liveStats = snapshot ? snapshotStats(snapshot) : [];
  const live = snapshot !== null && liveStats.length > 0;
  const stats: SnapshotStat[] = live ? liveStats : gtaMarketSnapshot;
  const teaser =
    live && snapshot
      ? [
          {
            label: `Last ${snapshot.windowDays} days`,
            value: `${formatNumber(snapshot.unitsSold)} homes`,
          },
          {
            label: "Median sold price",
            value: formatPriceCompact(snapshot.medianSoldPrice),
          },
          ...(snapshot.overAskingShare !== null
            ? [
                {
                  label: "Over asking",
                  value: `${Math.round(snapshot.overAskingShare * 100)}% of homes`,
                  highlight: true,
                },
              ]
            : []),
        ]
      : soldDataTeaser;

  return (
    <Section tone="alt">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <Eyebrow>{textOf(content, "eyebrow", "Know before you move")}</Eyebrow>
          <h2 className="mt-2 text-display text-ink">
            {headingLines(textOf(content, "title", "Market Intelligence,\nMade Useful.")).map((line, index) => (
              <span key={line}>
                {index > 0 && <br />}
                {line}
              </span>
            ))}
          </h2>
        </div>
        <Link
          href="/market-trends"
          className="inline-flex shrink-0 items-center gap-1.5 text-small font-medium text-navy transition-colors hover:text-gold-deep"
        >
          Explore market trends
          <ArrowGlyph className="text-current" />
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-surface bg-surface p-5 shadow-card lg:col-span-2">
          <h3 className="mb-4 text-h3 text-ink">GTA Market Snapshot</h3>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-control bg-surface-alt p-3">
                <dt className="mb-1 text-caption text-ink-muted">{stat.label}</dt>
                <dd className="text-h3 text-ink">{stat.value}</dd>
                {stat.change && (
                  <dd
                    className={`mt-0.5 text-caption font-medium ${stat.up ? "text-gold-deep" : "text-navy"}`}
                  >
                    {stat.change}
                  </dd>
                )}
              </div>
            ))}
          </dl>
          <p className="mt-3 text-caption text-ink-subtle">
            {live && snapshot
              ? `GTA residential sales · As of ${formatDate(snapshot.asOf)}${snapshot.stale ? " (updating)" : ""}`
              : "Sample figures for illustration"}
          </p>
        </div>

        <div className="rounded-surface bg-ink p-5 text-white">
          <Eyebrow className="mb-2">Sold data</Eyebrow>
          <h3 className="mb-3 text-h3 text-white">Past Sales in Your Area</h3>
          <dl className="mb-4 space-y-2">
            {teaser.map((row) => (
              <div key={row.label} className="flex justify-between text-caption">
                <dt className="text-white/60">{row.label}</dt>
                <dd className={row.highlight ? "font-medium text-gold" : "font-medium"}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
          <Link
            href={buildListingHref({ status: "Sold" })}
            className="inline-flex items-center gap-1 text-small font-medium text-gold transition-all hover:gap-2"
          >
            Browse Sold Properties →
          </Link>
        </div>

        <div className="rounded-surface bg-surface p-5 shadow-card lg:col-span-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-h3 text-ink">Local Market Reports</h3>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {marketReportCities.map((city) => (
                <li key={city}>
                  <Link
                    href={`/market-trends?city=${encodeURIComponent(city)}`}
                    className="group inline-flex items-center gap-1.5 text-small text-ink transition-colors hover:text-gold-deep"
                  >
                    <span>{city}</span>
                    <ArrowGlyph className="text-ink-muted group-hover:text-gold-deep" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Section>
  );
}
