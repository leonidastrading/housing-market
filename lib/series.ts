import type { Point } from "./yahoo";

/** Small helpers for derived series. All inputs are sorted oldest first. */

export function shiftYears(iso: string, years: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

/** Value at or just before `t` (null if none within `maxGapDays`). */
export function valueAt(points: Point[], t: string, maxGapDays = 45): number | null {
  let lo = 0;
  let hi = points.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t <= t) {
      best = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (best < 0) return null;
  const gap = (Date.parse(t) - Date.parse(points[best].t)) / 86400_000;
  return gap <= maxGapDays ? points[best].v : null;
}

/** Year-over-year change: percent (default) or absolute difference. */
export function yoy(points: Point[], mode: "pct" | "diff" = "pct", maxGapDays = 10): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const prior = valueAt(points, shiftYears(p.t, -1), maxGapDays);
    if (prior == null || (mode === "pct" && prior === 0)) continue;
    out.push({ t: p.t, v: mode === "pct" ? (p.v / prior - 1) * 100 : p.v - prior });
  }
  return out;
}

/** Combine two series on the first one's dates (b is carried forward up to `maxGapDays`). */
export function combine(a: Point[], b: Point[], fn: (x: number, y: number) => number, maxGapDays = 10): Point[] {
  const out: Point[] = [];
  for (const p of a) {
    const y = valueAt(b, p.t, maxGapDays);
    if (y != null) {
      const v = fn(p.v, y);
      if (Number.isFinite(v)) out.push({ t: p.t, v });
    }
  }
  return out;
}

export function rollingMean(points: Point[], n: number): Point[] {
  const out: Point[] = [];
  let sum = 0;
  points.forEach((p, i) => {
    sum += p.v;
    if (i >= n) sum -= points[i - n].v;
    if (i >= n - 1) out.push({ t: p.t, v: sum / n });
  });
  return out;
}

/** Percent change over `periods` observations back. */
export function change(points: Point[], periods: number): Point[] {
  return points.slice(periods).map((p, i) => ({ t: p.t, v: (p.v / points[i].v - 1) * 100 }));
}

/** Last observation in each calendar month, so weekly and daily series weigh like monthly ones. */
export function monthly(points: Point[]): Point[] {
  const m = new Map<string, Point>();
  for (const p of points) m.set(p.t.slice(0, 7), p);
  return [...m.values()];
}

/** Calendar-quarter average, dated at the first day of the quarter (FRED's convention). */
export function quarterlyMean(points: Point[]): Point[] {
  const m = new Map<string, number[]>();
  for (const p of points) {
    const q = Math.floor((Number(p.t.slice(5, 7)) - 1) / 3);
    const key = `${p.t.slice(0, 4)}-${String(q * 3 + 1).padStart(2, "0")}-01`;
    (m.get(key) ?? m.set(key, []).get(key)!).push(p.v);
  }
  return [...m.entries()].map(([t, vs]) => ({ t, v: vs.reduce((a, b) => a + b, 0) / vs.length }));
}

export const round = (points: Point[], digits = 3): Point[] => points.map((p) => ({ t: p.t, v: +p.v.toFixed(digits) }));

export const last = (points: Point[]): Point | null => (points.length ? points[points.length - 1] : null);

/** z-score of the latest value against the trailing `years` of monthly observations. */
export function zScore(points: Point[], years = 10): { z: number; mean: number; sd: number; n: number } | null {
  const end = last(points);
  if (!end) return null;
  const from = shiftYears(end.t, -years);
  const window = monthly(points.filter((p) => p.t > from));
  if (window.length < 8) return null;
  const mean = window.reduce((a, p) => a + p.v, 0) / window.length;
  const sd = Math.sqrt(window.reduce((a, p) => a + (p.v - mean) ** 2, 0) / (window.length - 1));
  if (!sd) return null;
  return { z: (end.v - mean) / sd, mean, sd, n: window.length };
}
