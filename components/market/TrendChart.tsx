"use client";

import { useState } from "react";
import { formatMonthLabel, formatNumber, formatPrice, formatPriceCompact } from "@/lib/utils/format";

/**
 * One month on the median-price combo chart.
 * `value` = median price (line, left axis).
 * `daysOnMarket` / `propertyDaysOnMarket` = stacked bars (right axis).
 * `detail` = optional tooltip extra (e.g. units sold).
 */
export interface ChartPoint {
  month: string;
  value: number | null;
  detail?: number | null;
  /** @deprecated Prefer `daysOnMarket`. Kept so older call sites still type-check. */
  secondary?: number | null;
  daysOnMarket?: number | null;
  propertyDaysOnMarket?: number | null;
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
      <rect x={x} y={y} width={boxW} height={boxH} rx={6} fill="#ffffff" stroke="#e5e5e5" />
      {tip.lines.map((line, index) => (
        <text
          key={`${index}-${line}`}
          x={x + 10}
          y={y + 18 + index * 16}
          fontSize="11"
          fill={index === 0 ? "#151515" : "#444444"}
          fontWeight={index === 0 ? 600 : 400}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

const DOM_COLOR = "#e8a04a";
const PDOM_COLOR = "#3d9b8f";
const PRICE_COLOR = "#2f5f9e";

/**
 * Median price line over stacked Days on Market / Property Days on Market bars
 * (HouseSigma-style dual-axis combo).
 */
export function TrendChart({
  series,
  label,
  detailLabel,
  secondaryLabel,
  height = 300,
  dots = "end",
}: {
  series: ChartPoint[];
  /** What the primary line measures, e.g. "Median price". */
  label: string;
  /** Heading for `detail` in the accessible table / tooltip. */
  detailLabel?: string;
  /** @deprecated Unused — legend uses fixed DOM / PDOM labels. */
  secondaryLabel?: string;
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
  const pad = (max - min) * 0.15 || max * 0.05 || 1;
  const lo = 0;
  const hi = max + pad;

  const domOf = (point: ChartPoint) => {
    const raw = point.daysOnMarket ?? point.secondary;
    return raw != null && Number.isFinite(raw) ? raw : null;
  };
  const pdomOf = (point: ChartPoint) => {
    const raw = point.propertyDaysOnMarket;
    return raw != null && Number.isFinite(raw) ? raw : null;
  };

  const dayTotals = points.map((point) => {
    const dom = domOf(point) ?? 0;
    const pdom = pdomOf(point);
    // Stack: orange = DOM, teal = extra days to reach PDOM (PDOM ≥ DOM).
    // When PDOM is missing, only DOM is drawn.
    if (pdom != null && pdom > dom) return pdom;
    return dom;
  });
  const showDays = dayTotals.some((total) => total > 0);
  const dayMax = showDays ? Math.max(...dayTotals, 1) : 1;
  // Keep DOM/PDOM bars in the lower ~40% of the plot so they don't crowd
  // the median-price line (axis ceiling ≈ 2.4× the tallest month).
  const dayHi = dayMax * 2.4;

  const width = 720;
  const inset = { top: 20, right: showDays ? 44 : 16, bottom: 36, left: 56 };
  const plotW = width - inset.left - inset.right;
  const plotH = height - inset.top - inset.bottom;

  const group = plotW / points.length;
  const barW = Math.min(14, Math.max(4, group * 0.45));
  const xCenter = (i: number) => inset.left + group * i + group / 2;
  const yPrice = (value: number) => inset.top + plotH - ((value - lo) / (hi - lo)) * plotH;
  const yDays = (value: number) => inset.top + plotH - (value / dayHi) * plotH;
  const hDays = (value: number) => (value / dayHi) * plotH;

  const line = points
    .map((point, i) => `${i === 0 ? "M" : "L"}${xCenter(i).toFixed(1)},${yPrice(point.value).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${xCenter(points.length - 1).toFixed(1)},${(inset.top + plotH).toFixed(1)} L${xCenter(0).toFixed(1)},${(inset.top + plotH).toFixed(1)} Z`;

  const priceTicks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
  const dayTicks = showDays ? Array.from({ length: 5 }, (_, i) => (dayHi * i) / 4) : [];

  const first = values[0];
  const last = values[values.length - 1];
  const changePct = first > 0 ? ((last - first) / first) * 100 : 0;
  const hasPdom = points.some((point) => pdomOf(point) != null);

  void secondaryLabel;

  return (
    <figure className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-[12px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: PRICE_COLOR }} />
          {label}
        </span>
        {showDays && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: DOM_COLOR }} />
            Days on Market
          </span>
        )}
        {hasPdom && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: PDOM_COLOR }} />
            Property Days on Market
          </span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${label} from ${formatMonthLabel(points[0].month)} to ${formatMonthLabel(points[points.length - 1].month)}, changing ${changePct >= 0 ? "up" : "down"} ${Math.abs(changePct).toFixed(1)} percent.${showDays ? " Also shows days on market." : ""}`}
        onMouseLeave={() => {
          setTip(null);
          setActive(null);
        }}
      >
        {priceTicks.map((tick) => (
          <g key={`price-${tick}`}>
            <line
              x1={inset.left}
              x2={width - inset.right}
              y1={yPrice(tick)}
              y2={yPrice(tick)}
              stroke="var(--color-line)"
              strokeWidth="1"
            />
            <text
              x={inset.left - 8}
              y={yPrice(tick) + 4}
              textAnchor="end"
              className="fill-[var(--color-ink-subtle)] text-[10px]"
            >
              {formatPriceCompact(tick)}
            </text>
          </g>
        ))}

        {dayTicks.map((tick) => (
          <text
            key={`dom-${tick}`}
            x={width - inset.right + 8}
            y={yDays(tick) + 4}
            textAnchor="start"
            className="fill-[var(--color-ink-subtle)] text-[10px]"
          >
            {Math.round(tick)}
          </text>
        ))}

        {showDays &&
          points.map((point, i) => {
            const dom = domOf(point) ?? 0;
            const pdom = pdomOf(point);
            // Orange = DOM. Teal stacked on top = PDOM − DOM when PDOM is higher.
            // When the feed only reports one figure, the full bar is DOM and PDOM
            // is drawn as a line on the same axis (see below).
            const teal = pdom != null && pdom > dom + 0.5 ? pdom - dom : 0;
            const cx = xCenter(i);
            const baseY = inset.top + plotH;
            const domH = hDays(dom);
            const tealH = hDays(teal);
            return (
              <g key={`bars-${point.month}`}>
                {dom > 0 && (
                  <rect
                    x={cx - barW / 2}
                    y={baseY - domH}
                    width={barW}
                    height={Math.max(domH, 1)}
                    fill={DOM_COLOR}
                    opacity={active === null || active === i ? 0.95 : 0.4}
                  />
                )}
                {teal > 0 && (
                  <rect
                    x={cx - barW / 2}
                    y={baseY - domH - tealH}
                    width={barW}
                    height={Math.max(tealH, 1)}
                    fill={PDOM_COLOR}
                    opacity={active === null || active === i ? 0.95 : 0.4}
                  />
                )}
              </g>
            );
          })}

        {hasPdom &&
          (() => {
            const pdomLine = points
              .map((point, i) => {
                const pdom = pdomOf(point);
                if (pdom == null) return null;
                return `${i === 0 || pdomOf(points[i - 1]) == null ? "M" : "L"}${xCenter(i).toFixed(1)},${yDays(pdom).toFixed(1)}`;
              })
              .filter(Boolean)
              .join(" ");
            return pdomLine ? (
              <path
                d={pdomLine}
                fill="none"
                stroke={PDOM_COLOR}
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null;
          })()}

        <path d={area} fill={PRICE_COLOR} opacity="0.08" />
        <path
          d={line}
          fill="none"
          stroke={PRICE_COLOR}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((point, i) => {
          const cx = xCenter(i);
          const cy = yPrice(point.value);
          const showDot = dots === "all" || (dots === "end" && i === points.length - 1) || active === i;
          const dom = domOf(point);
          const pdom = pdomOf(point);
          return (
            <g key={point.month}>
              <rect
                x={cx - group / 2}
                y={inset.top}
                width={group}
                height={plotH}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => {
                  setActive(i);
                  setTip({
                    x: cx,
                    y: Math.min(cy, yDays(dayTotals[i] || 0)),
                    lines: [
                      formatMonthLabel(point.month),
                      ...(dom != null ? [`Days on Market  ${Math.round(dom)}`] : []),
                      ...(pdom != null ? [`Property Days on Market  ${Math.round(pdom)}`] : []),
                      `${label}  ${formatPrice(point.value)}`,
                      ...(detailLabel && point.detail != null
                        ? [`${detailLabel}  ${formatNumber(point.detail)}`]
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
                  fill={PRICE_COLOR}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              ) : null}
            </g>
          );
        })}

        {points.map((point, i) =>
          i % Math.ceil(points.length / 6) === 0 || i === points.length - 1 ? (
            <text
              key={`label-${point.month}`}
              x={xCenter(i)}
              y={height - 10}
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
          <caption>
            {label}
            {showDays ? ", Days on Market" : ""}
            {hasPdom ? ", and Property Days on Market" : ""} by month
          </caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">{label}</th>
              {showDays && <th scope="col">Days on Market</th>}
              {hasPdom && <th scope="col">Property Days on Market</th>}
              {detailLabel && <th scope="col">{detailLabel}</th>}
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.month}>
                <th scope="row">{formatMonthLabel(point.month)}</th>
                <td>{formatPriceCompact(point.value)}</td>
                {showDays && <td>{domOf(point) != null ? Math.round(domOf(point)!) : ""}</td>}
                {hasPdom && <td>{pdomOf(point) != null ? Math.round(pdomOf(point)!) : ""}</td>}
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
