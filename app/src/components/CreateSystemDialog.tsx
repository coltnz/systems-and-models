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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createSystem } from '@/lib/db/systems'
import type { System } from '@/types'

interface CreateSystemDialogProps {
  onSystemCreated?: () => void
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function CreateSystemDialog({ onSystemCreated, children, open: controlledOpen, onOpenChange }: CreateSystemDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    tags: '',
    status: 'draft' as System['status'],
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const tagsArray = formData.tags
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean)

    createSystem({
      title: formData.title,
      description: formData.description,
      content: formData.content,
      tags: tagsArray,
      status: formData.status,
      evidence_links: [],
    })

    setFormData({
      title: '',
      description: '',
      content: '',
      tags: '',
      status: 'draft',
    })

    setOpen(false)
    onSystemCreated?.()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New System</DialogTitle>
          <DialogDescription>
            Add a new system to track your practical knowledge.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault()
            handleSubmit(e as unknown as React.FormEvent)
          }
        }}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Kettlebell Training Program"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief overview of this system..."
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Detailed description, steps, notes..."
                rows={6}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="fitness, strength, beginner"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as System['status'] })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
                <option value="proven">Proven</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create System</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
