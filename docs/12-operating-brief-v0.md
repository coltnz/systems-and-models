# Operating Brief v0

Date: 2026-05-26 · One page · The executable version of `11-best-of-breed-synthesis.md`.

Purpose: a 2-week probe to decide go/no-go on "source → reviewed learning graph." It tests
the two things most likely to be fatal — **will anyone curate (demand/moat)** and **is AI
extraction good enough (supply)** — *before* building a product.

## Decisions made

- **First source type:** one 20–40 min **CC-licensed or creator-authorized technical
  talk** (not YouTube-at-large, not an asof conversation). Rationale: it *is* the real wedge
  (third-party long-form media) but a rights-clean instance, so it sidesteps copyright (§1.4)
  while testing extraction honestly. asof conversations are reserved for a *later* lineage/
  reuse test, not this probe.
- **Pack contract:** JSON files + a JSON-Schema validator. **No backend, no DB, no editor.**
- **Schema:** the minimum in synthesis §5 — `system|model|claim` atoms, anchors with
  `verifiable` + reviewed `support_state`, 5 predicates, `DerivationRun`, `LearningPack`.
- **Tutor:** thin, cite-or-refuse, used only as a grounding *proof surface*.
- **Gate:** gold-set composite (synthesis §6), **thresholds committed before building.**

## Decisions still needed from you (blockers)

1. **First user** — name one real learner *and* one real creator to put Track B packs in
   front of. Without a named user, Track B is theater. (Can you be the proxy creator? Who's
   the learner?)
2. **First source** — pick the specific talk (your domain, something you'd vet quickly so
   you can build the gold set).
3. **asof audit** — 1 timeboxed day: is its event-log/fork-diff code actually reusable, or
   just conceptually similar? This is the long pole for any later stack decision; doing it
   now is cheap insurance.
4. **Kill thresholds** — confirm/adjust the placeholder numbers in synthesis §6 so the test
   is honestly falsifiable.

## Two-week plan

**Track A — supply (CLI + eval), needs ~1 engineer**
- Days 1–2: pack contract v0 + JSON-Schema validator + fixtures. Reviewer hand-builds the
  **gold set** for the chosen segment (defines "usable atom").
- Days 3–6: `ingest <source>` → transcript + anchors; `extract` → candidate atoms/edges via
  structured output; compute `verifiable`; reviewer tags `support_state`.
- Days 7–8: eval harness — precision/recall vs gold set, claim-support accuracy, anchor
  precision, grounding/refusal; thin cite-or-refuse tutor; produce the numbers.

**Track B — demand/moat (concierge, behavioral), runs in parallel, low-eng**
- Days 1–4: hand/AI-build 1–2 packs on topics the named users care about.
- Days 5–10: put them in front of 3–5 real learners/creators; record **behavior** — open
  source from anchor? fix/reject atoms? return? share? would they have built it? Stated
  willingness-to-pay is noted but not trusted.

**Day 9–10: decision.** Go only if Track A clears the committed thresholds **and** Track B
shows someone will actually curate. Either alone failing = no-go (or reshape: if learners
won't curate but creators will, the product is a creator tool — decide that explicitly).

## Explicitly out of scope for the probe

Editor UI, backend/DB choice, the learning layer (exercises/misconceptions/spaced practice),
marketplace, MCP, multi-source, embeddings, C2PA, and the full ontology. None of it is worth
building until the gate says extraction is good enough and someone will curate.
