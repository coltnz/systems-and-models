# Systems & Models MVP

A knowledge management platform for tracking practical systems (how-to processes) and mental models (conceptual frameworks) with full version history and evolution tracking.

## Features Implemented

### ✅ Core Functionality
- **Database Layer**: SQLite with sql.js for browser-based storage
- **Systems Management**: Create, read, and list systems with tags, status, and evidence links
- **Models Management**: Create, read, and list mental models/concepts/frameworks
- **Event Sourcing**: Full version history tracking in events table
- **IndexedDB Persistence**: Automatic saving to browser storage

### ✅ User Interface
- **Modern Design**: Built with React + Tailwind CSS + shadcn/ui
- **Responsive Layout**: Two-column grid showing systems and models
- **Create Dialogs**: Modal forms for creating new systems and models
- **Status Badges**: Visual indicators for system status (draft, active, archived, proven)
- **Type Badges**: Visual indicators for model types (mental-model, concept, framework, principle)
- **Tag System**: Comma-separated tags for categorization

### ✅ Technical Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS 3 with CSS variables for theming
- **Components**: shadcn/ui (Radix UI primitives)
- **Database**: SQL.js (SQLite compiled to WebAssembly)
- **State**: React hooks (useState, useEffect)
- **Storage**: IndexedDB for database persistence

## Project Structure

```
app/
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   └── textarea.tsx
│   │   ├── CreateSystemDialog.tsx
│   │   └── CreateModelDialog.tsx
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts     # Database initialization & schema
│   │   │   ├── systems.ts   # System CRUD operations
│   │   │   └── models.ts    # Model CRUD operations
│   │   └── utils.ts         # Utility functions (cn)
│   ├── pages/
│   │   └── Home.tsx         # Main page
│   ├── types/
│   │   └── index.ts         # TypeScript type definitions
│   ├── App.tsx              # Root component with DB initialization
│   ├── index.css            # Global styles with Tailwind
│   └── main.tsx             # App entry point
├── docs/                    # Analysis documents
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## Database Schema

### Tables
- **systems**: Stores practical systems (processes, workflows, habits)
- **models**: Stores mental models and concepts
- **relationships**: Links between systems and models (future use)
- **events**: Immutable event log for version history
- **evolution_notes**: Track knowledge evolution over time (future use)

### Indexes
- Optimized queries on updated_at for sorting
- Relationship lookups by from/to entities
- Event history by entity

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

Open http://localhost:5173 in your browser.

### Build for Production
```bash
npm run build
```

## Usage

### Creating a System
1. Click "New System" button
2. Fill in the form:
   - Title (required)
   - Description
   - Content (detailed steps, notes)
   - Tags (comma-separated)
   - Status (draft, active, archived, proven)
3. Click "Create System"

### Creating a Model
1. Click "New Model" button
2. Fill in the form:
   - Title (required)
   - Description
   - Content (explanation of concept)
   - Tags (comma-separated)
   - Type (mental-model, concept, framework, principle)
3. Click "Create Model"

## Data Persistence

All data is stored locally in your browser using IndexedDB. This means:
- ✅ Works completely offline
- ✅ Fast, no network latency
- ✅ Private, your data never leaves your device
- ⚠️ Data is tied to your browser (clearing browser data will delete it)
- ⚠️ No sync between devices (yet - coming in Phase 2)

## What's Next (Phase 2+)

### Week 3-4: Core Features
- [ ] Update/Edit systems and models
- [ ] Delete systems and models
- [ ] Detail pages for viewing full content
- [ ] Search and filter functionality
- [ ] Export to JSON/Markdown

### Week 5-6: Graph Visualization
- [ ] Integrate Cytoscape.js
- [ ] Visual graph of systems and models
- [ ] Create relationships between entities
- [ ] Interactive graph navigation

### Week 7-8: Version History & Evolution
- [ ] Version history viewer
- [ ] Diff viewer for changes
- [ ] Restore previous versions
- [ ] Evolution notes interface
- [ ] Timeline view

### Future Phases
- [ ] CRDT-based sync (Automerge)
- [ ] Sharing capabilities
- [ ] Collaborative editing
- [ ] AI-assisted connections
- [ ] Mobile apps

## Technical Notes

### Why SQLite?
- Lightweight (< 1MB)
- Proven technology (30+ years)
- Full SQL support
- ACID transactions
- Runs in browser via WebAssembly

### Why No Router Yet?
- MVP focuses on core functionality
- Routing will be added in Week 3-4
- Simpler to test and iterate without routing complexity

### Why shadcn/ui?
- Copy-paste components (no npm bloat)
- Full code ownership
- Accessibility built-in (Radix UI)
- Easy to customize
- Beautiful out of the box

## License

MIT

## Contributing

This is an MVP. Contributions welcome after initial release.
