# AUDIT-INVENTORY.md — Trading Command Center / The Edge Room

**Method.** Reconstructed from `git log --all`, the two source files, the five
serverless functions, and the one `.md` (README). The live site
(`trading-command-center-vercel.vercel.app`) is **unreachable from the audit
sandbox** — the egress proxy returns `403` on CONNECT for that host (and even
`google.com`), so no in-browser click-test of production was possible. Anything
that requires the live deployment is marked `UNVERIFIED (sandbox-blocked)` in
AUDIT-REPORT.md, with a device-side check you can run in 10 seconds.

Citations are `file:line` against the commit currently on `main`.

---

## 1. Stack & infrastructure (found, not assumed)

| Concern | What it actually is | Evidence |
|---|---|---|
| Framework | React 18 + Vite 5, single-page app | `package.json`, `vite.config.js` |
| Source shape | **One 6,753-line component file** + a 182-line entry | `src/TradingCommandCenter.jsx`, `src/main.jsx` |
| Routing | **No router.** Tab state in `useState("today")`; 16 tabs switched by string | `TradingCommandCenter.jsx:417`, tab list `:551` |
| State mgmt | React `useState` + a hand-rolled external store for the Runner scan (`runnerStore` + `useSyncExternalStore`) | `:3697-3730` |
| Persistence | `localStorage`, namespaced `tcc:` via `sGet`/`sSet` | `:100-111` |
| Backend | 5 Vercel serverless funcs: `claude.js` (Anthropic proxy), `quotes.js`, `ohlc.js`, `news.js`, `sync.js` | `api/` |
| Database | **Only for journal sync:** Vercel KV / Upstash Redis (REST) behind `/api/sync`. Everything else is local-only. | `api/sync.js`, `:26-35` |
| Auth | **None.** Sync is keyed by a fixed shared code `"edge-room-primary"` — no login, no per-user key. Anyone who hits `/api/sync?code=edge-room-primary` reads/writes the same journal. | `:125-126` |
| Image storage | **No blob store.** Screenshots are base64-inlined onto the trade (`t.img`) and live in localStorage + the KV blob. | `:2455-2459`, `:2633` |
| Realtime | **Not realtime.** 45 s poll + 1.5 s debounced push + pull-on-load. | `:437-450` |
| Hosting | Vercel | `README.md`, `vercel.json` |
| Tests | **None in repo.** No test files, no `test` script. (Audit-time tests were written ad-hoc in the scratchpad.) | — |

---

## 2. Route / tab map (16 tabs)

Declared at `:551`, dispatched by `{tab==="…" && <Component/>}` around `:600-618`.

`guide` → Guide · `today` → Today · `dash` → Dashboard · `journal` → Journal ·
`review` → (Review coach) · `watch` → Watchlist · `strat` → Strat/StratScanner ·
`runner` → RunnerScan · `scans` → ScanJournal (`:605`) · `sectors` → Sectors ·
`tools` → Tools · `pl` → P/L Lab · `news` → News · `play` → Playbook ·
`library` → KnowledgeLibrary · `tutor` → Tutor.

All 16 are reachable from the top nav. No orphaned routes found.
(Full per-tab button click-test was **not** performed — see Method: live site
blocked, and static reading can't prove runtime handler wiring for all ~100+
controls. The Phase-3 features below were traced by code path individually.)

---

## 3. Data model — every localStorage key

Only keys with a real payload shown; `*seed*`/`*fix*` are one-time seeding flags.

| Key (`tcc:` prefix) | Holds | Written by | **Syncs across devices?** |
|---|---|---|---|
| `journal:trades` | The trade array (incl. `img`, `review`, `grade`, `planFollowed`) | Journal `add`/`del`/edits `:2351-2362` | **YES** — the only synced store `:130-132` |
| `scan:log` | Saved scans (Runner/Goal/Account/Bias/Two-sided) | `logScan` `:3535` | **NO — local only** |
| `notes:list` | Today notes/reminders | Notes `:2257` | **NO** |
| `tradechat:<id>` | Per-trade coach conversation | ChatBox `:2672` | **NO** |
| `coach:kb` | Coach knowledge base | load-seed `:497-533` | **NO** |
| `watchlist:tickers` | Watchlist | Watchlist | **NO** |
| `watch:bias`,`:t` | Per-ticker bias | Bias scan `:4013` | **NO** |
| `goals:*` | Goals/mission | Goals | **NO** |
| `pl:state`,`library:items`,`test:*`,`study:progress`,`course:progress`,`intel:*`,`levels:*`,`quotes:last`,`ui:showHelp`,`auto:scans`,`sync:code`,`settings:watchVersion` | as named | various | **NO** |

**Headline:** of everything the app stores, **only `journal:trades` is cross-device.**

---

## 4. Component tree (top-level, mounted)

Entry `main.jsx` mounts `<BackupBar/>` + `<TradingCommandCenter/>` + `<UpdateBanner/>` (`main.jsx:176-182`).
`TradingCommandCenter` renders the active tab's component. ~90 components/functions
defined; the ones that carry the audited features:

- **Journal** `:2320` — form, `add`/`del`/`togglePlan`/`setSetup`/`setReview`/`setGrade`/`autoGrade`; renders `SyncCard` + `TradeRow` list.
- **TradeRow** `:2593` — P&L, grade select, plan toggle, screenshot, **good/bad review checklist** + **per-trade ChatBox**.
- **ScanJournal** `:3549` — the Scans tab; reads `scan:log`, matches trades within 3 days, win-rate by scanner.
- **RunnerScan** `:3732` / **runnerStore** `:3697` — scan that survives tab switches; auto-logs + "Save full scan" button.
- **Today** `:2144` — Week/Month P&L, Win rate, Discipline stat cards (derived live from `trades`).
- **SyncCard** `:2302` — sync status + "Sync now".
- **StrikesToWatch** `:6186`, **LiquiditySweepScanner** `:4208`, **FoundationCard** `:5650`, etc.

No dead top-level components detected in the mounted path; `api/sms.js` exists
only on branch `claude/vercel-plugin-install-sxs6ke` (paused, not on `main`).

---

## 5. Sync architecture (the item you care most about)

```
Device A  --debounced 1.5s POST /api/sync {code, trades}-->  KV blob "tccsync:edge-room-primary"
Device B  --GET /api/sync?code=… every 45s--> merge (union by id) into local trades
```

- `mergeTradesById` `:118-122` — **union by id**; on an id tie, keeps whichever object has ≥ keys, else iteration order → the *cloud* copy wins ties.
- Push `:130-132` includes the full trade **including base64 `img`**.
- Server `api/sync.js` stores one JSON blob per code, **hard cap 900,000 chars** (`sync.js:47`).
- No tombstones → **deletes are not represented**, so a delete on one device is re-merged back from the other.
