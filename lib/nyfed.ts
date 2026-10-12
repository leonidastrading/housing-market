import * as XLSX from "xlsx";
import { cachedFetch } from "./http";
import type { Point } from "./yahoo";

/**
 * New York Fed Quarterly Report on Household Debt and Credit (Equifax
 * credit-panel data). Free, quarterly, about six weeks after quarter end.
 * Covers every mortgage on a credit report, not just bank-held loans, so it
 * catches FHA and non-bank borrowers the bank delinquency series misses.
 */
export type NyFed = {
  report: string; // e.g. "2026q2"
  /** Consumers with a new foreclosure notation, thousands per quarter, 2003–. */
  foreclosures: Point[];
  /** Share of mortgage balances newly 90+ days delinquent (annualized %), 2003–. */
  mortgageSeriousFlow: Point[];
  /** Share of consumers with a new foreclosure, by state (only the states the report covers). */
  stateForeclosures: Record<string, Point[]>;
};

const url = (q: string) => `https://www.newyorkfed.org/medialibrary/interactives/householdcredit/data/xls/hhd_c_report_${q}.xlsx`;

/** Most recent quarters first, starting with the one just ended. */
function candidates(n = 4): string[] {
  const d = new Date();
  let y = d.getUTCFullYear();
  let q = Math.floor(d.getUTCMonth() / 3) + 1;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(`${y}q${q}`);
    q -= 1;
    if (q === 0) {
      q = 4;
      y -= 1;
    }
  }
  return out;
}

/** "26:Q2" -> "2026-04-01". */
function quarterDate(label: unknown): string | null {
  const m = String(label ?? "").match(/^(\d{2}):Q([1-4])$/);
  if (!m) return null;
  const yy = Number(m[1]);
  const year = yy < 70 ? 2000 + yy : 1900 + yy;
  return `${year}-${String((Number(m[2]) - 1) * 3 + 1).padStart(2, "0")}-01`;
}

type Rows = (string | number | null)[][];

function sheet(wb: XLSX.WorkBook, name: string): Rows {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`NY Fed report has no "${name}" sheet`);
  return XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1 });
}

/** A column of a table whose first column holds quarter labels. */
function column(rows: Rows, header: string): Point[] {
  const h = rows.find((r) => r.some((c) => typeof c === "string" && c.trim().toUpperCase() === header.toUpperCase()));
  if (!h) throw new Error(`NY Fed column "${header}" not found`);
  const col = h.findIndex((c) => typeof c === "string" && c.trim().toUpperCase() === header.toUpperCase());
  const out: Point[] = [];
  for (const r of rows) {
    const t = quarterDate(r[0]);
    const v = r[col];
    if (t && typeof v === "number" && Number.isFinite(v)) out.push({ t, v: +v.toFixed(3) });
  }
  return out;
}

export async function fetchNyFed(): Promise<NyFed> {
  let wb: XLSX.WorkBook | null = null;
  let report = "";
  for (const q of candidates()) {
    try {
      // retries: 0 — a not-yet-published quarter redirects to an HTML page; just try the previous one.
      const res = await cachedFetch(url(q), { retries: 0 });
      if (!res.headers.get("content-type")?.includes("spreadsheet")) continue;
      wb = XLSX.read(new Uint8Array(await res.arrayBuffer()), { type: "array" });
      report = q;
      break;
    } catch {
      // Try the previous quarter.
    }
  }
  if (!wb) throw new Error("No NY Fed household debt report found for the last four quarters");

  // Page 39: states in rows, quarters across the header row.
  const p39 = sheet(wb, "Page 39 Data");
  const header = p39.find((r) => r.some((c) => quarterDate(c)));
  const stateForeclosures: Record<string, Point[]> = {};
  if (header)
    for (const r of p39) {
      const code = typeof r[0] === "string" ? r[0].trim() : "";
      if (!/^[A-Z]{2,3}$/.test(code)) continue;
      stateForeclosures[code === "ALL" ? "US" : code] = header.flatMap((c, i) => {
        const t = quarterDate(c);
        const v = r[i];
        return t && typeof v === "number" ? [{ t, v: +v.toFixed(4) }] : [];
      });
    }

  return {
    report,
    foreclosures: column(sheet(wb, "Page 17 Data"), "foreclosure"),
    mortgageSeriousFlow: column(sheet(wb, "Page 14 Data"), "MORTGAGE"),
    stateForeclosures,
  };
}
