import { cachedFetch } from "./http";
import type { Point } from "./yahoo";

export type FredData = {
  id: string;
  points: Point[];
  last: number;
  lastDate: string;
  changeYoY: number | null; // absolute change vs ~1 year earlier
  min1y: number;
  max1y: number;
};

const csvUrl = (ids: string[], start: string) =>
  `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${ids.join(",")}&cosd=${ids.map(() => start).join(",")}`;

function startDate(years: number): string {
  const start = new Date();
  start.setFullYear(start.getFullYear() - years);
  return start.toISOString().slice(0, 10);
}

export function summarize(id: string, points: Point[]): FredData {
  if (!points.length) throw new Error(`No observations for ${id}`);
  const last = points[points.length - 1];
  const yearAgo = new Date(last.t);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const cutoff = yearAgo.toISOString().slice(0, 10);
  const prior = [...points].reverse().find((p) => p.t <= cutoff);
  const lastYear = points.filter((p) => p.t > cutoff).map((p) => p.v);
  return {
    id,
    points,
    last: last.v,
    lastDate: last.t,
    changeYoY: prior ? last.v - prior.v : null,
    min1y: Math.min(...lastYear),
    max1y: Math.max(...lastYear),
  };
}

/** FRED's public CSV endpoint needs no API key. */
export async function fetchFred(id: string, years = 12): Promise<FredData> {
  const series = await fetchFredMulti([id], years);
  return summarize(id, series.get(id) ?? []);
}

/**
 * Several series in one request. FRED returns a single CSV only when every
 * series has the same frequency (mixed frequencies come back as a zip), so
 * callers group like with like.
 */
export async function fetchFredMulti(ids: string[], years = 12): Promise<Map<string, Point[]>> {
  const start = startDate(years);
  const text = await (await cachedFetch(csvUrl(ids, start))).text();
  if (!text.startsWith("observation_date")) throw new Error(`Unexpected response for ${ids.join(",")}`);
  const lines = text.trim().split("\n");
  const header = lines[0].trim().split(",").slice(1);
  const out = new Map<string, Point[]>(header.map((h) => [h, []]));
  for (const line of lines.slice(1)) {
    const [t, ...vals] = line.trim().split(",");
    if (!t || t < start) continue;
    vals.forEach((raw, i) => {
      const v = Number(raw);
      if (raw && raw !== "." && Number.isFinite(v)) out.get(header[i])!.push({ t, v });
    });
  }
  return out;
}
