"use client";

import { useId, useMemo } from "react";
import { usePersistedChoice, usePersistedSet } from "./persisted";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { t: string; v: number };

const PALETTE = ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6", "--s7", "--s8"].map((v) => `var(${v})`);
const RANGES = { "3M": 63, "6M": 126, "1Y": 252, "2Y": 504, "5Y": 1300, "10Y": 2520, "25Y": 6300, "All": 30000 } as const;
type RangeKey = keyof typeof RANGES;

const axisProps = {
  stroke: "var(--faint)",
  tick: { fill: "var(--faint)", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const fmtTick = (v: number) => compact.format(v);

function fmtDate(t: string) {
  const d = new Date(t + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

const isoDay = (ts: number) => new Date(ts).toISOString().slice(0, 10);

/**
 * A true time axis: points sit at their dates, not at evenly spaced slots.
 * Matters when series have different calendars (fiscal quarters ending in
 * different months) or uneven spacing (thinned older history).
 */
const timeAxis = {
  dataKey: "ts",
  type: "number" as const,
  scale: "time" as const,
  domain: ["dataMin", "dataMax"] as [string, string],
  tickFormatter: (v: number) => fmtDate(isoDay(v)),
};

function withTs<T extends Record<string, unknown>>(rows: T[], key = "t"): (T & { ts: number })[] {
  return rows.map((r) => ({ ...r, ts: Date.parse(`${String(r[key])}T00:00:00Z`) }));
}

export type { RangeKey };

function RangePicker({ value, onChange, options }: { value: RangeKey; onChange: (r: RangeKey) => void; options: RangeKey[] }) {
  return (
    <div className="seg" role="group" aria-label="Time range">
      {options.map((r) => (
        <button key={r} aria-pressed={r === value} onClick={() => onChange(r)}>
          {r}
        </button>
      ))}
    </div>
  );
}

/** Calendar-day cutoff so daily and weekly/monthly series share one picker. */
function sliceByRange<T extends { t: string }>(points: T[], range: RangeKey): T[] {
  if (!points.length) return points;
  const days = Math.round((RANGES[range] / 252) * 365);
  const end = new Date(points[points.length - 1].t);
  end.setDate(end.getDate() - days);
  const cutoff = end.toISOString().slice(0, 10);
  return points.filter((p) => p.t >= cutoff);
}

type Series = { symbol: string; name: string; points: Point[] };

/** Rebased-to-100 performance chart with a toggleable legend. */
export function RelativeChart({
  series,
  defaultRange = "1Y",
  storageKey,
}: {
  series: Series[];
  defaultRange?: RangeKey;
  storageKey?: string;
}) {
  const [range, setRange] = usePersistedChoice<RangeKey>(storageKey && `${storageKey}:range`, defaultRange, ["3M", "6M", "1Y", "2Y"]);
  const [hidden, setHidden] = usePersistedSet(storageKey && `${storageKey}:hidden`);

  const data = useMemo(() => {
    const rows = new Map<string, Record<string, number | string>>();
    for (const s of series) {
      const pts = sliceByRange(s.points, range);
      if (!pts.length) continue;
      const base = pts[0].v;
      for (const p of pts) {
        const row = rows.get(p.t) ?? { t: p.t };
        row[s.symbol] = +((p.v / base) * 100).toFixed(2);
        rows.set(p.t, row);
      }
    }
    return withTs([...rows.values()].sort((a, b) => String(a.t).localeCompare(String(b.t))));
  }, [series, range]);

  return (
    <div>
      <div className="card-head">
        <span className="sub">Rebased to 100 at start of window</span>
        <RangePicker value={range} onChange={setRange} options={["3M", "6M", "1Y", "2Y"]} />
      </div>
      <div style={{ height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis {...timeAxis} minTickGap={40} {...axisProps} />
            <YAxis domain={["auto", "auto"]} width={48} tickFormatter={fmtTick} {...axisProps} />
            <ReferenceLine y={100} stroke="var(--faint)" strokeDasharray="3 3" />
            <Tooltip
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="tt">
                    <div className="tt-date">{isoDay(Number(label))}</div>
                    {[...payload]
                      .sort((a, b) => Number(b.value) - Number(a.value))
                      .map((p) => (
                        <div className="tt-row" key={String(p.dataKey)}>
                          <span style={{ color: p.color }}>{String(p.dataKey)}</span>
                          <span>{(Number(p.value) - 100).toFixed(1)}%</span>
                        </div>
                      ))}
                  </div>
                ) : null
              }
            />
            {series.map((s, i) =>
              hidden.has(s.symbol) ? null : (
                <Line
                  key={s.symbol}
                  type="monotone"
                  dataKey={s.symbol}
                  stroke={s.symbol === "SPY" ? "var(--faint)" : PALETTE[i % PALETTE.length]}
                  strokeDasharray={s.symbol === "SPY" ? "4 3" : undefined}
                  strokeWidth={1.6}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ),
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="legend">
        {series.map((s, i) => (
          <button
            key={s.symbol}
            aria-pressed={!hidden.has(s.symbol)}
            title={s.name}
            onClick={() =>
              setHidden((h) => {
                const n = new Set(h);
                if (n.has(s.symbol)) n.delete(s.symbol);
                else n.add(s.symbol);
                return n;
              })
            }
          >
            <i style={{ background: s.symbol === "SPY" ? "var(--faint)" : PALETTE[i % PALETTE.length] }} />
            {s.symbol}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Single time series with optional calm/stress reference lines. */
export function SeriesChart({
  points,
  unit = "",
  color = "var(--s1)",
  defaultRange = "2Y",
  refs = [],
  decimals = 2,
  storageKey,
  ranges = ["6M", "1Y", "2Y", "5Y"],
}: {
  storageKey?: string;
  ranges?: RangeKey[];
  points: Point[];
  unit?: string;
  color?: string;
  defaultRange?: RangeKey;
  refs?: { y: number; label: string; tone: "calm" | "stress" | "watch" }[];
  decimals?: number;
}) {
  const [range, setRange] = usePersistedChoice<RangeKey>(storageKey && `${storageKey}:range`, defaultRange, ranges);
  const data = useMemo(() => withTs(sliceByRange(points, range)), [points, range]);
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div>
      <div className="card-head" style={{ justifyContent: "flex-end" }}>
        <RangePicker value={range} onChange={setRange} options={ranges} />
      </div>
      <div style={{ height: 170 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis {...timeAxis} minTickGap={40} {...axisProps} />
            <YAxis domain={["auto", "auto"]} width={48} tickFormatter={fmtTick} {...axisProps} />
            {refs.map((r) => (
              <ReferenceLine
                key={r.label}
                y={r.y}
                stroke={`var(--${r.tone})`}
                strokeDasharray="4 3"
                label={{ value: r.label, fill: `var(--${r.tone})`, fontSize: 10, position: "insideTopRight" }}
              />
            ))}
            <Tooltip
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="tt">
                    <div className="tt-date">{isoDay(Number(label))}</div>
                    <div>
                      {Number(payload[0].value).toLocaleString("en-US", { maximumFractionDigits: decimals })}
                      {unit}
                    </div>
                  </div>
                ) : null
              }
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={1.6}
              fill={`url(#${id})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Stored daily snapshots: composite score plus any extra numeric series. */
export function HistoryChart({
  rows,
  keys,
}: {
  rows: Record<string, number | string | null>[];
  keys: { key: string; label: string; color: string; axis: "left" | "right" }[];
}) {
  return (
    <div style={{ height: 220 }}>
      <ResponsiveContainer>
        <LineChart data={withTs(rows, "date")} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis {...timeAxis} minTickGap={40} {...axisProps} />
          <YAxis yAxisId="left" domain={[0, 100]} width={44} {...axisProps} />
          <YAxis yAxisId="right" orientation="right" domain={["auto", "auto"]} width={44} {...axisProps} />
          <Tooltip
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="tt">
                  <div className="tt-date">{isoDay(Number(label))}</div>
                  {payload.map((p) => (
                    <div className="tt-row" key={String(p.dataKey)}>
                      <span style={{ color: p.color }}>{keys.find((k) => k.key === p.dataKey)?.label}</span>
                      <span>{Number(p.value).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : null
            }
          />
          {keys.map((k) => (
            <Line
              key={k.key}
              yAxisId={k.axis}
              type="monotone"
              dataKey={k.key}
              stroke={k.color}
              strokeWidth={1.8}
              dot={rows.length < 30}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}


export type LineKey = { key: string; label: string; color: string; axis?: "left" | "right"; dash?: boolean };

const fmtNum = (v: number, unit: string, decimals: number) =>
  unit === "$"
    ? `$${compact.format(v)}`
    : `${v.toLocaleString("en-US", { maximumFractionDigits: decimals })}${unit}`;

/** Several dated series on a true time axis, optional right axis, range picker and toggleable legend. */
export function LinesChart({
  rows,
  keys,
  storageKey,
  ranges = ["1Y", "2Y", "5Y", "10Y"],
  defaultRange,
  unit = "",
  rightUnit = "",
  decimals = 1,
  refs = [],
  height = 230,
}: {
  rows: Record<string, number | string | null>[];
  keys: LineKey[];
  storageKey?: string;
  ranges?: RangeKey[];
  defaultRange?: RangeKey;
  unit?: string;
  rightUnit?: string;
  decimals?: number;
  refs?: { y: number; label: string; tone: "calm" | "stress" | "watch" }[];
  height?: number;
}) {
  const [range, setRange] = usePersistedChoice<RangeKey>(storageKey && `${storageKey}:range`, defaultRange ?? ranges[ranges.length - 1], ranges);
  const [hidden, setHidden] = usePersistedSet(storageKey && `${storageKey}:hidden`);
  const data = useMemo(() => withTs(sliceByRange(rows as (Record<string, number | string | null> & { t: string })[], range)), [rows, range]);
  const hasRight = keys.some((k) => k.axis === "right");
  return (
    <div>
      {ranges.length > 1 && (
        <div className="card-head" style={{ justifyContent: "flex-end" }}>
          <RangePicker value={range} onChange={setRange} options={ranges} />
        </div>
      )}
      <div style={{ height }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: hasRight ? 0 : 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis {...timeAxis} minTickGap={40} {...axisProps} />
            <YAxis yAxisId="left" domain={["auto", "auto"]} width={52} tickFormatter={(v: number) => fmtNum(v, unit, 1)} {...axisProps} />
            {hasRight && (
              <YAxis yAxisId="right" orientation="right" domain={["auto", "auto"]} width={52} tickFormatter={(v: number) => fmtNum(v, rightUnit, 1)} {...axisProps} />
            )}
            {refs.map((r) => (
              <ReferenceLine
                key={r.label}
                yAxisId="left"
                y={r.y}
                stroke={`var(--${r.tone})`}
                strokeDasharray="4 3"
                label={{ value: r.label, fill: `var(--${r.tone})`, fontSize: 10, position: "insideTopRight" }}
              />
            ))}
            <Tooltip
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="tt">
                    <div className="tt-date">{isoDay(Number(label))}</div>
                    {payload.map((p) => {
                      const k = keys.find((x) => x.key === p.dataKey);
                      return (
                        <div className="tt-row" key={String(p.dataKey)}>
                          <span style={{ color: p.color }}>{k?.label}</span>
                          <span>{fmtNum(Number(p.value), k?.axis === "right" ? rightUnit : unit, decimals)}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : null
              }
            />
            {keys.map((k) =>
              hidden.has(k.key) ? null : (
                <Line
                  key={k.key}
                  yAxisId={k.axis ?? "left"}
                  type="monotone"
                  dataKey={k.key}
                  stroke={k.color}
                  strokeDasharray={k.dash ? "4 3" : undefined}
                  strokeWidth={1.7}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ),
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {keys.length > 1 && (
        <div className="legend">
          {keys.map((k) => (
            <button
              key={k.key}
              aria-pressed={!hidden.has(k.key)}
              onClick={() =>
                setHidden((h) => {
                  const n = new Set(h);
                  if (n.has(k.key)) n.delete(k.key);
                  else n.add(k.key);
                  return n;
                })
              }
            >
              <i style={{ background: k.color }} />
              {k.label}
              {k.axis === "right" ? " (right)" : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
