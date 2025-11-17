/**
 * Permalink utilities for knowledge graph entities
 *
 * Permalink format:
 * - Models: #/model/{id}
 * - Systems: #/system/{id}
 * - Provenance: #/provenance/{id}
 */

export type EntityType = 'model' | 'system' | 'provenance'

export interface PermalinkInfo {
  type: EntityType
  id: string
}

/**
 * Generate a permalink for an entity
 */
export function generatePermalink(type: EntityType, id: string): string {
  return `#/${type}/${id}`
}

/**
 * Get the full URL permalink for an entity
 */
export function getFullPermalink(type: EntityType, id: string): string {
  const baseUrl = window.location.origin + window.location.pathname
  return `${baseUrl}#/${type}/${id}`
}

/**
 * Parse a permalink hash into type and id
 * Returns null if not a valid permalink
 */
export function parsePermalink(hash: string): PermalinkInfo | null {
  // Remove leading #
  const clean = hash.startsWith('#') ? hash.slice(1) : hash

  // Match pattern: /type/id
  const match = clean.match(/^\/(model|system|provenance)\/([a-z0-9-]+)$/)
  if (!match) return null

  return {
    type: match[1] as EntityType,
    id: match[2]
  }
}

/**
 * Navigate to a permalink
 */
export function navigateToPermalink(type: EntityType, id: string): void {
  window.location.hash = `/${type}/${id}`
}

/**
 * Copy permalink to clipboard
 */
export async function copyPermalinkToClipboard(type: EntityType, id: string): Promise<void> {
  const url = getFullPermalink(type, id)

  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(url)
  } else {
    // Fallback for older browsers
    const textarea = document.createElement('textarea')
    textarea.value = url
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
}

/**
 * Get a human-readable title from entity ID
 */
export function getEntityTitle(id: string): string {
  return id
    .replace(/^(model|system|provenance)-/, '')
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
