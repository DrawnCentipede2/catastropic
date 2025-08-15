import { createClient, type SupabaseClient } from '@supabase/supabase-js'


let supabaseInstance: SupabaseClient<Database> | null = null

let supabaseAdminInstance: SupabaseClient<Database> | null = null

let supabaseAnonInstance: SupabaseClient<Database> | null = null

export const getSupabase = (): SupabaseClient<Database> => {
  if (supabaseInstance) return supabaseInstance

  // Simplest dual-source env: prefer Vite in browser, fall back to process.env in Node/tsx
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      `Missing Supabase environment variables.
      Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.
      When running in the browser, define them in .env.local (Vite).
      When running under Node/tsx, pass them via --env-file or process.env.`
    )
  }

  // Derive a stable storage key for auth session based on project ref
  // Example URL: https://hilvfxdxmefooodneicl.supabase.co → storageKey: sb-hilvfxdxmefooodneicl-auth-token
  let storageKey = 'sb-auth-token'
  try {
    const host = new URL(supabaseUrl).hostname
    const projectRef = host.split('.')[0]
    if (projectRef) storageKey = `sb-${projectRef}-auth-token`
  } catch {}

  // Client initialized

  supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      storageKey,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  })

  return supabaseInstance
}

// Admin client for Node/CLI scripts only. Requires SUPABASE_SERVICE_ROLE_KEY in process.env
export const getSupabaseAdmin = (): SupabaseClient<Database> => {
  if (supabaseAdminInstance) return supabaseAdminInstance
  const isNode = typeof window === 'undefined'
  if (!isNode) {
    throw new Error('getSupabaseAdmin() must only be used in Node/CLI scripts')
  }
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or URL in process.env for admin client')
  }
  supabaseAdminInstance = createClient<Database>(url, serviceKey)
  return supabaseAdminInstance
}

// Public client that NEVER attaches a user Authorization header.
// Use this for fetching publicly readable data regardless of auth state.
export const getSupabaseAnon = (): SupabaseClient<Database> => {
  if (supabaseAnonInstance) return supabaseAnonInstance

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables for anon client')
  }

  // Provide a no-op storage to ensure no session is read or written
  const nullStorage = {
    getItem: (_key: string) => null,
    setItem: (_key: string, _value: string) => {},
    removeItem: (_key: string) => {},
  }

  supabaseAnonInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: nullStorage as any,
      storageKey: 'sb-public',
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  // Anon client initialized

  return supabaseAnonInstance
}

// Auth helper functions
type OAuthProvider = 'github' | 'google'

export const signInWithProvider = async (provider: OAuthProvider = 'github') => {
  const { data, error } = await getSupabase().auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  })
  if (error) throw error
  return data
}

// Backward-compatible helper
export const signInWithGitHub = async () => signInWithProvider('github')

export const signOut = async () => {
  // Use local-only sign out to avoid GoTrue 403 on global logout in some providers.
  // This clears client session without calling the logout endpoint.
  try {
    await getSupabase().auth.signOut({ scope: 'local' as const })
  } catch {}
  // Best-effort: also remove stored session manually.
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    if (supabaseUrl) {
      const host = new URL(supabaseUrl).hostname
      const projectRef = host.split('.')[0]
      const storageKey = projectRef ? `sb-${projectRef}-auth-token` : 'sb-auth-token'
      localStorage.removeItem(storageKey)
    }
  } catch {}
}

export const getCurrentUser = async () => {
  const { data: { user }, error } = await getSupabase().auth.getUser()
  if (error) throw error
  return user
}

// Database types
export interface Database {
  public: {
    Tables: {
      mcp_categories: {
        Row: {
          id: string
          name: string
          description: string | null
          icon: string | null
          slug: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          icon?: string | null
          slug: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          icon?: string | null
          slug?: string
          created_at?: string
          updated_at?: string
        }
      }
      mcp_servers: {
        Row: {
          id: string
          name: string
          description: string | null
          repository_url: string
          website_url: string | null
          maintainer_name: string | null
          maintainer_url: string | null
          maintainer_avatar_url: string | null
          maintainer_followers: number | null
          contributors_count: number | null
          top_contributors: any | null
          license: string | null
          readme_overview: string | null
          readme_html_preview: string | null
          readme_html: string | null
          readme_last_fetched_at: string | null
          readme_url: string | null
          npm_package: string | null
          install_command: string | null
          github_stars: number
          npm_downloads: number
          average_rating: number
          total_reviews: number
          is_verified: boolean
          is_official: boolean
          is_trending: boolean
          compatibility_info: any
          media: any[]
          tags: string[]
          status: string
          submitted_by: string | null
          author: string
          votes: number
          views_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          repository_url: string
          website_url?: string | null
          maintainer_name?: string | null
          maintainer_url?: string | null
          maintainer_avatar_url?: string | null
          maintainer_followers?: number | null
          contributors_count?: number | null
          top_contributors?: any | null
          license?: string | null
          readme_overview?: string | null
          readme_html_preview?: string | null
          readme_html?: string | null
          readme_last_fetched_at?: string | null
          readme_url?: string | null
          npm_package?: string | null
          install_command?: string | null
          github_stars?: number
          npm_downloads?: number
          average_rating?: number
          total_reviews?: number
          is_verified?: boolean
          is_official?: boolean
          is_trending?: boolean
          compatibility_info?: any
          media?: any[]
          tags?: string[]
          status?: string
          submitted_by?: string | null
          author: string
          votes?: number
          views_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          repository_url?: string
          website_url?: string | null
          maintainer_name?: string | null
          maintainer_url?: string | null
          maintainer_avatar_url?: string | null
          maintainer_followers?: number | null
          contributors_count?: number | null
          top_contributors?: any | null
          license?: string | null
          readme_overview?: string | null
          readme_html_preview?: string | null
          readme_html?: string | null
          readme_last_fetched_at?: string | null
          readme_url?: string | null
          npm_package?: string | null
          install_command?: string | null
          github_stars?: number
          npm_downloads?: number
          average_rating?: number
          total_reviews?: number
          is_verified?: boolean
          is_official?: boolean
          is_trending?: boolean
          compatibility_info?: any
          media?: any[]
          tags?: string[]
          status?: string
          submitted_by?: string | null
          author?: string
          votes?: number
          views_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      mcp_users: {
        Row: {
          id: string
          github_id: string | null
          username: string
          email: string
          avatar_url: string | null
          bio: string | null
          location: string | null
          is_admin: boolean
          servers_submitted: number
          total_votes: number
          community_rank: number
          created_at: string
          last_login: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          github_id?: string | null
          username: string
          email: string
          avatar_url?: string | null
          bio?: string | null
          location?: string | null
          is_admin?: boolean
          servers_submitted?: number
          total_votes?: number
          community_rank?: number
          created_at?: string
          last_login?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          github_id?: string | null
          username?: string
          email?: string
          avatar_url?: string | null
          bio?: string | null
          location?: string | null
          is_admin?: boolean
          servers_submitted?: number
          total_votes?: number
          community_rank?: number
          created_at?: string
          last_login?: string | null
          updated_at?: string
        }
      }
    }
  }
}