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
| bd-2 | Spike value audit | 🟡 running | — | build/lint executed |
| bd-3 | Alpha scaffold | ⬜ open | bd-1, bd-2 | install/build/lint/test/typecheck |
| bd-4 | Pack validator | ⬜ open | bd-3 | test + example validates |
| bd-5 | Source ingest | ⬜ open | bd-3 | test + output validates |
| bd-6 | Extraction adapter | ⬜ open | bd-3, bd-5, bd-4 | test offline (mock) |
| bd-7 | Local alpha server | ⬜ open | bd-4, bd-5, bd-6 | integration test (temp dir) |
| bd-8 | Web review UI | ⬜ open | bd-7, bd-2 | test + vite build |
| bd-9 | Tutor proof surface | ⬜ open | bd-4, bd-7 | refusal suite |
| bd-10 | Alpha walkthrough | ⬜ open | bd-4..9 | full root gate |

Legend: ⬜ open · 🟡 running/in-review · ✅ done · ⛔ blocked

## Critical path
bd-1/bd-2 (audits) → **bd-3 (scaffold)** → bd-4 + bd-5 (parallel) → bd-6 → bd-7 → bd-8 + bd-9 → bd-10.

## Next actions
1. Await bd-2 report; record salvage map in bd-2 + `ai/decisions.md`.
2. Dispatch bd-3 scaffold worker (canonical names per D-002).
3. Commit bead system + dashboard; open the single alpha PR.

## Decisions
See `ai/decisions.md` (D-001…D-008 recorded from bd-1).

## Open product questions (non-blocking — recommended defaults taken)
- First named learner + creator, first source talk, kill thresholds (operating brief §"blockers").
  Not required to build the alpha; surfaced for the operator. Demo uses a synthetic CC transcript.

## Gate definition (merge bar)
A bead merges onto the alpha branch only when: diff matches the bead scope, and
`npm install && npm run build && npm run lint && npm test && npm run typecheck` is green
(scoped to the affected package(s) at minimum; full root before bd-10 closes).
