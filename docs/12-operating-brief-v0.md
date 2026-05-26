# Operating Brief v0

Date: 2026-05-26 · One page · Executable version of `11-best-of-breed-synthesis.md`.
Encoded contract: `spec/learning-pack.schema.json` (+ validated example in `spec/examples/`).

Purpose: a ~2-week probe to decide go/no-go on "source → reviewed learning graph." It tests
the two things most likely to be fatal — **will anyone curate (demand/moat)** and **is AI
extraction good enough, and better than the free alternative (supply)** — *before* building
a product.

## Decisions made

- **First source type:** one 20–40 min **CC-licensed or creator-authorized technical talk**
  — and a *dense* one (concepts + claims + a procedure, ideally slides), so extraction isn't
  flattered or punished by fluff (review C). Not YouTube-at-large (copyright), not an asof
  conversation (that's a later lineage test).
- **Pack contract:** the encoded JSON Schema. **No backend, no DB, no product editor.**
- **Schema:** `system|model|claim` atoms; anchors with computed `verifiable` + reviewed
  `support_state`; grounded relationships (reviewed-only traversal); cost logged.
- **Tutor:** thin, cite-or-refuse, used only as a grounding *proof surface*.
- **Gate:** beats a baseline arm on pre-registered provisional thresholds (not absolutes).

## Decisions still needed from you (blockers)

1. **First user** — name one real learner **and** one real creator for Track B. Without a
   named user, Track B is theater. (Can you be the proxy creator? Who's the learner?)
2. **First source** — pick the specific dense talk you can vet fast to build the gold set.
3. **Kill thresholds** — confirm/adjust the pre-registered provisional numbers in
   synthesis §6 so the test is honestly falsifiable.

(The 1-day **asof audit is *not* a probe blocker** — it feeds the later stack decision, which
is deferred to go/no-go. Do it then, not now — review A.)

## Two-week plan

**Track A — supply (CLI + eval), ~1 engineer**
- Days 1–2: contract is set (`spec/`). Add a JSON-Schema validator step. Reviewer(s)
  hand-build the **gold set** for the chosen segment; **double-annotate a subset** and record
  inter-rater agreement (defines "usable atom").
- Days 3–6: `ingest <source>` → transcript + anchors; `extract` → candidate atoms/edges
  (structured output); compute `verifiable`; reviewer tags `support_state`.
- Days 7–8: eval harness (precision/recall vs gold set, claim-support, anchor precision,
  grounding/refusal, relationship precision, minutes + usd per atom); **run the baseline arm**
  (NotebookLM / naive no-anchor extraction) on the same talk; produce the numbers.

**Track B — demand/moat (concierge, behavioral), runs alongside, low-eng**
- **B0 (kill gate), days 1–6:** hand/AI-build 1–2 packs on topics the named users care about.
  Put them on a **real review surface — not raw JSON** (a Markdown pack with accept/edit/
  reject checkboxes, a shared doc/spreadsheet, or a moderated session). Concrete task script,
  e.g.: *"Here is a generated pack from a talk you know. Improve it until you'd share it with
  [named learner]."* Record **behavior**: open source from an anchor, edit/reject atoms,
  return unprompted, actually share. If even friendly users won't engage → dead.
- **B1 (weak confirm), days 9–10:** if Track A clears its gate, put **Track A's real output**
  in front of the same users and observe the same behaviors on the *actual* artifact.

**Decision (day 10):** go only if A **beats baseline** on the committed thresholds **and** B1
shows someone will curate the real output. Either failing = no-go, or an explicit reshape to
a creator tool (the A-vs-B fork). Replace any stated-preference signal ("would you have built
it?") with an observable commitment: bring your own source, spend 30 min curating, share it,
or schedule a second session.

## Out of scope for the probe

Product editor UI, backend/DB choice, the learning layer (exercises/misconceptions/spaced
practice), marketplace, MCP, multi-source, embeddings, C2PA, the full ontology. None of it
is worth building until the gate says extraction beats the alternative **and** someone will
curate.

Monetization is further out still: the creator/sell-packs go-to-market lives in
`docs/13-creator-monetization-after-it-exists.md` and is gated on this probe passing *and* a
working single-creator pipeline. It must not pull scope into the probe.
