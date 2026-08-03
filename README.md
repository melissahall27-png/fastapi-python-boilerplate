# Trading Command Center — deploy guide

Your app, ported off the Claude artifact sandbox and ready for Vercel.

## What changed from the artifact version

| Was | Now |
|---|---|
| `window.storage` (artifact-only) | `localStorage`, namespaced under `tcc:` |
| Browser called `api.anthropic.com` directly | Browser calls `/api/claude`; the key stays on the server |
| No way to move your data | **Save a copy** / **Restore** bar at the top |

Nothing else was touched. The journal, watchlist, news, quotes, playbook, coach and review panels are unchanged, including the rate-limit throttle work.

---

## Deploy in five steps

**1. Get an Anthropic API key**
console.anthropic.com → API Keys → Create Key. Copy it now; it's only shown once. Add a little credit to the account — this is billed separately from your Claude subscription.

**2. Put this folder on GitHub**
Create a new **private** repo and upload these files. `.gitignore` already excludes `node_modules`, `dist`, and `.env` files.

**3. Import it into Vercel**
vercel.com → Add New → Project → pick the repo. It auto-detects Vite. Don't deploy yet.

**4. Add the key**
Before the first deploy, open **Settings → Environment Variables**:

- Name: `ANTHROPIC_API_KEY`
- Value: your key
- Apply to Production, Preview, and Development

**5. Deploy.** You get a `something.vercel.app` URL. Open it on your phone and use **Add to Home Screen** — it behaves like an app.

---

## Run it locally first (optional)

```bash
npm install
npm run dev
```

Note: `npm run dev` serves the front end but **not** the `/api/claude` function, so AI buttons will fail. To test the proxy locally, use the Vercel CLI instead:

```bash
npm i -g vercel
vercel dev
```

Put your key in `.env.local` (copy `.env.example`) for local runs.

---

## Your data lives in this browser

`localStorage` is per-browser and per-device. Your phone and your laptop will keep **separate** journals, and clearing site data erases what's there.

So: hit **Save a copy** after a real session. It downloads a dated JSON file. **Restore** loads it back — on any device, in any browser.

If you outgrow that, the upgrade is a real database (Vercel Postgres or Supabase). That's a bigger change and worth doing only once you're logging daily.

---

## Cost

Two separate bills, and neither touches your Claude chat limits:

- **Vercel** — free tier covers a single-user app comfortably.
- **Anthropic** — pay per API call at list price. Scans use Sonnet with web search, so heavy days cost more than quiet ones. Watch the console for the first week to learn your real number, and set a spend limit while you do.

---

## If something breaks

**AI buttons all fail immediately** — `ANTHROPIC_API_KEY` isn't set, or you added it after deploying. Add it, then redeploy.

**Rate-limit messages** — now these are real Anthropic limits, not artifact limits. The built-in throttle backs off and the buttons disable while cooling.

**Journal looks empty** — you're on a different browser or device than the one that has it. Restore from a backup file.

**Blank page** — open the browser console. A red error there names the file and line.
