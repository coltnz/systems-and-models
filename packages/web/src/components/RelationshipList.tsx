import type { Atom, Relationship } from '@sam/types'
import { Badge } from './Badge'
import { REVIEW_STATE_LABEL } from '../theme'

/** List predicate + from→to + review_state with Accept/Reject. */
export function RelationshipList({
  relationships,
  atomsById,
  busy,
  onAccept,
  onReject,
}: {
  relationships: Relationship[]
  atomsById: Map<string, Atom>
  busy: boolean
  onAccept: (relId: string) => void
  onReject: (relId: string) => void
}) {
  if (relationships.length === 0) {
    return <p className="muted">No relationships in this pack.</p>
  }
  const label = (id: string) => atomsById.get(id)?.title ?? id
  return (
    <div>
      {relationships.map((rel) => (
        <div className="card" key={rel.id} data-testid="relationship" data-rel-id={rel.id}>
          <div className="spread">
            <div className="row">
              <span>{label(rel.from_atom_id)}</span>
              <Badge color="#64748b">{rel.predicate}</Badge>
              <span>{label(rel.to_atom_id)}</span>
            </div>
            <Badge>{REVIEW_STATE_LABEL[rel.review_state]}</Badge>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button onClick={() => onAccept(rel.id)} disabled={busy}>
              Accept
            </button>
            <button className="danger" onClick={() => onReject(rel.id)} disabled={busy}>
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
