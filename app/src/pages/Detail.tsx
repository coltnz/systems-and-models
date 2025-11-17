import { useEffect, useState } from 'react'
import { ArrowLeft, Copy, Check, ExternalLink } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { getSystem } from '../lib/db/systems'
import { getModel } from '../lib/db/models'
import { getProvenance } from '../lib/db/provenance'
import { getRelationshipsByEntityId } from '../lib/db/relationships'
import { getSystems, getModels, getProvenance as getAllProvenance } from '../lib/db'
import type { System, Model, Provenance, Relationship } from '../types'
import { EntityType, copyPermalinkToClipboard, getFullPermalink, navigateToPermalink } from '../lib/permalink'
import ReactMarkdown from 'react-markdown'

interface DetailProps {
  type: EntityType
  id: string
  onBack: () => void
}

type Entity = System | Model | Provenance

export function Detail({ type, id, onBack }: DetailProps) {
  const [entity, setEntity] = useState<Entity | null>(null)
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [relatedEntities, setRelatedEntities] = useState<Map<string, Entity>>(new Map())
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadEntity()
  }, [type, id])

  const loadEntity = () => {
    setLoading(true)
    try {
      // Load the entity
      let loadedEntity: Entity | undefined
      if (type === 'system') {
        loadedEntity = getSystem(id)
      } else if (type === 'model') {
        loadedEntity = getModel(id)
      } else if (type === 'provenance') {
        loadedEntity = getProvenance(id)
      }

      if (!loadedEntity) {
        setEntity(null)
        setLoading(false)
        return
      }

      setEntity(loadedEntity)

      // Load relationships
      const rels = getRelationshipsByEntityId(id)
      setRelationships(rels)

      // Load related entities
      const allSystems = getSystems()
      const allModels = getModels()
      const allProvenance = getAllProvenance()
      const allEntities = new Map<string, Entity>()

      allSystems.forEach(s => allEntities.set(s.id, s))
      allModels.forEach(m => allEntities.set(m.id, m))
      allProvenance.forEach(p => allEntities.set(p.id, p))

      setRelatedEntities(allEntities)
      setLoading(false)
    } catch (error) {
      console.error('Error loading entity:', error)
      setEntity(null)
      setLoading(false)
    }
  }

  const handleCopyPermalink = async () => {
    try {
      await copyPermalinkToClipboard(type, id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy permalink:', error)
    }
  }

  const handleNavigateToEntity = (entityId: string) => {
    // Determine entity type
    const targetEntity = relatedEntities.get(entityId)
    if (!targetEntity) return

    let targetType: EntityType
    if (entityId.startsWith('system-')) targetType = 'system'
    else if (entityId.startsWith('model-')) targetType = 'model'
    else targetType = 'provenance'

    navigateToPermalink(targetType, entityId)
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!entity) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Not Found</CardTitle>
            <CardDescription>
              The {type} with ID "{id}" could not be found.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const outgoingRels = relationships.filter(r => r.from_id === id)
  const incomingRels = relationships.filter(r => r.to_id === id)

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyPermalink}
          className="gap-2"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy Link
            </>
          )}
        </Button>
      </div>

      {/* Main Content */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="capitalize">
                  {type}
                </Badge>
                {'status' in entity && entity.status && (
                  <Badge variant={entity.status === 'proven' ? 'default' : 'secondary'}>
                    {entity.status}
                  </Badge>
                )}
                {'type' in entity && entity.type && (
                  <Badge variant="secondary">{entity.type}</Badge>
                )}
              </div>
              <CardTitle className="text-2xl mb-2">{entity.title}</CardTitle>
              <CardDescription className="text-base">{entity.description}</CardDescription>
            </div>
          </div>

          {/* Tags */}
          {entity.tags && entity.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {entity.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Provenance metadata */}
          {type === 'provenance' && 'source' in entity && (
            <div className="mt-4 space-y-2">
              <div className="text-sm">
                <span className="font-medium">Source:</span>{' '}
                <span className="text-muted-foreground">{entity.source}</span>
                {entity.source_url && (
                  <a
                    href={entity.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View
                  </a>
                )}
              </div>
              {entity.credibility_score !== undefined && (
                <div className="text-sm">
                  <span className="font-medium">Credibility Score:</span>{' '}
                  <span className="text-muted-foreground">{entity.credibility_score}/100</span>
                </div>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{entity.content}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      {/* Evidence Links (for Systems and Models) */}
      {'evidence_links' in entity && entity.evidence_links && entity.evidence_links.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Evidence & Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {entity.evidence_links.map((evidenceId) => {
                const evidence = relatedEntities.get(evidenceId)
                if (!evidence) return null
                return (
                  <button
                    key={evidenceId}
                    onClick={() => handleNavigateToEntity(evidenceId)}
                    className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm mb-1">{evidence.title}</div>
                        <div className="text-xs text-muted-foreground">{evidence.description}</div>
                      </div>
                      {'credibility_score' in evidence && (
                        <Badge variant="secondary" className="text-xs">
                          {evidence.credibility_score}
                        </Badge>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Relationships */}
      {(outgoingRels.length > 0 || incomingRels.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Relationships</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {outgoingRels.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2 text-muted-foreground">
                  Outgoing ({outgoingRels.length})
                </h4>
                <div className="space-y-2">
                  {outgoingRels.map((rel) => {
                    const target = relatedEntities.get(rel.to_id)
                    if (!target) return null
                    return (
                      <button
                        key={rel.id}
                        onClick={() => handleNavigateToEntity(rel.to_id)}
                        className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <Badge variant="outline" className="text-xs capitalize mt-0.5">
                            {rel.relationship_type}
                          </Badge>
                          <div className="flex-1">
                            <div className="font-medium text-sm mb-1">{target.title}</div>
                            <div className="text-xs text-muted-foreground">{target.description}</div>
                            {rel.tags.length > 0 && (
                              <div className="flex gap-1 mt-2">
                                {rel.tags.map(tag => (
                                  <Badge key={tag} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {incomingRels.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2 text-muted-foreground">
                  Incoming ({incomingRels.length})
                </h4>
                <div className="space-y-2">
                  {incomingRels.map((rel) => {
                    const source = relatedEntities.get(rel.from_id)
                    if (!source) return null
                    return (
                      <button
                        key={rel.id}
                        onClick={() => handleNavigateToEntity(rel.from_id)}
                        className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <Badge variant="outline" className="text-xs capitalize mt-0.5">
                            {rel.relationship_type}
                          </Badge>
                          <div className="flex-1">
                            <div className="font-medium text-sm mb-1">{source.title}</div>
                            <div className="text-xs text-muted-foreground">{source.description}</div>
                            {rel.tags.length > 0 && (
                              <div className="flex gap-1 mt-2">
                                {rel.tags.map(tag => (
                                  <Badge key={tag} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
