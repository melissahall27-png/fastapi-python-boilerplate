/* Vercel serverless function — send a text (SMS) alert via Twilio.
 *
 * The browser bundle holds no Twilio secret. It POSTs { text, to } here and this
 * function attaches the account credentials from the server environment and
 * sends the message. Set these in the Vercel dashboard
 * (Settings -> Environment Variables), never commit them:
 *   TWILIO_ACCOUNT_SID   your Account SID (starts "AC...")
 *   TWILIO_AUTH_TOKEN    your Auth Token
 *   TWILIO_FROM          the Twilio number that sends the text, E.164 e.g. +18885551234
 *   ALERT_TO             (optional) default destination if the request omits "to"
 *
 * Until those are set, this returns { ok:false, reason:"not-configured" } with a
 * 200 so the app can no-op quietly instead of erroring.
 */

// Twilio requires E.164 (+ and 10-15 digits). Accept common US input like
// "(555) 123-4567" or "5551234567" and coerce to +1XXXXXXXXXX.
function normalize(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";
  if (s.startsWith("+")) {
    const d = s.slice(1).replace(/\D/g, "");
    return d.length >= 10 && d.length <= 15 ? "+" + d : "";
  }
  const d = s.replace(/\D/g, "");
  if (d.length === 10) return "+1" + d;          // bare US number
  if (d.length === 11 && d[0] === "1") return "+" + d; // 1XXXXXXXXXX
  return d.length >= 10 && d.length <= 15 ? "+" + d : "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, reason: "POST only" });
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) {
    return res.status(200).json({ ok: false, reason: "not-configured" });
  }

  const body = req.body || {};
  const text = String(body.text || "").slice(0, 600).trim();
  const to = normalize(body.to || process.env.ALERT_TO || "");
  if (!text) return res.status(200).json({ ok: false, reason: "no-text" });
  if (!to) return res.status(200).json({ ok: false, reason: "no-destination" });

  try {
    const form = new URLSearchParams({ To: to, From: from, Body: text });
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const r = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + auth,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      }
    );
    const j = await r.json().catch(() => ({}));
    if (r.ok) return res.status(200).json({ ok: true, sid: j.sid || null });
    // Surface Twilio's own message (e.g. unverified trial number) so the app can
    // tell the user exactly what to fix, without leaking credentials.
    return res.status(200).json({
      ok: false,
      reason: "twilio-error",
      status: r.status,
      message: String(j.message || "Twilio rejected the message").slice(0, 200),
    });
  } catch (e) {
    return res.status(200).json({ ok: false, reason: "network", message: (e.message || "unknown").slice(0, 160) });
  }
}
