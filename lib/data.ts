import { BUILDERS, FRED_SERIES, NEWS_FEEDS } from "./config";
import { fetchFred, type FredData } from "./fred";
import { appendSnapshot, readHistory, type Snapshot } from "./history";
import { mapLimit, settle } from "./http";
import { fetchNahb, type Nahb } from "./nahb";
import { fetchNews, type NewsItem } from "./news";
import { fetchNyFed, type NyFed } from "./nyfed";
import { fetchRegions, type RegionRow } from "./regions";
import { change, combine, quarterlyMean, rollingMean, round, valueAt } from "./series";
import {
  compositeScore,
  computeSignals,
  forcedSelling,
  stageScores,
  type Derived,
  type ForcedSelling,
  type Signal,
  type StageScore,
} from "./signals";
import { fetchQuote, type Point, type Quote } from "./yahoo";

export type DashboardData = {
  generatedAt: string;
  score: number | null;
  stages: StageScore[];
  signals: Signal[];
  forced: ForcedSelling;
  fred: Record<string, FredData>;
  derived: Derived;
  quotes: Record<string, Quote>;
  nahb: Nahb | null;
  nyfed: NyFed | null;
  regions: RegionRow[];
  news: { id: string; title: string; items: NewsItem[] }[];
  history: Snapshot[];
  errors: string[];
};

/**
 * Monthly median household income. The Census figure is annual and lags
 * about a year, so each month scales its year's figure by average hourly
 * earnings (carrying the last annual figure forward the same way).
 */
function estimateIncome(annual: Point[], ahe: Point[]): Point[] {
  if (!annual.length) return [];
  const byYear = new Map(annual.map((p) => [p.t.slice(0, 4), p.v]));
  const aheYear = new Map<string, number[]>();
  for (const p of ahe) (aheYear.get(p.t.slice(0, 4)) ?? aheYear.set(p.t.slice(0, 4), []).get(p.t.slice(0, 4))!).push(p.v);
  const aheAvg = (y: string) => {
    const xs = aheYear.get(y);
    return xs && xs.length >= 6 ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  const lastYear = annual[annual.length - 1].t.slice(0, 4);
  const out: Point[] = [];
  const start = Number(annual[0].t.slice(0, 4));
  const end = new Date().getUTCFullYear();
  for (let y = start; y <= end; y++) {
    for (let m = 1; m <= 12; m++) {
      const t = `${y}-${String(m).padStart(2, "0")}-01`;
      const baseYear = String(Math.min(y, Number(lastYear)));
      const base = byYear.get(baseYear);
      if (base == null) continue;
      const a = valueAt(ahe, t, 35);
      const avg = aheAvg(baseYear);
      if (a != null && avg != null) out.push({ t, v: base * (a / avg) });
      else if (y <= Number(lastYear)) out.push({ t, v: base });
    }
  }
  return out;
}

function monthlyPayment(principal: number, annualRatePct: number, years = 30): number {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  return (principal * r) / (1 - (1 + r) ** -n);
}

function derive(fred: Map<string, FredData>, itbW: Quote | null, spyW: Quote | null): Derived {
  const p = (id: string) => fred.get(id)?.points ?? [];
  const income = estimateIncome(p("MEHOINUSA646N"), p("CES0500000003"));
  const rateQ = quarterlyMean(p("MORTGAGE30US"));
  const affordability = p("MSPUS").flatMap((q) => {
    const rate = valueAt(rateQ, q.t, 5);
    // Income at the middle of the quarter.
    const mid = `${q.t.slice(0, 5)}${String(Number(q.t.slice(5, 7)) + 1).padStart(2, "0")}-01`;
    const inc = valueAt(income, mid, 70);
    if (rate == null || inc == null) return [];
    const pay = monthlyPayment(q.v * 0.8, rate);
    return [{ t: q.t, pay: ((pay * 12) / inc) * 100, pti: q.v / inc }];
  });

  const rent = p("CUSR0000SEHA");
  const cs = p("CSUSHPINSA");
  const rawPtr = combine(cs, rent, (a, b) => a / b, 5);
  const base = rawPtr.find((x) => x.t.startsWith("2000-01"))?.v ?? rawPtr[0]?.v;

  const itbSpy = itbW && spyW ? combine(itbW.points, spyW.points, (a, b) => (a / b) * 100, 6) : [];

  return {
    mortgageSpread: round(combine(p("MORTGAGE30US"), p("DGS10"), (m, t) => m - t, 5), 2),
    itbSpy: round(itbSpy, 3),
    itbSpy26w: round(change(itbSpy, 26), 2),
    paymentToIncome: affordability.map((a) => ({ t: a.t, v: +a.pay.toFixed(2) })),
    priceToIncome: affordability.map((a) => ({ t: a.t, v: +a.pti.toFixed(3) })),
    priceToRent: base ? round(rawPtr.map((x) => ({ t: x.t, v: (x.v / base) * 100 })), 1) : [],
    cutShare: round(combine(p("PRIREDCOUUS"), p("ACTLISCOUUS"), (c, a) => (c / a) * 100, 5), 2),
    claims4w: round(rollingMean(p("ICSA"), 4), 0),
    income: round(income, 0),
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const errors: string[] = [];

  const [fredResults, quoteResults, weeklyResults, nahbR, nyfedR, newsResults, regions, history] = await Promise.all([
    mapLimit(FRED_SERIES, 4, (f) => settle(fetchFred(f.id, f.years))),
    mapLimit(BUILDERS.tickers, 4, (t) => settle(fetchQuote(t.symbol, t.name))),
    mapLimit(["ITB", "SPY"], 2, (s) => settle(fetchQuote(s, s, "11y", "1wk"))),
    settle(fetchNahb()),
    settle(fetchNyFed()),
    mapLimit(NEWS_FEEDS, 3, (f) => settle(fetchNews(f.query))),
    fetchRegions(errors),
    readHistory(),
  ]);

  const fred = new Map<string, FredData>();
  fredResults.forEach((r, i) => {
    if (r.ok) fred.set(FRED_SERIES[i].id, r.data);
    else errors.push(`FRED ${FRED_SERIES[i].id}: ${r.error}`);
  });

  const quotes: Record<string, Quote> = {};
  quoteResults.forEach((r, i) => {
    if (r.ok) quotes[BUILDERS.tickers[i].symbol] = r.data;
    else errors.push(`Price ${BUILDERS.tickers[i].symbol}: ${r.error}`);
  });
  weeklyResults.forEach((r, i) => {
    if (!r.ok) errors.push(`Weekly ${["ITB", "SPY"][i]}: ${r.error}`);
  });
  const [itbW, spyW] = weeklyResults.map((r) => (r.ok ? r.data : null));

  if (!nahbR.ok) errors.push(`NAHB HMI: ${nahbR.error}`);
  const nahb = nahbR.ok ? nahbR.data : null;
  if (!nyfedR.ok) errors.push(`NY Fed household debt report: ${nyfedR.error}`);
  const nyfed = nyfedR.ok ? nyfedR.data : null;

  const news = NEWS_FEEDS.map((f, i) => {
    const r = newsResults[i];
    if (!r.ok) errors.push(`News ${f.title}: ${r.error}`);
    return { id: f.id, title: f.title, items: r.ok ? r.data : [] };
  });

  const derived = derive(fred, itbW, spyW);
  const signals = computeSignals(fred, derived, nahb, nyfed);
  const stages = stageScores(signals);

  return {
    generatedAt: new Date().toISOString(),
    score: compositeScore(stages),
    stages,
    signals,
    forced: forcedSelling(fred, derived.claims4w, nyfed),
    fred: Object.fromEntries(fred),
    derived,
    quotes,
    nahb,
    nyfed,
    regions,
    news,
    history,
    errors,
  };
}

export function toSnapshot(d: DashboardData): Snapshot {
  return {
    date: d.generatedAt.slice(0, 10),
    score: d.score,
    stages: Object.fromEntries(d.stages.map((s) => [s.id, s.score])),
    signals: Object.fromEntries(d.signals.map((s) => [s.id, s.score])),
    nahb: d.nahb ? { month: d.nahb.month, priceCutShare: d.nahb.priceCutShare, incentiveShare: d.nahb.incentiveShare } : undefined,
    forcedSelling: d.forced.status,
  };
}

export { appendSnapshot };
