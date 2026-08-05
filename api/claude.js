/* Vercel serverless function.
 *
 * The browser bundle has no API key in it. It POSTs the same body it used to
 * send to Anthropic directly; this function attaches the key from the server
 * environment and forwards the call. Set ANTHROPIC_API_KEY in the Vercel
 * dashboard (Settings -> Environment Variables). Never commit it.
 */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "POST only" } });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: { message: "ANTHROPIC_API_KEY is not set on the server." },
    });
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });

    const text = await upstream.text();

    // Pass the upstream status through untouched. The app's retry and cooldown
    // logic keys off 429 and 5xx, so masking them here would break the throttle.
    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json");
    // Forward Anthropic's own "retry-after" so the client waits exactly as long
    // as the API asks (often far less than the app's fallback cooldown guess).
    const ra = upstream.headers.get("retry-after");
    if (ra) res.setHeader("Retry-After", ra);
    return res.send(text);
  } catch (e) {
    return res.status(502).json({
      error: { message: "Proxy could not reach Anthropic: " + (e.message || "unknown") },
    });
  }
}
