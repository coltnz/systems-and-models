export interface System {
  id: string
  title: string
  description: string
  content: string
  tags: string[]
  status: 'draft' | 'active' | 'archived' | 'proven'
  evidence_links: string[]
  version: number
  created_at: number
  updated_at: number
  created_by?: string
  updated_by?: string
}

export interface Model {
  id: string
  title: string
  description: string
  content: string
  type: 'mental-model' | 'concept' | 'framework' | 'principle'
  tags: string[]
  version: number
  created_at: number
  updated_at: number
  created_by?: string
  updated_by?: string
}

export interface Relationship {
  id: string
  from_type: 'system' | 'model'
  from_id: string
  to_type: 'system' | 'model'
  to_id: string
  relationship_type: 'uses' | 'explains' | 'requires' | 'extends' | 'contradicts'
  metadata?: Record<string, unknown>
  created_at: number
}

export interface Event {
  id: number
  entity_type: 'system' | 'model' | 'relationship'
  entity_id: string
  event_type: 'created' | 'updated' | 'deleted'
  data: string // JSON string
  metadata?: string // JSON string
  created_at: number
  created_by?: string
}

export interface EvolutionNote {
  id: string
  entity_type: 'system' | 'model'
  entity_id: string
  note: string
  created_at: number
  created_by?: string
}
