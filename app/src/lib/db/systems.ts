import type { System, Event } from '@/types'
import { getDatabase, generateId, serializeArray, deserializeArray, saveDatabaseToIndexedDB } from './index'

function recordEvent(entityType: 'system', entityId: string, eventType: 'created' | 'updated' | 'deleted', data: System): void {
  const db = getDatabase()
  const now = Date.now()

  db.run(
    `INSERT INTO events (entity_type, entity_id, event_type, data, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [entityType, entityId, eventType, JSON.stringify(data), now]
  )
}

export function createSystem(system: Omit<System, 'id' | 'version' | 'created_at' | 'updated_at'>): System {
  const db = getDatabase()
  const now = Date.now()
  const id = generateId()

  const newSystem: System = {
    ...system,
    id,
    version: 1,
    created_at: now,
    updated_at: now,
  }

  db.run(
    `INSERT INTO systems (id, title, description, content, tags, status, evidence_links, version, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newSystem.id,
      newSystem.title,
      newSystem.description,
      newSystem.content,
      serializeArray(newSystem.tags),
      newSystem.status,
      serializeArray(newSystem.evidence_links),
      newSystem.version,
      newSystem.created_at,
      newSystem.updated_at,
      newSystem.created_by || null,
      newSystem.updated_by || null,
    ]
  )

  recordEvent('system', newSystem.id, 'created', newSystem)
  saveDatabaseToIndexedDB()

  return newSystem
}

export function getSystems(): System[] {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM systems ORDER BY updated_at DESC')
  const systems: System[] = []

  while (stmt.step()) {
    const row = stmt.getAsObject()
    systems.push({
      id: row.id as string,
      title: row.title as string,
      description: row.description as string,
      content: row.content as string,
      tags: deserializeArray(row.tags as string),
      status: row.status as System['status'],
      evidence_links: deserializeArray(row.evidence_links as string),
      version: row.version as number,
      created_at: row.created_at as number,
      updated_at: row.updated_at as number,
      created_by: row.created_by as string | undefined,
      updated_by: row.updated_by as string | undefined,
    })
  }

  stmt.free()
  return systems
}

export function getSystemById(id: string): System | null {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM systems WHERE id = ?')
  stmt.bind([id])

  if (stmt.step()) {
    const row = stmt.getAsObject()
    stmt.free()
    return {
      id: row.id as string,
      title: row.title as string,
      description: row.description as string,
      content: row.content as string,
      tags: deserializeArray(row.tags as string),
      status: row.status as System['status'],
      evidence_links: deserializeArray(row.evidence_links as string),
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

export function updateSystem(id: string, updates: Partial<Omit<System, 'id' | 'created_at' | 'version'>>): System | null {
  const db = getDatabase()
  const existing = getSystemById(id)

  if (!existing) return null

  const now = Date.now()
  const updatedSystem: System = {
    ...existing,
    ...updates,
    id,
    version: existing.version + 1,
    updated_at: now,
  }

  db.run(
    `UPDATE systems
     SET title = ?, description = ?, content = ?, tags = ?, status = ?, evidence_links = ?,
         version = ?, updated_at = ?, updated_by = ?
     WHERE id = ?`,
    [
      updatedSystem.title,
      updatedSystem.description,
      updatedSystem.content,
      serializeArray(updatedSystem.tags),
      updatedSystem.status,
      serializeArray(updatedSystem.evidence_links),
      updatedSystem.version,
      updatedSystem.updated_at,
      updatedSystem.updated_by || null,
      id,
    ]
  )

  recordEvent('system', id, 'updated', updatedSystem)
  saveDatabaseToIndexedDB()

  return updatedSystem
}

export function deleteSystem(id: string): boolean {
  const db = getDatabase()
  const existing = getSystemById(id)

  if (!existing) return false

  db.run('DELETE FROM systems WHERE id = ?', [id])
  recordEvent('system', id, 'deleted', existing)
  saveDatabaseToIndexedDB()

  return true
}
