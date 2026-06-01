import { useEffect, useState } from 'react'
import type { Access, MediaType } from '@sam/types'
import {
  createSourceAndDraft,
  getPack,
  listPacks,
  type DraftResult,
  type PackListItem,
} from '../api'

type WebMediaType = Extract<MediaType, 'markdown' | 'text'>

const ACCESS_OPTIONS: Access[] = ['owned', 'open', 'restricted']

/**
 * New source → draft: title, license, access, media_type + a content textarea.
 * "Generate draft" ingests the source (`POST /sources`) then drafts a pack
 * (`POST /packs/draft`) and hands the returned draft pack up via `onLoaded`.
 * Also offers a dropdown of existing packs (`GET /packs`) to load for review.
 */
export function NewSourceForm({
  onLoaded,
  onError,
}: {
  onLoaded: (draft: DraftResult) => void
  onError: (message: string) => void
}) {
  const [title, setTitle] = useState('')
  const [license, setLicense] = useState('CC-BY-4.0')
  const [access, setAccess] = useState<Access>('owned')
  const [mediaType, setMediaType] = useState<WebMediaType>('markdown')
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)

  const [packs, setPacks] = useState<PackListItem[]>([])
  const [selectedPack, setSelectedPack] = useState('')

  useEffect(() => {
    listPacks()
      .then(setPacks)
      .catch(() => {
        /* listing is optional; ignore if the server is unreachable */
      })
  }, [])

  async function generate() {
    if (!title.trim() || !content.trim()) {
      onError('Title and content are required to generate a draft.')
      return
    }
    setBusy(true)
    try {
      const draft = await createSourceAndDraft({
        title,
        media_type: mediaType,
        license,
        access,
        content,
      })
      onLoaded(draft)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'failed to generate draft')
    } finally {
      setBusy(false)
    }
  }

  async function loadExisting() {
    if (!selectedPack) return
    setBusy(true)
    try {
      const pack = await getPack(selectedPack)
      onLoaded({ pack_id: pack.id, pack, validation: { ok: true, errors: [] } })
    } catch (e) {
      onError(e instanceof Error ? e.message : 'failed to load pack')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card" aria-label="New source">
      <h2 style={{ marginTop: 0 }}>New source → draft</h2>
      <div className="row">
        <div className="field">
          <label htmlFor="src-title">Title</label>
          <input id="src-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="src-license">License</label>
          <input id="src-license" value={license} onChange={(e) => setLicense(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="src-access">Access</label>
          <select
            id="src-access"
            value={access}
            onChange={(e) => setAccess(e.target.value as Access)}
          >
            {ACCESS_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="src-media">Media type</label>
          <select
            id="src-media"
            value={mediaType}
            onChange={(e) => setMediaType(e.target.value as WebMediaType)}
          >
            <option value="markdown">markdown</option>
            <option value="text">text</option>
          </select>
        </div>
      </div>

      <div className="field" style={{ marginTop: 8 }}>
        <label htmlFor="src-content">Content</label>
        <textarea
          id="src-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste a transcript or markdown source…"
        />
      </div>

      <div className="row" style={{ marginTop: 8 }}>
        <button className="primary" onClick={() => void generate()} disabled={busy}>
          Generate draft
        </button>
      </div>

      {packs.length > 0 && (
        <div className="row" style={{ marginTop: 12 }}>
          <div className="field">
            <label htmlFor="existing-pack">Or load an existing pack</label>
            <select
              id="existing-pack"
              aria-label="Existing packs"
              value={selectedPack}
              onChange={(e) => setSelectedPack(e.target.value)}
            >
              <option value="">— select —</option>
              {packs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.version})
                </option>
              ))}
            </select>
          </div>
          <button onClick={() => void loadExisting()} disabled={busy || !selectedPack}>
            Load pack
          </button>
        </div>
      )}
    </section>
  )
}
