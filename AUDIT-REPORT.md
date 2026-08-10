# AUDIT-REPORT.md — findings with evidence

Statuses: **WORKS / BROKEN / MISSING / PARTIAL / UNVERIFIED / NEEDS CLARIFICATION**.
No code was changed to produce this report. Live-deployment items are
`UNVERIFIED (sandbox-blocked)` — the egress proxy blocks the vercel.app host
(confirmed: `403` CONNECT in the proxy's own failure log). Each carries a
device-side check you can run yourself.

---

## PHASE 3 — the specific items

### 1. Run scans → Save  →  **PARTIAL**
- **Results + Save button + full payload: WORKS.** Runner auto-logs every ticker with
  full detail — `{s,dir,px,score,why,trig,inval,atr,ivr,liq,ev}` — plus timestamp
  and source (`:3726`). The explicit "Save full scan to Scans" button re-writes with
  a `batchId` so it's idempotent (`logScan` dedupe `:3541`).
- **Lands in Scans + retrievable: WORKS.** `ScanJournal` reads `scan:log`, shows it,
  and matches trades within 3 sessions (`:3549-3574`).
- **Round-trip refresh (same device): WORKS** — `scan:log` persists in localStorage.
- **On both devices: BROKEN by design.** `scan:log` is **local-only; it does not
  sync** (see INVENTORY §3). Phase 3 #2 explicitly lists scans as a must-sync type.
- **Duplicate behavior:** the manual Save dedupes by `batchId`, **but** the same
  scan also auto-logs with `batchId:null` (`:3726`) — so a scan can appear **twice**
  (one auto row + one saved row). Flagged MEDIUM.

### 2. Desktop ↔ mobile realtime sync  →  **PARTIAL / UNVERIFIED (sandbox-blocked)**
- **Mechanism (stated plainly): NOT realtime.** It's 45 s polling + 1.5 s debounced
  push (`:437-450`). Fine for a journal; just not "instant."
- **What actually syncs: only `trades`** — and their attached screenshots + good/bad
  review (both live on the trade object). Derived metrics (P&L / win rate /
  discipline) follow because they're recomputed from `trades`.
- **What does NOT sync:** scans, notes, per-trade chat, watchlist, goals, settings,
  coach KB — all local-only. Phase 3 #2 asked for several of these.
- **Screenshot path: CRITICAL BUG.** Screenshots are base64 on the trade and the
  whole `trades` array is pushed as **one blob capped at 900,000 chars**
  (`sync.js:47`). A handful of phone screenshots exceeds that; the server returns
  `too-big` and **the entire journal silently stops syncing.** *Proven* — local KV
  test #5 (`test-sync-logic.mjs`): a 900,001-char payload → `{ok:false,too-big}`.
- **Conflict resolution (what it does today):** union-merge, cloud wins ties, **no
  timestamps** → a fresh local edit can be overwritten by the 45 s poll. And **there
  are no delete tombstones**, so **deleting a trade doesn't stick** — the other
  device merges it back. CRITICAL for data trust.
- **Auth/session across devices:** none — a fixed shared code, no login (INVENTORY §1).
- **Live status: UNVERIFIED (sandbox-blocked).** The server *logic* is proven (8/8,
  below). Whether the connected Upstash store + redeploy actually serve it in prod I
  **cannot** confirm from here. **Your 10-second check:** open the app on phone,
  Journal → the "Cross-device sync" card. Green **"● auto · linked"** = live;
  amber **"● setup needed"** = the store/env isn't wired. Then log a trade on the
  phone and watch it appear on desktop within ~45 s.

**Sync server logic — PROVEN (8/8)** via `scratchpad/test-sync-logic.mjs` against an
in-memory Upstash mock: GET empty→[], POST 2 trades→count 2, GET round-trips
**image + nested review intact**, other code isolated, oversized→`too-big`,
no-store→`not-configured`.

### 3. "Talk about the trade" → Save as bullets  →  **MISSING** (chat exists)
- A per-trade coach **chat exists** (`ChatBox` `:2672`, keyed `tradechat:<id>`).
- But there is **no "condense conversation to bullets and write them onto the trade"**
  feature. The only Save button in that panel (`:2661`) saves the good/bad **chips**
  (item #5), not the conversation. The chat is stored under its own local key and
  **does not sync** and **does not display as bullets on the trade** afterward.

### 4. The 6 questions  →  **NEEDS CLARIFICATION** (cannot find them)
- Per your hard rule I stopped rather than invent. There is **no "6 questions"
  feature** in history or code. What exists:
  - the **three** strategy questions (where/why enter, where exit if wrong, where
    take profit) — `:530`, `:5761`;
  - a **6-step pipeline** referenced only inside discipline grading — `:734`, `:2368`.
- Neither is "six questions, answerable with ✓/✗, on every trade." **See NEEDS-CLARIFICATION.md — I need the six verbatim from you before building this.**

### 5. Right / wrong moves  →  **WORKS, with one gap**
- Capture + save + display + edit: **WORKS.** `GOOD_MOVES`/`LEAKS` chips (`:2583-2584`),
  `saveReview → onSetReview → t.review` (`:2602`, `:2361`), persists, shows a
  "✓ N good / ✕ N leaks / reviewed" badge (`:2634`), and **syncs** (it's on the trade).
- **Gap:** it **does NOT feed the discipline metric.** Discipline = share of trades
  with `planFollowed` (`:2158`), entirely separate from the good/bad review. If you
  intended the leaks to drive discipline, that wiring doesn't exist. Flagged HIGH.

### 6. Auto-updating metrics  →  **WORKS, PARTIAL on realized-vs-open**
- **Auto-update on create/edit/delete: WORKS.** Week/Month P&L, Win rate, Discipline
  are derived in render from `trades` (`:2151-2158`), so any change recomputes them.
  Delete filters `trades` (`:2358`) → metrics follow.
- **P&L math (checked by hand):** `computePnl` (`:359-365`) = manual override, else
  `(exit−entry)·qty·mult·dir`, `mult`=100 options / point-mult futures / 1 stock,
  `dir`=−1 short. Verified against seeds: `rh-10` `0.77→1.43 ×1` → `(1.43−0.77)·1·100 = $66` ✓
  (matches `pnlManual "66.00"`); `rh-05` `0.80→0.34 ×2` → `−$92` ✓.
- **Discipline definition: FOUND, not invented** — "share of trades you marked 'plan
  followed'" (`:2195`).
- **Hit rate: WORKS** — wins/closed where "closed" = has a computable P&L (`:2156-2157`).
- **Realized vs OPEN P&L: PARTIAL** — only closed trades count; there is **no separate
  open/unrealized figure**. Phase 3 #6 asked both be handled and distinguished.
- **Floating-point: MINOR** — aggregates sum raw floats (no cents-integer math);
  display rounds to 2 dp but stored sums can carry FP dust. Low.

---

## PHASE 4 — general sweep (partial, sandbox-scoped)
- **Build: PASS.** `vite build` clean; one non-fatal warning (JS chunk 659 kB > 500 kB).
- **Tests: NONE exist** in the repo. Coverage = 0 files. (Audit added throwaway tests
  in scratchpad only.)
- **Console errors per screen / mobile tap-target sweep: UNVERIFIED (sandbox-blocked)** —
  needs the live site or a local `vercel dev` with the API funcs.
- **Async error handling:** quotes/brief/scan calls have try/catch + user-facing error
  lines; `syncPush`/`syncPull` swallow errors and return a status (`:127-132`) — safe
  but silent (ties into the CRITICAL screenshot-cap: failures aren't surfaced to you).

---

## Prioritized fix list

**CRITICAL (data loss / sync failure / wrong trust)**
1. Screenshots overflow the 900 KB sync blob → **all** sync silently dies. (Fix: cap/downscale images, or store images out-of-band, or surface the `too-big` failure instead of swallowing it.) `sync.js:47`, `:130-132`
2. Deletes don't propagate (no tombstones) — deleted trades resurrect. `:118-122`, `:448`
3. Edits can be clobbered by the 45 s poll (no timestamps in merge). `:118-122`

**HIGH (feature you asked for, missing/misw­ired)**
4. Scans (and notes) don't sync though Phase 3 #2 requires it. INVENTORY §3
5. "Talk about the trade → save as bullets onto the trade" not built. `:2672`
6. Right/wrong moves doesn't feed the discipline metric. `:2158`
7. **The 6 questions** — blocked on your input (NEEDS-CLARIFICATION.md).

**MEDIUM**
8. Duplicate scan rows (auto-log + manual save). `:3726` vs `:3753`
9. No open/unrealized P&L. `:2151-2157`
10. No auth on the shared sync code (privacy: one global journal). `:125-126`

**LOW**
11. Stale code comment claims images are stripped from sync (they aren't). `:117`
12. FP dust in aggregate P&L; consider cents-integer math. `:2154-2155`
13. Bundle-size warning (code-split). build output
