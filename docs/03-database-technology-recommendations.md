# Database Technology Recommendations: Systems & Models Platform

## Executive Summary

For a knowledge platform with **small individual requirements**, **sharing capabilities**, **version tracking**, and **evolution tracking**, the recommended approach is:

**Primary Recommendation**: **SQLite + JSON for local storage** + **CRDTs for sync** + **Git-like versioning**

**Specific Stack**:
- **Primary Database**: SQLite with JSON columns (via `sql.js` in browser or native SQLite)
- **Sync Layer**: Automerge or Loro (CRDT libraries)
- **Version Control**: Built-in event sourcing + snapshots
- **Sharing**: P2P sync via CRDT or optional backend (CouchDB/PouchDB)

This provides:
- ✅ Lightweight for individuals (< 10MB typical)
- ✅ Shareable (CRDT-based sync)
- ✅ Full version history (git-like tracking)
- ✅ Evolution tracking (event sourcing)
- ✅ Graph relationships (via foreign keys + JSON)
- ✅ Works offline-first
- ✅ No vendor lock-in (standard formats)

## Requirements Analysis

### 1. Individual Requirements: Small & Fast
- **Constraint**: < 100MB database size for typical user
- **Users**: 1-1000 systems/models per person
- **Access Pattern**: Mostly reads, occasional writes
- **Need**: Instant load, no server required

### 2. Sharing Capabilities
- **Granularity**: Share specific systems/models, not entire database
- **Privacy**: User controls what to share
- **Attribution**: Track who contributed what
- **Merge**: Handle conflicts when same item edited by multiple people

### 3. Tracking & Version Control
- **History**: Every change recorded
- **Diff**: See what changed between versions
- **Rollback**: Restore previous versions
- **Audit**: Who changed what and when

### 4. Evolution Tracking
- **Meta-History**: "I used to think X, now I think Y"
- **Learning Journey**: Track how understanding evolves
- **Effectiveness**: Did this system work? How did it improve?
- **Temporal Queries**: "What did I believe about low-carb in June?"

## Database Architecture Comparison

### Option 1: SQLite + Event Sourcing (RECOMMENDED)

**Architecture**:
```
┌─────────────────────────────────────┐
│ Application Layer                   │
├─────────────────────────────────────┤
│ CRDT Sync Layer (Automerge/Loro)   │
├─────────────────────────────────────┤
│ SQLite Database                     │
│  - events (immutable log)           │
│  - snapshots (current state)        │
│  - relationships (graph edges)      │
└─────────────────────────────────────┘
```

**Schema Example**:
```sql
-- Current state (snapshots)
CREATE TABLE systems (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT, -- markdown
  metadata JSON, -- tags, status, etc.
  version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT,
  updated_by TEXT
);

CREATE TABLE models (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  metadata JSON,
  version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT,
  updated_by TEXT
);

-- Relationships (graph edges)
CREATE TABLE relationships (
  id TEXT PRIMARY KEY,
  from_type TEXT NOT NULL, -- 'system' or 'model'
  from_id TEXT NOT NULL,
  to_type TEXT NOT NULL,
  to_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL, -- 'uses', 'explains', 'requires', etc.
  metadata JSON,
  created_at INTEGER NOT NULL,
  UNIQUE(from_type, from_id, to_type, to_id, relationship_type)
);

-- Event log (immutable history)
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL, -- 'system', 'model', 'relationship'
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'created', 'updated', 'deleted'
  data JSON NOT NULL, -- full snapshot or delta
  metadata JSON, -- author, timestamp, reason
  created_at INTEGER NOT NULL,
  created_by TEXT
);

-- Evolution notes (meta-knowledge)
CREATE TABLE evolution_notes (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  created_by TEXT
);

-- Indexes for performance
CREATE INDEX idx_systems_updated ON systems(updated_at DESC);
CREATE INDEX idx_models_updated ON models(updated_at DESC);
CREATE INDEX idx_relationships_from ON relationships(from_type, from_id);
CREATE INDEX idx_relationships_to ON relationships(to_type, to_id);
CREATE INDEX idx_events_entity ON events(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_evolution_entity ON evolution_notes(entity_type, entity_id, created_at DESC);
```

**Pros**:
- ✅ **Lightweight**: SQLite is < 1MB, databases typically < 10MB
- ✅ **Portable**: Single file, easy backup
- ✅ **Fast**: Local queries, no network latency
- ✅ **Full History**: Events table is immutable log
- ✅ **Standard**: SQL is universal, JSON is flexible
- ✅ **Tooling**: Excellent debugging tools (sqlite3 CLI, DB Browser)
- ✅ **Relationships**: Foreign keys + join queries

**Cons**:
- ⚠️ **Not Native Graph**: Have to model relationships manually
- ⚠️ **Sync Complexity**: Need CRDT layer for conflict-free sync
- ⚠️ **File Locking**: Only one writer at a time (mitigated by CRDTs)

**When to Use**: MVP, small-to-medium data, offline-first, single-user or small teams

---

### Option 2: Neo4j (Graph Database)

**Architecture**:
```
┌─────────────────────────────────────┐
│ Application Layer                   │
├─────────────────────────────────────┤
│ Neo4j Database (Cypher queries)     │
│  - Nodes: Systems, Models, Users    │
│  - Relationships: USES, EXPLAINS    │
│  - Properties: Version, metadata    │
└─────────────────────────────────────┘
```

**Graph Example**:
```cypher
// Create a system
CREATE (s:System {
  id: 'sys-123',
  title: 'Kettlebell Training Program',
  content: '...',
  version: 1,
  created_at: timestamp()
})

// Create a model
CREATE (m:Model {
  id: 'mod-456',
  title: 'Progressive Overload Concept',
  content: '...',
  version: 1
})

// Create relationship
MATCH (s:System {id: 'sys-123'}), (m:Model {id: 'mod-456'})
CREATE (s)-[:USES {since: timestamp()}]->(m)

// Query: Find all models used by a system
MATCH (s:System {id: 'sys-123'})-[:USES]->(m:Model)
RETURN m
```

**Pros**:
- ✅ **Native Graph**: Relationships are first-class
- ✅ **Query Power**: Cypher is expressive for graph traversals
- ✅ **Visualization**: Built-in graph visualization tools
- ✅ **Scalability**: Handles millions of nodes/relationships

**Cons**:
- ❌ **Heavyweight**: Server required, not local-first
- ❌ **Complexity**: Overkill for small individual use
- ❌ **Cost**: Neo4j AuraDB (cloud) or self-hosted infrastructure
- ❌ **Sync**: No built-in CRDT or local-first sync
- ❌ **Version Control**: Have to build custom on top

**When to Use**: Large-scale, multi-user, complex graph queries, server-based

---

### Option 3: PouchDB + CouchDB (Local-First Sync)

**Architecture**:
```
┌─────────────────────────────────────┐
│ Browser: PouchDB (IndexedDB)        │
├─────────────────────────────────────┤
│ Sync Layer (bi-directional)         │
├─────────────────────────────────────┤
│ Server: CouchDB (optional)          │
└─────────────────────────────────────┘
```

**Document Example**:
```javascript
// System document
{
  _id: 'system:kettlebell-program',
  _rev: '3-abc123', // CouchDB revision
  type: 'system',
  title: 'Kettlebell Training Program',
  content: '...',
  tags: ['fitness', 'strength'],
  relationships: [
    { type: 'uses', target: 'model:progressive-overload' }
  ],
  created_at: '2025-01-15T10:00:00Z',
  updated_at: '2025-02-01T14:30:00Z'
}
```

**Pros**:
- ✅ **Local-First**: Works offline, sync when online
- ✅ **Bi-directional Sync**: PouchDB ↔ CouchDB
- ✅ **Conflict Resolution**: Built-in MVCC (multi-version concurrency)
- ✅ **Browser Native**: Uses IndexedDB
- ✅ **P2P Possible**: Can sync PouchDB ↔ PouchDB

**Cons**:
- ⚠️ **Document-Oriented**: Not ideal for complex graph queries
- ⚠️ **Relationships**: Have to manually denormalize or query multiple docs
- ⚠️ **CouchDB Setup**: Need backend for multi-user sync
- ⚠️ **Limited Queries**: No joins, have to use map/reduce
- ⚠️ **Revision History**: CouchDB keeps old revisions but hard to query

**When to Use**: Mobile-first, offline-critical, simple relationships

---

### Option 4: Automerge / Loro (CRDT-Based)

**Architecture**:
```
┌─────────────────────────────────────┐
│ Application Layer                   │
├─────────────────────────────────────┤
│ Automerge/Loro Document             │
│  - Git-like version history         │
│  - Automatic conflict resolution    │
│  - P2P or server sync               │
└─────────────────────────────────────┘
```

**Automerge Example**:
```javascript
import * as Automerge from '@automerge/automerge'

// Create initial document
let doc = Automerge.from({
  systems: {},
  models: {},
  relationships: []
})

// User 1: Add system
doc = Automerge.change(doc, 'Add kettlebell system', doc => {
  doc.systems['sys-123'] = {
    title: 'Kettlebell Training',
    content: '...',
    tags: ['fitness']
  }
})

// User 2: Concurrent edit (different field)
let doc2 = Automerge.clone(doc)
doc2 = Automerge.change(doc2, 'Add tag', doc => {
  doc.systems['sys-123'].tags.push('strength')
})

// Merge changes (automatic conflict resolution)
doc = Automerge.merge(doc, doc2)

// Full history available
const history = Automerge.getHistory(doc)
```

**Pros**:
- ✅ **Automatic Conflict Resolution**: No manual merge conflicts
- ✅ **Full History**: Git-like version control built-in
- ✅ **P2P Sync**: No server required (or optional server)
- ✅ **Offline-First**: Works completely offline
- ✅ **Collaborative**: Real-time multiplayer editing
- ✅ **Portable**: JSON-compatible data structure

**Cons**:
- ⚠️ **Learning Curve**: CRDT concepts are new to many developers
- ⚠️ **Storage Overhead**: History takes space (mitigated by compaction)
- ⚠️ **Query Limitations**: No SQL, have to query in-memory JavaScript objects
- ⚠️ **Graph Queries**: Manual traversal of relationships

**When to Use**: Collaborative editing, P2P sync, full history required

---

## Recommended Hybrid Approach

### Best of Both Worlds: SQLite + Automerge

**Architecture**:
```
┌──────────────────────────────────────────┐
│ React Application                        │
├──────────────────────────────────────────┤
│ TanStack Query (data layer)             │
├──────────────────────────────────────────┤
│ Automerge (sync + conflict resolution)  │
├──────────────────────────────────────────┤
│ SQLite (query + persistence)            │
│  - Derived from Automerge state         │
│  - Rebuilt on each change               │
│  - Enables SQL queries                  │
└──────────────────────────────────────────┘
```

**How It Works**:

1. **Source of Truth**: Automerge document (CRDT with full history)
2. **Query Engine**: SQLite database (derived from Automerge)
3. **Sync**: Automerge handles P2P or server sync
4. **Persistence**: Save Automerge document to disk/IndexedDB
5. **Rebuilds**: On load, hydrate SQLite from Automerge state

**Code Example**:
```javascript
import * as Automerge from '@automerge/automerge'
import initSqlJs from 'sql.js'

class KnowledgeStore {
  constructor() {
    this.doc = null // Automerge document
    this.db = null // SQLite database
  }

  async init() {
    // Load persisted Automerge doc or create new
    const saved = localStorage.getItem('knowledge-doc')
    this.doc = saved
      ? Automerge.load(new Uint8Array(saved))
      : Automerge.from({ systems: {}, models: {}, relationships: [] })

    // Initialize SQLite
    const SQL = await initSqlJs()
    this.db = new SQL.Database()

    // Rebuild SQLite from Automerge state
    this.rebuildDatabase()
  }

  rebuildDatabase() {
    // Drop and recreate tables
    this.db.run('DROP TABLE IF EXISTS systems')
    this.db.run(`
      CREATE TABLE systems (
        id TEXT PRIMARY KEY,
        title TEXT,
        content TEXT,
        metadata TEXT
      )
    `)

    // Insert current state from Automerge
    const systems = this.doc.systems
    for (const [id, system] of Object.entries(systems)) {
      this.db.run('INSERT INTO systems VALUES (?, ?, ?, ?)', [
        id,
        system.title,
        system.content,
        JSON.stringify(system.metadata)
      ])
    }
  }

  // Mutate via Automerge (ensures history + sync)
  addSystem(system) {
    this.doc = Automerge.change(this.doc, 'Add system', doc => {
      doc.systems[system.id] = system
    })
    this.persist()
    this.rebuildDatabase() // Update query layer
  }

  // Query via SQLite (fast SQL queries)
  searchSystems(query) {
    const stmt = this.db.prepare('SELECT * FROM systems WHERE title LIKE ?')
    stmt.bind([`%${query}%`])
    const results = []
    while (stmt.step()) {
      results.push(stmt.getAsObject())
    }
    return results
  }

  // Sync with peer
  sync(peerDoc) {
    this.doc = Automerge.merge(this.doc, peerDoc)
    this.persist()
    this.rebuildDatabase()
  }

  persist() {
    const saved = Automerge.save(this.doc)
    localStorage.setItem('knowledge-doc', saved)
  }
}
```

**Benefits**:
- ✅ **CRDT Sync**: Automerge handles conflict-free sync
- ✅ **SQL Queries**: SQLite for fast, complex queries
- ✅ **Full History**: Automerge tracks every change
- ✅ **Offline-First**: Both work without network
- ✅ **Portable**: Entire database is one Automerge document

**Trade-offs**:
- ⚠️ **Rebuild Cost**: SQLite rebuilt on each change (mitigated: only rebuild affected tables)
- ⚠️ **Memory**: Both Automerge and SQLite in memory (mitigated: lazy load)
- ⚠️ **Complexity**: Two layers to understand

---

## Recommendation Matrix

| Requirement | SQLite Only | Neo4j | PouchDB | Automerge | **Hybrid (SQLite + Automerge)** |
|-------------|-------------|-------|---------|-----------|----------------------------------|
| **Small Individual** | ✅ Excellent | ❌ Too heavy | ✅ Good | ✅ Good | ✅ Excellent |
| **Sharing** | ⚠️ Manual | ⚠️ Manual | ✅ Built-in | ✅ Built-in | ✅ Built-in |
| **Version Tracking** | ⚠️ Manual | ⚠️ Manual | ⚠️ Limited | ✅ Built-in | ✅ Built-in |
| **Evolution Tracking** | ✅ Custom table | ✅ Nodes | ⚠️ Limited | ✅ Full history | ✅ Full history |
| **Graph Queries** | ⚠️ Joins | ✅ Native | ❌ Poor | ⚠️ Manual | ✅ SQL Joins |
| **Offline-First** | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |
| **Conflict Resolution** | ❌ Manual | ❌ Manual | ⚠️ MVCC | ✅ CRDT | ✅ CRDT |

---

## Final Recommendation

### MVP (Phase 1): **SQLite with Manual Versioning**
- Start simple: SQLite with `events` table for history
- Manual sync: Export/import JSON files
- Manual conflict resolution: User chooses version
- **Why**: Fastest to build, easiest to understand, no dependencies

### Production (Phase 2): **SQLite + Automerge Hybrid**
- Add Automerge for automatic sync and conflict resolution
- Keep SQLite for fast queries
- Rebuild SQLite on Automerge changes
- **Why**: Best of both worlds - CRDT sync + SQL queries

### Scale (Phase 3): **Optional Backend**
- Add sync server (simple Node.js server storing Automerge docs)
- Or use decentralized sync (WebRTC P2P)
- Keep local-first: backend is optional enhancement
- **Why**: Enable multi-device, multi-user without sacrificing local-first

---

## Implementation Roadmap

### Week 1-2: SQLite Foundation
```javascript
// Core schema
- systems table
- models table
- relationships table
- events table (immutable log)

// Core operations
- Create/Read/Update/Delete
- Query relationships
- Record events
- Export to JSON
```

### Week 3-4: Versioning & History
```javascript
// Event sourcing
- Append-only events
- Rebuild state from events
- Time-travel queries
- Diff between versions

// Evolution tracking
- evolution_notes table
- "Why I changed this" metadata
- Timeline view
```

### Week 5-6: Automerge Integration
```javascript
// CRDT layer
- Wrap SQLite mutations in Automerge changes
- Rebuild SQLite from Automerge state
- Persist Automerge doc to IndexedDB

// Sync
- Export Automerge doc
- Import and merge docs
- Automatic conflict resolution
```

### Week 7-8: Sharing & Collaboration
```javascript
// Granular sharing
- Export individual systems/models
- Share links or files
- Import shared knowledge

// Optional: Sync server
- POST Automerge changes
- GET latest document
- WebSocket for real-time
```

---

## Storage Size Estimates

| Data | Size | Typical User |
|------|------|--------------|
| **SQLite Schema** | ~50KB | Overhead |
| **100 Systems** | ~500KB | Text + metadata |
| **100 Models** | ~500KB | Text + metadata |
| **500 Relationships** | ~50KB | Edges |
| **1000 Events** | ~2MB | Full history |
| **Automerge Overhead** | ~20% | CRDT metadata |
| **Total** | ~4MB | Comfortable |

**Scaling**:
- 1000 systems + models: ~40MB
- 10,000 events: ~20MB
- Total for power user: **< 100MB**

Still lightweight enough for browser/mobile storage.

---

## Technology Choices Summary

### Core Stack (Recommended)
```
- Primary: SQLite (sql.js in browser, better-sqlite3 in Node.js)
- Sync: Automerge (CRDT library)
- Persistence: IndexedDB (browser) or file (desktop)
- Export: JSON (human-readable)
- Backup: Automerge snapshots (compact)
```

### Alternative Considerations
- **If you need native graph queries at scale**: Neo4j (accept server requirement)
- **If you have existing CouchDB expertise**: PouchDB + CouchDB (accept document limitations)
- **If you want simplest possible MVP**: SQLite only with JSON export/import (accept manual sync)

---

## Conclusion

The **SQLite + Automerge hybrid** approach is the optimal choice because:

1. **Local-First**: Works offline, fast queries, no server required
2. **Shareable**: CRDT-based sync handles conflicts automatically
3. **Versioned**: Full event history via Automerge
4. **Evolvable**: Track how knowledge changes over time
5. **Lightweight**: < 10MB for typical user, < 100MB for power users
6. **Portable**: Export to JSON, import anywhere
7. **No Lock-In**: Standard formats (SQLite, JSON)

Start with **SQLite only** for MVP to prove the concept, then add **Automerge** for sync when you need sharing. This incremental approach reduces complexity while maintaining a clear path to full collaboration.

The combination avoids common database pitfalls:
- ❌ No heavyweight servers (Neo4j, PostgreSQL)
- ❌ No vendor lock-in (Firebase, proprietary backends)
- ❌ No manual conflict resolution (git-style merges)
- ❌ No complex setup (Docker, cloud infrastructure)

You get a **simple, shareable, provable** knowledge system that starts small and scales gracefully.
