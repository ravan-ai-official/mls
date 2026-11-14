"use client";

import { useId, useState } from "react";
import { smoothAreaPath, smoothLinePath } from "@/lib/utils/chartPath";
import { formatMonthLabel, formatNumber, formatPrice, formatPriceCompact } from "@/lib/utils/format";

/**
 * One month on the median-price combo chart.
 * `value` = median price (line, left axis).
 * `daysOnMarket` / `propertyDaysOnMarket` = bars + line (right axis).
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

/** "Sep 2024" → "Sep '24" for crowded axes. */
function axisMonth(value: string): string {
  const label = formatMonthLabel(value);
  const [month, year] = label.split(" ");
  if (!month || !year || year.length < 2) return label;
  return `${month} '${year.slice(-2)}`;
}

function ChartTooltip({ tip, width }: { tip: Tip | null; width: number }) {
  if (!tip) return null;
  const boxW = Math.max(...tip.lines.map((line) => line.length)) * 7.2 + 24;
  const boxH = tip.lines.length * 17 + 16;
  const x = Math.min(Math.max(8, tip.x - boxW / 2), width - boxW - 8);
  const y = Math.max(8, tip.y - boxH - 14);
  return (
    <g pointerEvents="none">
      <rect
        x={x}
        y={y}
        width={boxW}
        height={boxH}
        rx={8}
        fill="#151515"
        opacity="0.94"
        filter="url(#trend-tip-shadow)"
      />
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

const DOM_COLOR = "#e8a04a";
const PDOM_COLOR = "#2f9e8f";
const PRICE_COLOR = "#1b2e4b";

/**
 * Median price line over Days on Market bars and Property Days on Market line
 * (dual-axis combo).
 */
export function TrendChart({
  series,
  label,
  detailLabel,
  secondaryLabel,
  height = 320,
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
  const gradId = useId().replace(/:/g, "");
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
  // Tight price band so the line has room to move — avoid a flat strip at the top.
  const span = max - min || max * 0.08 || 1;
  const lo = Math.max(0, min - span * 0.35);
  const hi = max + span * 0.2;

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
    if (pdom != null && pdom > dom) return pdom;
    return dom;
  });
  const showDays = dayTotals.some((total) => total > 0);
  const dayMax = showDays ? Math.max(...dayTotals, 1) : 1;
  // Bars stay in the lower third so they don't compete with the price line.
  const dayHi = dayMax * 3.1;

  const width = 720;
  const inset = { top: 18, right: showDays ? 46 : 16, bottom: 38, left: 58 };
  const plotW = width - inset.left - inset.right;
  const plotH = height - inset.top - inset.bottom;
  const baseY = inset.top + plotH;

  const group = plotW / points.length;
  const barW = Math.min(11, Math.max(3.5, group * 0.38));
  const xCenter = (i: number) => inset.left + group * i + group / 2;
  const yPrice = (value: number) => inset.top + plotH - ((value - lo) / (hi - lo)) * plotH;
  const yDays = (value: number) => inset.top + plotH - (value / dayHi) * plotH;
  const hDays = (value: number) => (value / dayHi) * plotH;

  const priceCoords = points.map((point, i) => ({
    x: xCenter(i),
    y: yPrice(point.value),
  }));
  const line = smoothLinePath(priceCoords);
  const area = smoothAreaPath(priceCoords, baseY);

  const priceTicks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
  const dayTicks = showDays ? Array.from({ length: 4 }, (_, i) => (dayHi * i) / 3) : [];

  const first = values[0];
  const last = values[values.length - 1];
  const changePct = first > 0 ? ((last - first) / first) * 100 : 0;
  const hasPdom = points.some((point) => pdomOf(point) != null);
  const labelEvery = Math.max(1, Math.ceil(points.length / 7));

  // Smooth each continuous PDOM run so gaps stay as breaks, not invented spans.
  let pdomLine = "";
  if (hasPdom) {
    const segments: Array<Array<{ x: number; y: number }>> = [];
    let current: Array<{ x: number; y: number }> = [];
    points.forEach((point, i) => {
      const pdom = pdomOf(point);
      if (pdom == null) {
        if (current.length) {
          segments.push(current);
          current = [];
        }
        return;
      }
      current.push({ x: xCenter(i), y: yDays(pdom) });
    });
    if (current.length) segments.push(current);
    pdomLine = segments.map((segment) => smoothLinePath(segment)).join(" ");
  }

  void secondaryLabel;

  return (
    <figure className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 rounded-full" style={{ background: PRICE_COLOR }} />
          {label}
        </span>
        {showDays && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: DOM_COLOR }} />
            Days on Market
          </span>
        )}
        {hasPdom && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 rounded-full" style={{ background: PDOM_COLOR }} />
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
        <defs>
          <linearGradient id={`price-fill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PRICE_COLOR} stopOpacity="0.22" />
            <stop offset="55%" stopColor={PRICE_COLOR} stopOpacity="0.06" />
            <stop offset="100%" stopColor={PRICE_COLOR} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`dom-fill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={DOM_COLOR} stopOpacity="0.95" />
            <stop offset="100%" stopColor={DOM_COLOR} stopOpacity="0.55" />
          </linearGradient>
          <filter id="trend-tip-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.18" />
          </filter>
          <clipPath id={`plot-clip-${gradId}`}>
            <rect x={inset.left} y={inset.top} width={plotW} height={plotH} />
          </clipPath>
        </defs>

        {priceTicks.map((tick) => (
          <g key={`price-${tick}`}>
            <line
              x1={inset.left}
              x2={width - inset.right}
              y1={yPrice(tick)}
              y2={yPrice(tick)}
              stroke="var(--color-line)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text
              x={inset.left - 10}
              y={yPrice(tick) + 3.5}
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
            x={width - inset.right + 10}
            y={yDays(tick) + 3.5}
            textAnchor="start"
            className="fill-[var(--color-ink-subtle)] text-[10px]"
          >
            {Math.round(tick)}
          </text>
        ))}

        <g clipPath={`url(#plot-clip-${gradId})`}>
          {showDays &&
            points.map((point, i) => {
              const dom = domOf(point) ?? 0;
              const pdom = pdomOf(point);
              const teal = pdom != null && pdom > dom + 0.5 ? pdom - dom : 0;
              const cx = xCenter(i);
              const domH = hDays(dom);
              const tealH = hDays(teal);
              const dimmed = active !== null && active !== i;
              return (
                <g key={`bars-${point.month}`} opacity={dimmed ? 0.28 : 1}>
                  {dom > 0 && (
                    <rect
                      x={cx - barW / 2}
                      y={baseY - domH}
                      width={barW}
                      height={Math.max(domH, 1)}
                      rx={2.5}
                      fill={`url(#dom-fill-${gradId})`}
                    />
                  )}
                  {teal > 0 && (
                    <rect
                      x={cx - barW / 2}
                      y={baseY - domH - tealH}
                      width={barW}
                      height={Math.max(tealH, 1)}
                      rx={2.5}
                      fill={PDOM_COLOR}
                      opacity={0.85}
                    />
                  )}
                </g>
              );
            })}

          {pdomLine ? (
            <path
              d={pdomLine}
              fill="none"
              stroke={PDOM_COLOR}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={active === null ? 0.95 : 0.7}
            />
          ) : null}

          <path d={area} fill={`url(#price-fill-${gradId})`} />
          <path
            d={line}
            fill="none"
            stroke={PRICE_COLOR}
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {active !== null && (
          <line
            x1={xCenter(active)}
            x2={xCenter(active)}
            y1={inset.top}
            y2={baseY}
            stroke="var(--color-ink)"
            strokeOpacity="0.12"
            strokeWidth="1"
          />
        )}

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
                      `${label}  ${formatPrice(point.value)}`,
                      ...(dom != null ? [`Days on Market  ${Math.round(dom)}`] : []),
                      ...(pdom != null ? [`Property Days on Market  ${Math.round(pdom)}`] : []),
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
                  r={active === i ? 5 : 3.5}
                  fill={PRICE_COLOR}
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              ) : null}
              {hasPdom && pdom != null && (active === i || i === points.length - 1) ? (
                <circle
                  cx={cx}
                  cy={yDays(pdom)}
                  r={active === i ? 4 : 3}
                  fill={PDOM_COLOR}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              ) : null}
            </g>
          );
        })}

        {points.map((point, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text
              key={`label-${point.month}`}
              x={xCenter(i)}
              y={height - 12}
              textAnchor="middle"
              className="fill-[var(--color-ink-subtle)] text-[9px]"
            >
              {axisMonth(point.month)}
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
