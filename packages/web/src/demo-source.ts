import type { NewSourceInput } from './api'

/**
 * Original CC-BY-4.0 demo transcript used for the offline alpha walkthrough.
 * Kept in @sam/web so the review UI can seed a draft without importing from
 * the @sam/e2e package or relying on Vite raw-file loaders.
 */
export const DEMO_SOURCE: NewSourceInput = {
  title: 'The Circuit Breaker Pattern for Resilient Services',
  creator: 'Systems & Models project',
  media_type: 'markdown',
  license: 'CC-BY-4.0',
  access: 'open',
  content: `The circuit breaker pattern is a mental model for protecting a service that depends on a flaky downstream dependency. Like an electrical breaker that trips to stop current when a fault is detected, the software circuit breaker watches the failure rate of outgoing calls and, once that rate crosses a threshold, it "opens" and short-circuits further calls so the caller fails fast instead of piling up doomed requests.

To operate a circuit breaker you follow a concrete procedure. First, wrap each remote call and record whether it succeeded or failed. Second, when the rolling failure rate exceeds the configured threshold, move the breaker to the open state and immediately reject new calls for a cooldown window. Third, after the cooldown elapses, allow a single trial call through in a half-open state; if it succeeds, close the breaker and resume normal traffic, otherwise re-open and wait again.

Teams that adopt this pattern claim that a tripped breaker measurably reduces cascading failures during a downstream outage, because callers stop waiting on timeouts and shed load before the whole system saturates. This assertion is testable: you can compare error budgets and tail latency with the breaker enabled versus disabled under an injected fault.`,
}
