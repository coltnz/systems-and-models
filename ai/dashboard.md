# Dashboard — Systems & Models alpha

_Mayor-maintained operator view. Updated each orchestration step._
Last updated: 2026-06-08 · Branch: `claude/festive-ptolemy-fvmCz` · **Status: ALPHA COMPLETE ✅ (bd-1..bd-13 merged) · PR #3 review threads all resolved · 138 tests green**

## Alpha goal
User supplies transcript/Markdown → generate a draft Learning Pack via an env-configured
OpenAI adapter (mock offline) → validate structurally + graph-wise → review/edit in a focused
web UI → save a reviewed pack → ask a grounded tutor question that cites reviewed anchors or refuses.

## Bead status

| Bead | Title | Status | Depends | Gate |
|------|-------|--------|---------|------|
| bd-1 | Tech/setup audit | ✅ done | — | report (no gate) |
| bd-2 | Spike value audit | ✅ done | — | build/lint executed |
| bd-3 | Alpha scaffold | ✅ done (9677cf7) | bd-1, bd-2 | all 5 green ✔ |
| bd-4 | Pack validator | ✅ done (e8a5bc3) | bd-3 | 31 tests green; example validates ✔ |
| bd-5 | Source ingest | ✅ done (bf7ac66) | bd-3 | 38 tests; output validates ✔ |
| bd-6 | Extraction adapter | ✅ done (209512c) | bd-3, bd-5, bd-4 | 50 tests; mock validates ✔ |
| bd-7 | Local alpha server | ✅ done (28e87e7) | bd-4, bd-5, bd-6 | 68 tests; draft validates ✔ |
| bd-9 | Tutor proof surface | ✅ done (2b6b14f) | bd-4, bd-7 | 24 tests; refusal suite ✔ |
| bd-8 | Web review UI | ✅ done (75915ba) | bd-7, bd-2 | 24 tests; vite build ✔ |
| bd-10 | Alpha walkthrough | ✅ done (ea51d3b) | bd-4..9 | full root gate ✔ (124 tests) |

Legend: ⬜ open · 🟡 running/in-review · ✅ done · ⛔ blocked

**All 10 beads merged on `claude/festive-ptolemy-fvmCz` (PR #3). Full root gate green: 124 tests
across 9 files; build/lint/typecheck clean. Live HTTP path mayor-verified on :8787.**

## Critical path (done)
bd-1/bd-2 (audits) → bd-3 (scaffold) → bd-4 + bd-5 → bd-6 → bd-7 → bd-9 + bd-8 → bd-10. ✅

## Run the alpha
`npm install` → `npm test` (offline) · `npm run serve` (API :8787, mock) + `npm run dev` (UI :5173) ·
`npm run demo` (scripted proof). OpenAI: set `OPENAI_API_KEY`+`OPENAI_MODEL`+`EXTRACTION_ADAPTER=openai`.

## Post-merge review (high-effort, 7 finder angles + verify)
Ran a `/code-review high` over the full PR #3 diff. Findings recorded; confirmed correctness items
remediated under **bd-11** (open → dispatched). None block the offline demo; #1 bites the first real
OpenAI run. Top confirmed: OpenAI empty-`anchor_ids` → unsaveable pack; `authored_by` never → "mixed"
on human edit; server `now` not threaded into extraction; split-lite stale provenance; traversable/
eligible asymmetry; web 422 validation not surfaced. Accepted-by-design items listed in `ai/beads/bd-11.md`.

| bd-11 | Review remediation | ✅ done (15a359a) | bd-4..9 | 131 tests; examples validate ✔ |
| bd-12 | Assembly drops bad edges (PR [P1]) | ✅ done (fa8d87e) | bd-6, bd-11 | 135 tests; examples unchanged ✔ |
| bd-13 | Dedupe extraction ids (PR [P1]) | ✅ done (e114b64) | bd-12 | 138 tests; examples unchanged ✔ |

PR #3 owner review thread r3332633664 ([P1], draft.ts) — **resolved by bd-12**: `assembleExtraction`
now drops dangling-endpoint relationships and normalizes empty `anchor_ids`, so a draft can never be
persisted with a relationship-caused graph error that blocks reviewed-save.

**Re-review (medium, 3 angles over `060a488..HEAD`):** fix-correctness — no new bugs; regressions —
none (examples byte-stable, `appendEditDerivation` pushes once); the 7 prior findings + the original
P1 verified closed. **Correction (PR [P2] r3347963222):** that re-review was scoped to the code delta
and did NOT re-check the PR, so it MISSED an owner [P1] (r3337754930) — duplicate model-supplied
atom/relationship ids. Process fix: **re-reviews fetch PR review activity first, then re-scan code.**

**Duplicate-ID [P1] (r3337754930): resolved by bd-13.** With bd-12 + bd-13, `assembleExtraction`
emits a draft free of every model-controllable validator graph error; the persisted-unsaveable-draft
class is fully closed. **PR re-checked: all 3 review threads replied + resolved; no open threads remain.**
Full gate green: **138 tests**.
- Human-in-the-loop browser click-through of the UI (logic covered by bd-8 tests; live API path verified).
- Probe-execution decisions still owed by the operator (non-blocking for the build): named first
  learner + creator, the specific dense source talk, and confirmed kill thresholds (operating brief §"blockers").
- Future (post-probe, gated): OpenAI live-path confirmation against a real API; richer review history;
  shadcn/Radix UI polish (D-008b); the Go/asof stack decision (D-001, deferred to go/no-go).

## Worker model (D-012)
Implementation workers run in the **main working tree** on the alpha branch, implement + run gates,
and do **not commit**; the mayor reviews the diff, re-runs gates, and commits. Sequential, to avoid
tree contention. (Agent worktrees branch from master and can't see merged scaffold, so they're used
only for the read-only audits.)

## Decisions
See `ai/decisions.md` (D-001…D-012).

## Open product questions (non-blocking — recommended defaults taken)
- First named learner + creator, first source talk, kill thresholds (operating brief §"blockers").
  Not required to build the alpha; surfaced for the operator. Demo uses a synthetic CC transcript.

## Gate definition (merge bar)
A bead merges onto the alpha branch only when: diff matches the bead scope, and
`npm install && npm run build && npm run lint && npm test && npm run typecheck` is green
(scoped to the affected package(s) at minimum; full root before bd-10 closes).
