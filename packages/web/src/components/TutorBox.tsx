import { useState } from 'react'
import { tutorQuery, type TutorResult } from '../api'

/**
 * Tutor query box (cite-or-refuse, bd-9). Submits to `POST /tutor/query` and
 * renders either the answer text + each cited excerpt, or the refusal reason.
 * The grounding/refusal decision is deterministic server-side code (D-008).
 */
export function TutorBox({ packId }: { packId: string }) {
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<TutorResult | undefined>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()

  async function ask() {
    if (!question.trim()) return
    setBusy(true)
    setError(undefined)
    try {
      setResult(await tutorQuery(packId, question))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'tutor query failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card" aria-label="Tutor">
      <h2 style={{ marginTop: 0 }}>Tutor</h2>
      <p className="muted">Answers only from the reviewed snapshot, or refuses.</p>
      <div className="row">
        <input
          aria-label="Tutor question"
          placeholder="Ask a question…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void ask()
          }}
        />
        <button className="primary" onClick={() => void ask()} disabled={busy}>
          Ask
        </button>
      </div>

      {error && <div className="banner err">{error}</div>}

      {result?.kind === 'answer' && (
        <div data-testid="tutor-answer" style={{ marginTop: 10 }}>
          <p>{result.text}</p>
          <p className="muted">Citations</p>
          <ul className="errors">
            {result.citations.map((c, i) => (
              <li key={i} className="anchor" data-testid="tutor-citation">
                <span className="excerpt">“{c.excerpt}”</span>
                <span className="tag">{c.atom_id}</span>
                <span className="tag">{c.anchor_id}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result?.kind === 'refusal' && (
        <div className="banner err" data-testid="tutor-refusal" style={{ marginTop: 10 }}>
          Refused: {result.reason}
        </div>
      )}
    </section>
  )
}
