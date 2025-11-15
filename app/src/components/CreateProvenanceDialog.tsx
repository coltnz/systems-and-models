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
import { createProvenance } from '@/lib/db/provenance'
import type { Provenance } from '@/types'

interface CreateProvenanceDialogProps {
  onProvenanceCreated?: () => void
  children?: React.ReactNode
}

export function CreateProvenanceDialog({ onProvenanceCreated, children }: CreateProvenanceDialogProps) {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    source: '',
    source_url: '',
    credibility_score: '',
    tags: '',
    type: 'fact' as Provenance['type'],
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const tagsArray = formData.tags
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean)

    const credibilityScore = formData.credibility_score
      ? parseInt(formData.credibility_score, 10)
      : undefined

    createProvenance({
      title: formData.title,
      description: formData.description,
      content: formData.content,
      source: formData.source,
      source_url: formData.source_url || undefined,
      credibility_score: credibilityScore,
      tags: tagsArray,
      type: formData.type,
    })

    setFormData({
      title: '',
      description: '',
      content: '',
      source: '',
      source_url: '',
      credibility_score: '',
      tags: '',
      type: 'fact',
    })

    setOpen(false)
    onProvenanceCreated?.()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Provenance (Why)</DialogTitle>
          <DialogDescription>
            Add evidence, theory, quote, or principle to support your knowledge.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="type">Provenance Type *</Label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as Provenance['type'] })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                required
              >
                <option value="theory">Theory</option>
                <option value="quote">Quote</option>
                <option value="fact">Fact</option>
                <option value="principle">Principle</option>
                <option value="corollary">Corollary</option>
                <option value="research">Research</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Theory: Explanatory framework • Quote: Direct citation • Fact: Historical/empirical data •
                Principle: Fundamental truth • Corollary: Derived conclusion • Research: Study findings
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., General Adaptation Syndrome"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="source">Source *</Label>
              <Input
                id="source"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                placeholder="e.g., Hans Selye, 1936"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="source_url">Source URL (optional)</Label>
              <Input
                id="source_url"
                type="url"
                value={formData.source_url}
                onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
                placeholder="https://..."
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief summary..."
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Full explanation, quote, or evidence..."
                rows={6}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="credibility_score">Credibility Score (0-100, optional)</Label>
              <Input
                id="credibility_score"
                type="number"
                min="0"
                max="100"
                value={formData.credibility_score}
                onChange={(e) => setFormData({ ...formData, credibility_score: e.target.value })}
                placeholder="75"
              />
              <p className="text-xs text-muted-foreground">
                How reliable is this source? 100 = peer-reviewed science, 50 = anecdotal
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="biology, stress, adaptation"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Provenance</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
