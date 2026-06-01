import { useMemo, useState } from 'react'
import { SCHEMA_VERSION } from '@sam/types'
import type { Atom, LearningPack, SourceAnchor } from '@sam/types'
import {
  acceptAtom,
  ApiError,
  editAtom,
  patchRelationship,
  rejectAtom,
  saveReviewed,
  setSupport,
  splitAtom,
  type AtomEditPatch,
  type DraftResult,
  type SupportState,
  type ValidationResult,
} from './api'
import { AtomCard } from './components/AtomCard'
import { NewSourceForm } from './components/NewSourceForm'
import { RelationshipList } from './components/RelationshipList'
import { TutorBox } from './components/TutorBox'
import { hasStructural, ValidationPanel } from './components/ValidationPanel'

interface ReviewState {
  pack: LearningPack
  validation: ValidationResult
}

/**
 * Extract a `ValidationResult` from a caught error if it is an `ApiError` whose
 * `body` carries a `validation` field (e.g. a 422 from a structurally-invalid
 * edit). Returns undefined for any other error so callers fall back to the plain
 * message.
 */
function validationFromError(e: unknown): ValidationResult | undefined {
  if (
    e instanceof ApiError &&
    typeof e.body === 'object' &&
    e.body !== null &&
    'validation' in e.body
  ) {
    return (e.body as { validation: ValidationResult }).validation
  }
  return undefined
}

/**
 * Single-page review UI (bd-8). Turns a generated draft pack into a reviewed
 * pack against the bd-7 server. State is plain React state; every mutation
 * returns `{ pack, validation }` and we re-render from that returned pack.
 */
export default function App() {
  const [review, setReview] = useState<ReviewState | undefined>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [saved, setSaved] = useState<string | undefined>()

  const anchorsById = useMemo(() => {
    const m = new Map<string, SourceAnchor>()
    review?.pack.anchors.forEach((a) => m.set(a.id, a))
    return m
  }, [review])

  const atomsById = useMemo(() => {
    const m = new Map<string, Atom>()
    review?.pack.atoms.forEach((a) => m.set(a.id, a))
    return m
  }, [review])

  function loadDraft(draft: DraftResult) {
    setReview({ pack: draft.pack, validation: draft.validation })
    setError(undefined)
    setSaved(undefined)
  }

  /** Run a mutation that returns `{pack, validation}`, re-render from its result. */
  async function run(action: () => Promise<ReviewState>) {
    setBusy(true)
    setError(undefined)
    setSaved(undefined)
    try {
      setReview(await action())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'request failed')
      // A 422 (e.g. an edit that would make the pack structurally invalid)
      // carries the failing validation on the ApiError body. Surface it in the
      // ValidationPanel (keeping the message banner) so the reviewer sees WHY,
      // not just a generic error.
      const validation = validationFromError(e)
      if (validation) {
        setReview((prev) => (prev ? { ...prev, validation } : prev))
      }
    } finally {
      setBusy(false)
    }
  }

  async function onSaveReviewed() {
    if (!review) return
    setBusy(true)
    setError(undefined)
    setSaved(undefined)
    try {
      const res = await saveReviewed(review.pack.id)
      if (res.ok) {
        setSaved(`Reviewed pack saved at ${res.reviewed.saved_at}.`)
      } else {
        // 409: surface the validation errors and keep editing.
        setReview({ pack: review.pack, validation: res.validation })
        setError('Reviewed save rejected — resolve the validation errors below.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'reviewed save failed')
    } finally {
      setBusy(false)
    }
  }

  const blocked = hasStructural(review?.validation)

  return (
    <main className="app">
      <header>
        <h1>Systems &amp; Models — Review</h1>
        <p className="muted">
          Turn a generated draft pack into a reviewed pack. Schema v{SCHEMA_VERSION}.
        </p>
      </header>

      {!review && <NewSourceForm onLoaded={loadDraft} onError={setError} />}

      {error && <div className="banner err" role="alert">{error}</div>}
      {saved && <div className="banner ok" role="status">{saved}</div>}

      {review && (
        <>
          <section className="card">
            <div className="spread">
              <div>
                <h2 style={{ margin: 0 }}>{review.pack.title}</h2>
                <span className="muted">
                  {review.pack.atoms.length} atom(s), {review.pack.relationships.length}{' '}
                  relationship(s)
                </span>
              </div>
              <div className="row">
                <button
                  className="primary"
                  onClick={() => void onSaveReviewed()}
                  disabled={busy || blocked}
                  data-testid="save-reviewed"
                  title={
                    blocked
                      ? 'Resolve structural errors before saving the reviewed pack'
                      : 'Save the reviewed pack'
                  }
                >
                  Save reviewed pack
                </button>
                <button onClick={() => setReview(undefined)} disabled={busy}>
                  Start over
                </button>
              </div>
            </div>
            {blocked && (
              <p className="muted">
                Saving is blocked while structural errors exist.
              </p>
            )}
          </section>

          <ValidationPanel validation={review.validation} />

          <h2>Atoms</h2>
          {review.pack.atoms.map((atom) => (
            <AtomCard
              key={atom.id}
              atom={atom}
              anchorsById={anchorsById}
              busy={busy}
              onAccept={() => void run(() => acceptAtom(review.pack.id, atom.id))}
              onReject={() => void run(() => rejectAtom(review.pack.id, atom.id))}
              onEdit={(patch: AtomEditPatch) =>
                void run(() => editAtom(review.pack.id, atom.id, patch))
              }
              onSplit={() => void run(() => splitAtom(review.pack.id, atom.id))}
              onSetSupport={(anchorId: string, support: SupportState) =>
                void run(() => setSupport(review.pack.id, atom.id, anchorId, support))
              }
            />
          ))}

          <h2>Relationships</h2>
          <RelationshipList
            relationships={review.pack.relationships}
            atomsById={atomsById}
            busy={busy}
            onAccept={(relId) =>
              void run(() => patchRelationship(review.pack.id, relId, 'accept'))
            }
            onReject={(relId) =>
              void run(() => patchRelationship(review.pack.id, relId, 'reject'))
            }
          />

          <TutorBox packId={review.pack.id} />
        </>
      )}
    </main>
  )
}
