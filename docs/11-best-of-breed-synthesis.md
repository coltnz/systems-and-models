# Best-of-Breed Synthesis

Date: 2026-05-26

Reconciles two independent 2026 revisit passes:
- `09-revisit-2026.md` + `10-wedge-spec-source-to-learning-pack.md` (Claude)
- `09-2026-revisit-ai-learning-strategy.md` (Codex)

This is a decision record, not a re-pitch. Each divergence gets a call on merit and a
one-line reason. Where the two passes agree, that is noted as settled — but §4 lists what
neither pass has actually earned, which matters more than the agreements.

---

## 1. Settled (both passes reached independently — treat as decided)

These are not "both were nice about it." They are conclusions two separate analyses landed
on without coordination, which is the only reason to weight them.

- **Not another PKM app.** The product is a *source → reviewed learning graph* studio.
- **Provenance/source-anchors are the center**, not a side annotation. The unit of trust
  is the link {atom ↔ source span ↔ extraction run ↔ review state}, not a node.
- **AI output is a proposal.** `generated` and `reviewed` are distinct states; nothing
  publishes without a human review state and ≥1 anchor.
- **Anchors are stored before summaries.** You can always get back to the source span.
- **Kill `credibility_score`.** Replace with computed signals (see §3).
- **Packages before marketplace.** Marketplace is a scaling pattern, not the product.
- **Graph is one mode, not the home screen.** Editor + trust workflow is the product; the
  global graph is a map, not the workspace.
- **`asof` is the lineage/inspector/fork-diff substrate**, not the storage layer and not
  to be merged in immediately.
- **The current app is a spike.** Reset the schema/package contract before adding features.
  (Concrete defects verified in the code, not just asserted — see §5.)
- **Wedge = YouTube/podcast/paper ingestion** with human review as the trust layer.

## 2. Resolved divergences (the calls)

| # | Topic | Claude pass | Codex pass | Call + why |
|---|-------|-------------|------------|------------|
| 1 | Atom typing | system/model binary + soft `lean` | unified `Atom{kind:…}` incl. `claim/exercise/misconception/term` | **Unified atom + kinds.** Claims/exercises/misconceptions are the real units; the binary caused the original fuzziness. |
| 2 | Is `provenance` an atom kind? | No — it's the anchor+derivation | Yes — a kind | **No.** Provenance = `SourceAnchor` + `DerivationRun` + review_state. A "quote" is an anchor excerpt; a "historical fact" is a `claim` with an anchor. Keeping it as a kind re-creates the island we're removing. *(This is a correction to Codex, not a split.)* |
| 3 | Trust primitive | computed per-anchor `verifiable` bool | aggregate review/quality signals | **Both, layered.** `verifiable` (excerpt re-derives from selector vs stored asset) is the atomic check; aggregate signals (citation density, review completeness, disputes) sit on top. |
| 4 | Backend | Postgres+pgvector / Turso | Go + SQLite + FTS5 + sqlite-vec | **Go + SQLite + FTS5 + sqlite-vec — conditional.** Right *iff* asof code-sharing is real and the team is fine in Go. If the editor (TS/React) dominates effort and asof reuse is shallow, a TS core (libSQL/better-sqlite3 in a Tauri/Electron host) is defensible. Decide by auditing asof first (§4.5). |
| 5 | Phasing | editor-first vertical | schema-first → CLI-first | **Schema-first → CLI → editor.** Lock the pack contract + ID stability (Phase 0), prove extraction+anchoring+validation headless (Phase 1 CLI) before any editor UI. |
| 6 | Evaluation | 6 metrics, but late | phase exit-criteria + market quality signals, no harness | **Eval harness as a Phase-1 exit gate**, not a late add. Codex's own cited PNAS finding (unguarded AI *harms* learning) is the reason: you must measure grounding/refusal from the first extraction. |
| 7 | Learning layer (exercises, misconceptions, spaced practice) | defer to v2 | first-class in model + Phase 3 | **First-class in the schema now; authoring/tutoring UX in Phase 3.** Get the data shape right immediately; don't build spaced-repetition UI early. |
| 8 | Standards (PROV/SHACL/C2PA/schema.org/Open Badges) | light, "open question" | concrete mapping, internal-JSON-first | **Adopt Codex's mapping.** Internal JSON first; PROV/SHACL/C2PA/schema.org at the boundary. C2PA specifically for AI-generated/edited media. |
| 9 | Tutor contract | hard cite-or-refuse invariant | "constrained to reviewed atoms / not an answer engine" | **Same intent; keep the hard invariant + tie it to eval #6** (refusal-correctness on an out-of-scope set). |

## 3. Unified object model

Codex's atom model with the §2 corrections folded in (no `provenance` kind; computed
`verifiable`; richer `DerivationRun`; eval/review summary on the pack).

```
SourceAsset { id, uri, media_type(video|audio|pdf|html|markdown|text|conversation),
              title, creator, license, access(owned|open|restricted),
              content_hash, c2pa_manifest? }

SourceAnchor { id, source_asset_id,
               selector{ kind(text_quote|char_range|timestamp_range|page_range|frame_range|message_ref),
                         start, end },
               excerpt,
               extraction_method(asr|ocr|native|human),
               verifiable: bool }        # COMPUTED: excerpt re-derives from selector vs stored asset

Atom { id,
       kind(system|model|claim|example|exercise|misconception|term),   # note: no 'provenance'
       title, summary, body(markdown),
       steps?[]                          # systems only
       learning_level(intro|working|advanced),
       review_state(generated|edited|reviewed|rejected|published),
       authored_by(ai|human|mixed),
       source_anchor_ids[], derivation_id, version }

Relationship { id, from_atom_id, to_atom_id,
               predicate(uses|explains|requires|supports|contradicts|evidences|
                         assesses|remediates|example_of),
               review_state, source_anchor_ids[] }

DerivationRun { id, op(ingest|segment|extract|edit|merge|split|publish),
                input_ids[], output_ids[], actor(ai|human),
                model_provider?, model_name?, model_snapshot?, prompt_hash?,
                schema_version, cost?, validation_results, diff?, created_at }

LearningPack { id, title, version, license, schema_version,
               sources[], atoms[], relationships[], derivations[],
               review_summary{ verifiable_anchor_ratio, citation_density,
                               unsupported_claims, disputes },
               eval?{ anchor_precision, grounding_accuracy, refusal_correctness } }
```

Invariants (enforced by validation, gate `published`):
- `system` ⇒ steps + ≥1 `requires` prerequisite consideration + success criteria
- `model` ⇒ explanation + boundaries/failure modes
- `exercise` ⇒ answer/check/rubric, and an `assesses` edge to what it tests
- `misconception` ⇒ a `contradicts` edge to the correct atom (+ optional `remediates`)
- `published` atom/edge ⇒ ≥1 **verifiable** anchor and `review_state ∈ {reviewed, published}`
- No published atom or edge without anchors (anti-hallucinated-structure rule)

## 4. What neither pass has earned

This is the part that matters. Both docs are supply-side reasoning by two language models
about what would be good to build. None of the following is yet evidence.

1. **No demand validation.** Zero users. Both passes argue from first principles and cited
   research, not from anyone wanting this. The wedge demo must double as a demand probe.
2. **Extraction quality is assumed, not measured.** The entire thesis rests on AI producing
   *good* system/model/claim decompositions rather than plausible-looking slop. If the
   human edit rate is high enough, the tool is worse than reading the source. **This is the
   most likely thing to be fatal and the cheapest to test.**
3. **Copyright for paid packs is unsolved.** "Minimal excerpt + reference" is legally
   untested for redistribution. This could cap the commercial thesis at "personal use
   only." Both passes punt it; punting is fine for v1, not for the marketplace bet.
4. **Moat vs. NotebookLM / Study Mode is unproven.** Source-grounded study tools already
   exist from the labs. The differentiator — *editable, portable, verified graph* — assumes
   learners will tolerate a review/curation burden that those tools don't impose. If they
   won't, the primary user is *creators*, not learners, which reshapes the whole product.
5. **asof reuse is asserted, not verified.** Neither pass has read asof's code. The Go core
   recommendation (call #4) hinges on this being real. Audit before committing the stack.
6. **The review burden is the hidden cost.** "Human review as the trust layer" is the
   pitch; it's also the work. If curating one video into a good pack takes hours, supply
   stays thin and the lingua-franca/registry story stalls.

## 5. Verified defects in the current spike (basis for "reset, don't extend")

Confirmed by inspection of the repo (file:line), not assumed:
- `app/src/components/EditEntityDialog.tsx:32,166–169` — model type initialized to `'mental'`
  and offers `mental`/`conceptual`/`paradigm`, none valid for `Model['type']`; `deprecated`
  status (line 151) not in `System['status']`.
- `app/src/pages/Detail.tsx:4,6,7` — imports `Badge` (no such component) and `getSystem`/
  `getModel` (the modules export `getSystemById`/`getModelById`).
- Two divergent KBs: `data/…yaml` (4506 lines / 157 entries) vs the loaded
  `app/public/data/…yaml` (538 lines / 23 entries). `ImportDataDialog.tsx:69` fetches the
  small one.
- `app/src/lib/import-data.ts:99,119,142` — discards the YAML `id`, mints a new one, remaps.
  Permalinks (`schema.md` `#/system/gtd`) can't resolve; package identity is broken at root.
- `app/src/lib/db/index.ts` — sql.js WASM fetched from `https://sql.js.org/dist/…`, breaking
  the offline/local-first claim.

## 6. The one move both passes should sign off on

A single end-to-end vertical on **one** source, framed as a **risk probe, not a showcase**:

> one source → CLI extract (structured output) → validated pack with verifiable anchors →
> minimal review editor → grounded tutor (cite-or-refuse) → **eval numbers** → exported
> pack with derivation log.

Its job is to attack §4.2 (extraction quality) directly. Success is **not** "it demos
well." Success is a number: anchor precision, grounding accuracy, refusal correctness, and
— the decisive one — **human edit rate per usable atom**. If that number says AI extraction
is good enough to build on, everything in §3 is worth building. If it doesn't, no amount of
schema or editor polish saves it, and we've learned that for the price of one pipeline.

Recommended first source: a user-owned AI conversation (via asof) or a CC-licensed talk —
sidesteps §4.3 while testing §4.2.
