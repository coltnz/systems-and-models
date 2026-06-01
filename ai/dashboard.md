# Dashboard — Systems & Models alpha

_Mayor-maintained operator view. Updated each orchestration step._
Last updated: 2026-06-01 · Branch: `claude/festive-ptolemy-fvmCz`

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
| bd-7 | Local alpha server | 🟡 dispatched | bd-4, bd-5, bd-6 | integration test (temp dir) |
| bd-8 | Web review UI | ⬜ open | bd-7, bd-2 | test + vite build |
| bd-9 | Tutor proof surface | ⬜ open | bd-4, bd-7 | refusal suite |
| bd-10 | Alpha walkthrough | ⬜ open | bd-4..9 | full root gate |

Legend: ⬜ open · 🟡 running/in-review · ✅ done · ⛔ blocked

## Critical path
bd-1/bd-2 (audits) → **bd-3 (scaffold)** → bd-4 + bd-5 (parallel) → bd-6 → bd-7 → bd-8 + bd-9 → bd-10.

## Next actions
1. bd-7 (local alpha server) dispatched (main-tree worker, D-012). Review diff, verify (integration test, temp dir), commit.
2. Then bd-8 (web) / bd-9 (tutor) → bd-10 (e2e).

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
