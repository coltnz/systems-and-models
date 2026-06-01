# Mayor workspace (`ai/`)

This project is run with the **Mayor Method**: one long-lived *mayor* session
orchestrates short-lived *worker* sessions. The mayor does not implement (beyond
tiny cleanup); it creates beads, dispatches bounded workers in isolation, reviews
their diffs against the bead, merges only when the diff matches and gates pass,
and keeps decisions durable.

## Bead system

The upstream Mayor Method uses the [`bd` Beads CLI](https://github.com/steveyegge/beads).
That CLI is **not installed in this remote execution environment**, so beads are
tracked here as durable, committed markdown:

- `ai/beads/bd-N.md` — one file per bead. Each carries problem, where-to-look,
  proposed change, definition of done, gates, constraints, and a mayor-maintained
  Notes/Decisions section. Beads are the only thing workers receive — vague beads
  produce vague PRs.
- `ai/dashboard.md` — the operator dashboard: bead status, gates, what's next.
- `ai/decisions.md` — durable product/tech decision log (Decision / Choice / Rationale).
- `ai/findings/` — worker research output. **Gitignored, never committed.** Only the
  distilled decisions are promoted into `ai/decisions.md` and bead notes.

## Worker contract

Each worker is dispatched with a single bead and must return: bead ID, scope,
changed files, gates run, risks, and any decisions made. The mayor reviews that
report and the actual diff before integrating onto the alpha branch.

## Branch / PR model

All alpha work lands on `claude/festive-ptolemy-fvmCz` behind a single PR. Workers
operate in isolated worktrees; the mayor integrates verified diffs onto the alpha
branch and records each bead's outcome (ID, scope, files, gates, risks, decisions)
in the PR body and the bead file.
