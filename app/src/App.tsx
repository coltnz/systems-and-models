import { useEffect, useState } from 'react'
import { Home } from './pages/Home'
import { initDatabase } from './lib/db'

function App() {
  const [dbInitialized, setDbInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return <Home />
}

export default App
