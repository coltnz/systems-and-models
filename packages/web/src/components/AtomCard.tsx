import { useState } from 'react'
import type { Atom, SourceAnchor } from '@sam/types'
import type { AtomEditPatch, SupportState } from '../api'
import { Badge } from './Badge'
import {
  KIND_COLOR,
  REVIEW_STATE_LABEL,
  SUPPORT_STATES,
  SUPPORT_STATE_LABEL,
} from '../theme'

export interface AtomCardProps {
  atom: Atom
  /** All anchors in the pack, used to resolve each AtomAnchorRef. */
  anchorsById: Map<string, SourceAnchor>
  busy: boolean
  onAccept: () => void
  onReject: () => void
  onEdit: (patch: AtomEditPatch) => void
  onSplit: () => void
  onSetSupport: (anchorId: string, support: SupportState) => void
}

/**
 * One review card per atom: a color-coded kind badge (D-008b palette), title,
 * summary, a review_state badge, per-atom actions (accept / reject / edit /
 * split) and the atom's source anchors with a per-(atom,anchor) support_state
 * control. Edit toggles inline editable title/summary/body; Save calls op:"edit".
 */
export function AtomCard(props: AtomCardProps) {
  const { atom, anchorsById, busy } = props
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(atom.title)
  const [summary, setSummary] = useState(atom.summary ?? '')
  const [body, setBody] = useState(atom.body ?? '')

  function startEdit() {
    setTitle(atom.title)
    setSummary(atom.summary ?? '')
    setBody(atom.body ?? '')
    setEditing(true)
  }

  function saveEdit() {
    props.onEdit({ title, summary, body })
    setEditing(false)
  }

  return (
    <article className="card" data-testid="atom-card" data-atom-id={atom.id}>
      <div className="spread">
        <div className="col" style={{ gap: 4 }}>
          <div className="row">
            <Badge color={KIND_COLOR[atom.kind]}>{atom.kind}</Badge>
            <strong data-testid="atom-title">{atom.title}</strong>
          </div>
          {atom.summary && <span className="muted">{atom.summary}</span>}
        </div>
        <Badge data-testid="atom-review-state">
          {REVIEW_STATE_LABEL[atom.review_state]}
        </Badge>
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <button onClick={props.onAccept} disabled={busy} aria-label={`Accept ${atom.title}`}>
          Accept
        </button>
        <button className="danger" onClick={props.onReject} disabled={busy}>
          Reject
        </button>
        <button onClick={editing ? saveEdit : startEdit} disabled={busy}>
          {editing ? 'Save' : 'Edit'}
        </button>
        {editing && (
          <button onClick={() => setEditing(false)} disabled={busy}>
            Cancel
          </button>
        )}
        <button onClick={props.onSplit} disabled={busy}>
          Split
        </button>
      </div>

      {editing && (
        <div className="editor col" data-testid="atom-editor">
          <div className="field">
            <label htmlFor={`title-${atom.id}`}>Title</label>
            <input
              id={`title-${atom.id}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={`summary-${atom.id}`}>Summary</label>
            <input
              id={`summary-${atom.id}`}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={`body-${atom.id}`}>Body</label>
            <textarea
              id={`body-${atom.id}`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
        </div>
      )}

      {atom.anchors.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <p className="muted" style={{ margin: '4px 0' }}>
            Source anchors
          </p>
          {atom.anchors.map((ref) => {
            const anchor = anchorsById.get(ref.anchor_id)
            return (
              <div className="anchor" key={ref.anchor_id} data-testid="atom-anchor">
                {anchor ? (
                  <>
                    <div className="excerpt">“{anchor.excerpt}”</div>
                    <div className="muted">
                      {anchor.selector.kind} [{anchor.selector.start}–{anchor.selector.end}]
                      <span className="tag">
                        {anchor.verifiable ? 'verifiable' : 'unverifiable'}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="muted">anchor {ref.anchor_id} (not found in pack)</div>
                )}
                <div className="field" style={{ marginTop: 6, maxWidth: 240 }}>
                  <label htmlFor={`support-${atom.id}-${ref.anchor_id}`}>support_state</label>
                  <select
                    id={`support-${atom.id}-${ref.anchor_id}`}
                    aria-label={`support state for anchor ${ref.anchor_id}`}
                    value={ref.support_state}
                    disabled={busy}
                    onChange={(e) =>
                      props.onSetSupport(ref.anchor_id, e.target.value as SupportState)
                    }
                  >
                    {SUPPORT_STATES.map((s) => (
                      <option key={s} value={s}>
                        {SUPPORT_STATE_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </article>
  )
}
