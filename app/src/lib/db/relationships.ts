import type { Relationship } from '@/types'
import { getDatabase, generateId, saveDatabaseToIndexedDB } from './index'

export function createRelationship(relationship: Omit<Relationship, 'id' | 'created_at'>): Relationship {
  const db = getDatabase()
  const now = Date.now()
  const id = generateId()

  const newRelationship: Relationship = {
    ...relationship,
    id,
    created_at: now,
  }

  db.run(
    `INSERT INTO relationships (id, from_type, from_id, to_type, to_id, relationship_type, strength, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newRelationship.id,
      newRelationship.from_type,
      newRelationship.from_id,
      newRelationship.to_type,
      newRelationship.to_id,
      newRelationship.relationship_type,
      newRelationship.strength || null,
      newRelationship.metadata ? JSON.stringify(newRelationship.metadata) : null,
      newRelationship.created_at,
    ]
  )

  saveDatabaseToIndexedDB()

  return newRelationship
}

export function getRelationships(): Relationship[] {
  const db = getDatabase()
  const stmt = db.prepare('SELECT * FROM relationships ORDER BY created_at DESC')
  const relationships: Relationship[] = []

  while (stmt.step()) {
    const row = stmt.getAsObject()
    relationships.push({
      id: row.id as string,
      from_type: row.from_type as Relationship['from_type'],
      from_id: row.from_id as string,
      to_type: row.to_type as Relationship['to_type'],
      to_id: row.to_id as string,
      relationship_type: row.relationship_type as Relationship['relationship_type'],
      strength: row.strength as number | undefined,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
      created_at: row.created_at as number,
    })
  }

  stmt.free()
  return relationships
}

export function getRelationshipsByEntity(entityType: Relationship['from_type'], entityId: string): Relationship[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT * FROM relationships
    WHERE (from_type = ? AND from_id = ?) OR (to_type = ? AND to_id = ?)
    ORDER BY created_at DESC
  `)
  stmt.bind([entityType, entityId, entityType, entityId])

  const relationships: Relationship[] = []

  while (stmt.step()) {
    const row = stmt.getAsObject()
    relationships.push({
      id: row.id as string,
      from_type: row.from_type as Relationship['from_type'],
      from_id: row.from_id as string,
      to_type: row.to_type as Relationship['to_type'],
      to_id: row.to_id as string,
      relationship_type: row.relationship_type as Relationship['relationship_type'],
      strength: row.strength as number | undefined,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
      created_at: row.created_at as number,
    })
  }

  stmt.free()
  return relationships
}

export function deleteRelationship(id: string): boolean {
  const db = getDatabase()

  db.run('DELETE FROM relationships WHERE id = ?', [id])
  saveDatabaseToIndexedDB()

  return true
}

export function deleteRelationshipsBetween(
  fromType: Relationship['from_type'],
  fromId: string,
  toType: Relationship['to_type'],
  toId: string,
  relationshipType?: Relationship['relationship_type']
): boolean {
  const db = getDatabase()

  if (relationshipType) {
    db.run(
      'DELETE FROM relationships WHERE from_type = ? AND from_id = ? AND to_type = ? AND to_id = ? AND relationship_type = ?',
      [fromType, fromId, toType, toId, relationshipType]
    )
  } else {
    db.run(
      'DELETE FROM relationships WHERE from_type = ? AND from_id = ? AND to_type = ? AND to_id = ?',
      [fromType, fromId, toType, toId]
    )
  }

  saveDatabaseToIndexedDB()

  return true
}
