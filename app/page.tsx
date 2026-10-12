import { BuildersTable, Explain, ForcedSellingCard, Gauge, NewsList, Pct, QuoteTable, SignalTable, StageFlow } from "@/components/blocks";
import { HistoryChart, LinesChart, RelativeChart, SeriesChart, type RangeKey } from "@/components/charts";
import { RegionDrill, type RegionSeries } from "@/components/regions";
import { ResetSettings } from "@/components/reset-settings";
import { SortableTable } from "@/components/sortable-table";
import { BUILDER_REPORTS } from "@/lib/builders";
import { BUILDERS, FRED_SERIES, STAGES, type FredSeries } from "@/lib/config";
import { getDashboardData } from "@/lib/data";
import type { FredData } from "@/lib/fred";
import { historyEnabled } from "@/lib/history";
import { REGION_SCALES, type RegionRow } from "@/lib/regions";
import { yoy } from "@/lib/series";
import { foreclosureNorm } from "@/lib/signals";
import { stressColor, toScore } from "@/lib/stress-color";
import type { Point } from "@/lib/yahoo";

// Rebuilt at most once a day, plus on demand by the daily cron (/api/refresh).
export const revalidate = 86400;
export const maxDuration = 120;

const SECTIONS = [
  { id: "signals", label: "Stress score" },
  ...STAGES.map((s) => ({ id: s.id, label: s.label })),
  { id: "regions", label: "Regional drill-down" },
  { id: "florida", label: "Florida" },
  { id: "news", label: "News" },
  { id: "playbook", label: "Playbook" },
];

/** Keep the last ~5 years at full resolution; thin older history to keep the page light. */
function thin(points: Point[], recent = 260, older = 300): Point[] {
  if (points.length <= recent + older) return points;
  const head = points.slice(0, -recent);
  const step = Math.ceil(head.length / older);
  return [...head.filter((_, i) => i % step === 0), ...points.slice(-recent)];
}

/** Display scaling for series whose raw units are awkward on a chart. */
const DISPLAY: Record<string, { div: number; unit: string }> = {
  EXHOSLUSM495S: { div: 1e6, unit: "M" },
  ACTLISCOUUS: { div: 1000, unit: "k" },
  NEWLISCOUUS: { div: 1000, unit: "k" },
  MSPUS: { div: 1000, unit: "k" },
  MEDLISPRIUS: { div: 1000, unit: "k" },
};

function fmtValue(id: string, unit: FredSeries["unit"], v: number) {
  const d = DISPLAY[id];
  const x = d ? v / d.div : v;
  const n = x.toLocaleString("en-US", { maximumFractionDigits: unit === "%" || d?.unit === "M" ? 2 : 1 });
  if (unit === "$") return `$${n}${d?.unit ?? ""}`;
  if (unit === "%") return `${n}%`;
  if (unit === "days") return `${n} days`;
  if (unit === "mo") return `${n} mo`;
  return `${n}${d?.unit ?? (unit === "k" ? "k" : "")}`;
}

function Card({
  title,
  sub,
  link,
  children,
  explain,
}: {
  title: string;
  sub?: React.ReactNode;
  link?: { href: string; label: string };
  children: React.ReactNode;
  explain?: string;
}) {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3>{title}</h3>
          {sub && <p className="sub">{sub}</p>}
        </div>
        {link && (
          <a className="faint" style={{ fontSize: 11 }} href={link.href} target="_blank" rel="noopener noreferrer">
            {link.label} ↗
          </a>
        )}
      </div>
      {children}
      {explain && <Explain id={explain} />}
    </div>
  );
}

function FredCard({ s, data, explain }: { s: FredSeries; data: FredData | undefined; explain?: string }) {
  const d = DISPLAY[s.id];
  const long = (s.years ?? 12) > 12;
  const ranges: RangeKey[] = long ? ["5Y", "10Y", "25Y", "All"] : ["1Y", "2Y", "5Y", "10Y"];
  const yoyPct = data && data.changeYoY != null && ["$", "k", "M", "", "idx"].includes(s.unit) ? (data.changeYoY / (data.last - data.changeYoY)) * 100 : null;
  return (
    <Card
      title={s.title}
      sub={
        data ? (
          <>
            <span style={{ color: "var(--text)", fontWeight: 600 }}>{fmtValue(s.id, s.unit, data.last)}</span> · {data.lastDate}
            {data.changeYoY != null && (
              <>
                {" "}
                · YoY{" "}
                {yoyPct != null ? (
                  <Pct v={yoyPct} />
                ) : (
                  `${data.changeYoY >= 0 ? "+" : ""}${data.changeYoY.toLocaleString("en-US", { maximumFractionDigits: 2 })}${s.unit === "%" ? " pts" : ""}`
                )}
              </>
            )}
          </>
        ) : (
          "Unavailable today"
        )
      }
      link={{ href: `https://fred.stlouisfed.org/series/${s.id}`, label: `FRED ${s.id}` }}
      explain={explain ?? s.id}
    >
      {data && (
        <SeriesChart
          points={thin(d ? data.points.map((p) => ({ t: p.t, v: p.v / d.div })) : data.points)}
          unit={s.unit === "%" ? "%" : (d?.unit ?? "")}
          refs={s.refs}
          storageKey={`fred:${s.id}`}
          ranges={ranges}
          defaultRange={long ? "25Y" : "10Y"}
          decimals={2}
        />
      )}
    </Card>
  );
}

function DerivedCard({
  title,
  points,
  unit = "",
  explain,
  refs,
  long = false,
  sub,
}: {
  title: string;
  points: Point[];
  unit?: string;
  explain: string;
  refs?: FredSeries["refs"];
  long?: boolean;
  sub?: string;
}) {
  const end = points[points.length - 1];
  return (
    <Card
      title={title}
      sub={
        end ? (
          <>
            <span style={{ color: "var(--text)", fontWeight: 600 }}>
              {end.v.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              {unit}
            </span>{" "}
            · {end.t}
            {sub ? ` · ${sub}` : ""}
          </>
        ) : (
          "Unavailable today"
        )
      }
      explain={explain}
    >
      {end && (
        <SeriesChart
          points={thin(points)}
          unit={unit}
          refs={refs}
          storageKey={`derived:${explain}`}
          ranges={long ? ["5Y", "10Y", "25Y", "All"] : ["1Y", "2Y", "5Y", "10Y"]}
          defaultRange={long ? "25Y" : "10Y"}
          decimals={2}
        />
      )}
    </Card>
  );
}

/** Pack a region's series onto one date axis so the client payload stays small. */
function packRegion(r: RegionRow): RegionSeries {
  const dates = r.series.listings.filter((p) => p.t >= "2016-07").map((p) => p.t);
  const at = (pts: Point[]) => {
    const m = new Map(pts.map((p) => [p.t, p.v]));
    return dates.map((t) => m.get(t) ?? null);
  };
  return {
    code: r.code,
    name: r.name,
    kind: r.kind,
    dates,
    listings: at(r.series.listings),
    norm: at(r.series.norm),
    cutShare: at(r.series.cutShare),
    dom: at(r.series.dom),
    listPrice: at(r.series.listPrice),
  };
}

function Scored({ v, k, fmt }: { v: number | null; k: keyof typeof REGION_SCALES; fmt: (v: number) => string }) {
  if (v == null) return <span className="faint">—</span>;
  const [calm, stress] = REGION_SCALES[k];
  const s = toScore(v, calm, stress);
  return <span style={{ color: s < 15 ? "var(--muted)" : stressColor(s) }}>{fmt(v)}</span>;
}

const sg = (d = 1, suffix = "%") => (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(d)}${suffix}`;

function RegionTable({ rows, storageKey, foreclosures }: { rows: RegionRow[]; storageKey: string; foreclosures?: Record<string, Point[]> }) {
  const fc = (code: string) => {
    const pts = foreclosures?.[code];
    if (!pts?.length) return null;
    return { v: pts[pts.length - 1].v, yoy: yoy(pts, "diff", 40).at(-1)?.v ?? null };
  };
  return (
    <SortableTable
      storageKey={storageKey}
      columns={[
        { label: "Region" },
        { label: "Score", align: "left", firstDir: "desc" },
        { label: "Listings YoY", firstDir: "desc" },
        { label: "vs 2017–19", title: "Active listings vs. the 2017–19 average for the same month", firstDir: "desc" },
        { label: "New listings YoY", firstDir: "desc" },
        { label: "Price cuts", title: "Share of listings with a price cut, and change vs a year ago", firstDir: "desc" },
        { label: "Days on mkt", firstDir: "desc" },
        { label: "List price YoY", firstDir: "asc" },
        { label: "Unemp. YoY", title: "State unemployment rate change vs a year ago", firstDir: "desc" },
        { label: "FHFA HPI YoY", title: "FHFA all-transactions index, quarterly", firstDir: "asc" },
        ...(foreclosures
          ? [{ label: "Foreclosures", title: "Share of consumers with a new foreclosure this quarter (NY Fed/Equifax; covers 11 states), and change vs a year ago", firstDir: "desc" as const }]
          : []),
      ]}
      rows={rows.map((r) => ({
        key: r.code,
        title: `Realtor.com data as of ${r.asOf ?? "—"}${r.hpiAsOf ? `; FHFA as of ${r.hpiAsOf}` : ""}`,
        sort: [r.name, r.score, r.listingsYoY, r.vsPrePandemic, r.newListingsYoY, r.cutShareYoY, r.domYoY, r.listPriceYoY, r.unemploymentYoY, r.hpiYoY, ...(foreclosures ? [fc(r.code)?.v ?? null] : [])],
        cells: [
          <>
            <span className="sym">{r.name}</span>
            {r.kind === "metro" && <span className="name">{r.state}</span>}
          </>,
          r.score == null ? (
            <span className="faint">—</span>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6, width: 90 }}>
              <div className="bar" style={{ flex: 1, minWidth: 40 }}>
                <span style={{ width: `${Math.max(3, r.score)}%`, background: stressColor(r.score) }} />
              </div>
              <span style={{ color: stressColor(r.score), width: 22 }}>{r.score}</span>
            </div>
          ),
          <Scored v={r.listingsYoY} k="listingsYoY" fmt={sg(0)} />,
          <Scored v={r.vsPrePandemic} k="vsPrePandemic" fmt={sg(0)} />,
          r.newListingsYoY == null ? <span className="faint">—</span> : <span className="muted">{sg(0)(r.newListingsYoY)}</span>,
          <>
            {r.cutShare == null ? "—" : `${r.cutShare.toFixed(0)}%`}{" "}
            <Scored v={r.cutShareYoY} k="cutShareYoY" fmt={(v) => `(${sg(1, "")(v)})`} />
          </>,
          <>
            {r.dom ?? "—"} <Scored v={r.domYoY} k="domYoY" fmt={(v) => `(${sg(0, "")(v)})`} />
          </>,
          <Scored v={r.listPriceYoY} k="listPriceYoY" fmt={sg(1)} />,
          <Scored v={r.unemploymentYoY} k="unemploymentYoY" fmt={sg(1, "")} />,
          <Scored v={r.hpiYoY} k="hpiYoY" fmt={sg(1)} />,
          ...(foreclosures
            ? [
                (() => {
                  const f = fc(r.code);
                  if (!f) return <span className="faint">—</span>;
                  return (
                    <>
                      {f.v.toFixed(3)}%{" "}
                      {f.yoy != null && (
                        <span style={{ color: f.yoy > 0.003 ? stressColor(toScore(f.yoy, 0, 0.02)) : "var(--muted)" }}>({sg(3, "")(f.yoy)})</span>
                      )}
                    </>
                  );
                })(),
              ]
            : []),
        ],
      }))}
    />
  );
}

export default async function Page() {
  const d = await getDashboardData();
  const meta = (id: string) => FRED_SERIES.find((s) => s.id === id)!;
  const fc = (id: string, explain?: string) => <FredCard key={id} s={meta(id)} data={d.fred[id]} explain={explain} />;

  const historyRows = d.history.map((h) => ({ date: h.date, score: h.score, ...h.stages }));

  const builderQuotes = BUILDERS.tickers
    .map((t) => d.quotes[t.symbol])
    .filter(Boolean)
    .map((q) => ({ symbol: q.symbol, name: q.name, points: q.points.slice(-504) }));

  // SLOOS: GSE-eligible and non-GSE tightening on one chart.
  const sloosRows = (() => {
    const m = new Map<string, Record<string, number | string | null>>();
    for (const [key, id] of [["gse", "SUBLPDHMSENQ"], ["qm", "SUBLPDHMSQNQ"]] as const)
      for (const p of d.fred[id]?.points ?? []) m.set(p.t, { ...(m.get(p.t) ?? { t: p.t }), [key]: p.v });
    return [...m.values()].sort((a, b) => String(a.t).localeCompare(String(b.t)));
  })();

  // Delinquencies vs unemployment since 1991: the 2008 combination.
  const comboRows = (() => {
    const ur = new Map((d.fred.UNRATE?.points ?? []).map((p) => [p.t, p.v]));
    return (d.fred.DRSFRMACBS?.points ?? []).map((p) => ({ t: p.t, dq: p.v, ur: ur.get(p.t) ?? null }));
  })();

  const fcNorm = d.nyfed ? foreclosureNorm(d.nyfed.foreclosures) : null;
  const FC_STATES = ["US", "FL", "TX", "AZ", "CA", "NV", "OH"];
  const stateFcKeys = FC_STATES.filter((c) => d.nyfed?.stateForeclosures[c]).map((c, i) => ({
    key: c,
    label: c === "US" ? "US (all)" : c,
    color: c === "US" ? "var(--faint)" : `var(--s${i || 1})`,
    dash: c === "US",
  }));
  const stateFcRows = (() => {
    const m = new Map<string, Record<string, number | string | null>>();
    for (const k of stateFcKeys)
      for (const p of d.nyfed?.stateForeclosures[k.key] ?? []) m.set(p.t, { ...(m.get(p.t) ?? { t: p.t }), [k.key]: p.v });
    return [...m.values()].sort((a, b) => String(a.t).localeCompare(String(b.t)));
  })();

  const csYoY = yoy(d.fred.CSUSHPINSA?.points ?? []).map((p) => ({ t: p.t, v: +p.v.toFixed(2) }));
  const insurance = d.fred.CUUR0000SEHD;
  const insuranceYoY = insurance ? yoy(insurance.points) : [];

  const stateRows = d.regions.filter((r) => r.kind === "state");
  const metroRows = d.regions.filter((r) => r.kind === "metro").sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const flRows = d.regions.filter((r) => r.state === "FL");
  const packed = d.regions.map(packRegion);
  const hottest = [...d.regions].filter((r) => r.code !== "US" && r.score != null).sort((a, b) => b.score! - a.score!).slice(0, 3);

  const n = d.nahb;
  const updated = new Date(d.generatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" });

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <h1>Housing Market Monitor</h1>
          <p>
            US housing stress, ordered by timing. A bust usually shows up in this order: financing → builders → demand &
            inventory → prices → defaults. Leading signals at the top, confirmation at the bottom.
          </p>
        </div>
        <div className="stamp">
          Updated {updated} ET · refreshes daily · <ResetSettings />
        </div>
      </header>

      <nav className="toc" aria-label="Sections">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`}>
            {s.label}
          </a>
        ))}
      </nav>

      <section id="signals" style={{ marginTop: 0 }}>
        <div className="grid hero">
          <div className="card">
            <h3>Housing stress level</h3>
            <p className="sub">{d.signals.length} signals, each a z-score vs. its own 10-year history, weighted toward leading stages</p>
            <Gauge score={d.score} />
            <p className="note">
              Green below 40, yellow 40–59, red 60 and up. A z of 0 (the 10-year average) scores 33; +1σ scores 67; +2σ or more scores
              100. A heuristic, not a forecast.
            </p>
          </div>
          <ForcedSellingCard f={d.forced} />
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <h3>The sequence</h3>
          <p className="sub">Stage scores, leading to lagging. Click a stage to jump to its charts.</p>
          <StageFlow stages={d.stages} />
          <p className="note">
            Weights: leading stages (financing, builders) count 1.5×, demand & inventory 1.25×, prices 0.75×, the rest 1×.
            {hottest.length > 0 && (
              <>
                {" "}
                Most stressed regions: {hottest.map((r) => `${r.name} (${r.score})`).join(", ")}.{" "}
                <a href="#regions">Drill down ↓</a>
              </>
            )}
          </p>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <h3>All signals</h3>
          <p className="sub">Grouped by stage. Hover a row for what it measures. z is signed so positive always means more stress.</p>
          <SignalTable signals={d.signals} />
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <h3>Score history</h3>
          {historyRows.length >= 2 ? (
            <>
              <p className="sub">Daily snapshots stored by the refresh job</p>
              <HistoryChart
                rows={historyRows}
                keys={[
                  { key: "score", label: "Composite", color: "var(--stress)", axis: "left" },
                  { key: "financing", label: "Financing", color: "var(--s1)", axis: "left" },
                  { key: "builders", label: "Builders", color: "var(--s2)", axis: "left" },
                  { key: "supply", label: "Demand & inventory", color: "var(--s4)", axis: "left" },
                  { key: "credit", label: "Credit", color: "var(--s6)", axis: "left" },
                ]}
              />
            </>
          ) : (
            <p className="sub">
              {historyEnabled()
                ? `Collecting daily snapshots (${historyRows.length} so far). The chart appears after the second day.`
                : "Connect a Vercel Blob store to this project to record the score and stage scores every day and chart them here."}
            </p>
          )}
          <Explain id="history" />
        </div>
      </section>

      <section id="financing">
        <h2>1 · Financing and rates</h2>
        <p className="blurb">Leading. Credit tightens before demand falls. Wide spreads mean lenders are nervous.</p>
        <div className="grid g2">
          {fc("MORTGAGE30US")}
          <DerivedCard
            title="Mortgage spread over the 10-year Treasury"
            points={d.derived.mortgageSpread}
            unit="%"
            explain="spread"
            refs={[{ y: 1.7, label: "pre-2022 norm", tone: "calm" }, { y: 3, label: "stress", tone: "stress" }]}
            long
          />
          <Card title="Banks tightening mortgage standards (net %)" sub="Fed Senior Loan Officer Survey, quarterly. Positive = tightening." explain="sloos" link={{ href: "https://www.federalreserve.gov/data/sloos.htm", label: "Fed SLOOS" }}>
            <LinesChart
              rows={sloosRows}
              keys={[
                { key: "gse", label: "GSE-eligible", color: "var(--s1)" },
                { key: "qm", label: "Non-GSE (QM, non-jumbo)", color: "var(--s2)" },
              ]}
              unit="%"
              refs={[{ y: 0, label: "neutral", tone: "watch" }]}
              storageKey="sloos"
            />
          </Card>
          {fc("SUBLPDHMDENQ")}
        </div>
        <p className="note">
          MBA weekly purchase applications are paywalled, so they aren&apos;t charted; the bank-reported demand series above is the
          free proxy. MBA&apos;s headline numbers appear in the &ldquo;Mortgage rates & applications&rdquo; news feed below.
        </p>
      </section>

      <section id="builders">
        <h2>2 · Builders and markets</h2>
        <p className="blurb">Leading. Builders must sell inventory, so they cut prices and add incentives before resale sellers do.</p>
        <div className="grid g2">
          <Card title="Homebuilder stocks vs. S&P 500" explain="builders">
            <RelativeChart series={builderQuotes} storageKey="builders" />
            <div style={{ marginTop: 12 }}>
              <QuoteTable quotes={BUILDERS.tickers.map((t) => d.quotes[t.symbol]).filter(Boolean)} storageKey="table:builders-quotes" />
            </div>
          </Card>
          <div className="grid" style={{ alignContent: "start" }}>
            <DerivedCard
              title="ITB ÷ SPY (homebuilders relative to the market)"
              points={d.derived.itbSpy}
              explain="itbspy"
              sub={(() => {
                const c = d.derived.itbSpy26w.at(-1);
                return c ? `26-week change ${c.v >= 0 ? "+" : ""}${c.v.toFixed(1)}%` : undefined;
              })()}
            />
            <Card
              title="NAHB/Wells Fargo builder sentiment (HMI)"
              sub={n ? n.headline ?? undefined : "Unavailable today"}
              explain="hmi"
              link={{ href: "https://www.nahb.org/news-and-economics/housing-economics/indices/housing-market-index", label: "NAHB" }}
            >
              {n && (
                <>
                  <div className="stat-row">
                    <div>
                      <div className="big" style={{ color: stressColor(toScore(n.hmi.at(-1)!.v, 55, 25)) }}>{n.hmi.at(-1)!.v}</div>
                      <div className="lbl">HMI, {n.month ?? n.hmi.at(-1)!.t.slice(0, 7)}</div>
                    </div>
                    {n.priceCutShare != null && (
                      <div>
                        <div className="big" style={{ color: stressColor(toScore(n.priceCutShare, 15, 45)) }}>{n.priceCutShare}%</div>
                        <div className="lbl">builders cutting prices{n.avgPriceCut != null ? ` (avg ${n.avgPriceCut}%)` : ""}</div>
                      </div>
                    )}
                    {n.incentiveShare != null && (
                      <div>
                        <div className="big" style={{ color: stressColor(toScore(n.incentiveShare, 30, 75)) }}>{n.incentiveShare}%</div>
                        <div className="lbl">using sales incentives</div>
                      </div>
                    )}
                  </div>
                  <SeriesChart
                    points={n.hmi}
                    refs={[{ y: 50, label: "neutral", tone: "watch" }]}
                    ranges={["5Y", "10Y", "25Y", "All"]}
                    defaultRange="All"
                    storageKey="nahb:hmi"
                    decimals={0}
                  />
                </>
              )}
            </Card>
          </div>
        </div>
        <div className="card" style={{ marginTop: 14 }}>
          <h3>Cancellations and incentives from earnings reports</h3>
          <p className="sub">
            Reviewed {BUILDER_REPORTS.reviewed}. {BUILDER_REPORTS.note}
          </p>
          <BuildersTable rows={BUILDER_REPORTS.builders} />
          <Explain id="buildersTable" />
        </div>
      </section>

      <section id="supply">
        <h2>3 · Demand and supply</h2>
        <p className="blurb">
          Inventory is the bridge from a frozen market to a falling one. Realtor.com&apos;s listings, price cuts and days on market are
          some of the best early signs of seller stress.
        </p>
        <div className="grid g3">
          {fc("MSACSR")}
          {fc("HSN1F")}
          {fc("EXHOSLUSM495S")}
          {fc("ACTLISCOUUS")}
          <DerivedCard title="Share of listings with a price cut" points={d.derived.cutShare} unit="%" explain="cutShare" />
          {fc("MEDDAYONMARUS")}
          {fc("NEWLISCOUUS")}
          {fc("HOUST")}
          {fc("PERMIT")}
        </div>
      </section>

      <section id="affordability">
        <h2>4 · Affordability</h2>
        <p className="blurb">How stretched buyers and valuations are. Stretched affordability is the fuel; it needs a trigger.</p>
        <div className="grid g3">
          <DerivedCard
            title="Mortgage payment as a share of median income"
            points={d.derived.paymentToIncome}
            unit="%"
            explain="payment"
            refs={[{ y: 25, label: "stretched", tone: "watch" }]}
            long
          />
          <DerivedCard title="Price-to-income ratio" points={d.derived.priceToIncome} unit="x" explain="pti" long />
          <DerivedCard title="Price-to-rent ratio (Jan 2000 = 100)" points={d.derived.priceToRent} explain="ptr" long />
        </div>
      </section>

      <section id="prices">
        <h2>5 · Prices</h2>
        <p className="blurb">Lagging. By the time national prices fall, the earlier stages have usually turned.</p>
        <div className="grid g3">
          <DerivedCard
            title="Case-Shiller national, year over year"
            points={csYoY}
            unit="%"
            explain="CSUSHPINSA"
            refs={[{ y: 0, label: "falling", tone: "stress" }]}
            long
          />
          {fc("MSPUS")}
          {fc("MEDLISPRIUS")}
        </div>
      </section>

      <section id="credit">
        <h2>6 · Credit stress</h2>
        <p className="blurb">Lagging, but it&apos;s the crash confirmation: forced sellers show up here.</p>
        <div className="grid g2">
          <Card title="Delinquencies vs. unemployment" sub="The 2008 combination. Quarterly delinquency (left), unemployment rate (right)." explain="combo">
            <LinesChart
              rows={comboRows}
              keys={[
                { key: "dq", label: "Mortgage delinquency", color: "var(--stress)" },
                { key: "ur", label: "Unemployment", color: "var(--s1)", axis: "right" },
              ]}
              unit="%"
              rightUnit="%"
              ranges={["10Y", "25Y", "All"]}
              defaultRange="All"
              decimals={2}
              storageKey="combo"
              height={260}
            />
          </Card>
          {fc("DRSFRMACBS")}
          <DerivedCard
            title="New foreclosures per quarter (thousands)"
            points={d.nyfed?.foreclosures ?? []}
            explain="foreclosures"
            refs={fcNorm ? [{ y: +fcNorm.toFixed(0), label: "2017–19 avg", tone: "watch" }] : undefined}
            long
            sub={d.nyfed ? `NY Fed report ${d.nyfed.report.toUpperCase()}` : undefined}
          />
          <DerivedCard
            title="Mortgages newly 90+ days late, all lenders"
            points={d.nyfed?.mortgageSeriousFlow ?? []}
            unit="%"
            explain="seriousFlow"
            long
          />
          <Card title="New foreclosures by state" sub="Share of consumers with a new foreclosure in the quarter (NY Fed/Equifax)" explain="stateForeclosures">
            <LinesChart
              rows={stateFcRows}
              keys={stateFcKeys}
              unit="%"
              decimals={3}
              ranges={["5Y", "10Y", "25Y"]}
              defaultRange="25Y"
              storageKey="nyfed:states"
              height={260}
            />
          </Card>
        </div>
        <p className="note">
          Foreclosures here count people with a new foreclosure on their credit report, a close stand-in for foreclosure starts. Not
          automated: FHA delinquencies (MBA National Delinquency Survey, paywalled; FHA borrowers have the thinnest cushions and crack
          first) and ATTOM&apos;s monthly foreclosure filings. Both show up in the &ldquo;Delinquencies & foreclosures&rdquo; news feed.
        </p>
      </section>

      <section id="macro">
        <h2>7 · Macro triggers</h2>
        <p className="blurb">A housing crash needs forced sellers, and forced sellers come from layoffs, not just high rates.</p>
        <div className="grid g3">
          {fc("UNRATE")}
          {fc("SAHMREALTIME")}
          {fc("ICSA")}
          {fc("DGS10")}
          {fc("T10Y2Y")}
          {fc("RRVRUSQ156N")}
        </div>
      </section>

      <section id="regions">
        <h2>Regional drill-down</h2>
        <p className="blurb">
          Housing busts start local. National data can look fine while Florida or Texas inventory surges. Scores use fixed thresholds
          (local history is too short for 10-year z-scores); colored numbers are the ones moving toward stress.
        </p>
        <div className="card">
          <h3>States</h3>
          <RegionTable rows={stateRows} storageKey="table:states" foreclosures={d.nyfed?.stateForeclosures} />
        </div>
        <div className="card" style={{ marginTop: 14 }}>
          <h3>Metros, most stressed first</h3>
          <RegionTable rows={metroRows} storageKey="table:metros" />
          <Explain id="regions" />
        </div>
        <div style={{ marginTop: 14 }}>
          <RegionDrill regions={packed} />
        </div>
      </section>

      <section id="florida">
        <h2>Florida</h2>
        <p className="blurb">
          Florida carries its own risks: insurance premiums that have risen far faster than the national CPI shows, and condo
          associations facing post-Surfside structural inspection and reserve-funding requirements that push special assessments and
          dues onto owners. Older condos are where forced selling shows up first.
        </p>
        <div className="card">
          <h3>Florida metros</h3>
          <RegionTable rows={flRows} storageKey="table:florida" foreclosures={d.nyfed?.stateForeclosures} />
        </div>
        <div className="grid g2" style={{ marginTop: 14 }}>
          <FredCard
            s={meta("CUUR0000SEHD")}
            data={insurance}
            explain="CUUR0000SEHD"
          />
          <div className="card">
            <h3>News: Florida condos & insurance</h3>
            <NewsList items={d.news.find((x) => x.id === "florida")?.items ?? []} />
            {insuranceYoY.length > 0 && (
              <p className="note">
                National household insurance CPI {insuranceYoY.at(-1)!.v >= 0 ? "+" : ""}
                {insuranceYoY.at(-1)!.v.toFixed(1)}% YoY. Check Citizens Property Insurance policy counts and condo special-assessment
                stories for local detail.
              </p>
            )}
          </div>
        </div>
      </section>

      <section id="news">
        <h2>News, last 7 days</h2>
        <p className="blurb">Google News searches, refreshed daily.</p>
        <div className="grid g3">
          {d.news
            .filter((x) => x.id !== "florida")
            .map((x) => (
              <div className="card" key={x.id}>
                <h3>{x.title}</h3>
                <NewsList items={x.items} />
              </div>
            ))}
        </div>
      </section>

      <section id="playbook">
        <h2>Reading it</h2>
        <div className="grid g2">
          <div className="card">
            <h3>Frozen vs. falling</h3>
            <ul className="muted" style={{ paddingLeft: 18, margin: 0 }}>
              <li>2008 happened because forced selling (bad loans plus job losses) met falling prices.</li>
              <li>
                Today most owners have locked-in low rates and lots of equity, so high rates mostly freeze the market: low sales, low
                listings, prices holding.
              </li>
              <li>
                The tell that a freeze is turning into a fall is the forced-selling check at the top: delinquencies and unemployment
                rising together.
              </li>
              <li>Builders are the exception: they must sell, so their incentives and cancellations show weakness first.</li>
            </ul>
          </div>
          <div className="card">
            <h3>What this page can&apos;t automate</h3>
            <ul className="muted" style={{ paddingLeft: 18, margin: 0 }}>
              <li>MBA weekly purchase applications and FHA/VA delinquencies (National Delinquency Survey).</li>
              <li>ATTOM monthly foreclosure starts.</li>
              <li>Builder earnings calls: cancellation rates, incentive spending, spec inventory. The table above is updated by hand.</li>
              <li>Florida: Citizens policy counts, condo association special assessments, insurer exits.</li>
              <li>Local MLS data for metros not listed here.</li>
            </ul>
          </div>
        </div>
        <p className="note">
          Data: FRED (Freddie Mac, Census, BLS, Fed, FHFA, S&P CoreLogic Case-Shiller, Realtor.com), NAHB, Yahoo Finance, company
          earnings releases, Google News. Not investment advice.
        </p>
      </section>

      {d.errors.length > 0 && (
        <details className="errors">
          <summary>{d.errors.length} data feeds were unavailable on the last refresh</summary>
          <ul>
            {d.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}
