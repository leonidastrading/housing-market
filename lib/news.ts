import { cachedFetch } from "./http";

export type NewsItem = { title: string; link: string; source: string; date: string };

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : "";
}

/** Google News RSS search, limited to the last week. */
export async function fetchNews(query: string, limit = 8): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:7d`)}&hl=en-US&gl=US&ceid=US:en`;
  const xml = await (await cachedFetch(url)).text();
  const items: NewsItem[] = [];
  const seen = new Set<string>();
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const source = tag(block, "source");
    let title = tag(block, "title");
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const key = title.toLowerCase().slice(0, 60);
    if (!title || seen.has(key)) continue;
    seen.add(key);
    const pub = tag(block, "pubDate");
    items.push({
      title,
      link: tag(block, "link"),
      source,
      date: pub ? new Date(pub).toISOString() : "",
    });
  }
  return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}
