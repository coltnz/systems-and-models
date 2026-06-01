/**
 * @sam/validator — LearningPack v0 validation (STUB).
 *
 * bd-4 implements this for real: structural validation via Ajv (2020-12)
 * against the committed `spec/learning-pack.schema.json` (the single schema
 * source, D-005) plus graph invariants in code. The schema is never re-declared
 * in TypeScript.
 *
 * For the scaffold this is a no-op that always reports the pack as valid so the
 * rest of the workspace can compile and call it.
 */
import type { LearningPack } from '@sam/types'

export interface ValidationResult {
  ok: boolean
  errors: unknown[]
}

/**
 * Validate a candidate LearningPack.
 *
 * STUB (bd-4): currently accepts everything. Takes `unknown` because callers may
 * hand us un-parsed JSON; the real implementation narrows it to {@link LearningPack}.
 */
export function validatePack(pack: unknown): ValidationResult {
  void pack
  return { ok: true, errors: [] }
}

/** Re-exported for callers that already hold a typed pack. */
export type { LearningPack }
