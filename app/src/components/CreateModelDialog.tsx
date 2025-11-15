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
import { createModel } from '@/lib/db/models'
import type { Model } from '@/types'

interface CreateModelDialogProps {
  onModelCreated?: () => void
  children?: React.ReactNode
}

export function CreateModelDialog({ onModelCreated, children }: CreateModelDialogProps) {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    tags: '',
    type: 'concept' as Model['type'],
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const tagsArray = formData.tags
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean)

    createModel({
      title: formData.title,
      description: formData.description,
      content: formData.content,
      tags: tagsArray,
      type: formData.type,
    })

    setFormData({
      title: '',
      description: '',
      content: '',
      tags: '',
      type: 'concept',
    })

    setOpen(false)
    onModelCreated?.()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Model</DialogTitle>
          <DialogDescription>
            Add a new mental model or concept to your knowledge base.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Progressive Overload"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief overview of this model..."
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Detailed explanation of this concept or model..."
                rows={6}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="fitness, learning, psychology"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as Model['type'] })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="mental-model">Mental Model</option>
                <option value="concept">Concept</option>
                <option value="framework">Framework</option>
                <option value="principle">Principle</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Model</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
