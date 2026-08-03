/* Phone-alert checker — runs on GitHub Actions every ~5 min.
 * Reads alerts.json, pulls 5-minute bars from Yahoo Finance, and on a FRESH
 * cross of a level pushes a notification to your phone via ntfy.sh.
 * Stateless: fires only on the crossing bar (last two 5m closes straddle the
 * level), so it won't spam while price sits past the level.
 * Set NTFY_TOPIC as a GitHub Actions secret. No API keys, no database.
 */
import fs from "node:fs";

const topic = process.env.NTFY_TOPIC;
if (!topic) console.log("NTFY_TOPIC not set — will check levels but not push.");

const alerts = JSON.parse(fs.readFileSync(new URL("../alerts.json", import.meta.url)));

async function closes(sym) {
  for (const host of ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"]) {
    try {
      const r = await fetch(`${host}/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=5m`,
        { headers: { "User-Agent": "Mozilla/5.0 (compatible; TCC/1.0)" } });
      if (!r.ok) continue;
      const j = await r.json();
      const q = j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
      const c = q.filter((x) => x != null).map(Number);
      if (c.length >= 2) return c;
    } catch (e) { /* next host */ }
  }
  return null;
}

async function push(title, body) {
  if (!topic) return;
  try {
    await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: "POST",
      headers: { Title: title, Priority: "high", Tags: "chart_with_upwards_trend" },
      body,
    });
    console.log("pushed:", title);
  } catch (e) { console.log("ntfy error:", e.message); }
}

let hits = 0;
for (const a of alerts) {
  const sym = String(a.sym || "").toUpperCase();
  const price = Number(a.price);
  const op = String(a.op || "above").toLowerCase();
  if (!sym || !isFinite(price)) continue;
  const c = await closes(sym);
  if (!c) { console.log(`${sym}: no data`); continue; }
  const last = c[c.length - 1], prev = c[c.length - 2];
  const crossedUp = prev < price && last >= price;
  const crossedDown = prev > price && last <= price;
  const hit = (op === "above" && crossedUp) || (op === "below" && crossedDown);
  console.log(`${sym} prev=${prev} last=${last} level=${price} ${op} -> ${hit ? "HIT" : "-"}`);
  if (hit) {
    hits++;
    await push(`${sym} crossed ${op} ${price}`,
      `${a.note ? a.note + " — " : ""}${sym} just crossed ${op} ${price} (now ${last.toFixed(2)})`);
  }
}
console.log(`done — ${hits} alert(s) fired`);
