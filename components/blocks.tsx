import type { NewsItem } from "@/lib/news";
import { STAGES } from "@/lib/config";
import type { BuilderReport } from "@/lib/builders";
import { scoreLabel, type ForcedSelling, type Signal, type StageScore } from "@/lib/signals";
import { EXPLAIN } from "@/lib/explain";
import { SortableTable } from "./sortable-table";
import { stressColor, stressColorDim, toScore } from "@/lib/stress-color";
import type { Quote } from "@/lib/yahoo";

export function Pct({ v, digits = 1 }: { v: number | null | undefined; digits?: number }) {
  if (v == null || !Number.isFinite(v)) return <span className="faint">—</span>;
  return (
    <span className={v > 0 ? "up" : v < 0 ? "down" : undefined}>
      {v > 0 ? "+" : ""}
      {v.toFixed(digits)}%
    </span>
  );
}

const toneVar = (score: number) => stressColor(score);

/** Semicircle gauge for the composite score. */
export function Gauge({ score }: { score: number | null }) {
  const s = score ?? 0;
  const { label } = scoreLabel(s);
  const r = 80;
  const cx = 100;
  const cy = 96;
  const angle = Math.PI * (1 - s / 100);
  const arc = (from: number, to: number) => {
    const a0 = Math.PI * (1 - from / 100);
    const a1 = Math.PI * (1 - to / 100);
    return `M ${cx + r * Math.cos(a0)} ${cy - r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(a1)} ${cy - r * Math.sin(a1)}`;
  };
  // The arc is drawn as short segments so it can shade continuously from
  // green to red; the part beyond the score stays faint.
  const STEP = 2;
  const segments = Array.from({ length: 100 / STEP }, (_, i) => i * STEP);
  return (
    <div style={{ textAlign: "center" }}>
      <svg viewBox="0 0 200 110" width="100%" style={{ maxWidth: 280 }} role="img" aria-label={`Housing stress score ${s} of 100, ${label}`}>
        {segments.map((a) => {
          const filled = score != null && a < s;
          return (
            <path
              key={a}
              d={arc(a, Math.min(100, a + STEP + 0.4))}
              // Opaque muted tint of the same hue, so overlapping segments leave no seams.
              stroke={filled ? stressColor(a + STEP / 2) : stressColorDim(a + STEP / 2)}
              strokeWidth={14}
              fill="none"
            />
          );
        })}
        <line
          x1={cx}
          y1={cy}
          x2={cx + (r - 22) * Math.cos(angle)}
          y2={cy - (r - 22) * Math.sin(angle)}
          stroke="var(--text)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={4} fill="var(--text)" />
      </svg>
      <div className="big" style={{ fontSize: 40, marginTop: -6 }}>
        {score ?? "—"}
        <span className="faint" style={{ fontSize: 16 }}> / 100</span>
      </div>
      <div style={{ fontWeight: 650, fontSize: 15, color: stressColor(s) }}>{label}</div>
    </div>
  );
}

function fmtPrice(v: number) {
  return v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : v.toFixed(2);
}

export function QuoteTable({ quotes, storageKey }: { quotes: Quote[]; storageKey?: string }) {
  if (!quotes.length) return <div className="empty">Price data unavailable today.</div>;
  return (
    <SortableTable
      storageKey={storageKey}
      columns={[
        { label: "Ticker" },
        { label: "Last", firstDir: "desc" },
        { label: "1D", firstDir: "desc" },
        { label: "1M", firstDir: "desc" },
        { label: "3M", firstDir: "desc" },
        { label: "YTD", firstDir: "desc" },
        { label: "Off high", title: "Distance below 52-week high", firstDir: "asc" },
      ]}
      rows={quotes.map((q) => ({
        key: q.symbol,
        sort: [q.symbol, q.last, q.chg1d, q.chg1m, q.chg3m, q.chgYtd, q.drawdown],
        cells: [
          <>
            <span className="sym">{q.symbol}</span>
            <span className="name">{q.name}</span>
          </>,
          fmtPrice(q.last),
          <Pct v={q.chg1d} />,
          <Pct v={q.chg1m} />,
          <Pct v={q.chg3m} />,
          <Pct v={q.chgYtd} />,
          <span style={{ color: q.drawdown > -3 ? "var(--muted)" : stressColor(toScore(q.drawdown, -3, -40)) }}>
            {q.drawdown.toFixed(1)}%
          </span>,
        ],
      }))}
    />
  );
}

function ago(iso: string) {
  if (!iso) return "";
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (h < 1) return "just now";
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function NewsList({ items }: { items: NewsItem[] }) {
  if (!items.length) return <div className="empty">No headlines in the last 7 days, or the feed is unavailable.</div>;
  return (
    <ul className="news">
      {items.map((n) => (
        <li key={n.link}>
          <a href={n.link} target="_blank" rel="noopener noreferrer">
            {n.title}
          </a>
          <div className="meta">
            {n.source}
            {n.source && n.date ? " · " : ""}
            {ago(n.date)}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** What / why / watch notes under a chart (text lives in lib/explain.ts). */
export function Explain({ id }: { id: string }) {
  const e = EXPLAIN[id];
  if (!e) return null;
  return (
    <dl className="explain">
      <dt>What it is</dt>
      <dd>{e.what}</dd>
      <dt>Why it matters</dt>
      <dd>{e.why}</dd>
      <dt>Watch for</dt>
      <dd>{e.watch}</dd>
    </dl>
  );
}

const stageLabel = Object.fromEntries(STAGES.map((s) => [s.id, s.short]));

function ScoreBar({ score }: { score: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: 130 }}>
      <div className="bar" style={{ flex: 1 }}>
        <span style={{ width: `${Math.max(3, score)}%`, background: stressColor(score) }} />
      </div>
      <span style={{ color: stressColor(score), width: 24 }}>{score}</span>
    </div>
  );
}

export function SignalTable({ signals }: { signals: Signal[] }) {
  const order = Object.fromEntries(STAGES.map((s, i) => [s.id, i]));
  const sorted = [...signals].sort((a, b) => order[a.stage] - order[b.stage] || b.score - a.score);
  return (
    <SortableTable
      storageKey="table:signals"
      columns={[
        { label: "Signal" },
        { label: "Stage", align: "left" },
        { label: "Now" },
        { label: "z", title: "Standard deviations from the 10-year average, signed so positive = more stress", firstDir: "desc" },
        { label: "Stress", align: "left", firstDir: "desc" },
        { label: "Basis", align: "left" },
      ]}
      rows={sorted.map((s) => ({
        key: s.id,
        title: s.detail,
        sort: [s.label, order[s.stage], parseFloat(s.value.replace(/[^0-9.-]/g, "")), s.z, s.score, s.basis],
        cells: [
          <>
            <div style={{ fontWeight: 600 }}>{s.label}</div>
            <div className="faint" style={{ fontSize: 11, whiteSpace: "normal", maxWidth: 340 }}>
              {s.detail}
            </div>
          </>,
          <span className="muted">{stageLabel[s.stage]}</span>,
          <>
            {s.value}
            <div className="faint" style={{ fontSize: 10 }}>{s.asOf}</div>
          </>,
          s.z == null ? <span className="faint">—</span> : <span style={{ color: stressColor(Math.max(0, Math.min(100, ((s.z + 1) / 3) * 100))) }}>{s.z > 0 ? "+" : ""}{s.z.toFixed(1)}</span>,
          <ScoreBar score={s.score} />,
          <span className="faint" style={{ fontSize: 11 }}>{s.basis}</span>,
        ],
      }))}
    />
  );
}

/** The bust sequence as a strip: each stage's score, leading on the left. */
export function StageFlow({ stages }: { stages: StageScore[] }) {
  return (
    <div className="flow">
      {stages.map((s, i) => (
        <a key={s.id} href={`#${s.id}`} className="flow-step" style={{ borderTopColor: s.score == null ? "var(--border)" : stressColor(s.score) }}>
          <div className="faint" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {s.lead} · ×{s.weight}
          </div>
          <div style={{ fontWeight: 600 }}>{s.label}</div>
          <div className="big" style={{ fontSize: 22, color: s.score == null ? "var(--faint)" : stressColor(s.score) }}>
            {s.score ?? "—"}
          </div>
          <div className="faint" style={{ fontSize: 11 }}>{s.count} signals</div>
          {i < stages.length - 1 && <span className="flow-arrow" aria-hidden="true">→</span>}
        </a>
      ))}
    </div>
  );
}

const FORCED_COPY = {
  frozen: {
    label: "Frozen, not falling",
    tone: "calm",
    text: "Neither delinquencies nor unemployment are rising. High rates keep owners with low locked-in rates from selling; that freezes volume rather than forcing prices down.",
  },
  watch: {
    label: "One of two is rising",
    tone: "watch",
    text: "One half of the 2008 combination is moving. Watch whether the other follows: forced selling needs both job losses and stretched borrowers.",
  },
  alarm: {
    label: "Both rising: forced-selling risk",
    tone: "stress",
    text: "Delinquencies and unemployment are rising together. This is the combination that turns a frozen market into a falling one.",
  },
} as const;

function Check({ on, label, children }: { on: boolean; label: string; children: React.ReactNode }) {
  return (
    <div className="check">
      <span className={`pill tone-${on ? "stress" : "calm"}`}>{on ? "rising" : "not rising"}</span>
      <div>
        <div style={{ fontWeight: 600 }}>{label}</div>
        <div className="faint" style={{ fontSize: 12 }}>{children}</div>
      </div>
    </div>
  );
}

const sgn = (v: number | null, d = 1, suffix = "") => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(d)}${suffix}`);

export function ForcedSellingCard({ f }: { f: ForcedSelling }) {
  const c = FORCED_COPY[f.status];
  return (
    <div className="card" style={{ borderColor: `var(--${c.tone})` }}>
      <h3>Forced-selling check</h3>
      <p className="sub">Delinquencies and unemployment rising together</p>
      <div className={`tone-${c.tone}`} style={{ fontSize: 20, fontWeight: 650, margin: "4px 0 6px" }}>
        {c.label}
      </div>
      <p className="muted" style={{ margin: "0 0 10px", fontSize: 13 }}>{c.text}</p>
      <Check on={f.delinquency.rising} label="Mortgage delinquencies">
        {f.delinquency.value?.toFixed(2)}% · {sgn(f.delinquency.yoy, 2, " pts")} YoY{f.delinquency.qoq2 ? " · up two quarters running" : ""} · {f.delinquency.asOf}
        <br />
        Rising = +0.15 pts YoY or two straight quarterly increases
      </Check>
      <Check on={f.jobs.rising} label="Unemployment">
        Sahm {f.jobs.sahm?.toFixed(2) ?? "—"} · rate {sgn(f.jobs.unrateYoY, 1, " pts")} YoY · claims {sgn(f.jobs.claimsYoY, 0, "%")} YoY · {f.jobs.asOf}
        <br />
        Rising = Sahm ≥ 0.3, unemployment +0.4 pts YoY, or claims +15% YoY
      </Check>
    </div>
  );
}

export function BuildersTable({ rows }: { rows: BuilderReport[] }) {
  const vs = (v: number | null, prior: number | null, higherIsWorse = true) =>
    v == null ? (
      <span className="faint">—</span>
    ) : (
      <>
        <span style={prior != null && v !== prior ? { color: (v > prior) === higherIsWorse ? "var(--down)" : "var(--up)" } : undefined}>{v.toFixed(v % 1 ? 1 : 0)}%</span>
        {prior != null && <span className="faint"> vs {prior.toFixed(prior % 1 ? 1 : 0)}%</span>}
      </>
    );
  return (
    <SortableTable
      storageKey="table:builders"
      columns={[
        { label: "Builder" },
        { label: "Quarter", align: "left" },
        { label: "Cancellations", title: "Prior figure is the year-ago quarter unless noted", firstDir: "desc" },
        { label: "Incentives", firstDir: "desc" },
        { label: "Gross margin", firstDir: "asc" },
        { label: "Notes", align: "left", className: "wrap-cell" },
      ]}
      rows={rows.map((b) => ({
        key: b.symbol,
        sort: [b.symbol, b.periodEnd, b.cancellation, b.incentives, b.grossMargin, b.comment],
        cells: [
          <>
            <span className="sym">{b.symbol}</span>
            <span className="name">{b.name}</span>
          </>,
          <>
            {b.quarter}
            <div className="faint" style={{ fontSize: 10 }}>reported {b.reported}</div>
          </>,
          <>
            {vs(b.cancellation, b.cancellationPrior)}
            <div className="faint" style={{ fontSize: 10 }}>of {b.cancellationBasis}</div>
          </>,
          vs(b.incentives, b.incentivesPrior),
          vs(b.grossMargin, b.grossMarginPrior, false),
          <span className="muted" style={{ fontSize: 12 }}>
            {b.comment}{" "}
            <a href={b.source} target="_blank" rel="noopener noreferrer">
              source ↗
            </a>
          </span>,
        ],
      }))}
    />
  );
}
