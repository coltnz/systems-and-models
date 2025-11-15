import type { Model } from '@/types'
import { getDatabase, generateId, serializeArray, deserializeArray, saveDatabaseToIndexedDB } from './index'

function recordEvent(entityType: 'model', entityId: string, eventType: 'created' | 'updated' | 'deleted', data: Model): void {
  const db = getDatabase()
  const now = Date.now()

  db.run(
    `INSERT INTO events (entity_type, entity_id, event_type, data, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [entityType, entityId, eventType, JSON.stringify(data), now]
  )
}

export function createModel(model: Omit<Model, 'id' | 'version' | 'created_at' | 'updated_at'>): Model {
  const db = getDatabase()
  const now = Date.now()
  const id = generateId()

  const newModel: Model = {
    ...model,
    id,
    version: 1,
    created_at: now,
    updated_at: now,
  }

  db.run(
    `INSERT INTO models (id, title, description, content, type, tags, version, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newModel.id,
      newModel.title,
      newModel.description,
      newModel.content,
      newModel.type,
      serializeArray(newModel.tags),
      newModel.version,
      newModel.created_at,
      newModel.updated_at,
      newModel.created_by || null,
      newModel.updated_by || null,
    ]
  )

  recordEvent('model', newModel.id, 'created', newModel)
  saveDatabaseToIndexedDB()

  return newModel
}

export function getModels(): Model[] {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM models ORDER BY updated_at DESC')
  const models: Model[] = []

  while (stmt.step()) {
    const row = stmt.getAsObject()
    models.push({
      id: row.id as string,
      title: row.title as string,
      description: row.description as string,
      content: row.content as string,
      type: row.type as Model['type'],
      tags: deserializeArray(row.tags as string),
      version: row.version as number,
      created_at: row.created_at as number,
      updated_at: row.updated_at as number,
      created_by: row.created_by as string | undefined,
      updated_by: row.updated_by as string | undefined,
    })
  }

  stmt.free()
  return models
}

export function getModelById(id: string): Model | null {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM models WHERE id = ?')
  stmt.bind([id])

  if (stmt.step()) {
    const row = stmt.getAsObject()
    stmt.free()
    return {
      id: row.id as string,
      title: row.title as string,
      description: row.description as string,
      content: row.content as string,
      type: row.type as Model['type'],
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

export function updateModel(id: string, updates: Partial<Omit<Model, 'id' | 'created_at' | 'version'>>): Model | null {
  const db = getDatabase()
  const existing = getModelById(id)

  if (!existing) return null

  const now = Date.now()
  const updatedModel: Model = {
    ...existing,
    ...updates,
    id,
    version: existing.version + 1,
    updated_at: now,
  }

  db.run(
    `UPDATE models
     SET title = ?, description = ?, content = ?, type = ?, tags = ?,
         version = ?, updated_at = ?, updated_by = ?
     WHERE id = ?`,
    [
      updatedModel.title,
      updatedModel.description,
      updatedModel.content,
      updatedModel.type,
      serializeArray(updatedModel.tags),
      updatedModel.version,
      updatedModel.updated_at,
      updatedModel.updated_by || null,
      id,
    ]
  )

  recordEvent('model', id, 'updated', updatedModel)
  saveDatabaseToIndexedDB()

  return updatedModel
}

export function deleteModel(id: string): boolean {
  const db = getDatabase()
  const existing = getModelById(id)

  if (!existing) return false

  db.run('DELETE FROM models WHERE id = ?', [id])
  recordEvent('model', id, 'deleted', existing)
  saveDatabaseToIndexedDB()

  return true
}
