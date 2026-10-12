import * as XLSX from "xlsx";
import { CONTACT_USER_AGENT } from "./config";
import { cachedFetch } from "./http";
import type { Point } from "./yahoo";

const PAGE = "https://www.nahb.org/news-and-economics/housing-economics/indices/housing-market-index";

export type Nahb = {
  hmi: Point[]; // monthly, seasonally adjusted, 1985–
  /** From the latest release text; NAHB publishes no history for these. */
  month: string | null;
  priceCutShare: number | null;
  avgPriceCut: number | null;
  incentiveShare: number | null;
  headline: string | null;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function pick(text: string, re: RegExp): number | null {
  const m = text.match(re);
  return m ? Number(m[1]) : null;
}

/**
 * NAHB/Wells Fargo Housing Market Index. FRED dropped it, so we read the
 * history spreadsheet linked from NAHB's page, plus the price-cut and
 * incentive shares quoted in the release text.
 */
export async function fetchNahb(): Promise<Nahb> {
  const html = await (await cachedFetch(PAGE, { headers: { "User-Agent": CONTACT_USER_AGENT } })).text();
  const href = html.match(/href="([^"]*national-hmi-history[^"]*\.xls[^"]*)"/i)?.[1];
  if (!href) throw new Error("NAHB history spreadsheet link not found");
  const url = new URL(href.replace(/&amp;/g, "&"), PAGE).toString();
  const buf = await (await cachedFetch(url, { headers: { "User-Agent": CONTACT_USER_AGENT } })).arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });

  const hmi: Point[] = [];
  for (const row of rows) {
    const year = Number(row[0]);
    if (!Number.isInteger(year) || year < 1980) continue;
    for (let m = 0; m < 12; m++) {
      const v = row[m + 1];
      if (typeof v === "number" && Number.isFinite(v)) hmi.push({ t: `${year}-${String(m + 1).padStart(2, "0")}-01`, v });
    }
  }
  if (hmi.length < 24) throw new Error("NAHB history spreadsheet had too few rows");

  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ");
  const month = text.match(new RegExp(`HMI Key Findings:\\s*(${MONTHS.join("|")})\\s+(\\d{4})`))?.slice(1, 3).join(" ") ?? null;
  const headline = text.match(/(Builder confidence[^.]{0,200}\.)/)?.[1]?.trim() ?? null;

  return {
    hmi,
    month,
    priceCutShare: pick(text, /(\d{1,3})% of builders (?:reported )?cut(?:ting)? prices/i),
    avgPriceCut: pick(text, /average price (?:cut|reduction)[^.%]*?(\d{1,2}(?:\.\d)?)%/i),
    incentiveShare: pick(text, /(\d{1,3})% of builders (?:reported )?us(?:ed|ing) (?:sales )?incentives/i),
    headline,
  };
}
