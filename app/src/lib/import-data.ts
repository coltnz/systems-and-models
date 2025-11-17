import { createSystem } from './db/systems'
import { createModel } from './db/models'
import { createProvenance } from './db/provenance'
import { createRelationship } from './db/relationships'
import type { System, Model, Provenance, Relationship } from '@/types'

// YAML data structure types
interface YAMLSystem {
  id: string
  title: string
  description: string
  status: System['status']
  tags: string[]
  content: string
  evidence_links?: string[]
}

interface YAMLModel {
  id: string
  title: string
  description: string
  type: Model['type']
  tags: string[]
  content: string
  evidence_links?: string[]
}

interface YAMLProvenance {
  id: string
  type: Provenance['type']
  title: string
  description: string
  source: string
  source_url?: string
  credibility_score?: number
  tags: string[]
  content: string
}

interface YAMLRelationship {
  from: string
  to: string
  type: Relationship['relationship_type']
  strength?: number
  tags?: string[]
}

interface YAMLData {
  version: string
  metadata?: {
    created?: string
    description?: string
    author?: string
  }
  systems?: YAMLSystem[]
  models?: YAMLModel[]
  provenance?: YAMLProvenance[]
  relationships?: YAMLRelationship[]
}

export interface ImportResult {
  success: boolean
  systemsImported: number
  modelsImported: number
  provenanceImported: number
  relationshipsImported: number
  errors: string[]
}

/**
 * Import knowledge graph data from parsed YAML
 */
export function importKnowledgeGraphData(data: YAMLData): ImportResult {
  const result: ImportResult = {
    success: true,
    systemsImported: 0,
    modelsImported: 0,
    provenanceImported: 0,
    relationshipsImported: 0,
    errors: []
  }

  // Map to track created entity IDs
  const entityMap = new Map<string, string>()

  try {
    // Import systems
    if (data.systems) {
      for (const system of data.systems) {
        try {
          const created = createSystem({
            title: system.title,
            description: system.description || '',
            content: system.content || '',
            tags: system.tags || [],
            status: system.status || 'draft',
            evidence_links: system.evidence_links || [],
          })
          entityMap.set(system.id, created.id)
          result.systemsImported++
        } catch (error) {
          result.errors.push(`Failed to import system "${system.id}": ${error}`)
          result.success = false
        }
      }
    }

    // Import models
    if (data.models) {
      for (const model of data.models) {
        try {
          const created = createModel({
            title: model.title,
            description: model.description || '',
            content: model.content || '',
            type: model.type || 'concept',
            tags: model.tags || [],
          })
          entityMap.set(model.id, created.id)
          result.modelsImported++
        } catch (error) {
          result.errors.push(`Failed to import model "${model.id}": ${error}`)
          result.success = false
        }
      }
    }

    // Import provenance
    if (data.provenance) {
      for (const prov of data.provenance) {
        try {
          const created = createProvenance({
            type: prov.type,
            title: prov.title,
            description: prov.description || '',
            content: prov.content || '',
            source: prov.source,
            source_url: prov.source_url,
            credibility_score: prov.credibility_score,
            tags: prov.tags || [],
          })
          entityMap.set(prov.id, created.id)
          result.provenanceImported++
        } catch (error) {
          result.errors.push(`Failed to import provenance "${prov.id}": ${error}`)
          result.success = false
        }
      }
    }

    // Import relationships (after all entities exist)
    if (data.relationships) {
      for (const rel of data.relationships) {
        try {
          const fromId = entityMap.get(rel.from)
          const toId = entityMap.get(rel.to)

          if (!fromId || !toId) {
            result.errors.push(
              `Relationship references unknown entity: ${rel.from} -> ${rel.to}`
            )
            continue
          }

          // Determine entity types from original IDs
          const fromType = getEntityType(rel.from, data)
          const toType = getEntityType(rel.to, data)

          if (!fromType || !toType) {
            result.errors.push(
              `Could not determine entity type for relationship: ${rel.from} -> ${rel.to}`
            )
            continue
          }

          createRelationship({
            from_type: fromType,
            from_id: fromId,
            to_type: toType,
            to_id: toId,
            relationship_type: rel.type,
            strength: rel.strength,
            tags: rel.tags || [],
          })
          result.relationshipsImported++
        } catch (error) {
          result.errors.push(
            `Failed to import relationship "${rel.from}" -> "${rel.to}": ${error}`
          )
          result.success = false
        }
      }
    }
  } catch (error) {
    result.success = false
    result.errors.push(`Fatal error during import: ${error}`)
  }

  return result
}

/**
 * Determine entity type from ID by checking which array it's in
 */
function getEntityType(
  id: string,
  data: YAMLData
): 'system' | 'model' | 'provenance' | null {
  if (data.systems?.some(s => s.id === id)) return 'system'
  if (data.models?.some(m => m.id === id)) return 'model'
  if (data.provenance?.some(p => p.id === id)) return 'provenance'
  return null
}

/**
 * Validate YAML data structure
 */
export function validateYAMLData(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!data || typeof data !== 'object') {
    errors.push('Data must be an object')
    return { valid: false, errors }
  }

  if (!data.version) {
    errors.push('Missing required field: version')
  }

  // Validate systems
  if (data.systems && Array.isArray(data.systems)) {
    data.systems.forEach((system: any, index: number) => {
      if (!system.id) errors.push(`System at index ${index} missing id`)
      if (!system.title) errors.push(`System at index ${index} missing title`)
      if (system.status && !['draft', 'active', 'archived', 'proven'].includes(system.status)) {
        errors.push(`System "${system.id}" has invalid status: ${system.status}`)
      }
    })
  }

  // Validate models
  if (data.models && Array.isArray(data.models)) {
    data.models.forEach((model: any, index: number) => {
      if (!model.id) errors.push(`Model at index ${index} missing id`)
      if (!model.title) errors.push(`Model at index ${index} missing title`)
      if (model.type && !['mental-model', 'concept', 'framework', 'principle'].includes(model.type)) {
        errors.push(`Model "${model.id}" has invalid type: ${model.type}`)
      }
    })
  }

  // Validate provenance
  if (data.provenance && Array.isArray(data.provenance)) {
    data.provenance.forEach((prov: any, index: number) => {
      if (!prov.id) errors.push(`Provenance at index ${index} missing id`)
      if (!prov.title) errors.push(`Provenance at index ${index} missing title`)
      if (!prov.type) errors.push(`Provenance at index ${index} missing type`)
      if (!prov.source) errors.push(`Provenance at index ${index} missing source`)
      if (prov.type && !['theory', 'quote', 'fact', 'principle', 'corollary', 'research'].includes(prov.type)) {
        errors.push(`Provenance "${prov.id}" has invalid type: ${prov.type}`)
      }
    })
  }

  // Validate relationships
  if (data.relationships && Array.isArray(data.relationships)) {
    data.relationships.forEach((rel: any, index: number) => {
      if (!rel.from) errors.push(`Relationship at index ${index} missing from`)
      if (!rel.to) errors.push(`Relationship at index ${index} missing to`)
      if (!rel.type) errors.push(`Relationship at index ${index} missing type`)
      const validTypes = ['uses', 'explains', 'requires', 'extends', 'contradicts', 'supports', 'evidences']
      if (rel.type && !validTypes.includes(rel.type)) {
        errors.push(`Relationship at index ${index} has invalid type: ${rel.type}`)
      }
    })
  }

  return { valid: errors.length === 0, errors }
}
