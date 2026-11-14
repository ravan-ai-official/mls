"use client";

import { useId, useState } from "react";
import { formatPrice } from "@/lib/utils/format";

const TYPE_COLORS = ["#1e3a5f", "#c7a45a", "#6f7682", "#151515", "#d6d3cd", "#8aa0b8"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
        <text key={line} x={x + 10} y={y + 18 + index * 16} fontSize="11" fill="#ffffff">
          {line}
        </text>
      ))}
    </g>
  );
}

function monthLabel(iso: string): string {
  const [year, month] = iso.split("-");
  const index = Number(month) - 1;
  if (!year || index < 0 || index > 11) return iso;
  return `${MONTHS[index]} '${year.slice(2)}`;
}

function compactMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(value / 1000)}K`;
}

export function TrendChart({
  points,
  city,
}: {
  points: Array<{ month: string; median: number; mean: number | null }>;
  city: string | null;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const width = 560;
  const height = 220;
  const left = 52;
  const right = 12;
  const top = 16;
  const bottom = 32;
  const innerW = width - left - right;
  const innerH = height - top - bottom;
  const values = points.flatMap((point) =>
    point.mean !== null ? [point.median, point.mean] : [point.median],
  );
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const yOf = (value: number) => top + innerH - ((value - min) / span) * innerH;
  const xOf = (index: number) =>
    left + (points.length <= 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
  const median = points.map((point, index) => `${xOf(index)},${yOf(point.median)}`).join(" ");
  const area = `${left},${top + innerH} ${median} ${xOf(points.length - 1)},${top + innerH}`;
  const mean = points
    .map((point, index) => (point.mean === null ? null : `${xOf(index)},${yOf(point.mean)}`))
    .filter((point): point is string => point !== null)
    .join(" ");
  const ticks = [0, 1, 2, 3].map((step) => min + (span * step) / 3);

  return (
    <div className="rounded-2xl border border-line p-4 sm:p-5">
      <h3 className="mb-1 text-[15px] font-semibold text-ink">
        Community Median Price{city ? ` — ${city}` : ""}
      </h3>
      <div className="mb-3 flex flex-wrap gap-4 text-[12px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-navy" /> Median
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-gold" /> Average
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-56 w-full"
        role="img"
        aria-label="Median and average asking price"
        onMouseLeave={() => {
          setTip(null);
          setActive(null);
        }}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={left} x2={width - right} y1={yOf(tick)} y2={yOf(tick)} stroke="#f0f0f0" />
            <text x={left - 8} y={yOf(tick) + 3} textAnchor="end" fontSize="11" fill="#9fa3aa">
              {compactMoney(tick)}
            </text>
          </g>
        ))}
        <polygon points={area} fill="#1e3a5f" opacity="0.15" />
        <polyline fill="none" stroke="#1e3a5f" strokeWidth="2" points={median} />
        {mean ? (
          <polyline fill="none" stroke="#c7a45a" strokeWidth="2" strokeDasharray="4 4" points={mean} />
        ) : null}
        {points.map((point, index) =>
          index % Math.ceil(points.length / 6) === 0 || index === points.length - 1 ? (
            <text key={point.month} x={xOf(index)} y={height - 8} textAnchor="middle" fontSize="11" fill="#9fa3aa">
              {monthLabel(point.month)}
            </text>
          ) : null,
        )}
        {points.map((point, index) => {
          const x = xOf(index);
          const y = yOf(point.median);
          return (
            <g key={`point-${point.month}`}>
              <circle
                cx={x}
                cy={y}
                r={12}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => {
                  setActive(index);
                  setTip({
                    x,
                    y,
                    lines: [
                      monthLabel(point.month),
                      `Median ${formatPrice(point.median)}`,
                      point.mean !== null ? `Average ${formatPrice(point.mean)}` : "Average —",
                    ],
                  });
                }}
              />
              <circle cx={x} cy={y} r={active === index ? 4.5 : 3} fill="#1e3a5f" />
            </g>
          );
        })}
        <ChartTooltip tip={tip} width={width} />
      </svg>
    </div>
  );
}

export function PriceDistribution({
  sold,
  asking,
  city,
}: {
  sold: Array<number | null>;
  asking: Array<number | null>;
  city: string | null;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const soldValues = sold.filter((price): price is number => price !== null && price > 0);
  const askingValues = asking.filter((price): price is number => price !== null && price > 0);
  const values = soldValues.length >= 3 ? soldValues : askingValues;
  if (values.length < 3) return null;
  const soldChart = soldValues.length >= 3;
  const buckets = priceBuckets(values);
  const peak = Math.max(...buckets.map((bucket) => bucket.count), 1);
  const width = 560;
  const height = 200;
  const left = 36;
  const right = 8;
  const top = 12;
  const bottom = 36;
  const innerW = width - left - right;
  const innerH = height - top - bottom;
  const gap = 10;
  const barW = (innerW - gap * (buckets.length - 1)) / buckets.length;

  return (
    <div className="rounded-2xl border border-line p-4 sm:p-5">
      <h3 className="mb-1 text-[15px] font-semibold text-ink">
        {soldChart ? "Sold Price Distribution" : "Asking Price Distribution"}
      </h3>
      <p className="mb-4 text-[12px] text-ink-muted">
        {soldChart ? "Recent sold listings" : "Active listings"}
        {city ? ` in ${city}` : ""} in this catalogue.
      </p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-48 w-full"
        role="img"
        aria-label="Price distribution"
        onMouseLeave={() => setTip(null)}
      >
        {[0, peak].map((tick) => {
          const y = top + innerH - (tick / peak) * innerH;
          return (
            <g key={tick}>
              <line x1={left} x2={width - right} y1={y} y2={y} stroke="#f0f0f0" />
              <text x={left - 6} y={y + 3} textAnchor="end" fontSize="11" fill="#9fa3aa">
                {tick}
              </text>
            </g>
          );
        })}
        {buckets.map((bucket, index) => {
          const barH = (bucket.count / peak) * innerH;
          const x = left + index * (barW + gap);
          const y = top + innerH - barH;
          return (
            <g key={bucket.label}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(barH, 2)}
                rx="4"
                fill="#1e3a5f"
                className="cursor-pointer"
                opacity={tip?.lines[0] === bucket.label ? 1 : 0.92}
                onMouseEnter={() =>
                  setTip({
                    x: x + barW / 2,
                    y,
                    lines: [bucket.label, `${bucket.count} listing${bucket.count === 1 ? "" : "s"}`],
                  })
                }
              />
              <text x={x + barW / 2} y={height - 10} textAnchor="middle" fontSize="11" fill="#9fa3aa">
                {bucket.label}
              </text>
            </g>
          );
        })}
        <ChartTooltip tip={tip} width={width} />
      </svg>
    </div>
  );
}

function priceBuckets(values: number[]): Array<{ label: string; count: number }> {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = Math.max(50_000, Math.ceil((max - min) / 5 / 50_000) * 50_000);
  const start = Math.floor(min / step) * step;
  const buckets = Array.from({ length: 5 }, (_, index) => ({
    from: start + index * step,
    count: 0,
  }));
  for (const value of values) {
    const index = Math.min(4, Math.floor((value - start) / step));
    buckets[Math.max(0, index)].count += 1;
  }
  return buckets.map((bucket) => ({
    label: compactMoney(bucket.from),
    count: bucket.count,
  }));
}

function piePaths(counts: number[]): string[] {
  const total = counts.reduce((sum, count) => sum + count, 0) || 1;
  const cx = 80;
  const cy = 80;
  const radius = 72;
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
    if (count >= total) return `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.01} ${cy - radius} Z`;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`;
  });
}

export function TypeSplit({
  slices,
  city,
}: {
  slices: Array<{ name: string; count: number }>;
  city: string | null;
}) {
  const tipId = useId();
  const [active, setActive] = useState<number | null>(null);
  const total = slices.reduce((sum, slice) => sum + slice.count, 0) || 1;
  const pie = piePaths(slices.map((slice) => slice.count));
  const tip = active !== null ? slices[active] : null;

  return (
    <div className="rounded-2xl border border-line p-4 sm:p-5">
      <h3 className="mb-1 text-[15px] font-semibold text-ink">
        Property Type Distribution{city ? ` — ${city}` : ""}
      </h3>
      <p className="mb-4 text-[12px] text-ink-muted">
        Active listings by home type — Detached, Semi-detached, townhouse, condo and Other.
      </p>
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <div className="relative shrink-0">
          <svg
            viewBox="0 0 160 160"
            className="h-40 w-40"
            role="img"
            aria-label="Property type split"
            onMouseLeave={() => setActive(null)}
          >
            {pie.map((slice, index) => (
              <path
                key={slices[index]?.name ?? index}
                d={slice}
                fill={TYPE_COLORS[index % TYPE_COLORS.length]}
                opacity={active === null || active === index ? 1 : 0.55}
                className="cursor-pointer transition-opacity"
                onMouseEnter={() => setActive(index)}
              >
                <title>{`${slices[index]?.name}: ${slices[index]?.count} (${Math.round(((slices[index]?.count ?? 0) / total) * 100)}%)`}</title>
              </path>
            ))}
          </svg>
          {tip ? (
            <div
              id={tipId}
              className="pointer-events-none absolute left-1/2 top-1/2 z-10 w-max -translate-x-1/2 -translate-y-1/2 rounded-md bg-ink px-2.5 py-1.5 text-[11px] text-white shadow-pop"
            >
              <p className="font-medium">{tip.name}</p>
              <p className="text-white/80">
                {tip.count} · {Math.round((tip.count / total) * 100)}%
              </p>
            </div>
          ) : null}
        </div>
        <ul className="w-full flex-1 space-y-2.5">
          {slices.map((slice, index) => (
            <li
              key={slice.name}
              className="flex items-center gap-3 text-[13px]"
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ background: TYPE_COLORS[index % TYPE_COLORS.length] }}
              />
              <span className="min-w-0 flex-1 truncate text-ink">{slice.name}</span>
              <span className="tabular-nums text-ink-muted">
                <span className="font-semibold text-ink">{Math.round((slice.count / total) * 100)}%</span>
                <span className="mx-1 text-ink-subtle">·</span>
                {slice.count}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
