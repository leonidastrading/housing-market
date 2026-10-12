import { CACHE_TAG, REVALIDATE_SECONDS } from "./config";

// An honest UA: FRED's bot filter rejects spoofed browser strings.
const DEFAULT_UA = "housing-market-monitor/1.0 (+https://github.com/leonidastrading/housing-market)";

/**
 * Fetch with the daily cache tag, a timeout and a couple of retries.
 * Every upstream here is free and occasionally rate-limits, so callers
 * treat a thrown error as "this card is unavailable today".
 */
export async function cachedFetch(
  url: string,
  init: { headers?: Record<string, string>; retries?: number; timeoutMs?: number } = {},
): Promise<Response> {
  const { headers = {}, retries = 2, timeoutMs = 15000 } = init;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": DEFAULT_UA, ...headers },
        signal: AbortSignal.timeout(timeoutMs),
        next: { revalidate: REVALIDATE_SECONDS, tags: [CACHE_TAG] },
      });
      if (res.ok) return res;
      lastErr = new Error(`${res.status} ${res.statusText} for ${url}`);
      if (res.status !== 429 && res.status < 500) break;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Run async tasks with a concurrency cap so we don't trip rate limits. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function settle<T>(p: Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await p };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
