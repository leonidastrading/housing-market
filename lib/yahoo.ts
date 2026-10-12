import { cachedFetch } from "./http";

export type Point = { t: string; v: number };

export type Quote = {
  symbol: string;
  name: string;
  points: Point[]; // daily closes, oldest first
  last: number;
  chg1d: number | null;
  chg1m: number | null;
  chg3m: number | null;
  chgYtd: number | null;
  high52: number;
  drawdown: number; // % below 52-week high (<= 0)
};

type ChartResponse = {
  chart: {
    result?: {
      timestamp?: number[];
      indicators: { quote: { close: (number | null)[] }[]; adjclose?: { adjclose: (number | null)[] }[] };
    }[];
    error?: { description?: string } | null;
  };
};

function pct(a: number | undefined, b: number | undefined): number | null {
  if (a == null || b == null || b === 0) return null;
  return (a / b - 1) * 100;
}

export async function fetchQuote(symbol: string, name: string, range = "2y", interval = "1d"): Promise<Quote> {
  const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  let res: Response;
  try {
    res = await cachedFetch(`https://query1.finance.yahoo.com${path}`, { retries: 1 });
  } catch {
    res = await cachedFetch(`https://query2.finance.yahoo.com${path}`, { retries: 2 });
  }
  const json = (await res.json()) as ChartResponse;
  const r = json.chart.result?.[0];
  if (!r?.timestamp) throw new Error(json.chart.error?.description ?? `No data for ${symbol}`);

  const closes = r.indicators.adjclose?.[0]?.adjclose ?? r.indicators.quote[0].close;
  const points: Point[] = [];
  r.timestamp.forEach((ts, i) => {
    const v = closes[i];
    if (v != null && Number.isFinite(v)) {
      points.push({ t: new Date(ts * 1000).toISOString().slice(0, 10), v: +v.toFixed(4) });
    }
  });
  if (points.length < 2) throw new Error(`Too little data for ${symbol}`);

  const n = points.length;
  const last = points[n - 1].v;
  const at = (daysBack: number) => points[Math.max(0, n - 1 - daysBack)]?.v;
  const year = points[n - 1].t.slice(0, 4);
  const ytdBase = [...points].reverse().find((p) => p.t.slice(0, 4) < year)?.v;
  const last252 = points.slice(-252);
  const high52 = Math.max(...last252.map((p) => p.v));

  return {
    symbol,
    name,
    points,
    last,
    chg1d: pct(last, at(1)),
    chg1m: pct(last, at(21)),
    chg3m: pct(last, at(63)),
    chgYtd: pct(last, ytdBase),
    high52,
    drawdown: (last / high52 - 1) * 100,
  };
}
