import { createRoot } from 'react-dom/client'
import './index.css'
import { AuthProvider } from '@/hooks/useAuth'

// Log before importing App so we see env even if a dependency throws

;(async () => {
  const { default: App } = await import('./App.tsx')
  createRoot(document.getElementById('root')!).render(
    <AuthProvider>
      <App />
    </AuthProvider>
  )
})()
