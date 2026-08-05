/* Vercel serverless function — free news feed (no AI tokens).
 *
 * Pulls real headlines from Yahoo Finance's public search/news endpoint,
 * server-side, for the watchlist or the broad market. This is the free +
 * instant alternative to the AI "News wire" (which costs an Anthropic call
 * each pull). Query:
 *   /api/news?symbols=NVDA,SPY   -> news for those tickers
 *   /api/news?market=1           -> broad-market news (index ETFs)
 */

const HOSTS = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];
const MARKET = ["SPY", "QQQ", "DIA", "IWM"];

async function newsFor(sym) {
  for (const host of HOSTS) {
    try {
      const url = `${host}/v1/finance/search?q=${encodeURIComponent(sym)}&newsCount=8&quotesCount=0&enableFuzzyQuery=false`;
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; TCC/1.0)" } });
      if (!r.ok) continue;
      const j = await r.json();
      const news = (j && Array.isArray(j.news)) ? j.news : [];
      return news.map(n => ({
        ticker: sym,
        headline: String(n.title || "").slice(0, 180),
        source: String(n.publisher || "").slice(0, 40),
        link: n.link || "",
        ts: n.providerPublishTime ? Number(n.providerPublishTime) * 1000 : null,
      })).filter(n => n.headline);
    } catch (e) { /* try next host */ }
  }
  return [];
}

export default async function handler(req, res) {
  const q = req.query || {};
  const market = String(q.market || "") === "1";
  let syms = String(q.symbols || "")
    .split(",")
    .map(s => s.trim().toUpperCase().replace(/[^A-Z0-9.\-^]/g, ""))
    .filter(Boolean)
    .filter((s, i, a) => a.indexOf(s) === i)
    .slice(0, 8);
  if (market || !syms.length) syms = MARKET;

  const results = await Promise.all(syms.map(newsFor));
  let items = [].concat(...results);

  // De-dupe by headline (the same story shows up under several tickers).
  const seen = new Set();
  items = items.filter(n => {
    const k = n.headline.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  items.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  items = items.slice(0, 18);

  res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");
  return res.status(200).json({ items });
}
