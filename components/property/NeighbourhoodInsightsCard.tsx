"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

export type InsightMetric = { label: string; value: string };

export type InsightDistribution = {
  range: string;
  value: number;
};

export type InsightCategory =
  | "Household Income"
  | "Age"
  | "Education"
  | "Ethnicity"
  | "Language"
  | "Construction"
  | "Occupation";

const CATEGORIES: InsightCategory[] = [
  "Household Income",
  "Age",
  "Education",
  "Ethnicity",
  "Language",
  "Construction",
  "Occupation",
];

const CATEGORY_TITLES: Record<InsightCategory, string> = {
  "Household Income": "Household Income Distribution",
  Age: "Age Distribution",
  Education: "Education Distribution",
  Ethnicity: "Ethnicity Distribution",
  Language: "Language Distribution",
  Construction: "Construction Period Distribution",
  Occupation: "Occupation Distribution",
};

/**
 * Reference HomeAtlasUI Neighbourhood Insights card — 9 demographic tiles +
 * category chips + horizontal % bars. Category chips switch the chart series.
 */
export function NeighbourhoodInsightsCard({
  placeLabel,
  metrics,
  distributions,
  source = "Source: Statistics Canada — 2021 Census",
}: {
  placeLabel: string;
  metrics: InsightMetric[];
  distributions: Partial<Record<InsightCategory, InsightDistribution[]>>;
  source?: string;
}) {
  const available = CATEGORIES.filter((cat) => (distributions[cat]?.length ?? 0) > 0);
  const initial = available.includes("Household Income")
    ? "Household Income"
    : (available[0] ?? "Household Income");
  const [category, setCategory] = useState<InsightCategory>(initial);
  const rows = distributions[category] ?? distributions["Household Income"] ?? [];
  const peak = Math.max(...rows.map((row) => row.value), 1);

  if (metrics.length === 0 && rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-line p-5">
      <h2 className="mb-2 text-[18px] font-semibold text-ink">Neighbourhood Insights</h2>
      <p className="mb-5 text-[13px] text-ink-muted">
        Demographics, income, and lifestyle data for {placeLabel}
      </p>

      {metrics.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-xl bg-surface-alt p-3.5">
              <div className="mb-1 text-[11px] text-ink-muted">{metric.label}</div>
              <div className="text-[16px] font-semibold text-ink">{metric.value}</div>
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <h3 className="mb-3 text-[14px] font-semibold text-ink">
            {CATEGORY_TITLES[category]}
          </h3>
          <div className="mb-4 flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => {
              const enabled = (distributions[cat]?.length ?? 0) > 0;
              const active = cat === category;
              return (
                <button
                  key={cat}
                  type="button"
                  disabled={!enabled}
                  onClick={() => enabled && setCategory(cat)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                    active
                      ? "bg-ink text-white"
                      : enabled
                        ? "bg-surface-alt text-ink-muted hover:bg-line"
                        : "cursor-not-allowed bg-surface-alt text-ink-subtle opacity-50",
                  )}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          <DistributionBars rows={rows} peak={peak} />
        </>
      )}

      <p className="mt-2 text-[11px] text-ink-subtle">{source}</p>
    </div>
  );
}

function DistributionBars({
  rows,
  peak,
}: {
  rows: InsightDistribution[];
  peak: number;
}) {
  const [tip, setTip] = useState<{ x: number; y: number; label: string; value: number } | null>(null);
  const width = 560;
  const rowH = 28;
  const labelW = 96;
  const right = 8;
  const height = rows.length * rowH + 28;
  const chartW = width - labelW - right;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(peak * t));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ height: Math.max(200, height) }}
      role="img"
      aria-label="Distribution chart"
      onMouseLeave={() => setTip(null)}
    >
      {ticks.map((tick) => {
        const x = labelW + (tick / peak) * chartW;
        return (
          <g key={tick}>
            <line
              x1={x}
              x2={x}
              y1={0}
              y2={height - 22}
              stroke="#f0f0f0"
              strokeDasharray="3 3"
            />
            <text
              x={x}
              y={height - 6}
              textAnchor="middle"
              fontSize="11"
              fill="#9fa3aa"
            >
              {tick}%
            </text>
          </g>
        );
      })}
      {rows.map((row, index) => {
        const y = index * rowH + 4;
        const barW = Math.max(2, (row.value / peak) * chartW);
        return (
          <g key={row.range}>
            <text
              x={labelW - 8}
              y={y + 14}
              textAnchor="end"
              fontSize="11"
              fill="#9fa3aa"
            >
              {row.range}
            </text>
            <rect
              x={labelW}
              y={y + 2}
              width={barW}
              height={16}
              rx={4}
              fill="#1e3a5f"
              className="cursor-pointer"
              opacity={tip?.label === row.range ? 1 : 0.92}
              onMouseEnter={() =>
                setTip({
                  x: labelW + barW,
                  y: y + 10,
                  label: row.range,
                  value: row.value,
                })
              }
            />
          </g>
        );
      })}
      {tip ? (
        <g pointerEvents="none">
          <rect
            x={Math.min(tip.x + 8, width - 120)}
            y={Math.max(4, tip.y - 28)}
            width={112}
            height={36}
            rx={6}
            fill="#151515"
            opacity="0.92"
          />
          <text
            x={Math.min(tip.x + 18, width - 110)}
            y={Math.max(18, tip.y - 14)}
            fontSize="11"
            fill="#ffffff"
          >
            {tip.label}
          </text>
          <text
            x={Math.min(tip.x + 18, width - 110)}
            y={Math.max(32, tip.y)}
            fontSize="11"
            fill="#d6d3cd"
          >
            {tip.value}%
          </text>
        </g>
      ) : null}
    </svg>
  );
}
