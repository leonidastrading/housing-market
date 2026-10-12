"use client";

import { useMemo } from "react";
import { LinesChart } from "./charts";
import { usePersisted } from "./persisted";

/** One region's monthly Realtor.com series on a shared date axis (compact for the page payload). */
export type RegionSeries = {
  code: string;
  name: string;
  kind: "state" | "metro";
  dates: string[];
  listings: (number | null)[];
  norm: (number | null)[];
  cutShare: (number | null)[];
  dom: (number | null)[];
  listPrice: (number | null)[];
};

function rowsOf(r: RegionSeries, keys: (keyof RegionSeries)[]) {
  return r.dates.map((t, i) => Object.fromEntries([["t", t], ...keys.map((k) => [k, (r[k] as (number | null)[])[i]])]));
}

export function RegionDrill({ regions, initial = "FL" }: { regions: RegionSeries[]; initial?: string }) {
  const [code, setCode] = usePersisted<string>("region:selected", initial, {
    encode: (v) => v,
    decode: (raw) => (typeof raw === "string" && regions.some((r) => r.code === raw) ? raw : undefined),
  });
  const r = regions.find((x) => x.code === code) ?? regions[0];
  const inv = useMemo(() => rowsOf(r, ["listings", "norm"]), [r]);
  const cuts = useMemo(() => rowsOf(r, ["cutShare"]), [r]);
  const dom = useMemo(() => rowsOf(r, ["dom"]), [r]);
  const price = useMemo(() => rowsOf(r, ["listPrice"]), [r]);
  const ranges = ["2Y", "5Y", "10Y"] as const;

  return (
    <div>
      <div className="card-head" style={{ alignItems: "center", marginBottom: 10 }}>
        <label className="muted" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          Region
          <select className="region-select" value={r.code} onChange={(e) => setCode(e.target.value)}>
            <optgroup label="States">
              {regions.filter((x) => x.kind === "state").map((x) => (
                <option key={x.code} value={x.code}>
                  {x.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Metros">
              {regions.filter((x) => x.kind === "metro").map((x) => (
                <option key={x.code} value={x.code}>
                  {x.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <span className="faint" style={{ fontSize: 12 }}>Realtor.com via FRED, monthly</span>
      </div>
      <div className="grid g2">
        <div className="card">
          <h3>Active listings vs. 2017–19 norm</h3>
          <p className="sub">Dashed: average for the same calendar month in 2017–2019</p>
          <LinesChart
            key={`inv-${r.code}`}
            rows={inv}
            keys={[
              { key: "listings", label: "Active listings", color: "var(--s1)" },
              { key: "norm", label: "2017–19 norm", color: "var(--faint)", dash: true },
            ]}
            ranges={[...ranges]}
            decimals={0}
            storageKey="region:inv"
          />
        </div>
        <div className="card">
          <h3>Share of listings with a price cut</h3>
          <p className="sub">Seasonal: compare with the same month last year</p>
          <LinesChart key={`cut-${r.code}`} rows={cuts} keys={[{ key: "cutShare", label: "Price-reduced share", color: "var(--s2)" }]} ranges={[...ranges]} unit="%" storageKey="region:cut" />
        </div>
        <div className="card">
          <h3>Median days on market</h3>
          <LinesChart key={`dom-${r.code}`} rows={dom} keys={[{ key: "dom", label: "Days on market", color: "var(--s4)" }]} ranges={[...ranges]} decimals={0} storageKey="region:dom" />
        </div>
        <div className="card">
          <h3>Median list price</h3>
          <LinesChart key={`price-${r.code}`} rows={price} keys={[{ key: "listPrice", label: "Median list price", color: "var(--s3)" }]} ranges={[...ranges]} unit="$" storageKey="region:price" />
        </div>
      </div>
    </div>
  );
}
