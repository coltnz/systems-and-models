import initSqlJs, { Database } from 'sql.js'
import type { System, Model, Provenance, Relationship, Event, EvolutionNote } from '@/types'

let dbInstance: Database | null = null

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS systems (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    content TEXT,
    tags TEXT,
    status TEXT NOT NULL,
    evidence_links TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    created_by TEXT,
    updated_by TEXT
  );

  CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    content TEXT,
    type TEXT NOT NULL,
    tags TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    created_by TEXT,
    updated_by TEXT
  );

  CREATE TABLE IF NOT EXISTS provenance (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    content TEXT,
    source TEXT NOT NULL,
    source_url TEXT,
    credibility_score INTEGER,
    tags TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    created_by TEXT,
    updated_by TEXT
  );

  CREATE TABLE IF NOT EXISTS relationships (
    id TEXT PRIMARY KEY,
    from_type TEXT NOT NULL,
    from_id TEXT NOT NULL,
    to_type TEXT NOT NULL,
    to_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL,
    strength INTEGER,
    tags TEXT,
    metadata TEXT,
    created_at INTEGER NOT NULL,
    UNIQUE(from_type, from_id, to_type, to_id, relationship_type)
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    data TEXT NOT NULL,
    metadata TEXT,
    created_at INTEGER NOT NULL,
    created_by TEXT
  );

  CREATE TABLE IF NOT EXISTS evolution_notes (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    note TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    created_by TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_systems_updated ON systems(updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_models_updated ON models(updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_provenance_updated ON provenance(updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_relationships_from ON relationships(from_type, from_id);
  CREATE INDEX IF NOT EXISTS idx_relationships_to ON relationships(to_type, to_id);
  CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity_type, entity_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_evolution_entity ON evolution_notes(entity_type, entity_id, created_at DESC);
`

export async function initDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance

  const SQL = await initSqlJs({
    locateFile: (file) => `https://sql.js.org/dist/${file}`
  })

  // Try to load existing database from IndexedDB
  const savedDb = await loadDatabaseFromIndexedDB()

  if (savedDb) {
    dbInstance = new SQL.Database(savedDb)
    // Run migrations for existing databases
    runMigrations(dbInstance)
  } else {
    dbInstance = new SQL.Database()
    dbInstance.run(SCHEMA)
  }

  return dbInstance
}

function runMigrations(db: Database): void {
  // Check if tags column exists in relationships table
  try {
    const result = db.exec("PRAGMA table_info(relationships)")
    if (result.length > 0) {
      const columns = result[0].values.map(row => row[1] as string)
      if (!columns.includes('tags')) {
        // Add tags column if it doesn't exist
        db.run("ALTER TABLE relationships ADD COLUMN tags TEXT")
        console.log('Migration: Added tags column to relationships table')
      }
    }
  } catch (error) {
    console.error('Migration error:', error)
  }
}

export function getDatabase(): Database {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return dbInstance
}

export async function saveDatabaseToIndexedDB(): Promise<void> {
  if (!dbInstance) return

  const data = dbInstance.export()
  const db = await openIndexedDB()

  const transaction = db.transaction(['database'], 'readwrite')
  const store = transaction.objectStore('database')
  await store.put(data, 'main')
}

async function loadDatabaseFromIndexedDB(): Promise<Uint8Array | null> {
  try {
    const db = await openIndexedDB()
    const transaction = db.transaction(['database'], 'readonly')
    const store = transaction.objectStore('database')
    const request = store.get('main')

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error loading database from IndexedDB:', error)
    return null
  }
}

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SystemsAndModelsDB', 1)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains('database')) {
        db.createObjectStore('database')
      }
    }
  })
}

// Helper functions
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function serializeArray(arr: string[]): string {
  return JSON.stringify(arr)
}

export function deserializeArray(str: string | null): string[] {
  if (!str) return []
  try {
    return JSON.parse(str)
  } catch {
    return []
  }
}
