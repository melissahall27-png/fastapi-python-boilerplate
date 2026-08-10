# NEEDS-CLARIFICATION.md

Places where your original intent is **not recoverable from history**, so per the
hard rules I stopped instead of inventing a "reasonable default." This file
existing is the intended outcome, not a failure.

---

## 1. THE 6 QUESTIONS — blocking (Phase 3 #4)

**What you asked:** "Locate the exact six questions as I defined them in history…
If you cannot find all six verbatim, stop and ask me before proceeding."

**What I found:** no "6 questions" feature anywhere in git history or the code.
The nearest things, and why none is it:
- **Three** strategy questions — where/why I enter, where I exit if wrong, where I
  take profit — `TradingCommandCenter.jsx:530` and `:5761`. That's 3, not 6, and it's
  a coaching principle, not a per-trade ✓/✗ checklist.
- A **"6-step pipeline"** named only inside the discipline auto-grader prompt
  (`:734`, `:2368`): *real trigger? · sized off the stop? · scaled out into strength?
  · right strike/DTE (Δ 0.55–0.70)? · closed 0DTE before 3:30? · not held to zero?*
  This is 6 items — but it was written as grading criteria for the AI, never as
  "the 6 questions" shown on every trade.

**What I need from you (pick one):**
- (a) Paste the six questions verbatim, and I'll add them to every trade
  (including quick/legacy entries) as ✓/✗ that saves, persists, and syncs; **or**
- (b) Confirm you want the 6-step pipeline above promoted into that per-trade
  checklist (I will not assume this); **or**
- (c) Tell me where you defined them (another chat/doc) so I can match them exactly.

Until you answer, I will not build this — building the wrong six is worse than none.

---

## 2. Right/wrong moves → discipline (Phase 3 #5)

The good/bad review saves and syncs, but the **Discipline %** is computed only from
the `planFollowed` checkbox (`:2158`), not from the leaks you tag. **Did you intend
the tagged leaks to lower the discipline score?** If yes, tell me the formula you
want (e.g. "any leak = off-plan," or weighted) — I won't invent a scoring rule.

---

## 3. "Talk about the trade" → bullets (Phase 3 #3)

A per-trade chat exists; a "condense to bullets and pin onto the trade" save does
not. **Confirm the intended behavior:** on Save, summarize the conversation into
bullets stored on that trade (and synced), replacing vs. appending on re-save?
Tell me replace or append.

---

## 4. Sync scope (Phase 3 #2)

Today only `trades` sync. **Which of these do you also want synced** across devices:
saved **scans**, **notes/reminders**, **watchlist**, per-trade **chat**, **settings**?
Each is doable; I want your priority order rather than guessing.
