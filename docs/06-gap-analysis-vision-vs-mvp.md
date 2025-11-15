# Gap Analysis: MVP vs Actual Vision

## The Actual Vision (Restated)

### Core Concept
**"A knowledge system for the AI future"** - not just personal knowledge management, but a **tool/platform with marketplace potential** for sharing structured knowledge.

### Three-Layer Knowledge Model

1. **Systems** = **What to do** (actions, processes, workflows)
2. **Models** = **What to know** (concepts, frameworks, understanding)
3. **Why** = **Provenance** (the reasoning and evidence behind knowledge)
   - Theories
   - Corollaries
   - Historical facts
   - Quotes
   - Principles
   - Other provenance types

### Interface Requirements

**"Lightning fast, easy, zoom-in/zoom-out interface"**
- Graph-based visualization (nodes and relationships)
- Zoom in: See details, expand nodes, drill down
- Zoom out: See big picture, patterns, connections
- Very accessible (non-technical users)
- Comprehensible (clear at every zoom level)
- Levels of detail (progressive disclosure)
- Schematic with workings (show how things connect and work)
- Attractive to read and use (beautiful, engaging)

### Backend Requirements

**"Tree-db behind the scenes with semantic search"**
- Tree/graph database (not purely relational)
- Semantic search (meaning-based, not just keyword matching)
- Hierarchical and networked relationships
- Fast traversal

### Commerce/Platform Vision

**"Import/export systems and models and sell them"**
- Import from others
- Export your own
- Marketplace potential (sell/buy knowledge)
- Packaging systems and models as products
- Tool with add-ons/tie-ins
- Economics can wait (but architecture should support it)

---

## What We Built (MVP Reality Check)

### ✅ What Matches

1. **Two-entity model**: Systems and Models exist ✓
2. **Tags**: Basic categorization ✓
3. **Status tracking**: Systems have status (draft, active, proven) ✓
4. **Type taxonomy**: Models have types ✓
5. **Version history**: Events table tracks all changes ✓
6. **Relationships schema**: Table exists (not used in UI yet) ✓
7. **Local-first**: Works offline ✓
8. **Modern UI**: React + Tailwind + shadcn/ui ✓

### ❌ Critical Gaps

#### 1. **Missing "Why" Layer (Provenance)**
- **Gap**: No way to annotate WHY something is true/works
- **What we have**: description, content (plain text)
- **What we need**:
  - Provenance nodes (theories, quotes, facts, principles)
  - Link systems/models to their evidence
  - Provenance types as first-class entities
  - Citation/source tracking

#### 2. **No Graph Visualization**
- **Gap**: Card-based list view only, no graph
- **What we have**: Two-column cards
- **What we need**:
  - Cytoscape.js graph (already in dependencies!)
  - Nodes for systems, models, provenance
  - Edges for relationships
  - Interactive: click, drag, zoom
  - Force-directed or hierarchical layout

#### 3. **No Zoom In/Out**
- **Gap**: Fixed detail level, no progressive disclosure
- **What we have**: Card shows title + description + tags
- **What we need**:
  - Zoom out: Just titles/icons
  - Zoom medium: Titles + summaries
  - Zoom in: Full content + relationships
  - Detail page: Everything including version history
  - Minimap for context

#### 4. **No Levels of Detail**
- **Gap**: Everything shown at once or nothing
- **What we need**:
  - L1: High-level overview (domains/categories)
  - L2: Systems and models (current cards view)
  - L3: Individual item details
  - L4: Provenance and evidence
  - L5: Version history and evolution
  - User controls which level to see

#### 5. **SQLite vs Tree-DB**
- **Gap**: Relational database, not graph/tree optimized
- **What we have**: SQLite with foreign keys
- **What we need**:
  - Graph database (Neo4j, or SQLite with recursive CTEs)
  - OR: Tree structure using adjacency list / materialized path
  - Fast graph traversal
  - Path queries (find all paths from A to B)
  - Ancestor/descendant queries

#### 6. **No Semantic Search**
- **Gap**: No search at all yet
- **What we have**: getSystems(), getModels() (no filtering)
- **What we need**:
  - Full-text search (basic keyword)
  - Semantic search (meaning-based)
  - Vector embeddings (OpenAI, local models)
  - "Find similar" functionality
  - Search by concept, not just words

#### 7. **No Import/Export**
- **Gap**: Data locked in browser
- **What we have**: IndexedDB only
- **What we need**:
  - Export to JSON (structured format)
  - Export to Markdown (readable)
  - Import from JSON
  - Package as "knowledge bundle"
  - Versioned packages (for marketplace)
  - Conflict resolution on import

#### 8. **No Marketplace Foundation**
- **Gap**: No concept of ownership, sharing, commerce
- **What we need**:
  - User accounts (optional for marketplace)
  - Public/private visibility
  - Licensing (CC0, MIT, commercial)
  - Pricing metadata
  - Bundle/package manifest
  - Dependency resolution (if system depends on model)

---

## Detailed Gap Analysis by Feature

### Feature Matrix

| Feature | Current MVP | Required for Vision | Priority | Effort |
|---------|-------------|---------------------|----------|--------|
| **Systems (what-to-do)** | ✅ Basic create/list | ✅ Works | ✓ | Done |
| **Models (what-to-know)** | ✅ Basic create/list | ✅ Works | ✓ | Done |
| **Provenance (why)** | ❌ None | ✅ Critical | 🔴 High | Med |
| **Graph visualization** | ❌ None | ✅ Critical | 🔴 High | Med |
| **Zoom in/out** | ❌ Fixed view | ✅ Critical | 🔴 High | High |
| **Levels of detail** | ❌ One level | ✅ Critical | 🔴 High | Med |
| **Relationships UI** | ❌ Schema only | ✅ Critical | 🔴 High | Low |
| **Tree/Graph DB** | ⚠️ SQLite (relational) | ✅ Needed | 🟡 Medium | Med |
| **Semantic search** | ❌ None | ✅ Needed | 🟡 Medium | High |
| **Edit/Update** | ❌ Create only | ✅ Basic CRUD | 🟡 Medium | Low |
| **Delete** | ❌ None | ✅ Basic CRUD | 🟡 Medium | Low |
| **Import/Export** | ❌ None | ✅ Needed | 🟡 Medium | Med |
| **Detail pages** | ❌ Cards only | ✅ Needed | 🟢 Low | Low |
| **Search (keyword)** | ❌ None | ✅ Needed | 🟢 Low | Low |
| **User accounts** | ❌ Local only | ⚠️ For marketplace | 🔵 Future | High |
| **Marketplace** | ❌ None | ⚠️ Vision | 🔵 Future | Very High |

**Priority Legend:**
- 🔴 High: Critical for core vision
- 🟡 Medium: Important for usability
- 🟢 Low: Nice to have
- 🔵 Future: Post-MVP

---

## What the System Should Actually Do

### User Journey: Creating Knowledge

#### 1. Create a System (What to Do)
```
User creates: "Kettlebell Training Program"
- Type: System (what-to-do)
- Description: "Progressive strength building using kettlebells"
- Content: Detailed workout steps
- Tags: fitness, strength, beginner
- Status: active
```

#### 2. Create Models (What to Know)
```
User creates: "Progressive Overload Principle"
- Type: Model (what-to-know)
- Model type: principle
- Description: "Gradually increase stress to drive adaptation"
- Content: Explanation of how it works
- Tags: fitness, learning, adaptation
```

#### 3. Link System to Model
```
Relationship:
  "Kettlebell Training Program" USES "Progressive Overload Principle"
```

#### 4. Add Provenance (Why)
```
User adds provenance to "Progressive Overload":
- Type: Quote
  Source: "Hans Selye, General Adaptation Syndrome (1936)"
  Content: "The body adapts to stress placed upon it"

- Type: Theory
  Source: "Exercise Physiology Research"
  Content: "Muscle hypertrophy occurs when mechanical tension..."

- Type: Historical Fact
  Source: "Ancient Greek wrestling training"
  Content: "Milo of Croton carried a growing calf daily"
```

#### 5. Visualize in Graph
```
[Kettlebell System] --USES--> [Progressive Overload]
                                     |
                                     +--WHY--> [Selye Quote]
                                     +--WHY--> [Exercise Theory]
                                     +--WHY--> [Milo Fact]
```

#### 6. Navigate with Zoom
```
Zoom Level 1 (Out): See all systems and models as small nodes
Zoom Level 2: See titles and basic connections
Zoom Level 3 (In): See full content and provenance
Click node: Open detail panel with everything
```

#### 7. Search Semantically
```
User searches: "building strength gradually"
Results:
- Progressive Overload (exact match on concept)
- Kettlebell Training (uses progressive overload)
- Other systems with similar patterns
```

#### 8. Export as Package
```
User exports: "Complete Kettlebell Knowledge Bundle"
Includes:
- Kettlebell Training System
- Progressive Overload Model
- All provenance citations
- Relationships
Package format: JSON with manifest
Could be sold on marketplace for $X
```

---

## Architectural Changes Needed

### 1. Data Model Evolution

#### Current Schema (Simplified)
```sql
systems (id, title, content, tags, status)
models (id, title, content, type, tags)
relationships (from, to, type) -- NOT USED IN UI
events (history)
```

#### Required Schema
```sql
-- Core entities
systems (id, title, content, tags, status)
models (id, title, content, type, tags)

-- NEW: Provenance (Why layer)
provenance (
  id,
  type,              -- theory | quote | fact | principle | corollary | research
  title,
  content,
  source,            -- Citation/attribution
  source_url,
  credibility_score, -- Optional: how reliable
  created_at
)

-- Relationships (ACTUALLY USE THIS)
relationships (
  id,
  from_type,  -- system | model | provenance
  from_id,
  to_type,
  to_id,
  relationship_type,  -- uses | explains | requires | supports | contradicts
  strength,           -- Optional: how strong is this connection
  created_at
)

-- Graph structure (for tree-db features)
graph_paths (
  ancestor_id,
  descendant_id,
  depth,
  path               -- Materialized path for fast queries
)

-- Search index (for semantic search)
embeddings (
  entity_type,
  entity_id,
  vector,            -- 1536-dim embedding from OpenAI
  model_version,     -- Which embedding model
  created_at
)
```

### 2. Technology Stack Changes

#### Keep
- ✅ React + TypeScript + Vite
- ✅ Tailwind CSS + shadcn/ui
- ✅ SQLite (can be extended with graph features)
- ✅ IndexedDB persistence

#### Add
- 🆕 **Cytoscape.js** (already installed!) - for graph visualization
- 🆕 **React Flow** OR **Cytoscape.js** - for zoom/pan interface
- 🆕 **D3-zoom** - for zoom behaviors
- 🆕 **OpenAI Embeddings API** - for semantic search
- 🆕 **OR: Local embeddings** (sentence-transformers via ONNX)
- 🆕 **Vector search library** (hnswlib-wasm for browser)

#### Replace/Enhance
- ⚠️ **SQLite → SQLite with graph extensions**
  - Use recursive CTEs for tree queries
  - Materialized path for hierarchies
  - OR: Switch to DexieDB with better graph support
  - OR: Future: Backend with Neo4j/SurrealDB

### 3. UI/UX Architecture

#### Current: Card Grid
```
Home Page
├── Systems Column (cards)
└── Models Column (cards)
```

#### Required: Multi-Mode Interface
```
Main View (tabs/modes):
├── Graph Mode (PRIMARY)
│   ├── Canvas (Cytoscape)
│   ├── Zoom controls
│   ├── Level selector (L1-L5)
│   ├── Minimap
│   └── Detail sidebar (click node)
│
├── List Mode (current cards)
│   ├── Systems list
│   ├── Models list
│   └── Provenance list
│
└── Search Mode
    ├── Search bar (keyword + semantic)
    ├── Filters (type, tags, provenance)
    └── Results (ranked by relevance)
```

---

## What This Means for the MVP

### MVP Built the Foundation ✅
- Database layer works
- UI components exist
- Create/read functionality
- Event sourcing for history
- Good architecture for expansion

### MVP Missed the Core Vision ❌
- **Not a graph interface** (cards, not nodes)
- **No provenance layer** (missing "why")
- **No zoom metaphor** (fixed detail level)
- **No semantic search** (not even keyword search)
- **Not positioned for marketplace** (local-only)

### The MVP is Actually...
**Phase 0.5: Data Entry Foundation**

What we built is the **backend + basic CRUD** for a much richer system. It's like building a database admin panel when the real product is a visual knowledge explorer.

---

## Revised Roadmap

### Phase 1: Core Vision (Critical Features)
**Goal: Graph-based knowledge explorer with provenance**

**Week 1-2: Provenance & Relationships**
- [ ] Add provenance entity (theories, quotes, facts, principles)
- [ ] Create provenance UI (add "why" to systems/models)
- [ ] Implement relationships CRUD
- [ ] Link interface (drag-and-drop or dropdown)

**Week 3-4: Graph Visualization**
- [ ] Integrate Cytoscape.js graph view
- [ ] Render systems, models, provenance as nodes
- [ ] Render relationships as edges
- [ ] Color-code by type
- [ ] Click node → open detail panel
- [ ] Basic zoom/pan

**Week 5-6: Zoom & Levels of Detail**
- [ ] Implement zoom metaphor (D3-zoom or Cytoscape built-in)
- [ ] Level 1: Overview (category bubbles)
- [ ] Level 2: All nodes (small)
- [ ] Level 3: Selected cluster (medium)
- [ ] Level 4: Single node detail (large)
- [ ] Level 5: Full detail page
- [ ] Smooth transitions between levels

**Week 7-8: Search Foundation**
- [ ] Keyword search (title, content)
- [ ] Filter by type, tags, status
- [ ] Search in graph (highlight matches)
- [ ] "Find similar" (basic: shared tags)

### Phase 2: Semantic & Export
**Week 9-10: Semantic Search**
- [ ] Integrate OpenAI embeddings API
- [ ] OR: Local embeddings (ONNX in browser)
- [ ] Generate embeddings for all content
- [ ] Vector similarity search
- [ ] "Find related by meaning"

**Week 11-12: Import/Export**
- [ ] Export to JSON (structured)
- [ ] Export to Markdown (readable)
- [ ] Package format (manifest + data)
- [ ] Import from JSON
- [ ] Import from package
- [ ] Conflict resolution

### Phase 3: Platform Features
**Week 13-16: Marketplace Foundation**
- [ ] User accounts (optional)
- [ ] Public/private toggle
- [ ] Licensing metadata
- [ ] Pricing fields
- [ ] Share links
- [ ] Dependency tracking

**Week 17-20: Actual Marketplace**
- [ ] Browse public packages
- [ ] Purchase flow
- [ ] Seller dashboard
- [ ] Reviews/ratings
- [ ] Discovery (trending, recommended)

---

## Immediate Next Steps (Priority Order)

### Option A: Fix to Match Vision (Recommended)
**Focus on making it a graph-based knowledge explorer**

1. **Add Provenance Layer** (2-3 hours)
   - New table: provenance
   - UI: "Add Why" button on systems/models
   - Create provenance dialog
   - List provenance on detail view

2. **Implement Relationships UI** (2-3 hours)
   - "Link to..." button
   - Select entity to link
   - Choose relationship type
   - Save to relationships table

3. **Build Graph View** (4-6 hours)
   - New page: Graph.tsx
   - Cytoscape.js integration
   - Render nodes from systems + models + provenance
   - Render edges from relationships
   - Basic styling (colors by type)
   - Click node → show detail

4. **Add Basic Zoom** (2-3 hours)
   - Zoom controls (+/-)
   - Pan/drag canvas
   - Fit to view
   - Reset zoom

**Total: 10-15 hours → Functional graph-based knowledge system**

### Option B: Complete CRUD First
**Finish the foundation before adding vision features**

1. Edit/Update (2 hours)
2. Delete (1 hour)
3. Detail pages (2 hours)
4. Search (2 hours)
5. Export (2 hours)

**Total: 9 hours → Complete traditional CRUD app**

Then start on graph features.

### Option C: Hybrid Approach
**Do minimal CRUD + start on graph**

1. Edit/Update/Delete (3 hours)
2. Provenance layer (3 hours)
3. Basic graph view (4 hours)

**Total: 10 hours → Functional but incomplete vision**

---

## My Recommendation

### **Start Fresh on Core Vision (Option A)**

Why:
1. The current MVP is useful but doesn't demonstrate the *unique value*
2. Graph + provenance + zoom is what makes this special
3. CRUD can be added to graph interface (edit nodes in graph)
4. You'll get more valuable feedback on the actual vision
5. More exciting to show/demo

### Concrete Plan:

**Session 1 (Now): Provenance & Relationships**
- Add provenance table + CRUD
- Add relationships UI
- Link systems ↔ models ↔ provenance

**Session 2: Graph Visualization**
- Build graph view with Cytoscape
- Render all entities as nodes
- Show relationships as edges
- Make it beautiful

**Session 3: Zoom & Polish**
- Add zoom/pan controls
- Level-of-detail toggling
- Smooth interactions
- Polish the UX

**Result**: A **graph-based knowledge explorer with provenance** that actually matches your vision.

---

## Questions to Clarify

1. **Provenance types**: Are these fixed (theory, quote, fact, principle, corollary) or user-defined?
2. **Zoom metaphor**: Geometric zoom (like Google Maps) or semantic zoom (show more detail)?
3. **Tree-DB**: Stay with SQLite + graph queries, or switch to proper graph DB?
4. **Semantic search**: Use OpenAI API (costs $) or local embeddings (slower)?
5. **Marketplace**: Build now or just architect for it?
6. **Edit in graph**: Should users edit nodes directly in graph view, or only in dialogs?

---

## The Bottom Line

**What we built**: A solid database + CRUD foundation
**What you need**: A visual knowledge graph with provenance and marketplace potential

**Gap size**: Medium-Large (core features missing)
**Time to close gap**: 15-25 hours of focused dev
**Is MVP useful as-is?**: Partially, but doesn't show the magic

**Recommendation**: Pivot to graph interface + provenance layer ASAP.
