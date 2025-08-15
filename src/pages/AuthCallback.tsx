import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSupabase } from '@/lib/supabase'

const AuthCallback = () => {
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    const completeAuth = async () => {
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')
        if (code) {
          // Prefer explicit code exchange for wider SDK compatibility
          await getSupabase().auth.exchangeCodeForSession(code)
        } else {
          // Fallback: let SDK process session in URL or return current session
          await getSupabase().auth.getSession()
        }
      } finally {
        if (!cancelled) navigate('/', { replace: true })
      }
    }

    completeAuth()
    return () => {
      cancelled = true
    }
  }, [navigate])

  return (
    <div className="container mx-auto py-10 text-center">
      <p className="text-sm text-muted-foreground">Completing sign-in...</p>
    </div>
  )
}

export default AuthCallback


