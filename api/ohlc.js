/* Vercel serverless function — OHLC price bars for the in-app chart.
 *
 * The browser can't fetch market data directly (CORS), so this runs
 * server-side. It pulls candles from Yahoo Finance's public chart endpoint
 * and returns a normalized array the chart draws from. No API key needed.
 */

const RANGE_FOR = { "15m": "5d", "60m": "1mo", "1d": "6mo" };

export default async function handler(req, res) {
  const q = req.query || {};
  // Allow "=" (futures, e.g. ES=F) and "^" (indices, e.g. ^GSPC) besides the usual set.
  const sym = String(q.symbol || "").toUpperCase().replace(/[^A-Z0-9.\-=^]/g, "");
  if (!sym) return res.status(400).json({ error: "symbol required" });

  const interval = ["15m", "60m", "1d"].includes(String(q.interval)) ? String(q.interval) : "1d";
  const range = String(q.range || RANGE_FOR[interval] || "6mo");

  const path = `/v8/finance/chart/${encodeURIComponent(sym)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;
  const hosts = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];

  let lastErr = "unknown";
  for (const host of hosts) {
    try {
      const r = await fetch(host + path, { headers: { "User-Agent": "Mozilla/5.0 (compatible; TCC/1.0)" } });
      if (!r.ok) { lastErr = "data source " + r.status; continue; }
      const j = await r.json();
      const result = j && j.chart && j.chart.result && j.chart.result[0];
      if (!result) { lastErr = "no data"; continue; }
      const ts = result.timestamp || [];
      const quote = (result.indicators && result.indicators.quote && result.indicators.quote[0]) || {};
      const bars = [];
      for (let i = 0; i < ts.length; i++) {
        const o = quote.open && quote.open[i];
        const h = quote.high && quote.high[i];
        const l = quote.low && quote.low[i];
        const c = quote.close && quote.close[i];
        if (o == null || h == null || l == null || c == null) continue;
        bars.push({ t: ts[i], o, h, l, c });
      }
      if (!bars.length) { lastErr = "empty series"; continue; }
      res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");
      return res.status(200).json({ symbol: sym, interval, bars });
    } catch (e) {
      lastErr = (e && e.message) || "fetch failed";
    }
  }
  return res.status(502).json({ error: "Could not load price data (" + lastErr + ")." });
}
