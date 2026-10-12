import { get, put } from "@vercel/blob";

/**
 * Optional daily snapshots in Vercel Blob. FRED series carry their own
 * history; the composite score, stage scores and NAHB's price-cut and
 * incentive shares don't, so the refresh job stores them here. Without a
 * Blob store connected the dashboard still works; it just can't chart these.
 */

export type Snapshot = {
  date: string;
  score: number | null;
  stages: Record<string, number | null>;
  signals: Record<string, number>;
  nahb?: { month: string | null; priceCutShare: number | null; incentiveShare: number | null };
  forcedSelling?: string;
};

const PATH = "history/snapshots.json";

export const historyEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

export async function readHistory(): Promise<Snapshot[]> {
  if (!historyEnabled()) return [];
  try {
    const res = await get(PATH, { access: "private", useCache: false });
    if (!res?.stream) return [];
    return (await new Response(res.stream).json()) as Snapshot[];
  } catch {
    return [];
  }
}

export async function appendSnapshot(snap: Snapshot): Promise<number> {
  const all = (await readHistory()).filter((s) => s.date !== snap.date);
  all.push(snap);
  all.sort((a, b) => a.date.localeCompare(b.date));
  await put(PATH, JSON.stringify(all), {
    access: "private",
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json",
  });
  return all.length;
}
