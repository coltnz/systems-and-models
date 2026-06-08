# bd-5 — Source ingest

- **Status:** done (merged bf7ac66)
- **Type:** implementation
- **Depends on:** bd-3 (uses bd-4 types if available)
- **Blocks:** bd-6, bd-7

## Problem
We need to turn a supplied transcript/Markdown file into `SourceAsset` + `SourceAnchor`
records with a content hash and deterministic selectors, so extraction and the UI have
stable, re-derivable anchors.

## Where to look
- `spec/learning-pack.schema.json` `$defs.SourceAsset`, `$defs.SourceAnchor` (selector
  `kind: text_quote|timestamp_range|page_range`, `start/end` as strings, `verifiable`).
- domain-language.md (Source Asset vs Source Anchor vs Provenance).

## Proposed change (sketch)
`packages/ingest`:
- `ingestSource({ uri|path, media_type, title, creator, license, access })` → `SourceAsset`
  with `content_hash` = `sha256:<hex>` of normalized bytes.
- For markdown/text: segment into anchorable spans (paragraph/sentence) and emit
  `SourceAnchor`s with `selector.kind="text_quote"`, `start/end` = **character offsets**
  (as strings) into the normalized source, `excerpt` = exact substring, `extraction_method="native"`.
- A `verifyAnchor(anchor, sourceText)` that recomputes `excerpt` from the selector and sets
  `verifiable` (string match within defined tolerance — document the tolerance).
- Deterministic: same input ⇒ identical asset id derivation, hashes, offsets, ordering.
- Emit an `ingest` `DerivationRun` (input = source id, outputs = anchor ids).

## Definition of done
- Given a sample transcript .md, produces a JSON blob `{ source, anchors, derivation }`
  that validates against the schema (via bd-4) and whose anchors are all `verifiable`.
- Round-trip test: every emitted anchor re-derives its excerpt from its selector.
- Deterministic test: same input twice ⇒ byte-identical output (modulo timestamps, which
  must be injectable for tests).

## Gates
- `npm test` (ingest) green; output validates via bd-4; typecheck/lint green.

## Constraints
- No ASR/video in alpha — transcript/Markdown/text only.
- No network. Hash + offsets must be stable across runs/OSes (normalize line endings).
- Timestamps/ids injectable so tests are deterministic.

## Notes & decisions (mayor)
Reviewed (ingest pkg + 1-line lockfile) and re-ran 5 gates green (38 tests; ingest 8). Clean,
deterministic, matches the bead.
- Input carries `content` (server reads files, D-007); normalization = line-endings only;
  `content_hash=sha256:<hex>`; asset id `src-<12 hex>` (hash-derived).
- Paragraph segmentation on blank lines; `verifyAnchor` = EXACT-equality re-derivation; all anchors
  verifiable by construction. Injectable clock → tz-aware `created_at`. Same content+clock ⇒ identical.
- **Follow-ups carried forward** (worker flagged): anchor ids `anc-<start>-<end>` are unique within a
  source but NOT globally — **bd-6/bd-7 must namespace anchors by `source_asset_id`** if pooling across
  packs. **bd-7 (server)** owns normalization-at-read (store normalized text or re-normalize identically
  so offsets don't drift) and must de-dupe the deterministic `der-ingest-<sourceId>` on re-ingest.
- Minor (accepted): `ingestSource` returns a Promise but throws synchronously on unsupported media;
  fine since the server awaits in try/catch.
