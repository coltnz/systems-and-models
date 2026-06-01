/**
 * @sam/server — local HTTP API for the review UI + CLI (STUB).
 *
 * This package is the single owner of the `.systems-and-models/` runtime dir
 * (D-007): ingest/extraction return pure data, the server persists it. None of
 * that I/O exists yet — bd-7 wires routes and file-backed storage.
 *
 * `createServer()` returns a server *object* (config + a not-yet-started handle).
 * It deliberately does NOT bind a port, so tests can construct it without a
 * live socket.
 */
import { validatePack } from '@sam/validator'
import { getAdapter, type ExtractionAdapter } from '@sam/extraction'

export interface ServerOptions {
  /** Runtime data dir owned by this package (D-007). Default chosen by bd-7. */
  dataDir?: string
  /** Extraction backend; defaults to the env-selected adapter (mock offline). */
  adapter?: ExtractionAdapter
}

export interface Server {
  readonly dataDir: string
  readonly adapter: ExtractionAdapter
  /** STUB: bd-7 binds a port and starts serving. */
  listen(port: number): Promise<void>
  /** STUB: bd-7 implements graceful shutdown. */
  close(): Promise<void>
}

/**
 * Build a server object without binding a port.
 *
 * STUB (bd-7): `listen`/`close` throw not-implemented for now. Wiring the
 * validator + adapter here keeps the dependency graph honest and gives bd-7 a
 * concrete seam to fill.
 */
export function createServer(options: ServerOptions = {}): Server {
  const dataDir = options.dataDir ?? '.systems-and-models'
  const adapter = options.adapter ?? getAdapter(process.env)

  // Touch validatePack so the dependency is real (and tree-shake-safe).
  void validatePack

  return {
    dataDir,
    adapter,
    listen(port: number): Promise<void> {
      void port
      return Promise.reject(new Error('server.listen is not implemented yet (bd-7)'))
    },
    close(): Promise<void> {
      return Promise.reject(new Error('server.close is not implemented yet (bd-7)'))
    },
  }
}
