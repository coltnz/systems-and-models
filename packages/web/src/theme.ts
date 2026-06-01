/**
 * Domain palette + small presentation maps for the review UI.
 *
 * Colors are the audited spike graph palette (D-008b): systems blue
 * `#3b82f6`, models purple `#a855f7`, provenance amber `#f59e0b`. Claims get a
 * distinct teal `#14b8a6` (the alpha's atom kinds are `system|model|claim`).
 */
import type { AtomKind, ReviewState, SupportState, Severity } from './api'

/** Atom-kind badge colors. Systems/models reuse the D-008b graph palette. */
export const KIND_COLOR: Record<AtomKind, string> = {
  system: '#3b82f6',
  model: '#a855f7',
  claim: '#14b8a6',
}

/** Amber from the salvaged palette, kept for provenance/source accents. */
export const PROVENANCE_COLOR = '#f59e0b'

/** Human-facing review-state labels. */
export const REVIEW_STATE_LABEL: Record<ReviewState, string> = {
  generated: 'Generated',
  edited: 'Edited',
  reviewed: 'Reviewed',
  rejected: 'Rejected',
  published: 'Published',
}

export const SUPPORT_STATES: SupportState[] = [
  'supports',
  'partially',
  'does_not_support',
  'disputed',
]

export const SUPPORT_STATE_LABEL: Record<SupportState, string> = {
  supports: 'Supports',
  partially: 'Partially',
  does_not_support: 'Does not support',
  disputed: 'Disputed',
}

/** Validation severities, ordered blocking-first. */
export const SEVERITY_LABEL: Record<Severity, string> = {
  structural: 'Structural (blocking)',
  graph: 'Graph (warning)',
}
