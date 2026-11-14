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
  "var(--color-ink-muted)",
  "var(--color-ink)",
  "var(--color-navy-soft)",
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

/**
 * Sales vs new listings, the paired bars on the HomeAtlas market page.
 * Sales are closed transactions; listings are new active catalogue rows.
 */
export function SalesListingsChart({
  rows,
}: {
  rows: Array<{ month: string; sales: number; listings: number }>;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const points = rows.filter((row) => row.sales > 0 || row.listings > 0);
  if (points.length < 2) {
    return (
      <p className="rounded-control bg-surface-alt px-4 py-8 text-center text-small text-ink-muted">
        Not enough months to compare sales and new listings.
      </p>
    );
  }

  const width = 640;
  const height = 200;
  const inset = { top: 12, right: 8, bottom: 28, left: 36 };
  const plotW = width - inset.left - inset.right;
  const plotH = height - inset.top - inset.bottom;
  const max = Math.max(...points.flatMap((row) => [row.sales, row.listings]), 1);
  const group = plotW / points.length;
  const bar = Math.min(14, group * 0.28);

  const y = (value: number) => inset.top + plotH - (value / max) * plotH;
  const h = (value: number) => (value / max) * plotH;

  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Sales compared with new listings"
        onMouseLeave={() => setTip(null)}
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
          const cx = inset.left + group * i + group / 2;
          const tipY = Math.min(y(row.sales), y(row.listings));
          const month = formatMonthLabel(row.month);
          const active = tip?.lines[0] === month;
          return (
            <g
              key={row.month}
              className="cursor-pointer"
              opacity={tip && !active ? 0.55 : 1}
              onMouseEnter={() =>
                setTip({
                  x: cx,
                  y: tipY,
                  lines: [
                    month,
                    `Sales ${formatNumber(row.sales)}`,
                    `New listings ${formatNumber(row.listings)}`,
                  ],
                })
              }
            >
              <rect x={cx - group / 2} y={inset.top} width={group} height={plotH} fill="transparent" />
              <rect
                x={cx - bar - 1}
                y={y(row.sales)}
                width={bar}
                height={Math.max(h(row.sales), 2)}
                rx="3"
                fill="var(--color-navy)"
              />
              <rect
                x={cx + 1}
                y={y(row.listings)}
                width={bar}
                height={Math.max(h(row.listings), 2)}
                rx="3"
                fill="#e8e8e8"
              />
              <text x={cx} y={height - 8} textAnchor="middle" className="fill-[var(--color-ink-subtle)] text-[10px]">
                {axisMonth(row.month).split(" ")[0]}
              </text>
            </g>
          );
        })}
        <ChartTooltip tip={tip} width={width} />
      </svg>
      <figcaption className="mt-3 flex gap-4 text-[12px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-navy" /> Sales
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#e8e8e8]" /> New listings
        </span>
        <table className="sr-only">
          <caption>Sales and new listings by month</caption>
          <thead>
            <tr>
              <th>Month</th>
              <th>Sales</th>
              <th>New listings</th>
            </tr>
          </thead>
          <tbody>
            {points.map((row) => (
              <tr key={row.month}>
                <th>{formatMonthLabel(row.month)}</th>
                <td>{formatNumber(row.sales)}</td>
                <td>{formatNumber(row.listings)}</td>
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

/**
 * Property type distribution — share of active listings by subtype.
 * Replaces the old donut "mix" chart with count + % bars so the split is obvious.
 */
export function PropertyTypeDistribution({ rows }: { rows: Array<{ name: string; count: number }> }) {
  const [active, setActive] = useState<number | null>(null);
  const items = [...rows]
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const total = items.reduce((sum, row) => sum + row.count, 0);
  if (total === 0) return null;

  const slices = items.map((item, index) => ({
    ...item,
    pct: (item.count / total) * 100,
    color: MIX_COLORS[index % MIX_COLORS.length],
  }));

  return (
    <div className="space-y-4" onMouseLeave={() => setActive(null)}>
      <p className="text-[13px] text-ink-muted">
        {formatNumber(total)} active listing{total === 1 ? "" : "s"} in this catalogue
      </p>
      <ul className="space-y-3" aria-label="Property type distribution">
        {slices.map((slice, index) => {
          const isActive = active === null || active === index;
          return (
            <li
              key={slice.name}
              className="space-y-1.5 transition-opacity"
              style={{ opacity: isActive ? 1 : 0.45 }}
              onMouseEnter={() => setActive(index)}
            >
              <div className="flex items-baseline justify-between gap-3 text-small">
                <span className="flex min-w-0 items-center gap-2 font-medium text-ink">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
                  <span className="truncate">{slice.name}</span>
                </span>
                <span className="shrink-0 tabular-nums text-ink-muted">
                  <span className="font-semibold text-ink">{Math.round(slice.pct)}%</span>
                  <span className="mx-1.5 text-ink-subtle">·</span>
                  {formatNumber(slice.count)}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-alt">
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{ width: `${Math.max(slice.pct, 1.5)}%`, background: slice.color }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** @deprecated Prefer PropertyTypeDistribution — kept for older imports. */
export const TypeMix = PropertyTypeDistribution;
