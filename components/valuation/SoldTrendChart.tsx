"use client";

import { useId, useState } from "react";
import type { ValuationTrendPoint } from "@/lib/api/valuation";
import { smoothAreaPath, smoothLinePath } from "@/lib/utils/chartPath";
import { formatMonthLabel, formatPercent, formatPrice, formatPriceCompact } from "@/lib/utils/format";

const LINE = "#1b2e4b";

type Tip = { x: number; y: number; lines: string[] };

function ChartTooltip({ tip, width }: { tip: Tip | null; width: number }) {
  if (!tip) return null;
  const boxW = Math.min(220, Math.max(...tip.lines.map((line) => line.length)) * 7.1 + 24);
  const boxH = tip.lines.length * 17 + 16;
  const x = Math.min(Math.max(8, tip.x - boxW / 2), width - boxW - 8);
  const y = Math.max(8, tip.y - boxH - 14);
  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width={boxW} height={boxH} rx={8} fill="#151515" opacity="0.94" />
      {tip.lines.map((line, index) => (
        <text
          key={`${index}-${line}`}
          x={x + 12}
          y={y + 20 + index * 17}
          fontSize="11"
          fill={index === 0 ? "#ffffff" : "rgba(255,255,255,0.82)"}
          fontWeight={index === 0 ? 600 : 400}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

/**
 * Readable local sold-price trend for the home-evaluation result.
 * Axes, month ticks, hover tooltips, and a one-line summary of change.
 */
export function SoldTrendChart({
  points,
  trendPct,
  trendLabel,
}: {
  points: ValuationTrendPoint[];
  trendPct: number;
  trendLabel: string;
}) {
  const gradId = useId().replace(/:/g, "");
  const [tip, setTip] = useState<Tip | null>(null);
  const [active, setActive] = useState<number | null>(null);

  const spark = points.filter((point) => point.medianSoldPrice != null && point.month);
  // Caller hides the whole "Local sold trend" card when there is nothing to chart.
  if (spark.length < 2) return null;

  const width = 560;
  const height = 240;
  const left = 54;
  const right = 14;
  const top = 18;
  const bottom = 36;
  const innerW = width - left - right;
  const innerH = height - top - bottom;
  const baseY = top + innerH;

  const values = spark.map((point) => point.medianSoldPrice!);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || max * 0.08 || 1;
  const lo = Math.max(0, min - span * 0.18);
  const hi = max + span * 0.14;
  const yOf = (value: number) => top + innerH - ((value - lo) / (hi - lo)) * innerH;
  const xOf = (index: number) =>
    left + (spark.length <= 1 ? innerW / 2 : (index / (spark.length - 1)) * innerW);

  const coords = spark.map((point, index) => ({
    x: xOf(index),
    y: yOf(point.medianSoldPrice!),
  }));
  const line = smoothLinePath(coords);
  const area = smoothAreaPath(coords, baseY);
  const ticks = [0, 1, 2, 3, 4].map((step) => lo + ((hi - lo) * step) / 4);
  const labelEvery = Math.max(1, Math.ceil(spark.length / 5));

  const first = spark[0]!.medianSoldPrice!;
  const latest = spark[spark.length - 1]!.medianSoldPrice!;
  const latestMonth = spark[spark.length - 1]!.month;
  const changeFromStart = first > 0 ? ((latest - first) / first) * 100 : 0;

  return (
    <div className="mt-5">
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat
          label="Latest median"
          value={formatPriceCompact(latest)}
          hint={formatMonthLabel(latestMonth)}
        />
        <Stat
          label={trendLabel}
          value={formatPercent(trendPct)}
          hint={trendPct < 0 ? "Prices softened" : trendPct > 0 ? "Prices rose" : "Flat nearby"}
          tone={trendPct < 0 ? "down" : trendPct > 0 ? "up" : "flat"}
        />
        <Stat
          label="Chart span"
          value={formatPercent(changeFromStart)}
          hint={`${formatMonthLabel(spark[0]!.month)} → ${formatMonthLabel(latestMonth)}`}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <p className="mb-2 text-caption text-ink-muted">
        Hover or tap a month to see the exact median sold price
        {spark.some((p) => p.unitsSold != null) ? " and sales count" : ""}.
      </p>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-52 w-full sm:h-56"
        role="img"
        aria-label={`Local median sold price from ${formatMonthLabel(spark[0]!.month)} to ${formatMonthLabel(latestMonth)}`}
        onMouseLeave={() => {
          setTip(null);
          setActive(null);
        }}
      >
        <defs>
          <linearGradient id={`sold-trend-fill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={LINE} stopOpacity="0.22" />
            <stop offset="55%" stopColor={LINE} stopOpacity="0.06" />
            <stop offset="100%" stopColor={LINE} stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={left}
              x2={width - right}
              y1={yOf(tick)}
              y2={yOf(tick)}
              stroke="#ececec"
              strokeDasharray="4 4"
            />
            <text x={left - 8} y={yOf(tick) + 3} textAnchor="end" fontSize="11" fill="#9fa3aa">
              {formatPriceCompact(tick)}
            </text>
          </g>
        ))}

        <path d={area} fill={`url(#sold-trend-fill-${gradId})`} />
        <path
          d={line}
          fill="none"
          stroke={LINE}
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {active !== null ? (
          <line
            x1={xOf(active)}
            x2={xOf(active)}
            y1={top}
            y2={baseY}
            stroke="#151515"
            strokeOpacity="0.12"
          />
        ) : null}

        {spark.map((point, index) =>
          index % labelEvery === 0 || index === spark.length - 1 ? (
            <text
              key={`label-${point.month}`}
              x={xOf(index)}
              y={height - 10}
              textAnchor="middle"
              fontSize="11"
              fill="#9fa3aa"
            >
              {formatMonthLabel(point.month)}
            </text>
          ) : null,
        )}

        {spark.map((point, index) => {
          const x = xOf(index);
          const y = yOf(point.medianSoldPrice!);
          const prev = index > 0 ? spark[index - 1]!.medianSoldPrice! : null;
          const monthChange =
            prev && prev > 0 ? ((point.medianSoldPrice! - prev) / prev) * 100 : null;
          const hitW = spark.length <= 1 ? 40 : innerW / (spark.length - 1);
          const showDot = active === index || index === spark.length - 1;

          return (
            <g key={`pt-${point.month}`}>
              <rect
                x={x - hitW / 2}
                y={top}
                width={hitW}
                height={innerH}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => {
                  setActive(index);
                  setTip({
                    x,
                    y,
                    lines: [
                      formatMonthLabel(point.month),
                      `Median sold  ${formatPrice(point.medianSoldPrice)}`,
                      point.unitsSold != null ? `Homes sold  ${point.unitsSold}` : "Homes sold  —",
                      monthChange != null ? `Vs prior month  ${formatPercent(monthChange)}` : "First month in range",
                    ],
                  });
                }}
              />
              {showDot ? (
                <circle
                  cx={x}
                  cy={y}
                  r={active === index ? 5 : 3.5}
                  fill={LINE}
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              ) : null}
            </g>
          );
        })}

        <ChartTooltip tip={tip} width={width} />
      </svg>

      {active !== null && spark[active] ? (
        <p className="mt-2 rounded-control bg-surface-alt px-3 py-2 text-caption text-ink sm:hidden">
          <span className="font-semibold">{formatMonthLabel(spark[active]!.month)}</span>
          {" · "}
          {formatPrice(spark[active]!.medianSoldPrice)}
          {spark[active]!.unitsSold != null ? ` · ${spark[active]!.unitsSold} sold` : ""}
        </p>
      ) : (
        <p className="mt-2 text-caption text-ink-subtle sm:hidden">Tap a point on the chart for details.</p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "flat",
  className = "",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "up" | "down" | "flat";
  className?: string;
}) {
  return (
    <div className={`rounded-control border border-line bg-surface-alt/50 px-3 py-2.5 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-ink-muted">{label}</p>
      <p
        className={
          tone === "up"
            ? "mt-1 text-body font-semibold text-positive"
            : tone === "down"
              ? "mt-1 text-body font-semibold text-negative"
              : "mt-1 text-body font-semibold text-ink"
        }
      >
        {value}
      </p>
      <p className="mt-0.5 text-caption text-ink-subtle">{hint}</p>
    </div>
  );
}
