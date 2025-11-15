import { useEffect, useState, useRef } from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import Cytoscape from 'cytoscape'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { getSystems } from '@/lib/db/systems'
import { getModels } from '@/lib/db/models'
import { getProvenance } from '@/lib/db/provenance'
import { getRelationships } from '@/lib/db/relationships'
import type { System, Model, Provenance, Relationship } from '@/types'

export function Graph() {
  const [systems, setSystems] = useState<System[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [provenance, setProvenance] = useState<Provenance[]>([])
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [selectedNode, setSelectedNode] = useState<{ type: string; data: System | Model | Provenance } | null>(null)
  const cyRef = useRef<Cytoscape.Core | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    try {
      setSystems(getSystems())
      setModels(getModels())
      setProvenance(getProvenance())
      setRelationships(getRelationships())
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  // Build Cytoscape elements
  const elements: Cytoscape.ElementDefinition[] = [
    // System nodes
    ...systems.map(system => ({
      data: {
        id: system.id,
        label: system.title,
        type: 'system',
        status: system.status,
        fullData: system
      }
    })),
    // Model nodes
    ...models.map(model => ({
      data: {
        id: model.id,
        label: model.title,
        type: 'model',
        modelType: model.type,
        fullData: model
      }
    })),
    // Provenance nodes
    ...provenance.map(prov => ({
      data: {
        id: prov.id,
        label: prov.title,
        type: 'provenance',
        provType: prov.type,
        fullData: prov
      }
    })),
    // Relationship edges
    ...relationships.map(rel => ({
      data: {
        id: rel.id,
        source: rel.from_id,
        target: rel.to_id,
        label: rel.relationship_type,
        relationshipType: rel.relationship_type,
        strength: rel.strength
      }
    }))
  ]

  // Cytoscape stylesheet
  const stylesheet: Cytoscape.Stylesheet[] = [
    // System nodes (blue)
    {
      selector: 'node[type="system"]',
      style: {
        'background-color': '#3b82f6',
        'label': 'data(label)',
        'color': '#ffffff',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': '12px',
        'width': '60px',
        'height': '60px',
        'border-width': '2px',
        'border-color': '#1e40af'
      }
    },
    // Model nodes (purple)
    {
      selector: 'node[type="model"]',
      style: {
        'background-color': '#a855f7',
        'label': 'data(label)',
        'color': '#ffffff',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': '12px',
        'width': '60px',
        'height': '60px',
        'border-width': '2px',
        'border-color': '#7e22ce'
      }
    },
    // Provenance nodes (amber/yellow)
    {
      selector: 'node[type="provenance"]',
      style: {
        'background-color': '#f59e0b',
        'label': 'data(label)',
        'color': '#ffffff',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': '12px',
        'width': '60px',
        'height': '60px',
        'border-width': '2px',
        'border-color': '#d97706'
      }
    },
    // Edges
    {
      selector: 'edge',
      style: {
        'width': 2,
        'line-color': '#94a3b8',
        'target-arrow-color': '#94a3b8',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'label': 'data(label)',
        'font-size': '10px',
        'text-rotation': 'autorotate',
        'text-margin-y': -10
      }
    },
    // Selected node
    {
      selector: ':selected',
      style: {
        'border-width': '4px',
        'border-color': '#22c55e'
      }
    }
  ]

  // Layout configuration
  const layout = {
    name: 'cose',
    animate: true,
    animationDuration: 500,
    idealEdgeLength: 100,
    nodeOverlap: 20,
    refresh: 20,
    fit: true,
    padding: 30,
    randomize: false,
    componentSpacing: 100,
    nodeRepulsion: 400000,
    edgeElasticity: 100,
    nestingFactor: 5,
    gravity: 80,
    numIter: 1000,
    initialTemp: 200,
    coolingFactor: 0.95,
    minTemp: 1.0
  }

  const handleNodeTap = (event: Cytoscape.EventObject) => {
    const node = event.target
    const nodeData = node.data()

    setSelectedNode({
      type: nodeData.type,
      data: nodeData.fullData
    })
  }

  const handleZoomIn = () => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() * 1.2)
      cyRef.current.center()
    }
  }

  const handleZoomOut = () => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() * 0.8)
      cyRef.current.center()
    }
  }

  const handleFit = () => {
    if (cyRef.current) {
      cyRef.current.fit()
    }
  }

  const totalNodes = systems.length + models.length + provenance.length

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-3xl font-bold">Knowledge Graph</h1>
          <p className="text-muted-foreground mt-1">
            Visual representation of systems, models, and provenance
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* Graph Canvas */}
          <div className="relative">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Graph View</CardTitle>
                    <CardDescription>
                      {totalNodes} nodes, {relationships.length} relationships
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={handleZoomIn}>
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleZoomOut}>
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleFit}>
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {totalNodes === 0 ? (
                  <div className="flex items-center justify-center h-[600px] text-muted-foreground">
                    <p>No nodes to display. Create some systems, models, or provenance first!</p>
                  </div>
                ) : (
                  <CytoscapeComponent
                    elements={elements}
                    stylesheet={stylesheet}
                    layout={layout}
                    style={{ width: '100%', height: '600px' }}
                    cy={(cy) => {
                      cyRef.current = cy
                      cy.on('tap', 'node', handleNodeTap)
                    }}
                  />
                )}
              </CardContent>
            </Card>

            {/* Legend */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm">Legend</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-blue-700"></div>
                  <span className="text-sm">Systems (what to do)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-purple-500 border-2 border-purple-700"></div>
                  <span className="text-sm">Models (what to know)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-amber-500 border-2 border-amber-700"></div>
                  <span className="text-sm">Provenance (why)</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detail Panel */}
          <div>
            {selectedNode ? (
              <Card>
                <CardHeader>
                  <CardTitle>{selectedNode.data.title}</CardTitle>
                  <CardDescription>
                    {selectedNode.type === 'system' && `System • ${(selectedNode.data as System).status}`}
                    {selectedNode.type === 'model' && `Model • ${(selectedNode.data as Model).type}`}
                    {selectedNode.type === 'provenance' && `Provenance • ${(selectedNode.data as Provenance).type}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Description</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedNode.data.description || 'No description'}
                    </p>
                  </div>

                  {selectedNode.type === 'provenance' && (
                    <div>
                      <h4 className="font-semibold text-sm mb-1">Source</h4>
                      <p className="text-sm text-muted-foreground">
                        {(selectedNode.data as Provenance).source}
                      </p>
                      {(selectedNode.data as Provenance).source_url && (
                        <a
                          href={(selectedNode.data as Provenance).source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-500 hover:underline"
                        >
                          View source
                        </a>
                      )}
                    </div>
                  )}

                  <div>
                    <h4 className="font-semibold text-sm mb-1">Tags</h4>
                    <div className="flex gap-1 flex-wrap">
                      {selectedNode.data.tags.map((tag: string) => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {selectedNode.data.content && (
                    <div>
                      <h4 className="font-semibold text-sm mb-1">Content</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {selectedNode.data.content.substring(0, 300)}
                        {selectedNode.data.content.length > 300 && '...'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground text-sm">
                    Click a node to see details
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
