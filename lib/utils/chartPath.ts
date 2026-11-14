/**
 * Smooth SVG line helpers for Market Insights charts.
 * Uses monotone cubic Hermite (Fritsch–Carlson) so curves look soft without
 * overshooting past neighbouring points (and without dipping below zero).
 */

export type ChartCoord = { x: number; y: number };

/** Straight polyline — fallback for 0–1 points. */
export function linePath(coords: ChartCoord[]): string {
  if (coords.length === 0) return "";
  return coords
    .map((point, i) => `${i === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
}

/**
 * Monotone cubic path through every point. Safe for inventory / price series
 * that must not swing below the axis or invent fake peaks.
 */
export function smoothLinePath(coords: ChartCoord[]): string {
  const n = coords.length;
  if (n === 0) return "";
  if (n === 1) return `M${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
  if (n === 2) return linePath(coords);

  const dx: number[] = [];
  const dy: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = coords[i + 1].x - coords[i].x;
    dy[i] = coords[i + 1].y - coords[i].y;
    m[i] = Math.abs(dx[i]) < 1e-9 ? 0 : dy[i] / dx[i];
  }

  const slopes: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) slopes[i] = 0;
    else slopes[i] = (m[i - 1] + m[i]) / 2;
  }
  slopes.push(m[n - 2]);

  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(m[i]) < 1e-12) {
      slopes[i] = 0;
      slopes[i + 1] = 0;
      continue;
    }
    const a = slopes[i] / m[i];
    const b = slopes[i + 1] / m[i];
    const h = Math.hypot(a, b);
    if (h > 3) {
      const t = 3 / h;
      slopes[i] = t * a * m[i];
      slopes[i + 1] = t * b * m[i];
    }
  }

  let d = `M${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const cp1x = p0.x + dx[i] / 3;
    const cp1y = p0.y + (slopes[i] * dx[i]) / 3;
    const cp2x = p1.x - dx[i] / 3;
    const cp2y = p1.y - (slopes[i + 1] * dx[i]) / 3;
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
  }
  return d;
}

/** Closed area under a smooth line down to `baseY` (for gradient fills). */
export function smoothAreaPath(coords: ChartCoord[], baseY: number): string {
  const line = smoothLinePath(coords);
  if (!line || coords.length === 0) return "";
  const last = coords[coords.length - 1];
  const first = coords[0];
  return `${line} L${last.x.toFixed(1)},${baseY.toFixed(1)} L${first.x.toFixed(1)},${baseY.toFixed(1)} Z`;
}
