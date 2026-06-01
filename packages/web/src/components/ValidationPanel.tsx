import type { ValidationResult } from '../api'
import { SEVERITY_LABEL } from '../theme'

/**
 * Render `validation.errors` grouped by severity: `structural` blocking (red),
 * `graph` warnings (amber). The reviewed-save button is gated on
 * {@link hasStructural} by the parent.
 */
export function hasStructural(v: ValidationResult | undefined): boolean {
  return !!v?.errors.some((e) => e.severity === 'structural')
}

export function ValidationPanel({ validation }: { validation: ValidationResult | undefined }) {
  if (!validation) return null
  const structural = validation.errors.filter((e) => e.severity === 'structural')
  const graph = validation.errors.filter((e) => e.severity === 'graph')

  return (
    <section className="card" aria-label="Validation">
      <div className="spread">
        <h2 style={{ margin: 0 }}>Validation</h2>
        <span className="muted" data-testid="validation-status">
          {validation.ok ? 'Pack is valid' : `${validation.errors.length} issue(s)`}
        </span>
      </div>

      {validation.errors.length === 0 && (
        <p className="muted">No validation errors.</p>
      )}

      {structural.length > 0 && (
        <>
          <p className="muted">{SEVERITY_LABEL.structural}</p>
          <ul className="errors" data-testid="errors-structural">
            {structural.map((e, i) => (
              <li key={`s-${i}`} className="structural">
                <code>{e.code}</code> {e.message}
                {e.path && <span className="tag">{e.path}</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      {graph.length > 0 && (
        <>
          <p className="muted">{SEVERITY_LABEL.graph}</p>
          <ul className="errors" data-testid="errors-graph">
            {graph.map((e, i) => (
              <li key={`g-${i}`} className="graph">
                <code>{e.code}</code> {e.message}
                {e.path && <span className="tag">{e.path}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
