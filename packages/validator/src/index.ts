/**
 * @sam/validator — LearningPack v0 validation.
 *
 * Two layers (bd-4, D-005):
 *
 *  1. STRUCTURAL — Ajv (JSON Schema 2020-12) + ajv-formats, validating against
 *     the committed `spec/learning-pack.schema.json`. That file is the SINGLE
 *     schema source: it is loaded once at module init and never re-declared in
 *     TypeScript. Structural failures carry `severity: "structural"`.
 *
 *  2. GRAPH-LEVEL — checks JSON Schema cannot express (referential integrity,
 *     uniqueness, the publish invariant, relationship anchor/support dependency,
 *     timezone-aware datetimes). These run only after the pack is structurally
 *     valid (so graph code can assume the shape). Failures carry
 *     `severity: "graph"`.
 *
 * `validatePack` is pure: the only filesystem access is the one-time schema load
 * at module init. No network. Deterministic (errors are emitted in a fixed
 * traversal order).
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js'
import type { FormatsPlugin } from 'ajv-formats'

import type {
  Atom,
  DerivationRun,
  LearningPack,
  Relationship,
  SourceAnchor,
} from '@sam/types'

// --- Result shape -----------------------------------------------------------

/**
 * Stable error `code` taxonomy. These strings are part of the contract: callers
 * (server bd-7, tutor bd-9, CLI) may switch on them, so they must not change
 * meaning. Grouped structural-vs-graph for readability; `severity` carries the
 * same distinction at runtime.
 */
export type ValidationCode =
  // structural (Ajv)
  | 'structural'
  // graph: referential integrity + uniqueness
  | 'duplicate_id'
  | 'dangling_anchor_source_ref'
  | 'dangling_atom_anchor_ref'
  | 'dangling_atom_derivation_ref'
  | 'dangling_relationship_atom_ref'
  | 'dangling_relationship_anchor_ref'
  // graph: publish invariant
  | 'publish_without_supporting_anchor'
  | 'publish_bad_review_state'
  // graph: relationship anchor/support dependency
  | 'relationship_empty_anchor_ids'
  | 'relationship_anchor_without_support_state'
  // graph: datetime
  | 'derivation_created_at_not_tz_aware'

export type Severity = 'structural' | 'graph'

export interface ValidationError {
  /** Stable, documented code. See {@link ValidationCode}. */
  code: ValidationCode
  /** JSON Pointer (structural) or dotted path (graph) to the offending node. */
  path: string
  /** Human-readable explanation. */
  message: string
  severity: Severity
}

export interface ValidationResult {
  ok: boolean
  errors: ValidationError[]
}

// --- Schema loading (single source of truth, once at module init) -----------

const SCHEMA_FILENAME = 'learning-pack.schema.json'
const SCHEMA_RELATIVE = join('spec', SCHEMA_FILENAME)

/**
 * Resolve `spec/learning-pack.schema.json` robustly so the validator works
 * whether it runs from TS source (Vitest / D-011 aliases, `import.meta.url`
 * points at `packages/validator/src/index.ts`) or from the built bundle
 * (`packages/validator/dist/index.js`). We start at this module's directory and
 * walk up parent directories until we find `spec/<file>`, which lands on the
 * repo root in both layouts. Throws a clear error if not found (e.g. the package
 * was published detached from the monorepo) — this surfaces at import time, not
 * silently per call.
 */
function resolveSchemaPath(): string {
  const startDir = dirname(fileURLToPath(import.meta.url))
  let dir = startDir
  // Walk up to the filesystem root.
  for (;;) {
    const candidate = join(dir, SCHEMA_RELATIVE)
    try {
      // Probe existence by attempting a read; readFileSync throws ENOENT if absent.
      readFileSync(candidate)
      return candidate
    } catch {
      // not here; keep walking
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(
    `@sam/validator: could not locate ${SCHEMA_RELATIVE} by walking up from ${startDir}. ` +
      `The validator must run inside the monorepo (or alongside a copy of spec/).`,
  )
}

const SCHEMA_PATH = resolveSchemaPath()
const SCHEMA_JSON: unknown = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'))

// Ajv 2020 + ajv-formats ship CJS. The `Ajv2020` class is reachable as a named
// import (runtime: `module.exports.Ajv2020`). ajv-formats only exposes its plugin
// as a CJS default; under NodeNext + verbatimModuleSyntax that default is not
// callable when imported, so we load it via createRequire (runtime: the plugin
// function is `module.exports` itself).
const requireCjs = createRequire(import.meta.url)
const addFormats = requireCjs('ajv-formats') as FormatsPlugin

const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)

// Deliberately make the structural `date-time` format LENIENT (accept zoneless /
// naive datetimes) and defer the strict timezone-awareness rule to the graph
// layer (see `isTzAwareInstant`). This keeps a single, well-documented place that
// owns the datetime contract: the structural pass only checks the value is a
// well-formed datetime-shaped string, while the graph pass enforces that
// DerivationRun.created_at carries an explicit `Z`/offset. Without this override,
// ajv-formats already rejects zoneless values structurally, which would shadow the
// graph-level `derivation_created_at_not_tz_aware` code and split the datetime
// contract across two layers. Garbage (`not-a-date`) is still rejected here.
ajv.addFormat('date-time', {
  type: 'string',
  validate: (value: string): boolean =>
    !Number.isNaN(Date.parse(value)) ||
    /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}/.test(value),
})

const validateStructural: ValidateFunction = ajv.compile(SCHEMA_JSON as object)

// --- Datetime tolerance -----------------------------------------------------

/**
 * Require an RFC 3339 / ISO 8601 instant WITH an explicit timezone: a trailing
 * `Z` (UTC) or a numeric offset `±HH:MM`. We deliberately REJECT naive /
 * zoneless datetimes such as `2026-05-26T10:00:00`, because a zoneless instant
 * is ambiguous across machines and would make provenance ordering unstable.
 *
 * Ajv's `format: date-time` is lenient (it accepts zoneless values), so we add
 * this explicit code-level gate. Tolerance: we do not normalize or re-parse the
 * date beyond the regex + range check below; we only assert it is a well-formed,
 * timezone-qualified RFC 3339 timestamp. Fractional seconds are allowed.
 */
const RFC3339_TZ_AWARE =
  /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/

function isTzAwareInstant(value: string): boolean {
  if (!RFC3339_TZ_AWARE.test(value)) return false
  // Defensive: ensure it is also a real calendar instant (e.g. reject month 13).
  const ms = Date.parse(value)
  return !Number.isNaN(ms)
}

// --- Helpers ----------------------------------------------------------------

function structuralError(e: ErrorObject): ValidationError {
  // Ajv instancePath is already a JSON Pointer ("" for the root).
  const path = e.instancePath === '' ? '/' : e.instancePath
  const detail = e.message ?? 'is invalid'
  // Include the failing keyword's params for actionable messages (enum values,
  // const, missing property name, ...). Kept compact & deterministic.
  const params =
    e.params && Object.keys(e.params).length > 0
      ? ` (${JSON.stringify(e.params)})`
      : ''
  return {
    code: 'structural',
    path,
    message: `${e.keyword}: ${detail}${params}`,
    severity: 'structural',
  }
}

/**
 * Collect duplicate ids in a collection. Returns ValidationErrors pointing at the
 * second-and-later occurrences (deterministic: first wins, later flagged).
 */
function checkUnique(
  items: ReadonlyArray<{ id: string }>,
  collection: string,
): ValidationError[] {
  const seen = new Set<string>()
  const errors: ValidationError[] = []
  items.forEach((item, i) => {
    if (seen.has(item.id)) {
      errors.push({
        code: 'duplicate_id',
        path: `/${collection}/${i}/id`,
        message: `duplicate id "${item.id}" in ${collection}`,
        severity: 'graph',
      })
    } else {
      seen.add(item.id)
    }
  })
  return errors
}

// --- Graph-level validation -------------------------------------------------

function validateGraph(pack: LearningPack): ValidationError[] {
  const errors: ValidationError[] = []

  // Id sets per collection (first occurrence; uniqueness reported separately).
  const sourceIds = new Set(pack.sources.map((s) => s.id))
  const anchorIds = new Set(pack.anchors.map((a) => a.id))
  const atomIds = new Set(pack.atoms.map((a) => a.id))
  const derivationIds = new Set(pack.derivations.map((d) => d.id))

  // 1. Uniqueness within each collection.
  errors.push(...checkUnique(pack.sources, 'sources'))
  errors.push(...checkUnique(pack.anchors, 'anchors'))
  errors.push(...checkUnique(pack.atoms, 'atoms'))
  errors.push(...checkUnique(pack.relationships, 'relationships'))
  errors.push(...checkUnique(pack.derivations, 'derivations'))

  // 2. Referential integrity — anchors -> source assets.
  pack.anchors.forEach((anchor: SourceAnchor, i) => {
    if (!sourceIds.has(anchor.source_asset_id)) {
      errors.push({
        code: 'dangling_anchor_source_ref',
        path: `/anchors/${i}/source_asset_id`,
        message: `anchor "${anchor.id}" references unknown source_asset_id "${anchor.source_asset_id}"`,
        severity: 'graph',
      })
    }
  })

  // 3. Referential integrity — atoms -> anchors and atoms -> derivations.
  pack.atoms.forEach((atom: Atom, i) => {
    atom.anchors.forEach((ref, j) => {
      if (!anchorIds.has(ref.anchor_id)) {
        errors.push({
          code: 'dangling_atom_anchor_ref',
          path: `/atoms/${i}/anchors/${j}/anchor_id`,
          message: `atom "${atom.id}" references unknown anchor_id "${ref.anchor_id}"`,
          severity: 'graph',
        })
      }
    })
    if (!derivationIds.has(atom.derivation_id)) {
      errors.push({
        code: 'dangling_atom_derivation_ref',
        path: `/atoms/${i}/derivation_id`,
        message: `atom "${atom.id}" references unknown derivation_id "${atom.derivation_id}"`,
        severity: 'graph',
      })
    }

    // 4. Publish invariant. A published atom MUST have >=1 anchor entry with
    //    support_state === "supports" whose referenced anchor exists, and a
    //    review_state in {reviewed, published}. `review_state === "published"`
    //    already satisfies the {reviewed, published} half by construction, so
    //    only the supporting-anchor half can fail here. The `publish_bad_review_state`
    //    code is reserved for the (currently unreachable) case of enforcing the
    //    invariant against a non-published reviewed lifecycle if that is added.
    if (atom.review_state === 'published') {
      const hasSupportingResolvableAnchor = atom.anchors.some(
        (ref) => ref.support_state === 'supports' && anchorIds.has(ref.anchor_id),
      )
      if (!hasSupportingResolvableAnchor) {
        errors.push({
          code: 'publish_without_supporting_anchor',
          path: `/atoms/${i}`,
          message: `published atom "${atom.id}" has no anchor with support_state="supports" that resolves to an existing anchor`,
          severity: 'graph',
        })
      }
    }
  })

  // 5. Relationships — atom/anchor referential integrity + anchor/support dep.
  pack.relationships.forEach((rel: Relationship, i) => {
    if (!atomIds.has(rel.from_atom_id)) {
      errors.push({
        code: 'dangling_relationship_atom_ref',
        path: `/relationships/${i}/from_atom_id`,
        message: `relationship "${rel.id}" references unknown from_atom_id "${rel.from_atom_id}"`,
        severity: 'graph',
      })
    }
    if (!atomIds.has(rel.to_atom_id)) {
      errors.push({
        code: 'dangling_relationship_atom_ref',
        path: `/relationships/${i}/to_atom_id`,
        message: `relationship "${rel.id}" references unknown to_atom_id "${rel.to_atom_id}"`,
        severity: 'graph',
      })
    }

    // Mirror the schema's dependentRequired ({ anchor_ids: ["support_state"] })
    // plus the semantic rule that anchor_ids (if present) must be non-empty and
    // every referenced anchor must resolve.
    //
    // `Relationship` is a discriminated union where the WithAnchors arm requires
    // support_state, so narrowing on `anchor_ids` would type support_state as
    // always-present and collapse the missing-state branch to `never`. Because
    // the graph layer is intentionally defending against runtime data that may
    // violate that invariant (e.g. a hand-edited pack), read both fields through
    // a loose view rather than relying on the union narrowing.
    const loose = rel as {
      anchor_ids?: string[]
      support_state?: string
    }
    if (loose.anchor_ids !== undefined) {
      if (loose.anchor_ids.length === 0) {
        errors.push({
          code: 'relationship_empty_anchor_ids',
          path: `/relationships/${i}/anchor_ids`,
          message: `relationship "${rel.id}" has anchor_ids present but empty`,
          severity: 'graph',
        })
      }
      if (loose.support_state === undefined) {
        errors.push({
          code: 'relationship_anchor_without_support_state',
          path: `/relationships/${i}/support_state`,
          message: `relationship "${rel.id}" has anchor_ids but no support_state (dependentRequired)`,
          severity: 'graph',
        })
      }
      loose.anchor_ids.forEach((anchorId, j) => {
        if (!anchorIds.has(anchorId)) {
          errors.push({
            code: 'dangling_relationship_anchor_ref',
            path: `/relationships/${i}/anchor_ids/${j}`,
            message: `relationship "${rel.id}" references unknown anchor_id "${anchorId}"`,
            severity: 'graph',
          })
        }
      })
    }
  })

  // 6. Datetime — every DerivationRun.created_at must be a tz-aware instant.
  pack.derivations.forEach((run: DerivationRun, i) => {
    if (!isTzAwareInstant(run.created_at)) {
      errors.push({
        code: 'derivation_created_at_not_tz_aware',
        path: `/derivations/${i}/created_at`,
        message: `derivation "${run.id}" created_at "${run.created_at}" is not a timezone-aware RFC 3339 instant (require trailing Z or ±HH:MM offset)`,
        severity: 'graph',
      })
    }
  })

  return errors
}

// --- Public API -------------------------------------------------------------

/**
 * Validate a candidate LearningPack.
 *
 * Runs structural (Ajv) validation first; only if it passes do graph-level
 * checks run (they assume the validated shape). Pure & deterministic.
 *
 * @param pack un-parsed/typed candidate; the structural pass narrows it to
 *   {@link LearningPack} for the graph pass.
 */
export function validatePack(pack: unknown): ValidationResult {
  const ok = validateStructural(pack)
  if (!ok) {
    const errors = (validateStructural.errors ?? []).map(structuralError)
    // Defensive: Ajv should always populate errors on failure, but never return
    // ok:false with an empty errors array.
    if (errors.length === 0) {
      errors.push({
        code: 'structural',
        path: '/',
        message: 'structural validation failed',
        severity: 'structural',
      })
    }
    return { ok: false, errors }
  }

  const errors = validateGraph(pack as LearningPack)
  return { ok: errors.length === 0, errors }
}

/**
 * Reviewed-or-published traversal (D-008, synthesis §5). Returns only
 * relationships the tutor (bd-9) may traverse: those with
 * `review_state ∈ {reviewed, published}`. `published` ⊇ `reviewed` (a published
 * edge is a reviewed edge that has been promoted), matching the tutor's
 * atom-eligibility rule (`isEligible` accepts both), so a published edge is not
 * silently dropped from traversal.
 *
 * NOTE: a non-traversable edge is NOT a validation error — such edges are
 * allowed to exist, they are simply not traversable. Callers that walk the graph
 * should source edges from here (or from {@link isTraversable}) rather than from
 * `pack.relationships` directly, so non-traversable edges are never followed.
 */
export function traversableEdges(pack: LearningPack): Relationship[] {
  return pack.relationships.filter((rel) => isTraversable(rel))
}

/**
 * Predicate a caller can use to detect/guard traversal of a non-traversable
 * edge. Returns true iff the relationship is traversable
 * (`review_state ∈ {reviewed, published}`).
 */
export function isTraversable(rel: Relationship): boolean {
  return rel.review_state === 'reviewed' || rel.review_state === 'published'
}

/** Re-exported for callers that already hold a typed pack. */
export type { LearningPack }
