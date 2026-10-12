import { STAGES, type StageId } from "./config";
import type { FredData } from "./fred";
import type { Nahb } from "./nahb";
import type { NyFed } from "./nyfed";
import { last, yoy, zScore } from "./series";
import type { Point } from "./yahoo";

export type Signal = {
  id: string;
  label: string;
  stage: StageId;
  value: string;
  asOf: string;
  /** Direction-adjusted z-score vs. the trailing 10 years (positive = more stress). Null for fixed-threshold signals. */
  z: number | null;
  score: number; // 0 = calm, 100 = crisis
  weight: number; // within-stage weight; stage weights come from config
  basis: string; // how the score is set: 10-year history or fixed thresholds
  detail: string;
};

/** Derived national series computed in data.ts and shared with the charts. */
export type Derived = {
  mortgageSpread: Point[];
  itbSpy: Point[]; // ITB ÷ SPY, weekly
  itbSpy26w: Point[]; // 26-week % change of the ratio
  paymentToIncome: Point[]; // % of median household income
  priceToIncome: Point[];
  priceToRent: Point[]; // index, 2000 = 100
  cutShare: Point[]; // % of active listings with a price cut
  claims4w: Point[];
  income: Point[]; // estimated monthly median household income
};

const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** z of −1 maps to 0, 0 to 33, +1 to 67, +2 or more to 100. */
export const zToScore = (z: number) => Math.round(clamp(((z + 1) / 3) * 100));

/** Linear map: `calm` -> 0, `stress` -> 100, clamped. Works in either direction. */
const scale = (v: number, calm: number, stress: number) => Math.round(clamp(((v - calm) / (stress - calm)) * 100));

const sign = (n: number, d = 1) => `${n >= 0 ? "+" : ""}${n.toFixed(d)}`;

export function computeSignals(fred: Map<string, FredData>, derived: Derived, nahb: Nahb | null, nyfed: NyFed | null): Signal[] {
  const out: Signal[] = [];

  /** Score a series by its latest value's z-score vs. its own last 10 years. */
  function z(
    id: string,
    stage: StageId,
    label: string,
    points: Point[] | undefined,
    direction: 1 | -1,
    fmt: (v: number) => string,
    detail: string,
    weight = 1,
  ) {
    if (!points?.length) return;
    const zs = zScore(points, 10);
    const end = last(points)!;
    if (!zs) return;
    const zd = zs.z * direction;
    out.push({
      id,
      stage,
      label,
      value: fmt(end.v),
      asOf: end.t,
      z: +zd.toFixed(2),
      score: zToScore(zd),
      weight,
      basis: `10-yr avg ${fmt(zs.mean)}, σ ${fmt(zs.sd).replace(/^\+/, "")}`,
      detail,
    });
  }

  /** Score against fixed calm/stress levels, for series whose 10-year history is distorted (2020) or missing. */
  function fixed(id: string, stage: StageId, label: string, points: Point[] | undefined, calm: number, stress: number, fmt: (v: number) => string, detail: string, weight = 1) {
    const end = points?.length ? last(points)! : null;
    if (!end) return;
    out.push({ id, stage, label, value: fmt(end.v), asOf: end.t, z: null, score: scale(end.v, calm, stress), weight, basis: `fixed: ${fmt(calm)} calm → ${fmt(stress)} stress`, detail });
  }

  const pts = (id: string) => fred.get(id)?.points;
  const pct = (d = 2) => (v: number) => `${v.toFixed(d)}%`;
  const pctChg = (v: number) => `${sign(v)}%`;
  const pts1 = (v: number) => `${sign(v)} pts`;

  // ── 1. Financing ──
  z("mortgage", "financing", "30-year mortgage rate", pts("MORTGAGE30US"), 1, pct(), "Freddie Mac weekly survey. Higher rates first freeze turnover; they crash prices only alongside forced selling.", 1);
  z("spread", "financing", "Mortgage spread over 10-year", derived.mortgageSpread, 1, pct(2), "30-year mortgage rate minus the 10-year Treasury. Wide spreads mean lenders and MBS buyers want more protection.", 1);
  z("sloosTight", "financing", "Banks tightening mortgage standards", pts("SUBLPDHMSENQ"), 1, (v) => `${v.toFixed(1)}%`, "Fed Senior Loan Officer Survey, GSE-eligible loans, net % tightening. Quarterly.", 0.75);
  z("sloosDemand", "financing", "Bank-reported mortgage demand", pts("SUBLPDHMDENQ"), -1, (v) => `${v.toFixed(1)}%`, "Net % of banks seeing stronger demand for GSE-eligible mortgages. A free stand-in for MBA purchase applications, which aren't public.", 0.75);

  // ── 2. Builders ──
  z("itbspy", "builders", "Homebuilders vs S&P (26-week)", derived.itbSpy26w, -1, pctChg, "Change in the ITB ÷ SPY ratio over six months. The market prices builder margins before they show up in earnings.", 1);
  if (nahb) z("hmi", "builders", "NAHB builder sentiment", nahb.hmi, -1, (v) => v.toFixed(0), `NAHB/Wells Fargo HMI. Above 50 = more builders see good conditions than poor.${nahb.headline ? ` ${nahb.headline}` : ""}`, 1);
  if (nahb?.priceCutShare != null)
    out.push({
      id: "nahbcuts",
      stage: "builders",
      label: "Builders cutting prices",
      value: `${nahb.priceCutShare}%`,
      asOf: nahb.month ?? "",
      z: null,
      score: scale(nahb.priceCutShare, 15, 45),
      weight: 0.75,
      basis: "fixed: 15% calm → 45% stress",
      detail: `NAHB survey, ${nahb.month ?? "latest"}.${nahb.avgPriceCut != null ? ` Average cut ${nahb.avgPriceCut}%.` : ""}${nahb.incentiveShare != null ? ` ${nahb.incentiveShare}% of builders using sales incentives.` : ""} No published history, so fixed thresholds.`,
    });

  // ── 3. Demand & inventory ──
  const msacsr = fred.get("MSACSR");
  z("monthsSupply", "supply", "New-home months' supply", msacsr?.points, 1, (v) => `${v.toFixed(1)} mo`, `Months to sell the new-home inventory at the current pace. Above ~9 is a warning${msacsr && msacsr.last >= 9 ? " (crossed)" : ""}.`, 1);
  z("newSales", "supply", "New home sales (YoY)", yoy(pts("HSN1F") ?? []), -1, pctChg, "Census, seasonally adjusted annual rate, year over year.", 0.75);
  z("listings", "supply", "Active listings (YoY)", yoy(pts("ACTLISCOUUS") ?? []), 1, pctChg, "Realtor.com. Rising inventory with flat sales is the first sign of seller stress.", 1);
  z("cutShare", "supply", "Listings with price cuts (YoY)", yoy(derived.cutShare, "diff"), 1, pts1, "Share of active listings with a price reduction, change vs a year ago (Realtor.com).", 1);
  z("dom", "supply", "Median days on market (YoY)", yoy(pts("MEDDAYONMARUS") ?? [], "diff"), 1, (v) => `${sign(v, 0)} days`, "Realtor.com. Homes sitting longer means buyers are stepping back.", 0.75);
  z("permits", "supply", "Building permits (YoY)", yoy(pts("PERMIT") ?? []), -1, pctChg, "Census. Builders pulling permits is the supply response to weak demand.", 0.5);

  // ── 4. Affordability ──
  z("payment", "affordability", "Mortgage payment / income", derived.paymentToIncome, 1, pct(1), "Principal and interest on the median-priced home (20% down) as a share of median household income. Excludes taxes and insurance.", 1);
  z("pti", "affordability", "Price-to-income", derived.priceToIncome, 1, (v) => `${v.toFixed(2)}x`, "Median sales price ÷ median household income.", 0.75);
  z("ptr", "affordability", "Price-to-rent", derived.priceToRent, 1, (v) => v.toFixed(0), "Case-Shiller national ÷ CPI rent of primary residence, 2000 = 100. How far prices have run ahead of rents.", 0.75);

  // ── 5. Prices ──
  z("caseShiller", "prices", "Case-Shiller national (YoY)", yoy(pts("CSUSHPINSA") ?? []), -1, pctChg, "Repeat-sales index, not seasonally adjusted, year over year. Lags by about two months.", 1);
  z("medianPrice", "prices", "Median sales price (YoY)", yoy(pts("MSPUS") ?? [], "pct", 40), -1, pctChg, "Census/HUD, quarterly. Mix-sensitive: more new homes in the South pull it down.", 0.75);

  // ── 6. Credit stress ──
  const dq = pts("DRSFRMACBS");
  z("delinquency", "credit", "Mortgage delinquency rate", dq, 1, pct(2), "Single-family mortgages 30+ days past due at commercial banks, quarterly. Bank loans skew prime, so this moves late.", 1);
  z("delinquencyYoY", "credit", "Delinquency change (YoY)", yoy(dq ?? [], "diff", 40), 1, pts1, "Change in the delinquency rate vs a year earlier. Direction matters more than level.", 1);
  // NY Fed credit-panel data: 2020–21 forbearance and foreclosure moratoriums distort a 10-year z, so fixed levels.
  if (nyfed) {
    const norm = foreclosureNorm(nyfed.foreclosures);
    const fc = last(nyfed.foreclosures);
    fixed("foreclosuresYoY", "credit", "New foreclosures (YoY)", yoy(nyfed.foreclosures, "pct", 40), 0, 40, pctChg, `Consumers with a new foreclosure on their credit report (NY Fed/Equifax), quarterly.${fc ? ` ${fc.v.toFixed(0)}k in the latest quarter` : ""}${fc && norm ? `, ${sign((fc.v / norm - 1) * 100, 0)}% vs the 2017–19 average of ${norm.toFixed(0)}k` : ""}.`, 1);
    fixed("seriousFlow", "credit", "Mortgages newly 90+ days late", nyfed.mortgageSeriousFlow, 1, 3, pct(2), "Annualized share of mortgage balances moving into serious delinquency (NY Fed/Equifax). Covers all lenders, including FHA and non-bank loans that the bank series misses.", 1);
  }

  // ── 7. Macro triggers ──
  // The 2020 spike swamps a 10-year standard deviation for these two, so they use fixed levels.
  fixed("sahm", "macro", "Sahm rule indicator", pts("SAHMREALTIME"), 0, 0.5, pct(2), "3-month average unemployment minus its 12-month low. 0.5+ has marked every recession since 1970.", 1);
  fixed("claims", "macro", "Jobless claims, 4-wk avg (YoY)", yoy(derived.claims4w, "pct", 10), 0, 30, pctChg, "Initial claims, 4-week average, year over year. Forced sellers come from layoffs.", 1);
  z("dgs10", "macro", "10-year Treasury yield", pts("DGS10"), 1, pct(), "Anchors mortgage rates.", 0.5);
  z("curve", "macro", "Yield curve (10y − 2y)", pts("T10Y2Y"), -1, pct(), "Inversion has preceded recessions; the re-steepening after it often coincides with layoffs.", 0.5);

  return out;
}

export type StageScore = { id: StageId; label: string; short: string; lead: string; weight: number; score: number | null; count: number };

export function stageScores(signals: Signal[]): StageScore[] {
  return STAGES.map((s) => {
    const xs = signals.filter((x) => x.stage === s.id);
    const w = xs.reduce((a, x) => a + x.weight, 0);
    return {
      ...s,
      score: w ? Math.round(xs.reduce((a, x) => a + x.score * x.weight, 0) / w) : null,
      count: xs.length,
    };
  });
}

/** Weighted by stage (leading stages count more), then by signal within each stage. */
export function compositeScore(stages: StageScore[]): number | null {
  const xs = stages.filter((s) => s.score != null);
  const w = xs.reduce((a, s) => a + s.weight, 0);
  return w ? Math.round(xs.reduce((a, s) => a + s.score! * s.weight, 0) / w) : null;
}

export function scoreLabel(score: number): { label: string; tone: "calm" | "watch" | "stress" } {
  if (score < 40) return { label: "Green: calm", tone: "calm" };
  if (score < 60) return { label: "Yellow: watch", tone: "watch" };
  return { label: "Red: stress", tone: "stress" };
}

/**
 * The 2008 mechanism: forced selling (job losses plus bad loans) meeting
 * falling prices. High rates alone freeze the market; this flags when
 * delinquencies and unemployment start rising together.
 */
export type ForcedSelling = {
  status: "frozen" | "watch" | "alarm";
  delinquency: {
    rising: boolean;
    value: number | null;
    yoy: number | null;
    qoq2: boolean;
    asOf: string | null;
    seriousFlow: number | null;
    seriousFlowYoY: number | null;
    foreclosures: number | null; // thousands, latest quarter
    foreclosuresYoY: number | null;
    nyfedAsOf: string | null;
  };
  jobs: { rising: boolean; sahm: number | null; unrateYoY: number | null; claimsYoY: number | null; asOf: string | null };
};

/** Average new foreclosures per quarter in 2017–19, the last stretch before moratoriums. */
export function foreclosureNorm(points: Point[]): number | null {
  const xs = points.filter((p) => p.t >= "2017" && p.t < "2020").map((p) => p.v);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export function forcedSelling(fred: Map<string, FredData>, claims4w: Point[], nyfed: NyFed | null): ForcedSelling {
  const dq = fred.get("DRSFRMACBS")?.points ?? [];
  const dqYoY = last(yoy(dq, "diff", 40))?.v ?? null;
  const n = dq.length;
  const qoq2 = n >= 3 && dq[n - 1].v > dq[n - 2].v && dq[n - 2].v > dq[n - 3].v;
  const flow = nyfed?.mortgageSeriousFlow ?? [];
  const flowYoY = last(yoy(flow, "diff", 40))?.v ?? null;
  const fcYoY = nyfed ? (last(yoy(nyfed.foreclosures, "pct", 40))?.v ?? null) : null;
  const delinqRising = (dqYoY != null && dqYoY >= 0.15) || qoq2 || (flowYoY != null && flowYoY >= 0.25);

  const sahm = fred.get("SAHMREALTIME")?.last ?? null;
  const ur = fred.get("UNRATE");
  const unrateYoY = ur?.changeYoY ?? null;
  const claimsYoY = last(yoy(claims4w, "pct", 10))?.v ?? null;
  const jobsRising = (sahm != null && sahm >= 0.3) || (unrateYoY != null && unrateYoY >= 0.4) || (claimsYoY != null && claimsYoY >= 15);

  return {
    status: delinqRising && jobsRising ? "alarm" : delinqRising || jobsRising ? "watch" : "frozen",
    delinquency: {
      rising: delinqRising,
      value: last(dq)?.v ?? null,
      yoy: dqYoY,
      qoq2,
      asOf: last(dq)?.t ?? null,
      seriousFlow: last(flow)?.v ?? null,
      seriousFlowYoY: flowYoY,
      foreclosures: nyfed ? (last(nyfed.foreclosures)?.v ?? null) : null,
      foreclosuresYoY: fcYoY,
      nyfedAsOf: last(flow)?.t ?? null,
    },
    jobs: { rising: jobsRising, sahm, unrateYoY, claimsYoY, asOf: ur?.lastDate ?? null },
  };
}

