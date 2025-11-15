import type { System, Model, Provenance } from '@/types'

type SearchableEntity = System | Model | Provenance

export interface SearchResult<T extends SearchableEntity> {
  entity: T
  type: 'system' | 'model' | 'provenance'
  score: number
  matchedFields: string[]
}

/**
 * Simple keyword-based search that searches across all entity fields
 * Returns results sorted by relevance score
 */
export function searchEntities(
  query: string,
  systems: System[],
  models: Model[],
  provenance: Provenance[]
): SearchResult<SearchableEntity>[] {
  if (!query || query.trim().length === 0) {
    return []
  }

  const normalizedQuery = query.toLowerCase().trim()
  const queryTerms = normalizedQuery.split(/\s+/)

  const results: SearchResult<SearchableEntity>[] = []

  // Search systems
  systems.forEach(system => {
    const { score, matchedFields } = scoreEntity(system, queryTerms, [
      'title',
      'description',
      'content',
      'tags',
      'status'
    ])
    if (score > 0) {
      results.push({ entity: system, type: 'system', score, matchedFields })
    }
  })

  // Search models
  models.forEach(model => {
    const { score, matchedFields } = scoreEntity(model, queryTerms, [
      'title',
      'description',
      'content',
      'tags',
      'type'
    ])
    if (score > 0) {
      results.push({ entity: model, type: 'model', score, matchedFields })
    }
  })

  // Search provenance
  provenance.forEach(prov => {
    const { score, matchedFields } = scoreEntity(prov, queryTerms, [
      'title',
      'description',
      'content',
      'tags',
      'type',
      'source'
    ])
    if (score > 0) {
      results.push({ entity: prov, type: 'provenance', score, matchedFields })
    }
  })

  // Sort by score descending
  return results.sort((a, b) => b.score - a.score)
}

/**
 * Score an entity based on how well it matches the query terms
 * Returns score and list of matched fields
 */
function scoreEntity(
  entity: any,
  queryTerms: string[],
  searchableFields: string[]
): { score: number; matchedFields: string[] } {
  let score = 0
  const matchedFields: Set<string> = new Set()

  searchableFields.forEach(field => {
    const value = entity[field]
    if (!value) return

    const fieldValue = Array.isArray(value)
      ? value.join(' ').toLowerCase()
      : String(value).toLowerCase()

    queryTerms.forEach(term => {
      if (fieldValue.includes(term)) {
        // Weight matches by field importance
        let weight = 1
        if (field === 'title') weight = 3 // Title matches are most important
        else if (field === 'description') weight = 2 // Description is second
        else if (field === 'tags') weight = 2.5 // Tags are highly relevant

        // Exact word boundary matches get bonus
        const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'i')
        if (wordBoundaryRegex.test(fieldValue)) {
          weight *= 1.5
        }

        score += weight
        matchedFields.add(field)
      }
    })
  })

  return { score, matchedFields: Array.from(matchedFields) }
}

/**
 * Filter entities by IDs (for graph highlighting)
 */
export function getMatchingIds(results: SearchResult<SearchableEntity>[]): Set<string> {
  return new Set(results.map(r => r.entity.id))
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Highlight search terms in text
 */
export function highlightText(text: string, query: string): string {
  if (!query || query.trim().length === 0) return text

  const terms = query.toLowerCase().trim().split(/\s+/)
  let highlighted = text

  terms.forEach(term => {
    const regex = new RegExp(`(${escapeRegex(term)})`, 'gi')
    highlighted = highlighted.replace(regex, '<mark>$1</mark>')
  })

  return highlighted
}
