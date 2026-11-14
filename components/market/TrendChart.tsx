"use client";

import { useState } from "react";
import { formatMonthLabel, formatNumber, formatPrice, formatPriceCompact } from "@/lib/utils/format";

/** One month on the chart. `detail` is an extra column for the screen-reader table. */
export interface ChartPoint {
  month: string;
  value: number | null;
  detail?: number | null;
}

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
 * Monthly price line chart (median list price, median sold price).
 * Hover a point to see the exact month value.
 */
export function TrendChart({
  series,
  label,
  detailLabel,
  height = 280,
  dots = "end",
}: {
  series: ChartPoint[];
  /** What the line measures, e.g. "Median sold price". */
  label: string;
  /** Heading for `detail` in the accessible table, when points carry one. */
  detailLabel?: string;
  height?: number;
  /** `end` marks only the latest month. `all` marks every month. */
  dots?: "end" | "all" | "none";
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const points = series.filter((point): point is ChartPoint & { value: number } => point.value !== null);

  if (points.length < 2) {
    return (
      <p className="rounded-control bg-surface-alt px-4 py-8 text-center text-small text-ink-muted">
        Not enough data to chart a trend for this area yet.
      </p>
    );
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Pad the domain so the line never sits flat against an edge.
  const pad = (max - min) * 0.15 || max * 0.05 || 1;
  const lo = Math.max(0, min - pad);
  const hi = max + pad;

  const width = 720;
  const inset = { top: 16, right: 16, bottom: 28, left: 56 };
  const plotW = width - inset.left - inset.right;
  const plotH = height - inset.top - inset.bottom;

  const x = (i: number) => inset.left + (i / (points.length - 1)) * plotW;
  const y = (value: number) => inset.top + plotH - ((value - lo) / (hi - lo)) * plotH;

  const line = points
    .map((point, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(point.value).toFixed(1)}`)
    .join(" ");

  const area = `${line} L${x(points.length - 1).toFixed(1)},${(inset.top + plotH).toFixed(1)} L${x(0).toFixed(1)},${(inset.top + plotH).toFixed(1)} Z`;

  // Four horizontal gridlines including both bounds.
  const ticks = Array.from({ length: 4 }, (_, i) => lo + ((hi - lo) * i) / 3);

  const first = values[0];
  const last = values[values.length - 1];
  const changePct = first > 0 ? ((last - first) / first) * 100 : 0;

  return (
    <figure className="space-y-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${label} from ${formatMonthLabel(points[0].month)} to ${formatMonthLabel(points[points.length - 1].month)}, changing ${changePct >= 0 ? "up" : "down"} ${Math.abs(changePct).toFixed(1)} percent.`}
        onMouseLeave={() => {
          setTip(null);
          setActive(null);
        }}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={inset.left}
              x2={width - inset.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--color-line)"
              strokeWidth="1"
            />
            <text
              x={inset.left - 8}
              y={y(tick) + 4}
              textAnchor="end"
              className="fill-[var(--color-ink-subtle)] text-[10px]"
            >
              {formatPriceCompact(tick)}
            </text>
          </g>
        ))}

        <path d={area} fill="var(--color-navy)" opacity="0.07" />
        <path
          d={line}
          fill="none"
          stroke="var(--color-navy)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((point, i) => {
          const cx = x(i);
          const cy = y(point.value);
          const showDot = dots === "all" || (dots === "end" && i === points.length - 1) || active === i;
          return (
            <g key={point.month}>
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
                    lines: [
                      formatMonthLabel(point.month),
                      `${label} ${formatPrice(point.value)}`,
                      ...(detailLabel && point.detail != null
                        ? [`${detailLabel} ${formatNumber(point.detail)}`]
                        : []),
                    ],
                  });
                }}
              />
              {showDot ? (
                <circle
                  cx={cx}
                  cy={cy}
                  r={active === i || i === points.length - 1 ? 4.5 : 2.5}
                  fill={
                    active === i || i === points.length - 1 ? "var(--color-gold)" : "var(--color-navy)"
                  }
                />
              ) : null}
            </g>
          );
        })}

        {points.map((point, i) =>
          // Label roughly six ticks to avoid crowding on narrow screens.
          i % Math.ceil(points.length / 6) === 0 || i === points.length - 1 ? (
            <text
              key={`label-${point.month}`}
              x={x(i)}
              y={height - 8}
              textAnchor="middle"
              className="fill-[var(--color-ink-subtle)] text-[10px]"
            >
              {formatMonthLabel(point.month)}
            </text>
          ) : null,
        )}

        <ChartTooltip tip={tip} width={width} />
      </svg>

      <figcaption className="sr-only">
        <table>
          <caption>{label} by month</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">{label}</th>
              {detailLabel && <th scope="col">{detailLabel}</th>}
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.month}>
                <th scope="row">{formatMonthLabel(point.month)}</th>
                <td>{formatPriceCompact(point.value)}</td>
                {detailLabel && <td>{point.detail ?? ""}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}

/** Horizontal bar breakdown used for bedroom / property-type segmentation. */
export function SegmentBars({
  data,
  label,
}: {
  data: Array<{ name: string; count: number }>;
  label: string;
}) {
  const rows = data.filter((row) => row.count > 0).slice(0, 6);
  if (rows.length === 0) return null;

  const max = Math.max(...rows.map((row) => row.count));

  return (
    <div>
      <h3 className="text-h3 text-ink">{label}</h3>
      <dl className="mt-4 space-y-2.5">
        {rows.map((row) => (
          <div key={row.name} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-3">
            <dt className="truncate text-caption text-ink-muted" title={row.name}>
              {row.name}
            </dt>
            <dd className="h-2 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-navy"
                style={{ width: `${(row.count / max) * 100}%` }}
              />
            </dd>
            <dd className="text-right text-caption text-ink">
              {row.count.toLocaleString("en-CA")}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
