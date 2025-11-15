import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateSystemDialog } from '@/components/CreateSystemDialog'
import { CreateModelDialog } from '@/components/CreateModelDialog'
import { getSystems } from '@/lib/db/systems'
import { getModels } from '@/lib/db/models'
import type { System, Model } from '@/types'

export function Home() {
  const [systems, setSystems] = useState<System[]>([])
  const [models, setModels] = useState<Model[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    try {
      const allSystems = getSystems()
      const allModels = getModels()
      setSystems(allSystems)
      setModels(allModels)
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-3xl font-bold">Systems & Models</h1>
          <p className="text-muted-foreground mt-1">
            Track your practical knowledge systematically
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-8 md:grid-cols-2">
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
                  <Card key={system.id} className="hover:shadow-md transition-shadow cursor-pointer">
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
                  <Card key={model.id} className="hover:shadow-md transition-shadow cursor-pointer">
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
