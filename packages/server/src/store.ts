/**
 * File-backed persistence for @sam/server (bd-7).
 *
 * The server is the SOLE owner of the gitignored `.systems-and-models/` runtime
 * dir (D-007): ingest/extraction return pure data, the Store persists it. No DB,
 * no network. Layout under `dataDir` (all created lazily):
 *
 *   <dataDir>/
 *     sources/<source_id>.json    each = { source, anchors, ingestDerivation }
 *     packs/<pack_id>.json        each = a full LearningPack
 *     reviewed/<pack_id>.json     each = a reviewed snapshot { pack, saved_at }
 *
 * Writes are "atomic enough for the alpha": write to a temp file in the same
 * directory then `rename` into place, so a reader never observes a half-written
 * file. No cross-file transaction guarantees beyond that (none are needed here).
 */
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

import type {
  DerivationRun,
  LearningPack,
  SourceAnchor,
  SourceAsset,
} from '@sam/types'

/** Persisted shape of an ingested source (one file under `sources/`). */
export interface StoredSource {
  source: SourceAsset
  anchors: SourceAnchor[]
  /** The `ingest` DerivationRun; carried into the pack so atom refs resolve. */
  ingestDerivation: DerivationRun
}

/** Persisted shape of a reviewed snapshot (one file under `reviewed/`). */
export interface StoredReviewed {
  pack: LearningPack
  /** tz-aware instant the snapshot was saved (from the injected clock). */
  saved_at: string
}

/** A compact listing entry for a source (`GET /sources`). */
export interface SourceListItem {
  id: string
  title: string
  media_type: string
}

/** A compact listing entry for a pack (`GET /packs`). */
export interface PackListItem {
  id: string
  title: string
  version: string
}

/** The three persisted collections, each a subdirectory under `dataDir`. */
type Subdir = 'sources' | 'packs' | 'reviewed'

/**
 * Defense-in-depth id guard for the Store chokepoint (bd-14). An id is "safe"
 * only if it is a non-empty run of `[A-Za-z0-9._-]` and is neither `.` nor `..`.
 * This blocks path traversal via client-controllable id fields (`source_id`,
 * `pack_id`) that would otherwise interpolate straight into a join under
 * `dataDir` (e.g. `"../../etc/passwd"` or `"../packs/<id>"`). All server-minted
 * ids (`src-<hex>`, `srv-…`) and the demo `id-N` ids pass.
 */
export function isSafeId(id: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(id) && id !== '.' && id !== '..'
}

/**
 * File-backed store rooted at `dataDir`. Directories are created lazily on the
 * first write so merely constructing a Store (or a Server) touches no disk.
 */
export class Store {
  constructor(readonly dataDir: string) {}

  private dir(sub: Subdir): string {
    return join(this.dataDir, sub)
  }

  private ensureDir(sub: Subdir): string {
    const d = this.dir(sub)
    mkdirSync(d, { recursive: true })
    return d
  }

  /** Atomic-enough write: temp file in the same dir, then rename into place. */
  private writeJson(sub: Subdir, id: string, value: unknown): void {
    // Server-minted ids are always safe; this is defense-in-depth so a future
    // caller can never write outside `dataDir` via a crafted id.
    if (!isSafeId(id)) {
      throw new Error(`unsafe id "${id}" — refusing to write outside dataDir`)
    }
    const d = this.ensureDir(sub)
    const target = join(d, `${id}.json`)
    const tmp = join(d, `.${id}.${process.pid}.${Date.now()}.tmp`)
    writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8')
    renameSync(tmp, target)
  }

  private readJson<T>(sub: Subdir, id: string): T | undefined {
    // An unsafe id can never name a real persisted file; treat it as missing so
    // routes 404 cleanly (no read attempt outside `dataDir`).
    if (!isSafeId(id)) return undefined
    const target = join(this.dir(sub), `${id}.json`)
    let raw: string
    try {
      raw = readFileSync(target, 'utf8')
    } catch {
      return undefined
    }
    return JSON.parse(raw) as T
  }

  private listIds(sub: Subdir): string[] {
    let names: string[]
    try {
      names = readdirSync(this.dir(sub))
    } catch {
      return []
    }
    return names
      .filter((n) => n.endsWith('.json') && !n.startsWith('.'))
      .map((n) => n.slice(0, -'.json'.length))
      .sort()
  }

  // --- Sources --------------------------------------------------------------

  putSource(value: StoredSource): void {
    this.writeJson('sources', value.source.id, value)
  }

  getSource(id: string): StoredSource | undefined {
    return this.readJson<StoredSource>('sources', id)
  }

  listSources(): SourceListItem[] {
    return this.listIds('sources').flatMap((id) => {
      const s = this.getSource(id)
      if (!s) return []
      return [{ id: s.source.id, title: s.source.title, media_type: s.source.media_type }]
    })
  }

  // --- Packs ----------------------------------------------------------------

  putPack(pack: LearningPack): void {
    this.writeJson('packs', pack.id, pack)
  }

  getPack(id: string): LearningPack | undefined {
    return this.readJson<LearningPack>('packs', id)
  }

  listPacks(): PackListItem[] {
    return this.listIds('packs').flatMap((id) => {
      const p = this.getPack(id)
      if (!p) return []
      return [{ id: p.id, title: p.title, version: p.version }]
    })
  }

  // --- Reviewed snapshots ---------------------------------------------------

  putReviewed(packId: string, value: StoredReviewed): void {
    this.writeJson('reviewed', packId, value)
  }

  getReviewed(packId: string): StoredReviewed | undefined {
    return this.readJson<StoredReviewed>('reviewed', packId)
  }
}
