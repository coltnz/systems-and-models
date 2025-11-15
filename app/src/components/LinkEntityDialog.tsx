import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { createRelationship } from '@/lib/db/relationships'
import { getSystems } from '@/lib/db/systems'
import { getModels } from '@/lib/db/models'
import { getProvenance } from '@/lib/db/provenance'
import type { Relationship } from '@/types'

interface LinkEntityDialogProps {
  fromType: Relationship['from_type']
  fromId: string
  fromTitle: string
  onRelationshipCreated?: () => void
  children?: React.ReactNode
}

export function LinkEntityDialog({
  fromType,
  fromId,
  fromTitle,
  onRelationshipCreated,
  children
}: LinkEntityDialogProps) {
  const [open, setOpen] = useState(false)
  const [toType, setToType] = useState<Relationship['to_type']>('system')
  const [toId, setToId] = useState('')
  const [relationshipType, setRelationshipType] = useState<Relationship['relationship_type']>('uses')
  const [strength, setStrength] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!toId) return

    createRelationship({
      from_type: fromType,
      from_id: fromId,
      to_type: toType,
      to_id: toId,
      relationship_type: relationshipType,
      strength: strength ? parseInt(strength, 10) : undefined,
    })

    setToId('')
    setStrength('')
    setOpen(false)
    onRelationshipCreated?.()
  }

  // Get available entities based on selected type
  const getAvailableEntities = () => {
    switch (toType) {
      case 'system':
        return getSystems().filter(s => s.id !== fromId)
      case 'model':
        return getModels().filter(m => m.id !== fromId)
      case 'provenance':
        return getProvenance().filter(p => p.id !== fromId)
      default:
        return []
    }
  }

  const availableEntities = getAvailableEntities()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Link to Another Entity</DialogTitle>
          <DialogDescription>
            Create a relationship from "{fromTitle}"
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="to-type">Link to Type</Label>
              <select
                id="to-type"
                value={toType}
                onChange={(e) => {
                  setToType(e.target.value as Relationship['to_type'])
                  setToId('')
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="system">System</option>
                <option value="model">Model</option>
                <option value="provenance">Provenance</option>
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="to-entity">Select Entity *</Label>
              <select
                id="to-entity"
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                required
              >
                <option value="">-- Select {toType} --</option>
                {availableEntities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.title}
                  </option>
                ))}
              </select>
              {availableEntities.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No {toType}s available. Create one first!
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="relationship-type">Relationship Type *</Label>
              <select
                id="relationship-type"
                value={relationshipType}
                onChange={(e) => setRelationshipType(e.target.value as Relationship['relationship_type'])}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                required
              >
                <option value="uses">Uses</option>
                <option value="explains">Explains</option>
                <option value="requires">Requires</option>
                <option value="extends">Extends</option>
                <option value="supports">Supports</option>
                <option value="evidences">Evidences</option>
                <option value="contradicts">Contradicts</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Uses: depends on • Explains: clarifies • Requires: prerequisite •
                Extends: builds upon • Supports: backs up • Evidences: proves •
                Contradicts: conflicts with
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="strength">Strength (1-100, optional)</Label>
              <Input
                id="strength"
                type="number"
                min="1"
                max="100"
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
                placeholder="50"
              />
              <p className="text-xs text-muted-foreground">
                How strong is this relationship? Higher = stronger connection
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!toId}>
              Create Link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
