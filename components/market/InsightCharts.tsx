"use client";

import { useState } from "react";
import { formatMonthLabel, formatNumber } from "@/lib/utils/format";

/** "Sep 2024" → "Sep '24", for crowded chart axes. */
function axisMonth(value: string): string {
  const label = formatMonthLabel(value);
  const [month, year] = label.split(" ");
  if (!month || !year || year.length < 2) return label;
  return `${month} '${year.slice(-2)}`;
}

const MIX_COLORS = [
  "var(--color-navy)",
  "var(--color-gold)",
  "#5b7c99",
  "var(--color-ink)",
  "var(--color-navy-soft)",
  "var(--color-ink-muted)",
];

type Tip = { x: number; y: number; lines: string[] };

function ChartTooltip({ tip, width }: { tip: Tip | null; width: number }) {
  if (!tip) return null;
  const boxW = Math.max(...tip.lines.map((line) => line.length)) * 7.2 + 20;
  const boxH = tip.lines.length * 16 + 14;
  const x = Math.min(Math.max(8, tip.x - boxW / 2), width - boxW - 8);
  const y = Math.max(8, tip.y - boxH - 12);
  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width={boxW} height={boxH} rx={6} fill="#151515" opacity="0.92" />
      {tip.lines.map((line, index) => (
        <text key={`${index}-${line}`} x={x + 10} y={y + 18 + index * 16} fontSize="11" fill="#ffffff">
          {line}
        </text>
      ))}
    </g>
  );
}

/** Smooth open curve through points (Catmull-Rom → cubic Bézier). */
function smoothLinePath(coords: Array<{ x: number; y: number }>): string {
  if (coords.length === 0) return "";
  if (coords.length === 1) return `M${coords[0].x},${coords[0].y}`;
  if (coords.length === 2) {
    return `M${coords[0].x},${coords[0].y} L${coords[1].x},${coords[1].y}`;
  }
  let d = `M${coords[0].x},${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i - 1] ?? coords[i];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

/**
 * Sold bars with Active and New Listing as curves on the Market Insights page.
 * Sold = closed transactions; New Listing = new catalogue rows that month;
 * Active = open inventory when provided for that month.
 */
export function SalesListingsChart({
  rows,
}: {
  rows: Array<{ month: string; sold: number; active: number; newListings: number }>;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const points = rows.filter((row) => row.sold > 0 || row.active > 0 || row.newListings > 0);
  if (points.length < 2) {
    return (
      <p className="rounded-control bg-surface-alt px-4 py-8 text-center text-small text-ink-muted">
        Not enough months to compare sold, active and new listings.
      </p>
    );
  }

  const width = 640;
  const height = 210;
  const inset = { top: 14, right: 10, bottom: 36, left: 36 };
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));
  const plotW = width - inset.left - inset.right;
  const plotH = height - inset.top - inset.bottom;
  const max = Math.max(
    ...points.flatMap((row) => [row.sold, row.active, row.newListings]),
    1,
  );
  const group = plotW / points.length;
  const bar = Math.min(18, group * 0.42);

  const xAt = (i: number) => inset.left + group * i + group / 2;
  const y = (value: number) => inset.top + plotH - (value / max) * plotH;
  const h = (value: number) => (value / max) * plotH;

  const SOLD = "var(--color-navy)";
  const ACTIVE = "var(--color-gold)";
  const NEW = "#5b7c99";

  const newCoords = points.map((row, i) => ({ x: xAt(i), y: y(row.newListings) }));
  // Active inventory is often only known for the latest month — still draw a
  // curve through the series so the legend stays consistent.
  const activeCoords = points.map((row, i) => ({ x: xAt(i), y: y(row.active) }));
  const hasActiveSeries = points.some((row) => row.active > 0);
  const newPath = smoothLinePath(newCoords);
  const activePath = hasActiveSeries ? smoothLinePath(activeCoords) : "";

  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Sold bars with active and new listing curves by month"
        onMouseLeave={() => {
          setTip(null);
          setActiveIndex(null);
        }}
      >
        {[0, 0.5, 1].map((tick) => (
          <line
            key={tick}
            x1={inset.left}
            x2={width - inset.right}
            y1={y(max * tick)}
            y2={y(max * tick)}
            stroke="var(--color-line)"
            strokeDasharray="3 3"
          />
        ))}

        {points.map((row, i) => {
          const cx = xAt(i);
          return (
            <g key={`sold-${row.month}`}>
              <rect
                x={cx - bar / 2}
                y={y(row.sold)}
                width={bar}
                height={Math.max(h(row.sold), row.sold > 0 ? 2 : 0)}
                rx="2"
                fill={SOLD}
                opacity={activeIndex === null || activeIndex === i ? 0.9 : 0.35}
              />
            </g>
          );
        })}

        {newPath ? (
          <path
            d={newPath}
            fill="none"
            stroke={NEW}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {activePath ? (
          <path
            d={activePath}
            fill="none"
            stroke={ACTIVE}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {points.map((row, i) => {
          const cx = xAt(i);
          const month = formatMonthLabel(row.month);
          const tipY = Math.min(
            y(Math.max(row.sold, 1)),
            y(Math.max(row.active, 1)),
            y(Math.max(row.newListings, 1)),
          );
          const showDot = activeIndex === i || i === points.length - 1;
          return (
            <g
              key={row.month}
              className="cursor-pointer"
              onMouseEnter={() => {
                setActiveIndex(i);
                setTip({
                  x: cx,
                  y: tipY,
                  lines: [
                    month,
                    `Sold ${formatNumber(row.sold)}`,
                    `Active ${formatNumber(row.active)}`,
                    `New listing ${formatNumber(row.newListings)}`,
                  ],
                });
              }}
            >
              <rect x={cx - group / 2} y={inset.top} width={group} height={plotH} fill="transparent" />
              {showDot ? (
                <>
                  <circle cx={cx} cy={y(row.newListings)} r={activeIndex === i ? 4.5 : 3.5} fill={NEW} stroke="#fff" strokeWidth="1.5" />
                  {row.active > 0 || activeIndex === i ? (
                    <circle cx={cx} cy={y(row.active)} r={activeIndex === i ? 4.5 : 3.5} fill={ACTIVE} stroke="#fff" strokeWidth="1.5" />
                  ) : null}
                </>
              ) : null}
              {i % labelEvery === 0 || i === points.length - 1 ? (
                <text
                  x={cx}
                  y={height - 10}
                  textAnchor="middle"
                  className="fill-[var(--color-ink-subtle)] text-[9px]"
                >
                  {axisMonth(row.month)}
                </text>
              ) : null}
            </g>
          );
        })}
        <ChartTooltip tip={tip} width={width} />
      </svg>
      <figcaption className="mt-3 flex flex-wrap gap-4 text-[12px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-navy" /> Sold
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded-full bg-gold" /> Active
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded-full bg-[#5b7c99]" /> New listing
        </span>
        <table className="sr-only">
          <caption>Sold, active and new listings by month</caption>
          <thead>
            <tr>
              <th>Month</th>
              <th>Sold</th>
              <th>Active</th>
              <th>New listing</th>
            </tr>
          </thead>
          <tbody>
            {points.map((row) => (
              <tr key={row.month}>
                <th>{formatMonthLabel(row.month)}</th>
                <td>{formatNumber(row.sold)}</td>
                <td>{formatNumber(row.active)}</td>
                <td>{formatNumber(row.newListings)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}

/** Average days on market, the gold line beside the sales bars. */
export function DaysOnMarketChart({
  rows,
}: {
  rows: Array<{ month: string; days: number }>;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const [active, setActive] = useState<number | null>(null);

  if (rows.length < 2) {
    return (
      <p className="rounded-control bg-surface-alt px-4 py-8 text-center text-small text-ink-muted">
        Not enough months to chart days on market.
      </p>
    );
  }

  const width = 640;
  const height = 200;
  const inset = { top: 16, right: 12, bottom: 28, left: 32 };
  const plotW = width - inset.left - inset.right;
  const plotH = height - inset.top - inset.bottom;
  const values = rows.map((row) => row.days);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.2 || 2;
  const lo = Math.max(0, min - pad);
  const hi = max + pad;
  const x = (i: number) => inset.left + (i / (rows.length - 1)) * plotW;
  const y = (value: number) => inset.top + plotH - ((value - lo) / (hi - lo)) * plotH;
  const line = rows.map((row, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(row.days).toFixed(1)}`).join(" ");

  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Average days on market"
        onMouseLeave={() => {
          setTip(null);
          setActive(null);
        }}
      >
        {[0, 0.5, 1].map((tick) => {
          const value = lo + (hi - lo) * tick;
          return (
            <g key={tick}>
              <line
                x1={inset.left}
                x2={width - inset.right}
                y1={y(value)}
                y2={y(value)}
                stroke="var(--color-line)"
                strokeDasharray="3 3"
              />
              <text x={inset.left - 6} y={y(value) + 3} textAnchor="end" className="fill-[var(--color-ink-subtle)] text-[10px]">
                {Math.round(value)}
              </text>
            </g>
          );
        })}
        <path d={line} fill="none" stroke="var(--color-gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {rows.map((row, i) => {
          const cx = x(i);
          const cy = y(row.days);
          return (
            <g key={row.month}>
              <circle
                cx={cx}
                cy={cy}
                r={14}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => {
                  setActive(i);
                  setTip({
                    x: cx,
                    y: cy,
                    lines: [formatMonthLabel(row.month), `${Math.round(row.days)} days on market`],
                  });
                }}
              />
              <circle cx={cx} cy={cy} r={active === i ? 5 : 4} fill="var(--color-gold)" />
            </g>
          );
        })}
        {rows.map((row, i) =>
          i % Math.ceil(rows.length / 6) === 0 || i === rows.length - 1 ? (
            <text key={`l-${row.month}`} x={x(i)} y={height - 8} textAnchor="middle" className="fill-[var(--color-ink-subtle)] text-[10px]">
              {axisMonth(row.month)}
            </text>
          ) : null,
        )}
        <ChartTooltip tip={tip} width={width} />
      </svg>
      <table className="sr-only">
        <caption>Average days on market by month</caption>
        <thead>
          <tr>
            <th>Month</th>
            <th>Days</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.month}>
              <th>{formatMonthLabel(row.month)}</th>
              <td>{Math.round(row.days)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function piePaths(counts: number[]): string[] {
  const total = counts.reduce((sum, count) => sum + count, 0) || 1;
  const cx = 110;
  const cy = 110;
  const radius = 90;
  let angle = -Math.PI / 2;
  return counts.map((count) => {
    const sweep = (count / total) * Math.PI * 2;
    const start = angle;
    angle += sweep;
    const large = sweep > Math.PI ? 1 : 0;
    const x1 = cx + radius * Math.cos(start);
    const y1 = cy + radius * Math.sin(start);
    const x2 = cx + radius * Math.cos(angle);
    const y2 = cy + radius * Math.sin(angle);
    if (count >= total) {
      return `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.01} ${cy - radius} Z`;
    }
    return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`;
  });
}

/**
 * Property type distribution pie — Detached / Semi-detached / Freehold townhouse /
 * Condo townhouse / Condo apartment / Other. Legend always lists every type; the
 * pie only draws slices with count > 0.
 */
export function PropertyTypeDistribution({ rows }: { rows: Array<{ name: string; count: number }> }) {
  const [active, setActive] = useState<number | null>(null);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (total === 0) {
    return (
      <p className="rounded-control bg-surface-alt px-4 py-8 text-center text-small text-ink-muted">
        No active listings match this area yet.
      </p>
    );
  }

  const colorFor = (name: string, index: number) =>
    name === "Other" ? "var(--color-ink-muted)" : MIX_COLORS[index % MIX_COLORS.length];

  const legend = rows.map((item, index) => ({
    ...item,
    pct: (item.count / total) * 100,
    color: colorFor(item.name, index),
  }));
  const pieSlices = legend.filter((slice) => slice.count > 0);
  const paths = piePaths(pieSlices.map((slice) => slice.count));
  const tip = active !== null ? legend[active] : null;

  return (
    <div className="flex flex-col items-center gap-8 sm:flex-row" onMouseLeave={() => setActive(null)}>
      <div className="relative shrink-0">
        <svg
          viewBox="0 0 220 220"
          className="h-[220px] w-[220px]"
          role="img"
          aria-label="Property type distribution"
        >
          {paths.map((path, index) => {
            const slice = pieSlices[index];
            const legendIndex = legend.findIndex((row) => row.name === slice?.name);
            return (
              <path
                key={slice?.name ?? index}
                d={path}
                fill={slice?.color}
                opacity={active === null || active === legendIndex ? 1 : 0.45}
                className="cursor-pointer transition-opacity"
                onMouseEnter={() => setActive(legendIndex)}
              >
                <title>
                  {`${slice?.name}: ${formatNumber(slice?.count ?? 0)} (${Math.round(slice?.pct ?? 0)}%)`}
                </title>
              </path>
            );
          })}
        </svg>
        {tip && tip.count > 0 ? (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 w-max -translate-x-1/2 -translate-y-1/2 rounded-md bg-ink px-2.5 py-1.5 text-[11px] text-white shadow-pop">
            <p className="font-medium">{tip.name}</p>
            <p className="text-white/80">
              {formatNumber(tip.count)} · {Math.round(tip.pct)}%
            </p>
          </div>
        ) : null}
      </div>
      <div className="w-full flex-1 space-y-4">
        <p className="text-[13px] text-ink-muted">
          {formatNumber(total)} active listing{total === 1 ? "" : "s"} by home type
        </p>
        <ul className="space-y-3" aria-label="Property type shares">
          {legend.map((slice, index) => (
            <li
              key={slice.name}
              className="flex cursor-pointer items-center justify-between gap-4 text-small transition-opacity"
              style={{ opacity: active === null || active === index ? 1 : 0.45 }}
              onMouseEnter={() => setActive(index)}
            >
              <span className="flex min-w-0 items-center gap-2 font-medium text-ink">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: slice.color }} />
                <span className="truncate">{slice.name}</span>
              </span>
              <span className="shrink-0 tabular-nums text-ink-muted">
                <span className="font-semibold text-ink">{Math.round(slice.pct)}%</span>
                <span className="mx-1.5 text-ink-subtle">·</span>
                {formatNumber(slice.count)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** @deprecated Prefer PropertyTypeDistribution — kept for older imports. */
export const TypeMix = PropertyTypeDistribution;
