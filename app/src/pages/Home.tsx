import { useEffect, useState, useMemo, useCallback } from 'react'
import { Plus, Link2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateSystemDialog } from '@/components/CreateSystemDialog'
import { CreateModelDialog } from '@/components/CreateModelDialog'
import { CreateProvenanceDialog } from '@/components/CreateProvenanceDialog'
import { LinkEntityDialog } from '@/components/LinkEntityDialog'
import { ImportDataDialog } from '@/components/ImportDataDialog'
import { SharePermalinkButton } from '@/components/SharePermalinkButton'
import { getSystems } from '@/lib/db/systems'
import { getModels } from '@/lib/db/models'
import { getProvenance } from '@/lib/db/provenance'
import { searchEntities } from '@/lib/search'
import type { System, Model, Provenance } from '@/types'

export function Home() {
  const [allSystems, setAllSystems] = useState<System[]>([])
  const [allModels, setAllModels] = useState<Model[]>([])
  const [allProvenance, setAllProvenance] = useState<Provenance[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  const loadData = useCallback(() => {
    try {
      setAllSystems(getSystems())
      setAllModels(getModels())
      setAllProvenance(getProvenance())
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Memoize filtered entities - only recompute when data or search changes
  const filteredEntities = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length === 0) {
      return {
        systems: allSystems,
        models: allModels,
        provenance: allProvenance
      }
    }

    const results = searchEntities(searchQuery, allSystems, allModels, allProvenance)
    const matchingIds = new Set(results.map(r => r.entity.id))

    return {
      systems: allSystems.filter(s => matchingIds.has(s.id)),
      models: allModels.filter(m => matchingIds.has(m.id)),
      provenance: allProvenance.filter(p => matchingIds.has(p.id))
    }
  }, [searchQuery, allSystems, allModels, allProvenance])

  const { systems, models, provenance } = filteredEntities
  const totalResults = useMemo(() => systems.length + models.length + provenance.length, [systems, models, provenance])
  const isSearching = searchQuery.trim().length > 0

  return (
    <div>
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">Systems & Models</h1>
              <p className="text-muted-foreground mt-1">
                Knowledge for the AI future: What to do (systems), what to know (models), and why (provenance)
              </p>
            </div>
            <ImportDataDialog onDataImported={loadData} />
          </div>

          {/* Search Bar */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search systems, models, and provenance..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground">
                {totalResults} result{totalResults !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Systems Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">Systems</h2>
              <CreateSystemDialog onSystemCreated={loadData}>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  New System
                </Button>
              </CreateSystemDialog>
            </div>

            <div className="space-y-4">
              {systems.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">
                      No systems yet. Create your first system to get started!
                    </p>
                  </CardContent>
                </Card>
              ) : (
                systems.map((system) => (
                  <Card key={system.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg">{system.title}</CardTitle>
                      <CardDescription>{system.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2 flex-wrap">
                        {system.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded"
                          >
                            {tag}
                          </span>
                        ))}
                        <span
                          className={`px-2 py-1 text-xs rounded ${
                            system.status === 'active'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : system.status === 'proven'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                          }`}
                        >
                          {system.status}
                        </span>
                      </div>
                    </CardContent>
                    <CardFooter className="gap-2">
                      <SharePermalinkButton
                        type="system"
                        id={system.id}
                        onShare={true}
                        className="flex-1"
                      />
                      <LinkEntityDialog
                        fromType="system"
                        fromId={system.id}
                        fromTitle={system.title}
                        onRelationshipCreated={loadData}
                      >
                        <Button variant="outline" size="sm" className="flex-1">
                          <Link2 className="w-3 h-3 mr-2" />
                          Link
                        </Button>
                      </LinkEntityDialog>
                    </CardFooter>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Models Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">Models</h2>
              <CreateModelDialog onModelCreated={loadData}>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  New Model
                </Button>
              </CreateModelDialog>
            </div>

            <div className="space-y-4">
              {models.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">
                      No models yet. Create your first model to get started!
                    </p>
                  </CardContent>
                </Card>
              ) : (
                models.map((model) => (
                  <Card key={model.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg">{model.title}</CardTitle>
                      <CardDescription>{model.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2 flex-wrap">
                        {model.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded"
                          >
                            {tag}
                          </span>
                        ))}
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs rounded">
                          {model.type}
                        </span>
                      </div>
                    </CardContent>
                    <CardFooter className="gap-2">
                      <SharePermalinkButton
                        type="model"
                        id={model.id}
                        onShare={true}
                        className="flex-1"
                      />
                      <LinkEntityDialog
                        fromType="model"
                        fromId={model.id}
                        fromTitle={model.title}
                        onRelationshipCreated={loadData}
                      >
                        <Button variant="outline" size="sm" className="flex-1">
                          <Link2 className="w-3 h-3 mr-2" />
                          Link
                        </Button>
                      </LinkEntityDialog>
                    </CardFooter>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Provenance Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">Provenance</h2>
              <CreateProvenanceDialog onProvenanceCreated={loadData}>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Why
                </Button>
              </CreateProvenanceDialog>
            </div>

            <div className="space-y-4">
              {provenance.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">
                      No provenance yet. Add evidence, theories, or quotes!
                    </p>
                  </CardContent>
                </Card>
              ) : (
                provenance.map((prov) => (
                  <Card key={prov.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg">{prov.title}</CardTitle>
                      <CardDescription>{prov.source}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2 flex-wrap">
                        {prov.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded"
                          >
                            {tag}
                          </span>
                        ))}
                        <span className="px-2 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs rounded">
                          {prov.type}
                        </span>
                        {prov.credibility_score && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs rounded">
                            {prov.credibility_score}% credible
                          </span>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter className="gap-2">
                      <SharePermalinkButton
                        type="provenance"
                        id={prov.id}
                        onShare={true}
                        className="flex-1"
                      />
                      <LinkEntityDialog
                        fromType="provenance"
                        fromId={prov.id}
                        fromTitle={prov.title}
                        onRelationshipCreated={loadData}
                      >
                        <Button variant="outline" size="sm" className="flex-1">
                          <Link2 className="w-3 h-3 mr-2" />
                          Link
                        </Button>
                      </LinkEntityDialog>
                    </CardFooter>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
