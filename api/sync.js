/* Vercel serverless function — cross-device journal sync.
 *
 * The app is otherwise per-device (localStorage). This lets two devices share a
 * journal by a private "sync code": each device pushes its trades under a key
 * derived from the code, and pulls the other device's trades. Storage is a
 * Vercel KV / Upstash Redis database — connect one in the Vercel dashboard
 * (Storage → Create → KV) and it auto-sets these env vars:
 *   KV_REST_API_URL, KV_REST_API_TOKEN
 * Until a store is connected, this returns { ok:false, reason:"not-configured" }
 * with a 200 so the app degrades gracefully to local-only.
 *
 *   GET  /api/sync?code=XXX        -> { ok, trades:[...] }
 *   POST /api/sync  {code, trades} -> { ok, count }
 */

function cleanCode(raw) {
  return String(raw || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 64);
}

export default async function handler(req, res) {
  // Accept whichever names the connected store uses — Vercel KV sets KV_REST_API_*,
  // an Upstash Redis integration sets UPSTASH_REDIS_REST_* — so either works.
  const base = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!base || !token) return res.status(200).json({ ok: false, reason: "not-configured" });

  const auth = { Authorization: "Bearer " + token };
  const codeRaw = req.method === "POST" ? (req.body && req.body.code) : (req.query && req.query.code);
  const code = cleanCode(codeRaw);
  if (!code) return res.status(200).json({ ok: false, reason: "no-code" });
  const key = "tccsync:" + code;

  try {
    if (req.method === "POST") {
      const trades = (req.body && Array.isArray(req.body.trades)) ? req.body.trades : [];
      const payload = JSON.stringify({ trades, ts: Date.now() });
      if (payload.length > 900000) return res.status(200).json({ ok: false, reason: "too-big" });
      // Upstash REST: POST {base}/set/{key} with the value as the request body.
      const r = await fetch(`${base}/set/${encodeURIComponent(key)}`, { method: "POST", headers: auth, body: payload });
      if (!r.ok) return res.status(200).json({ ok: false, reason: "store-error", status: r.status });
      return res.status(200).json({ ok: true, count: trades.length });
    }

    // GET
    const r = await fetch(`${base}/get/${encodeURIComponent(key)}`, { headers: auth });
    const j = await r.json().catch(() => null);
    const val = j && j.result;
    if (!val) return res.status(200).json({ ok: true, trades: [] });
    let parsed = null;
    try { parsed = JSON.parse(val); } catch (e) { parsed = null; }
    return res.status(200).json({
      ok: true,
      trades: (parsed && Array.isArray(parsed.trades)) ? parsed.trades : [],
      ts: parsed && parsed.ts,
    });
  } catch (e) {
    return res.status(200).json({ ok: false, reason: "network", message: (e.message || "unknown").slice(0, 160) });
  }
}
