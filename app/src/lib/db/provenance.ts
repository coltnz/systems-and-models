import type { Provenance } from '@/types'
import { getDatabase, generateId, serializeArray, deserializeArray, saveDatabaseToIndexedDB } from './index'

function recordEvent(entityType: 'provenance', entityId: string, eventType: 'created' | 'updated' | 'deleted', data: Provenance): void {
  const db = getDatabase()
  const now = Date.now()

  db.run(
    `INSERT INTO events (entity_type, entity_id, event_type, data, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [entityType, entityId, eventType, JSON.stringify(data), now]
  )
}

export function createProvenance(provenance: Omit<Provenance, 'id' | 'version' | 'created_at' | 'updated_at'>): Provenance {
  const db = getDatabase()
  const now = Date.now()
  const id = generateId()

  const newProvenance: Provenance = {
    ...provenance,
    id,
    version: 1,
    created_at: now,
    updated_at: now,
  }

  db.run(
    `INSERT INTO provenance (id, type, title, description, content, source, source_url, credibility_score, tags, version, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newProvenance.id,
      newProvenance.type,
      newProvenance.title,
      newProvenance.description,
      newProvenance.content,
      newProvenance.source,
      newProvenance.source_url || null,
      newProvenance.credibility_score || null,
      serializeArray(newProvenance.tags),
      newProvenance.version,
      newProvenance.created_at,
      newProvenance.updated_at,
      newProvenance.created_by || null,
      newProvenance.updated_by || null,
    ]
  )

  recordEvent('provenance', newProvenance.id, 'created', newProvenance)
  saveDatabaseToIndexedDB()

  return newProvenance
}

export function getProvenance(): Provenance[] {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM provenance ORDER BY updated_at DESC')
  const provenances: Provenance[] = []

  while (stmt.step()) {
    const row = stmt.getAsObject()
    provenances.push({
      id: row.id as string,
      type: row.type as Provenance['type'],
      title: row.title as string,
      description: row.description as string,
      content: row.content as string,
      source: row.source as string,
      source_url: row.source_url as string | undefined,
      credibility_score: row.credibility_score as number | undefined,
      tags: deserializeArray(row.tags as string),
      version: row.version as number,
      created_at: row.created_at as number,
      updated_at: row.updated_at as number,
      created_by: row.created_by as string | undefined,
      updated_by: row.updated_by as string | undefined,
    })
  }

  stmt.free()
  return provenances
}

export function getProvenanceById(id: string): Provenance | null {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM provenance WHERE id = ?')
  stmt.bind([id])

  if (stmt.step()) {
    const row = stmt.getAsObject()
    stmt.free()
    return {
      id: row.id as string,
      type: row.type as Provenance['type'],
      title: row.title as string,
      description: row.description as string,
      content: row.content as string,
      source: row.source as string,
      source_url: row.source_url as string | undefined,
      credibility_score: row.credibility_score as number | undefined,
      tags: deserializeArray(row.tags as string),
      version: row.version as number,
      created_at: row.created_at as number,
      updated_at: row.updated_at as number,
      created_by: row.created_by as string | undefined,
      updated_by: row.updated_by as string | undefined,
    }
  }

  stmt.free()
  return null
}

export function updateProvenance(id: string, updates: Partial<Omit<Provenance, 'id' | 'created_at' | 'version'>>): Provenance | null {
  const db = getDatabase()
  const existing = getProvenanceById(id)

  if (!existing) return null

  const now = Date.now()
  const updatedProvenance: Provenance = {
    ...existing,
    ...updates,
    id,
    version: existing.version + 1,
    updated_at: now,
  }

  db.run(
    `UPDATE provenance
     SET type = ?, title = ?, description = ?, content = ?, source = ?, source_url = ?, credibility_score = ?, tags = ?,
         version = ?, updated_at = ?, updated_by = ?
     WHERE id = ?`,
    [
      updatedProvenance.type,
      updatedProvenance.title,
      updatedProvenance.description,
      updatedProvenance.content,
      updatedProvenance.source,
      updatedProvenance.source_url || null,
      updatedProvenance.credibility_score || null,
      serializeArray(updatedProvenance.tags),
      updatedProvenance.version,
      updatedProvenance.updated_at,
      updatedProvenance.updated_by || null,
      id,
    ]
  )

  recordEvent('provenance', id, 'updated', updatedProvenance)
  saveDatabaseToIndexedDB()

  return updatedProvenance
}

export function deleteProvenance(id: string): boolean {
  const db = getDatabase()
  const existing = getProvenanceById(id)

  if (!existing) return false

  db.run('DELETE FROM provenance WHERE id = ?', [id])
  recordEvent('provenance', id, 'deleted', existing)
  saveDatabaseToIndexedDB()

  return true
}
