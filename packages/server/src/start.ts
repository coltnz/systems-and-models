/**
 * @sam/server — runnable start entrypoint (bd-10, additive).
 *
 * Boots the local alpha API on a FIXED port (8787) so the web UI (bd-8, whose
 * `VITE_API_BASE` defaults to `http://127.0.0.1:8787`) can talk to it. Adapter
 * selection is env-driven via the server's default `getAdapter(process.env)`:
 * the MOCK adapter offline unless `EXTRACTION_ADAPTER=openai` (which then also
 * requires `OPENAI_API_KEY` + `OPENAI_MODEL`, per D-006).
 *
 * This file ADDS a binary entrypoint only — it changes no existing server logic.
 * Run it with `npm run serve` (root or from this package), which builds then
 * `node dist/start.js`.
 */
import { createServer } from './index.js'

const dataDir = process.env.SAM_DATA_DIR ?? '.systems-and-models'
const port = Number(process.env.PORT) || 8787

const server = createServer({ dataDir })

server
  .listen(port)
  .then(() => {
    console.log(`listening on http://127.0.0.1:${port}`)
    console.log(`adapter=${server.adapter.name} dataDir=${dataDir}`)
  })
  .catch((e: unknown) => {
    console.error('failed to start server:', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
