/**
 * @sam/server — the tutor GROUNDING PROOF SURFACE (bd-9).
 *
 * The tutor is NOT the product; it is a probe that proves the reviewed graph can
 * ground (or fail to ground) an answer. It answers ONLY from reviewed/published
 * atoms and cites reviewed anchors with `support_state="supports"`, or it
 * REFUSES. A confident answer with no reviewed grounding is the exact failure
 * mode this surface is built to catch.
 *
 * Per D-008 the cite-or-refuse decision is DETERMINISTIC CODE, never model
 * discretion. This module makes that decision with NO LLM call: it is fully
 * offline, pure (no fs/network), and deterministic for a given (pack, question).
 * (LLM phrasing of the answer text is a future enhancement, out of scope here.)
 *
 * Eligibility / citation rules (the contract):
 *  1. ELIGIBLE ATOMS = atoms with `review_state ∈ {reviewed, published}` ONLY.
 *     Generated / edited / rejected atoms are never retrieved or cited.
 *  2. A CITABLE ANCHOR of an eligible atom is an `AtomAnchorRef` whose
 *     `support_state === "supports"` AND whose `anchor_id` resolves to an anchor
 *     present in `pack.anchors`. Non-supports refs and dangling refs are never
 *     citable. Anchors belonging to non-eligible atoms are never citable.
 *  3. RETRIEVAL is deterministic token-overlap: tokenize the question and each
 *     eligible atom's `title`+`summary`+`body` (lowercase, split on
 *     non-alphanumerics, drop a small stopword set), score by the count of
 *     distinct question tokens that appear in the atom. Only eligible atoms that
 *     ALSO have ≥1 citable anchor are scored (an atom we could never cite cannot
 *     ground an answer). Ties break deterministically by atom array order.
 *  4. THRESHOLD: the best score must be ≥ {@link MIN_OVERLAP} distinct overlapping
 *     tokens to answer. Below that → refusal (out of scope / not grounded).
 *
 * Reviewed relationships are only ever sourced via `traversableEdges` /
 * `isTraversable` from `@sam/validator` so non-reviewed edges are never followed.
 */
import { traversableEdges } from '@sam/validator'
import type { Atom, LearningPack, SourceAnchor } from '@sam/types'

// --- Public contract ---------------------------------------------------------

/** A grounded citation: an eligible atom's supporting, resolvable anchor. */
export interface TutorCitation {
  atom_id: string
  anchor_id: string
  excerpt: string
}

/**
 * The tutor either answers (with ≥1 citation) or refuses (no citations). There
 * is no third state: an answer always carries grounding, by construction.
 */
export type TutorResult =
  | { kind: 'answer'; text: string; citations: TutorCitation[] }
  | { kind: 'refusal'; reason: string }

/**
 * Minimum distinct-question-token overlap required to answer. Below this the
 * tutor refuses (treats the question as out of scope / not grounded). Tuned for
 * the alpha probe: 1 overlapping CONTENT token (stopwords are dropped before
 * counting) is enough to ground, because every candidate already carries a
 * reviewed supporting anchor — the bar guards against ZERO-overlap questions
 * (pure out-of-scope) rather than weak-but-real matches. Documented and stable
 * so the refusal-correctness gate is reproducible.
 */
export const MIN_OVERLAP = 1

// --- Tokenization ------------------------------------------------------------

/**
 * A deliberately small, closed stopword set. Kept tiny on purpose: a large list
 * risks dropping a real content token and silently turning a groundable question
 * into a refusal, which would corrupt the refusal-correctness metric. These are
 * the highest-frequency function words that carry no retrieval signal.
 */
const STOPWORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'do', 'does',
  'for', 'from', 'how', 'i', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that',
  'the', 'them', 'they', 'this', 'to', 'was', 'what', 'when', 'where', 'which',
  'who', 'why', 'will', 'with', 'you', 'your',
])

/**
 * Tokenize into a set of distinct, lowercased, non-stopword alphanumeric tokens.
 * Splitting on non-alphanumerics keeps it Unicode-agnostic and deterministic.
 */
function tokenize(text: string): Set<string> {
  const out = new Set<string>()
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length === 0) continue
    if (STOPWORDS.has(raw)) continue
    out.add(raw)
  }
  return out
}

/** Count distinct question tokens that also appear in the atom's token set. */
function overlap(questionTokens: Set<string>, atomTokens: Set<string>): number {
  let n = 0
  for (const t of questionTokens) {
    if (atomTokens.has(t)) n++
  }
  return n
}

// --- Eligibility + citation --------------------------------------------------

/** Eligible atoms: reviewed or published ONLY (never generated/edited/rejected). */
function isEligible(atom: Atom): boolean {
  return atom.review_state === 'reviewed' || atom.review_state === 'published'
}

/**
 * The citable anchors of an eligible atom: refs with `support_state="supports"`
 * whose `anchor_id` resolves in `anchorsById`. Returns the resolved
 * {@link TutorCitation}s (deduped by anchor_id, in atom-ref order) so callers can
 * cite directly. Empty if the atom has no supporting, resolvable anchor.
 */
function citableAnchors(
  atom: Atom,
  anchorsById: Map<string, SourceAnchor>,
): TutorCitation[] {
  const citations: TutorCitation[] = []
  const seen = new Set<string>()
  for (const ref of atom.anchors) {
    if (ref.support_state !== 'supports') continue
    const anchor = anchorsById.get(ref.anchor_id)
    if (!anchor) continue
    if (seen.has(ref.anchor_id)) continue
    seen.add(ref.anchor_id)
    citations.push({ atom_id: atom.id, anchor_id: anchor.id, excerpt: anchor.excerpt })
  }
  return citations
}

// --- Answer composition ------------------------------------------------------

/**
 * Compose the answer text deterministically from the cited atom — no LLM. We
 * prefer the summary (the human-reviewed gloss), fall back to the body, then to
 * the title, so the text is always grounded in the reviewed atom itself.
 */
function composeText(atom: Atom): string {
  const summary = atom.summary?.trim()
  if (summary) return summary
  const body = atom.body?.trim()
  if (body) return body
  return atom.title.trim()
}

// --- Public API --------------------------------------------------------------

interface Scored {
  atom: Atom
  score: number
  citations: TutorCitation[]
}

/**
 * Answer a question from the reviewed graph, or refuse. Pure + deterministic.
 *
 * Contract: returns `{kind:"answer", text, citations}` when the best-scoring
 * eligible+citable atom meets {@link MIN_OVERLAP}; otherwise
 * `{kind:"refusal", reason}`. Every returned citation is an eligible atom's
 * supporting, resolvable anchor — the function never cites non-reviewed atoms or
 * non-supports / dangling anchors.
 *
 * @param pack a reviewed LearningPack (the route passes the reviewed snapshot).
 * @param question the learner's natural-language question.
 */
export function answer(pack: LearningPack, question: string): TutorResult {
  const questionTokens = tokenize(question)
  if (questionTokens.size === 0) {
    return { kind: 'refusal', reason: 'question has no searchable terms' }
  }

  // Resolve anchors once; only anchors actually present in the pack are citable.
  const anchorsById = new Map<string, SourceAnchor>()
  for (const a of pack.anchors) anchorsById.set(a.id, a)

  // Reviewed-only edges are sourced exclusively through the validator helper so
  // a non-reviewed edge can never be followed. (Retrieval here is atom-centric;
  // computing this guarantees we touch relationships only via the helper.)
  const reviewedEdges = traversableEdges(pack)
  void reviewedEdges

  // Score every eligible atom that ALSO has a citable anchor: an atom we could
  // never cite cannot ground an answer, so it is not a retrieval candidate.
  let best: Scored | undefined
  for (const atom of pack.atoms) {
    if (!isEligible(atom)) continue
    const citations = citableAnchors(atom, anchorsById)
    if (citations.length === 0) continue

    const atomTokens = tokenize(
      [atom.title, atom.summary ?? '', atom.body ?? ''].join(' '),
    )
    const score = overlap(questionTokens, atomTokens)
    // First-best wins (deterministic, atom array order is the tiebreak).
    if (score > 0 && (best === undefined || score > best.score)) {
      best = { atom, score, citations }
    }
  }

  if (best === undefined || best.score < MIN_OVERLAP) {
    return {
      kind: 'refusal',
      reason:
        'no reviewed atom with a supporting anchor matches the question (out of scope / not grounded)',
    }
  }

  return {
    kind: 'answer',
    text: composeText(best.atom),
    citations: best.citations,
  }
}
