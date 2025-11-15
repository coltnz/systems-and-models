export type ZoomLevel = 1 | 2 | 3 | 4

/**
 * Generate dynamic Cytoscape stylesheet based on zoom level
 * Level 1: Overview - minimal detail
 * Level 2: Titles only
 * Level 3: Titles + type badges
 * Level 4: Full detail with descriptions
 */
export function getGraphStylesheet(level: ZoomLevel): any[] {
  // Base configuration that changes with zoom level
  const config = {
    1: { nodeSize: 40, fontSize: 8, labelField: 'shortLabel', edgeFontSize: 0, showEdgeLabel: false },
    2: { nodeSize: 60, fontSize: 11, labelField: 'label', edgeFontSize: 9, showEdgeLabel: true },
    3: { nodeSize: 60, fontSize: 12, labelField: 'label', edgeFontSize: 10, showEdgeLabel: true },
    4: { nodeSize: 90, fontSize: 14, labelField: 'label', edgeFontSize: 11, showEdgeLabel: true }
  }[level]

  return [
    // System nodes (blue)
    {
      selector: 'node[type="system"]',
      style: {
        'background-color': '#3b82f6',
        'label': level >= 4
          ? (ele: any) => `${ele.data('label')}\n${(ele.data('description') || '').substring(0, 50)}${ele.data('description')?.length > 50 ? '...' : ''}`
          : level >= 3
          ? (ele: any) => `${ele.data('label')}\n[${ele.data('status')}]`
          : `data(${config.labelField})`,
        'color': '#ffffff',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': `${config.fontSize}px`,
        'width': `${config.nodeSize}px`,
        'height': `${config.nodeSize}px`,
        'border-width': '2px',
        'border-color': '#1e40af',
        'text-wrap': level >= 3 ? 'wrap' : 'none',
        'text-max-width': level >= 4 ? '120px' : '80px'
      }
    },
    // Model nodes (purple)
    {
      selector: 'node[type="model"]',
      style: {
        'background-color': '#a855f7',
        'label': level >= 4
          ? (ele: any) => `${ele.data('label')}\n${(ele.data('description') || '').substring(0, 50)}${ele.data('description')?.length > 50 ? '...' : ''}`
          : level >= 3
          ? (ele: any) => `${ele.data('label')}\n[${ele.data('modelType')}]`
          : `data(${config.labelField})`,
        'color': '#ffffff',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': `${config.fontSize}px`,
        'width': `${config.nodeSize}px`,
        'height': `${config.nodeSize}px`,
        'border-width': '2px',
        'border-color': '#7e22ce',
        'text-wrap': level >= 3 ? 'wrap' : 'none',
        'text-max-width': level >= 4 ? '120px' : '80px'
      }
    },
    // Provenance nodes (amber/yellow)
    {
      selector: 'node[type="provenance"]',
      style: {
        'background-color': '#f59e0b',
        'label': level >= 4
          ? (ele: any) => `${ele.data('label')}\n${(ele.data('description') || '').substring(0, 50)}${ele.data('description')?.length > 50 ? '...' : ''}`
          : level >= 3
          ? (ele: any) => `${ele.data('label')}\n[${ele.data('provType')}]`
          : `data(${config.labelField})`,
        'color': '#ffffff',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': `${config.fontSize}px`,
        'width': `${config.nodeSize}px`,
        'height': `${config.nodeSize}px`,
        'border-width': '2px',
        'border-color': '#d97706',
        'text-wrap': level >= 3 ? 'wrap' : 'none',
        'text-max-width': level >= 4 ? '120px' : '80px'
      }
    },
    // Edges
    {
      selector: 'edge',
      style: {
        'width': level === 1 ? 1 : 2,
        'line-color': '#94a3b8',
        'target-arrow-color': '#94a3b8',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'label': config.showEdgeLabel ? 'data(label)' : '',
        'font-size': `${config.edgeFontSize}px`,
        'text-rotation': 'autorotate',
        'text-margin-y': -10,
        'opacity': level === 1 ? 0.4 : 0.7
      }
    },
    // Selected node
    {
      selector: ':selected',
      style: {
        'border-width': '4px',
        'border-color': '#22c55e'
      }
    },
    // Matched nodes (search results)
    {
      selector: '.matched',
      style: {
        'border-width': '4px',
        'border-color': '#eab308',
        'box-shadow': '0 0 15px #eab308'
      }
    },
    // Dimmed nodes (non-matches during search)
    {
      selector: '.dimmed',
      style: {
        'opacity': 0.3
      }
    }
  ]
}

/**
 * Calculate semantic zoom level from zoom value
 */
export function calculateZoomLevel(zoom: number): ZoomLevel {
  if (zoom < 0.6) return 1 // Far out: minimal detail
  if (zoom < 1.0) return 2 // Medium: titles only
  if (zoom < 1.8) return 3 // Close: titles + type badges (default)
  return 4 // Very close: full detail with descriptions
}
