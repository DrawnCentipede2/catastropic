import { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import { getSupabase, signInWithProvider, signOut } from '@/lib/supabase'
import { userApi, type MCPUser } from '@/services/api'

// Minimal user type to avoid dependency on @supabase/supabase-js types during tooling/version churn
type SupabaseAuthUser = { id: string } & Record<string, unknown>

interface AuthState {
  user: SupabaseAuthUser | null
  profile: MCPUser | null
  loading: boolean // initial auth check (not tied to button state)
  isLoggingIn: boolean // specifically for the sign-in button state
  error: string | null
}

type AuthContextValue = {
  user: AuthState['user']
  profile: AuthState['profile']
  loading: boolean
  isLoggingIn: boolean
  error: string | null
  isAuthenticated: boolean
  isAdmin: boolean
  login: (provider?: 'github' | 'google') => Promise<void>
  logout: () => Promise<void>
  refreshProfile: () => Promise<MCPUser | null>
  updateProfileInState: (updates: Partial<MCPUser>) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    isLoggingIn: false,
    error: null
  })
  const [version, setVersion] = useState(0)

  // Function to refresh user profile data
  const refreshProfile = async () => {
    if (!state.user) {
      console.warn('Cannot refresh profile: no user logged in')
      return null
    }

    try {
      const updatedProfile = await userApi.getOrCreateUser(state.user)
      setState(prev => ({
        ...prev,
        profile: updatedProfile,
        error: null
      }))
      return updatedProfile
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Profile refresh error'
      console.error('Failed to refresh profile:', errorMessage)
      setState(prev => ({
        ...prev,
        error: errorMessage
      }))
      throw error
    }
  }

  // Function to update profile in state without API call (optimistic update)
  const updateProfileInState = (updates: Partial<MCPUser>) => {
    setState(prev => ({
      ...prev,
      profile: prev.profile ? { ...prev.profile, ...updates } : null
    }))
  }

  useEffect(() => {
    let mounted = true

    // Get initial session (more reliable than getUser for restore-on-reload)
    const getInitialSession = async () => {
      try {
        // Startup marker
        const { data: { session }, error: sessionErr } = await getSupabase().auth.getSession()
        if (sessionErr) console.error('[auth] getSession error', sessionErr)
        console.debug('[auth] session', { hasSession: !!session })
        const user = (session?.user as unknown as SupabaseAuthUser | null) ?? null
        if (user && mounted) {
          // Set authenticated immediately to avoid UI waiting on profile
          setState(prev => ({ ...prev, user, loading: false, isLoggingIn: false, error: null }))
          setVersion(v => v + 1)
          ;(async () => {
            try {
              const profile = await userApi.getOrCreateUser(user)
              if (!mounted) return
              setState(prev => ({ ...prev, profile }))
              setVersion(v => v + 1)
            } catch (e) {
              console.error('[auth] profile fetch failed after getSession', e)
              if (!mounted) return
              setVersion(v => v + 1)
            }
          })()
        } else if (mounted) {
          setState({
            user: null,
            profile: null,
            loading: false,
            isLoggingIn: false,
            error: null
          })
          setVersion(v => v + 1)
        }
      } catch (error) {
        if (mounted) {
          setState({
            user: null,
            profile: null,
            loading: false,
            isLoggingIn: false,
            error: error instanceof Error ? error.message : 'Authentication error'
          })
        }
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = getSupabase().auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        console.debug('[auth] event', { event, hasSession: !!session })

        // Handle initial session to avoid flicker after reload
        if (event === 'INITIAL_SESSION') {
          const user = (session?.user as unknown as SupabaseAuthUser | null) ?? null
          if (user) {
            // Immediate auth state
            setState(prev => ({ ...prev, user, loading: false, isLoggingIn: false, error: null }))
            setVersion(v => v + 1)
            // Fetch profile in background
            ;(async () => {
              try {
                const profile = await userApi.getOrCreateUser(user)
                setState(prev => ({ ...prev, profile }))
                setVersion(v => v + 1)
              } catch (error) {
                console.error('[auth] profile fetch failed on INITIAL_SESSION', error)
                setVersion(v => v + 1)
              }
            })()
          } else {
            setState({ user: null, profile: null, loading: false, isLoggingIn: false, error: null })
            setVersion(v => v + 1)
          }
          // initial session handled
          return
        }

        if (event === 'SIGNED_IN' && session?.user) {
          const user = session.user as unknown as SupabaseAuthUser
          // Immediate auth state
          setState(prev => ({ ...prev, user, loading: false, isLoggingIn: false, error: null }))
          setVersion(v => v + 1)
          // Fetch profile in background
          ;(async () => {
            try {
              const profile = await userApi.getOrCreateUser(user)
              setState(prev => ({ ...prev, profile }))
              setVersion(v => v + 1)
            } catch (error) {
              console.error('[auth] profile fetch failed on SIGNED_IN', error)
              setVersion(v => v + 1)
            }
          })()
        } else if (event === 'SIGNED_OUT') {
          console.log('[auth] signed out event')
          setState({
            user: null,
            profile: null,
            loading: false,
            isLoggingIn: false,
            error: null
          })
          setVersion(v => v + 1)
        }
      }
    )

    return () => {
      mounted = false
      console.log('[auth] unsubscribe auth listener')
      subscription.unsubscribe()
    }
  }, [])

  const login = async (provider: 'github' | 'google' = 'github') => {
    try {
      setState(prev => ({ ...prev, isLoggingIn: true, error: null }))
      await signInWithProvider(provider)
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoggingIn: false,
        error: error instanceof Error ? error.message : 'Login failed'
      }))
    }
  }

  const logout = async () => {
    try {
      await signOut()
      setState({
        user: null,
        profile: null,
        loading: false,
        isLoggingIn: false,
        error: null
      })
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Logout failed'
      }))
    }
  }

  const value: AuthContextValue = {
    user: state.user,
    profile: state.profile,
    loading: state.loading,
    isLoggingIn: state.isLoggingIn,
    error: state.error,
    isAuthenticated: !!state.user,
    isAdmin: state.profile?.is_admin || false,
    login,
    logout,
    refreshProfile,
    updateProfileInState,
  }

  // Force new reference each render and carry a version to help debug updates
  const provided = { ...value, _v: version } as any
  console.debug('[auth] provide', { _v: version, isAuthenticated: provided.isAuthenticated, loading: provided.loading })
  return <AuthContext.Provider value={provided}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext)
  if (ctx) return ctx
  // Fallback to prevent crashes if a consumer renders before provider mounts (e.g., HMR or load order)
  console.warn('[auth] useAuth called outside <AuthProvider>; returning fallback')
  return {
    user: null,
    profile: null,
    loading: true,
    isLoggingIn: false,
    error: null,
    isAuthenticated: false,
    isAdmin: false,
    login: async () => console.warn('[auth] login called without provider'),
    logout: async () => console.warn('[auth] logout called without provider'),
    refreshProfile: async () => {
      console.warn('[auth] refreshProfile called without provider')
      return null
    },
    updateProfileInState: () => console.warn('[auth] updateProfileInState called without provider'),
  }
}


