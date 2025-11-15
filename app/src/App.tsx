import { useEffect, useState } from 'react'
import { Home } from './pages/Home'
import { Graph } from './pages/Graph'
import { Button } from './components/ui/button'
import { List, Network } from 'lucide-react'
import { initDatabase } from './lib/db'

type View = 'home' | 'graph'

function App() {
  const [dbInitialized, setDbInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<View>('home')

  useEffect(() => {
    initDatabase()
      .then(() => {
        setDbInitialized(true)
        console.log('Database initialized successfully')
      })
      .catch((err) => {
        console.error('Failed to initialize database:', err)
        setError('Failed to initialize database')
      })
  }, [])

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Error</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (!dbInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Initializing database...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <nav className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex gap-2">
          <Button
            variant={currentView === 'home' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentView('home')}
          >
            <List className="w-4 h-4 mr-2" />
            List View
          </Button>
          <Button
            variant={currentView === 'graph' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentView('graph')}
          >
            <Network className="w-4 h-4 mr-2" />
            Graph View
          </Button>
        </div>
      </nav>

      {/* Content */}
      {currentView === 'home' && <Home />}
      {currentView === 'graph' && <Graph />}
    </div>
  )
}

export default App
