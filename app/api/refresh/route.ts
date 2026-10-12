import { revalidatePath, revalidateTag } from "next/cache";
import { CACHE_TAG } from "@/lib/config";
import { appendSnapshot, getDashboardData, toSnapshot } from "@/lib/data";
import { historyEnabled } from "@/lib/history";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Called daily by Vercel Cron (see vercel.json). Drops the cached upstream
 * data, re-fetches it, stores a snapshot for the history chart, and
 * rebuilds the page.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  revalidateTag(CACHE_TAG, { expire: 0 });
  const data = await getDashboardData();

  let stored: number | string = "history disabled (no Blob store connected)";
  if (historyEnabled()) {
    try {
      stored = await appendSnapshot(toSnapshot(data));
    } catch (err) {
      stored = `history write failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  revalidatePath("/");

  return Response.json({
    ok: true,
    generatedAt: data.generatedAt,
    score: data.score,
    stages: Object.fromEntries(data.stages.map((s) => [s.id, s.score])),
    forcedSelling: data.forced.status,
    signals: data.signals.length,
    snapshots: stored,
    errors: data.errors,
  });
}
