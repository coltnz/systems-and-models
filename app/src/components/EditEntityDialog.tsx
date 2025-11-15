import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { updateSystem } from '@/lib/db/systems'
import { updateModel } from '@/lib/db/models'
import { updateProvenance } from '@/lib/db/provenance'
import type { System, Model, Provenance } from '@/types'

type EntityData = System | Model | Provenance

interface EditEntityDialogProps {
  open: boolean
  onClose: () => void
  entityType: 'system' | 'model' | 'provenance'
  entityData: EntityData
  onEntityUpdated: () => void
}

export function EditEntityDialog({ open, onClose, entityType, entityData, onEntityUpdated }: EditEntityDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')

  // System-specific fields
  const [status, setStatus] = useState<System['status']>('draft')

  // Model-specific fields
  const [modelType, setModelType] = useState<Model['type']>('mental')

  // Provenance-specific fields
  const [provType, setProvType] = useState<Provenance['type']>('theory')
  const [source, setSource] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [credibilityScore, setCredibilityScore] = useState<number | ''>('')

  useEffect(() => {
    if (open) {
      // Initialize form fields from entity data
      setTitle(entityData.title)
      setDescription(entityData.description || '')
      setContent(entityData.content || '')
      setTags(entityData.tags.join(', '))

      if (entityType === 'system') {
        const system = entityData as System
        setStatus(system.status)
      } else if (entityType === 'model') {
        const model = entityData as Model
        setModelType(model.type)
      } else if (entityType === 'provenance') {
        const prov = entityData as Provenance
        setProvType(prov.type)
        setSource(prov.source)
        setSourceUrl(prov.source_url || '')
        setCredibilityScore(prov.credibility_score ?? '')
      }
    }
  }, [open, entityData, entityType])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const tagsArray = tags.split(',').map(t => t.trim()).filter(t => t.length > 0)

    try {
      if (entityType === 'system') {
        updateSystem(entityData.id, {
          title,
          description,
          content,
          tags: tagsArray,
          status,
        })
      } else if (entityType === 'model') {
        updateModel(entityData.id, {
          title,
          description,
          content,
          tags: tagsArray,
          type: modelType,
        })
      } else if (entityType === 'provenance') {
        updateProvenance(entityData.id, {
          title,
          description,
          content,
          tags: tagsArray,
          type: provType,
          source,
          source_url: sourceUrl || undefined,
          credibility_score: typeof credibilityScore === 'number' ? credibilityScore : undefined,
        })
      }

      onEntityUpdated()
      onClose()
    } catch (error) {
      console.error('Failed to update entity:', error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Edit {entityType === 'system' ? 'System' : entityType === 'model' ? 'Model' : 'Provenance'}
          </DialogTitle>
          <DialogDescription>
            Update the details for this {entityType}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Title */}
            <div>
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter title"
                required
              />
            </div>

            {/* Type-specific field */}
            {entityType === 'system' && (
              <div>
                <Label htmlFor="edit-status">Status *</Label>
                <select
                  id="edit-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as System['status'])}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                  <option value="deprecated">Deprecated</option>
                </select>
              </div>
            )}

            {entityType === 'model' && (
              <div>
                <Label htmlFor="edit-type">Type *</Label>
                <select
                  id="edit-type"
                  value={modelType}
                  onChange={(e) => setModelType(e.target.value as Model['type'])}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                >
                  <option value="mental">Mental Model</option>
                  <option value="conceptual">Conceptual</option>
                  <option value="framework">Framework</option>
                  <option value="paradigm">Paradigm</option>
                </select>
              </div>
            )}

            {entityType === 'provenance' && (
              <>
                <div>
                  <Label htmlFor="edit-prov-type">Type *</Label>
                  <select
                    id="edit-prov-type"
                    value={provType}
                    onChange={(e) => setProvType(e.target.value as Provenance['type'])}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    required
                  >
                    <option value="theory">Theory</option>
                    <option value="quote">Quote</option>
                    <option value="fact">Fact</option>
                    <option value="principle">Principle</option>
                    <option value="corollary">Corollary</option>
                    <option value="research">Research</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="edit-source">Source *</Label>
                  <Input
                    id="edit-source"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="Enter source"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="edit-source-url">Source URL</Label>
                  <Input
                    id="edit-source-url"
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <Label htmlFor="edit-credibility">Credibility Score (0-100)</Label>
                  <Input
                    id="edit-credibility"
                    type="number"
                    min="0"
                    max="100"
                    value={credibilityScore}
                    onChange={(e) => setCredibilityScore(e.target.value ? parseInt(e.target.value) : '')}
                    placeholder="0-100"
                  />
                </div>
              </>
            )}

            {/* Description */}
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description"
                rows={2}
              />
            </div>

            {/* Content */}
            <div>
              <Label htmlFor="edit-content">Content</Label>
              <Textarea
                id="edit-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Detailed content"
                rows={6}
              />
            </div>

            {/* Tags */}
            <div>
              <Label htmlFor="edit-tags">Tags</Label>
              <Input
                id="edit-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="tag1, tag2, tag3"
              />
              <p className="text-xs text-muted-foreground mt-1">Comma-separated tags</p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
