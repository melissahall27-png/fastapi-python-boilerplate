/* Vercel serverless function — batch quotes (price + % change) for the watchlist.
 *
 * Replaces the AI-based "Sync quotes" call: this pulls real prices from Yahoo
 * Finance server-side, for many symbols in one request, using ZERO AI tokens.
 * Query: /api/quotes?symbols=IWM,SPY,QQQ
 */

const HOSTS = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];

async function oneQuote(sym) {
  for (const host of HOSTS) {
    try {
      const url = `${host}/v8/finance/chart/${encodeURIComponent(sym)}?range=2d&interval=1d`;
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; TCC/1.0)" } });
      if (!r.ok) continue;
      const j = await r.json();
      const m = j && j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].meta;
      if (!m) continue;
      const price = m.regularMarketPrice != null ? Number(m.regularMarketPrice) : null;
      if (price == null || !isFinite(price)) continue;
      let prev = m.previousClose != null ? Number(m.previousClose)
               : (m.chartPreviousClose != null ? Number(m.chartPreviousClose) : null);
      const changePct = (prev != null && prev !== 0) ? ((price - prev) / prev) * 100 : 0;
      return [sym, { price, changePct }];
    } catch (e) { /* try next host */ }
  }
  return null;
}

export default async function handler(req, res) {
  const raw = String((req.query && req.query.symbols) || "");
  const syms = raw.split(",")
    .map(s => s.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, ""))
    .filter(Boolean)
    .filter((s, i, a) => a.indexOf(s) === i)
    .slice(0, 50);
  if (!syms.length) return res.status(400).json({ error: "symbols required" });

  const results = await Promise.all(syms.map(oneQuote));
  const quotes = {};
  for (const r of results) { if (r) quotes[r[0]] = r[1]; }

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  return res.status(200).json({ quotes });
}
