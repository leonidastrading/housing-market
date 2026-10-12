import { REGIONS, type Region } from "./config";
import { fetchFredMulti } from "./fred";
import { mapLimit, settle } from "./http";
import { combine, last, round, yoy } from "./series";
import { toScore } from "./stress-color";
import type { Point } from "./yahoo";

export type RegionRow = Region & {
  asOf: string | null;
  listings: number | null;
  listingsYoY: number | null;
  /** Active listings vs. the 2017–19 average for the same calendar month. */
  vsPrePandemic: number | null;
  newListingsYoY: number | null;
  cutShare: number | null; // % of active listings with a price cut
  cutShareYoY: number | null; // pts
  dom: number | null;
  domYoY: number | null; // days
  listPrice: number | null;
  listPriceYoY: number | null;
  unemployment: number | null;
  unemploymentYoY: number | null; // pts
  hpiYoY: number | null; // FHFA, quarterly
  hpiAsOf: string | null;
  score: number | null;
  series: {
    listings: Point[];
    norm: Point[]; // 2017–19 same-month average, for the chart
    cutShare: Point[];
    dom: Point[];
    listPrice: Point[];
  };
};

const realtorIds = (code: string) => ["ACTLISCOU", "NEWLISCOU", "PRIREDCOU", "MEDDAYONMAR", "MEDLISPRI"].map((p) => p + code);

/** Average of 2017–2019 values per calendar month: the pre-pandemic "normal" inventory. */
function prePandemicNorm(points: Point[]): Map<string, number> {
  const byMonth = new Map<string, number[]>();
  for (const p of points) {
    const y = p.t.slice(0, 4);
    if (y < "2017" || y > "2019") continue;
    const m = p.t.slice(5, 7);
    (byMonth.get(m) ?? byMonth.set(m, []).get(m)!).push(p.v);
  }
  return new Map([...byMonth].map(([m, vs]) => [m, vs.reduce((a, b) => a + b, 0) / vs.length]));
}

function lastYoY(points: Point[], mode: "pct" | "diff"): number | null {
  return last(yoy(points, mode))?.v ?? null;
}

function avg(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x != null && Number.isFinite(x));
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
}

/** FRED serves at most 12 series per CSV request. */
async function fetchHpi(ids: string[]): Promise<Map<string, Point[]>> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 12) chunks.push(ids.slice(i, i + 12));
  const maps = await mapLimit(chunks, 2, (c) => fetchFredMulti(c, 12));
  return new Map(maps.flatMap((m) => [...m]));
}

export async function fetchRegions(errors: string[]): Promise<RegionRow[]> {
  const states = REGIONS.filter((r) => r.kind === "state" && r.code !== "US").map((r) => r.code);
  // Quarterly FHFA indexes come in one request; monthly unemployment rides with each state's Realtor.com call.
  const [hpiR, realtor] = await Promise.all([
    settle(fetchHpi(["USSTHPI", ...states.map((s) => `${s}STHPI`)])),
    mapLimit(REGIONS, 4, (r) =>
      settle(fetchFredMulti([...realtorIds(r.code), ...(r.kind === "state" ? [r.code === "US" ? "UNRATE" : `${r.code}UR`] : [])], 11)),
    ),
  ]);
  if (!hpiR.ok) errors.push(`FHFA state HPI: ${hpiR.error}`);

  return REGIONS.map((r, i) => {
    const res = realtor[i];
    if (!res.ok) errors.push(`Realtor.com ${r.name}: ${res.error}`);
    const m = res.ok ? res.data : new Map<string, Point[]>();
    const [act, neu, cut, dom, price] = realtorIds(r.code).map((id) => m.get(id) ?? []);
    const ur = m.get(r.code === "US" ? "UNRATE" : `${r.code}UR`) ?? [];
    const hpi = hpiR.ok ? (hpiR.data.get(r.code === "US" ? "USSTHPI" : `${r.code}STHPI`) ?? []) : [];

    const norm = prePandemicNorm(act);
    const normSeries = act.filter((p) => p.t >= "2017").map((p) => ({ t: p.t, v: Math.round(norm.get(p.t.slice(5, 7)) ?? NaN) })).filter((p) => Number.isFinite(p.v));
    const cutShare = combine(cut, act, (c, a) => (c / a) * 100, 5);
    const lastAct = last(act);
    const normNow = lastAct ? norm.get(lastAct.t.slice(5, 7)) : undefined;

    const row: Omit<RegionRow, "score"> = {
      ...r,
      asOf: lastAct?.t ?? null,
      listings: lastAct?.v ?? null,
      listingsYoY: lastYoY(act, "pct"),
      vsPrePandemic: lastAct && normNow ? (lastAct.v / normNow - 1) * 100 : null,
      newListingsYoY: lastYoY(neu, "pct"),
      cutShare: last(cutShare)?.v ?? null,
      cutShareYoY: lastYoY(cutShare, "diff"),
      dom: last(dom)?.v ?? null,
      domYoY: lastYoY(dom, "diff"),
      listPrice: last(price)?.v ?? null,
      listPriceYoY: lastYoY(price, "pct"),
      unemployment: last(ur)?.v ?? null,
      unemploymentYoY: lastYoY(ur, "diff"),
      hpiYoY: last(yoy(hpi, "pct", 10))?.v ?? null,
      hpiAsOf: last(hpi)?.t ?? null,
      series: {
        listings: act,
        norm: normSeries,
        cutShare: round(cutShare, 2),
        dom,
        listPrice: price,
      },
    };
    return { ...row, score: regionScore(row) };
  });
}

/** Fixed thresholds (calm → stress), averaged. Local data is too short for 10-year z-scores. */
export const REGION_SCALES = {
  listingsYoY: [0, 40],
  vsPrePandemic: [-20, 30],
  cutShareYoY: [0, 6],
  domYoY: [0, 15],
  listPriceYoY: [3, -6],
  unemploymentYoY: [0, 1],
  hpiYoY: [3, -5],
} as const;

export function regionScore(r: Omit<RegionRow, "score">): number | null {
  return avg(
    (Object.keys(REGION_SCALES) as (keyof typeof REGION_SCALES)[]).map((k) => {
      const v = r[k];
      const [calm, stress] = REGION_SCALES[k];
      return v == null ? null : toScore(v, calm, stress);
    }),
  );
}

