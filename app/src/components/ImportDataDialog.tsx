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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { importKnowledgeGraphData, validateYAMLData, type ImportResult } from '@/lib/import-data'
import { Upload, CheckCircle2, AlertCircle } from 'lucide-react'
import YAML from 'yaml'

interface ImportDataDialogProps {
  onDataImported?: () => void
  children?: React.ReactNode
}

export function ImportDataDialog({ onDataImported, children }: ImportDataDialogProps) {
  const [open, setOpen] = useState(false)
  const [yamlText, setYamlText] = useState('')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [isImporting, setIsImporting] = useState(false)

  const handleImport = async () => {
    setIsImporting(true)
    setImportResult(null)
    setValidationErrors([])

    try {
      // Parse YAML
      const data = YAML.parse(yamlText)

      // Validate structure
      const validation = validateYAMLData(data)
      if (!validation.valid) {
        setValidationErrors(validation.errors)
        setIsImporting(false)
        return
      }

      // Import data
      const result = importKnowledgeGraphData(data)
      setImportResult(result)

      if (result.success && result.errors.length === 0) {
        // Success - close dialog after short delay
        setTimeout(() => {
          setOpen(false)
          setYamlText('')
          setImportResult(null)
          onDataImported?.()
        }, 2000)
      }
    } catch (error) {
      setValidationErrors([`Failed to parse YAML: ${error}`])
    } finally {
      setIsImporting(false)
    }
  }

  const handleLoadSample = async () => {
    try {
      const response = await fetch('/data/sample-knowledge-base.yaml')
      const text = await response.text()
      setYamlText(text)
    } catch (error) {
      setValidationErrors([`Failed to load sample data: ${error}`])
    }
  }

  const handleReset = () => {
    setYamlText('')
    setImportResult(null)
    setValidationErrors([])
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline">
            <Upload className="w-4 h-4 mr-2" />
            Import Data
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Knowledge Graph Data</DialogTitle>
          <DialogDescription>
            Paste YAML data below or load sample data to import systems, models, and provenance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <Button onClick={handleLoadSample} variant="outline" size="sm">
              Load Sample Data
            </Button>
            <Button onClick={handleReset} variant="outline" size="sm">
              Clear
            </Button>
          </div>

          <div>
            <Label htmlFor="yaml-input">YAML Data</Label>
            <Textarea
              id="yaml-input"
              value={yamlText}
              onChange={(e) => setYamlText(e.target.value)}
              placeholder={`version: "1.0"
metadata:
  created: 2025-01-17

systems:
  - id: my-system
    title: "My System"
    description: "Example system"
    status: active
    tags: [example]
    content: "System steps..."

models:
  - id: my-model
    title: "My Model"
    ...`}
              rows={15}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">
              See <code>/data/schema.md</code> for format documentation
            </p>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive rounded-md p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-sm mb-2">Validation Errors</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {validationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <div className={`border rounded-md p-4 ${
              importResult.success && importResult.errors.length === 0
                ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800'
            }`}>
              <div className="flex items-start gap-2">
                <CheckCircle2 className={`h-5 w-5 mt-0.5 ${
                  importResult.success && importResult.errors.length === 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-yellow-600 dark:text-yellow-400'
                }`} />
                <div className="flex-1">
                  <h4 className="font-semibold text-sm mb-2">Import Complete</h4>
                  <div className="text-sm space-y-1">
                    <p>✓ {importResult.systemsImported} systems imported</p>
                    <p>✓ {importResult.modelsImported} models imported</p>
                    <p>✓ {importResult.provenanceImported} provenance items imported</p>
                    <p>✓ {importResult.relationshipsImported} relationships created</p>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="mt-3">
                      <p className="font-semibold text-sm mb-1">Warnings:</p>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        {importResult.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!yamlText.trim() || isImporting}
          >
            {isImporting ? 'Importing...' : 'Import Data'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
