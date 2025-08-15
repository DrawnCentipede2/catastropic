import { getSupabase, getSupabaseAnon } from '@/lib/supabase'
import type { Server } from '@/components/ServerCard'

// Types matching our database schema
export interface MCPServer {
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
  created_at: string
  updated_at: string
  // added
  views_count?: number
}

export interface MCPUser {
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

// Convert database server to frontend Server type
const convertToServerCard = (dbServer: MCPServer): Server => ({
  id: dbServer.id,
  name: dbServer.name,
  author: dbServer.maintainer_name || dbServer.author,
  official: dbServer.is_official,
  trending: dbServer.is_trending,
  votes: dbServer.votes,
  tags: (dbServer as any).tags || [],
  description: dbServer.description || '',
  repositoryUrl: dbServer.repository_url,
  githubStars: dbServer.github_stars,
  websiteUrl: dbServer.website_url || undefined,
  maintainerUrl: dbServer.maintainer_url || undefined,
  maintainerAvatarUrl: (dbServer as any).maintainer_avatar_url || undefined,
  maintainerFollowers: (dbServer as any).maintainer_followers ?? undefined,
  contributorsCount: dbServer.contributors_count ?? undefined,
  topContributors: dbServer.top_contributors ?? undefined,
  license: dbServer.license ?? undefined,
  readmeOverview: dbServer.readme_overview ?? undefined,
  readmeHtmlPreview: dbServer.readme_html_preview ?? undefined,
  readmeHtml: dbServer.readme_html ?? undefined,
  readme_last_fetched_at: (dbServer as any).readme_last_fetched_at ?? undefined,
  readmeUrl: dbServer.readme_url ?? undefined,
  // media removed for MVP
  views: (dbServer.views_count as number | undefined) ?? 0,
})

// Server API functions
export const serverApi = {
  // Check approved servers by repository URL (public)
  async findApprovedByRepoUrl(repoUrl: string) {
    const { data, error } = await getSupabaseAnon()
      .from('mcp_servers')
      .select('id, name, author')
      .eq('status', 'approved')
      .ilike('repository_url', repoUrl.replace(/%/g, '').trim())
      .maybeSingle()
    if (error && (error as any).code !== 'PGRST116') throw error
    return data || null
  },
  // Check any server row by repository URL regardless of status
  async findServerByRepoUrl(repoUrl: string) {
    const { data, error } = await getSupabaseAnon()
      .from('mcp_servers')
      .select('id, name, author, status')
      .ilike('repository_url', repoUrl.replace(/%/g, '').trim())
      .maybeSingle()
    if (error && (error as any).code !== 'PGRST116') throw error
    return data || null
  },
  // Check pending submissions table by repository URL
  async findSubmissionByRepoUrl(repoUrl: string) {
    const { data, error } = await getSupabaseAnon()
      .from('mcp_server_submissions')
      .select('id, name, author, status')
      .ilike('repository_url', repoUrl.replace(/%/g, '').trim())
      .maybeSingle()
    if (error && (error as any).code !== 'PGRST116') throw error
    return data || null
  },
  // Get all servers with optional filtering
  async getServers(filters?: {
    category?: string
    trending?: boolean
    official?: boolean
    search?: string
    sort?: 'views' | 'stars' | 'created'
    limit?: number
    offset?: number
  }) {
    // Always use anon client for public data to avoid auth header/RLS surprises
    let query = getSupabaseAnon()
      .from('mcp_servers')
      .select(`*`, { count: 'exact' })
      .eq('status', 'approved')
    // sort handling
    if (filters?.sort === 'views') {
      query = query.order('views_count', { ascending: false })
    } else if (filters?.sort === 'created') {
      query = query.order('created_at', { ascending: false })
    } else {
      // default to stars
      query = query.order('github_stars', { ascending: false })
    }

    if (filters?.trending) {
      query = query.eq('is_trending', true)
    }

    if (filters?.official) {
      query = query.eq('is_official', true)
    }

    // no categories in MVP

    if (filters?.search) {
      const q = filters.search.replace(/%/g, '').replace(/\n/g, ' ').trim()
      if (q) {
        query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`)
      }
    }

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1)
    }

    const { data, error, count } = await query

    if (error) throw error

    return {
      servers: data?.map(convertToServerCard) || [],
      total: count || 0
    }
  },

  // Get live vote count from votes table (source of truth)
  async getVoteCount(serverId: string) {
    const { count, error } = await getSupabase()
      .from('mcp_user_votes')
      .select('id', { count: 'exact', head: true })
      .eq('server_id', serverId)

    if (error) throw error
    return count || 0
  },

  // Get single server by ID
  async getServerById(id: string) {
    const { data, error } = await getSupabase()
      .from('mcp_servers')
      .select(`*`)
      .eq('id', id)
      .eq('status', 'approved')
      .single()

    if (error) throw error
    
    return data ? convertToServerCard(data) : null
  },

  // Record a view (once per user/device per day)
  async recordView(serverId: string, viewerId: string) {
    const { error } = await getSupabase().rpc('record_server_view', { p_server_id: serverId, p_viewer_id: viewerId })
    if (error) throw error
    return true
  },

  // Toggle vote for a server (add if missing, remove if exists)
  async toggleVote(serverId: string, userId: string) {
    try {
      const { data, error } = await getSupabase()
        .rpc('cast_vote_toggle', { p_server_id: serverId })
        .single()

      if (error) {
        console.error('[vote] cast_vote_toggle rpc failed', {
          serverId,
          userId,
          errorMessage: error?.message,
          errorName: error?.name,
          errorStack: (error as any)?.stack,
        })
        throw error
      }
      console.debug('[vote] toggle result', data)
      // returns { status: 'added' | 'removed' | 'exists', votes }
      return data
    } catch (e: any) {
      console.error('[vote] cast_vote_toggle exception', {
        serverId,
        userId,
        errorMessage: e?.message,
        errorName: e?.name,
        errorStack: e?.stack,
      })
      throw e
    }
  },

  // Submit new server
  async submitServer(serverData: {
    name: string
    description: string
    repository_url: string
    npm_package?: string
    install_command?: string
    tags: string[]
    author: string
    is_owner_verified?: boolean
    // enrichment optional fields
    license?: string | null
    readme_url?: string | null
    readme_html?: string | null
    readme_last_fetched_at?: string | null
    maintainer_name?: string | null
    maintainer_url?: string | null
    maintainer_avatar_url?: string | null
    maintainer_followers?: number | null
    website_url?: string | null
  }, userId: string) {
    const client = getSupabase()

    // If owner is verified, write directly into mcp_servers as approved
    if (serverData.is_owner_verified) {
      const directPayload = {
        name: serverData.name,
        description: serverData.description || null,
        repository_url: serverData.repository_url,
        author: serverData.author,
        status: 'approved' as const,
        submitted_by: userId,
        // enrichment
        license: serverData.license ?? null,
        readme_url: serverData.readme_url ?? null,
        readme_html: serverData.readme_html ?? null,
        readme_last_fetched_at: serverData.readme_last_fetched_at ?? null,
        maintainer_name: serverData.maintainer_name ?? null,
        maintainer_url: serverData.maintainer_url ?? null,
        maintainer_avatar_url: serverData.maintainer_avatar_url ?? null,
        maintainer_followers: serverData.maintainer_followers ?? null,
        website_url: serverData.website_url ?? null,
      }
      const { data, error } = await client
        .from('mcp_servers')
        .insert(directPayload)
        .select('*')
        .single()
      if (error) {
        if ((error as any).code === '23505') {
          throw new Error('A server with this repository URL already exists')
        }
        throw error
      }
      return data
    }

    // Otherwise, try to create a submission; if the table doesn't exist, fall back to pending server
    const res = await client
      .from('mcp_server_submissions')
      .insert({
        ...serverData,
        user_id: userId,
        status: 'pending'
      })
      .select()
      .single()

    if (!res.error && res.data) {
      return res.data
    }

    const notFoundLike = !!res.error && (
      (res.error as any).code === 'PGRST116' ||
      /not\s*found|does\s*not\s*exist|relation/i.test(res.error.message || '')
    )
    if (!notFoundLike) {
      throw res.error as any
    }

    // Fallback into servers as pending
    const fallbackPayload = {
      name: serverData.name,
      description: serverData.description || null,
      repository_url: serverData.repository_url,
      author: serverData.author,
      status: 'pending' as const,
      submitted_by: userId,
    }
    const { data: directData, error: directErr } = await client
      .from('mcp_servers')
      .insert(fallbackPayload)
      .select('*')
      .single()
    if (directErr) {
      if ((directErr as any).code === '23505') {
        throw new Error('A server with this repository URL already exists')
      }
      throw directErr
    }
    return directData
  }
}

// Owner verification helpers
export const submissionVerificationApi = {
  async setVerificationCode(submissionId: string, code: string) {
    const { data, error } = await getSupabase()
      .from('mcp_server_submissions')
      .update({ verification_code: code })
      .eq('id', submissionId)
      .select('*')
      .maybeSingle()
    if (error) throw error
    return data
  },
  async markOwnerVerified(submissionId: string) {
    const { data, error } = await getSupabase()
      .from('mcp_server_submissions')
      .update({ is_owner_verified: true, verified_at: new Date().toISOString() })
      .eq('id', submissionId)
      .select('*')
      .maybeSingle()
    if (error) throw error
    return data
  }
}
// Image generation API functions
// PERFORMANCE OPTIMIZATION: Optimized server API functions
// 
// Problem: getServersWithGeneratedImages() loads 2MB+ base64 images for ALL servers upfront,
// causing 26MB+ data transfer for just 13 servers and 1+ minute load times.
//
// Solution: Separate image loading from server data loading
// - getServersWithoutImages(): Fast server list without heavy images
// - getServerImage(): Load individual server images on-demand
//
// Usage:
// - Use optimizedServerApi.getServersWithoutImages() for server listings (fast)
// - Use optimizedServerApi.getServerImage(id) to load specific images when needed
// - Keep imageGenerationApi.getServersWithGeneratedImages() for admin/cases needing all images
export const optimizedServerApi = {
  // Get servers WITHOUT the heavy base64 images (lightweight version)
  async getServersWithoutImages(filters?: {
    trending?: boolean
    official?: boolean
    search?: string
    sort?: 'views' | 'stars' | 'created'
    limit?: number
    offset?: number
  }) {
    console.debug('[data] list start', { filters })
    let query = getSupabase()
      .from('mcp_servers')
      .select(`*`, { count: 'exact' })
      .eq('status', 'approved')
      // sort handling
      .order(filters?.sort === 'views' ? 'views_count' : filters?.sort === 'created' ? 'created_at' : 'github_stars', { ascending: false })

    // Apply filters (same as serverApi.getServers)
    if (filters?.trending) {
      query = query.eq('is_trending', true)
    }

    if (filters?.official) {
      query = query.eq('is_official', true)
    }

    // no categories in MVP

    if (filters?.search) {
      const q = filters.search.replace(/%/g, '').replace(/\n/g, ' ').trim()
      if (q) {
        query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`)
      }
    }

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1)
    }

    const { data, error, count } = await query
    if (error) { console.error('[data] list error', error); throw error }

    // Convert to Server type without heavy image data
    const servers = data?.map(server => ({
      ...convertToServerCard(server as unknown as MCPServer),
    })) || []

    const result = {
      servers,
      total: count || 0
    }
    console.debug('[data] list success', { total: result.total, count: servers.length })
    return result
  },

  // Get individual server image by ID (on-demand loading)
  async getServerImage(serverId: string) {
    console.debug('[data] image start', { serverId })
    // Use the standard client to respect current auth (and avoid stricter anon RLS)
    const { data, error } = await getSupabase()
      .from('mcp_servers')
      .select('generated_image, generated_image_metadata, name')
      .eq('id', serverId)
      .eq('status', 'approved')
      .single()

    if (error) { console.error('[data] image error', error); throw error }

    return {
      serverId,
      name: data?.name || '',
      generatedImage: data?.generated_image || null,
      generatedImageMetadata: data?.generated_image_metadata || null
    }
  }
}

// User API functions
export const userApi = {
  // Get or create user profile
  async getOrCreateUser(authUser: any) {
    console.log('[profile] getOrCreateUser start', {
      authUserId: authUser?.id,
      email: authUser?.email,
      metadata: authUser?.user_metadata,
      providers: authUser?.app_metadata?.providers,
    })
    // Normalize provider metadata (supports GitHub and Google)
    const userMetadata = authUser?.user_metadata || {}
    const providersList: string[] = Array.isArray(authUser?.app_metadata?.providers) ? authUser.app_metadata.providers : []
    const isGithubLogin = providersList.includes('github') || authUser?.app_metadata?.provider === 'github'
    const providerUsername: string | null =
      userMetadata.user_name || // GitHub
      userMetadata.preferred_username ||
      userMetadata.username ||
      null
    const displayName: string | null =
      userMetadata.full_name || userMetadata.name || providerUsername || null
    const avatarUrl: string | null =
      userMetadata.avatar_url || userMetadata.picture || null
    const bio: string | null = userMetadata.bio || null
    const email: string = authUser?.email

    const userId: string = authUser?.id
    // 1) Prefer direct lookup by auth user id
    if (userId) {
      const { data: byId, error: byIdErr } = await getSupabase()
        .from('mcp_users')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      if (byIdErr) {
        console.error('[profile] lookup error by id:', byIdErr)
      }
      if (byId) {
        const updatePayload: any = { last_login: new Date().toISOString(), email, avatar_url: avatarUrl ?? byId.avatar_url }
        if (providerUsername) updatePayload.github_id = providerUsername
        const { error } = await getSupabase()
          .from('mcp_users')
          .update(updatePayload)
          .eq('id', userId)
        if (error) console.error('[profile] error updating last login (by id):', error)
        const { data: refreshed } = await getSupabase()
          .from('mcp_users')
          .select('*')
          .eq('id', userId)
          .single()
        return refreshed || byId
      }
    }

    // 2) Fallback: try by email (may return multiple rows if user has multiple providers)
    console.log('[profile] lookup by email (fallback)')
    const byEmailList = await getSupabase()
      .from('mcp_users')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
    if (byEmailList.error) {
      console.error('[profile] lookup error by email (list):', byEmailList.error)
    }
    const byEmail = Array.isArray(byEmailList.data) ? byEmailList.data[0] : null
    if (byEmail && userId) {
      // Ensure a row exists for this auth uid: update-then-insert pattern to avoid 409 in some environments
      const basePayload: any = {
        username: displayName || email,
        email,
        avatar_url: avatarUrl,
        bio
      }
      if (providerUsername && isGithubLogin) basePayload.github_id = providerUsername
      let ensured = null as any
      // Try update
      const { data: updData, error: updErr } = await getSupabase()
        .from('mcp_users')
        .update({ ...basePayload, last_login: new Date().toISOString() })
        .eq('id', userId)
        .select('*')
        .maybeSingle()
      if (!updErr && updData) ensured = updData
      if (!ensured) {
        // Try insert; if race causes 23505, read the row
        const { data: insData, error: insErr } = await getSupabase()
          .from('mcp_users')
          .insert([{ id: userId, ...basePayload }])
          .select('*')
          .maybeSingle()
        if (insErr && (insErr as any).code !== '23505') {
          console.error('[profile] insert after email fallback error:', insErr)
        }
        ensured = insData || ensured
        if (!ensured) {
          const { data: readBack } = await getSupabase()
            .from('mcp_users')
            .select('*')
            .eq('id', userId)
            .maybeSingle()
          ensured = readBack
        }
      }
      if (ensured) return ensured
      return byEmail
    }

    // 3) Optional: lookup by github_id (GitHub provider only)
    if (providerUsername) {
      console.log('[profile] lookup by github_id', providerUsername)
      const { data: byGh, error: byGhErr } = await getSupabase()
        .from('mcp_users')
        .select('*')
        .eq('github_id', providerUsername)
        .maybeSingle()
      if (byGhErr) console.error('[profile] lookup error by github_id:', byGhErr)
      if (byGh) {
        const { error } = await getSupabase()
          .from('mcp_users')
          .update({ last_login: new Date().toISOString(), email })
          .eq('id', byGh.id)
        if (error) console.error('[profile] error updating profile (github_id):', error)
        return byGh
      }
    }

    // 4) Create or update user with current auth uid (update-then-insert)
    console.log('[profile] create/update mcp_user')
    const baseCreate: any = {
      username: displayName || email,
      email,
      avatar_url: avatarUrl,
      bio
    }
    if (providerUsername && isGithubLogin) baseCreate.github_id = providerUsername
    const { data: updCreated } = await getSupabase()
      .from('mcp_users')
      .update({ ...baseCreate, last_login: new Date().toISOString() })
      .eq('id', userId)
      .select('*')
      .maybeSingle()
    if (updCreated) return updCreated
    const { data: inserted, error: insertErr } = await getSupabase()
      .from('mcp_users')
      .insert([{ id: userId, ...baseCreate }])
      .select('*')
      .maybeSingle()
    if (!inserted && insertErr && (insertErr as any).code !== '23505') {
      console.error('[profile] create error:', insertErr)
      throw insertErr
    }
    if (inserted) return inserted
    const { data: readCreated } = await getSupabase()
      .from('mcp_users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    return readCreated
  },

  // Get user's submitted servers
  async getUserSubmittedServers(userId: string) {
    const { data, error } = await getSupabase()
      .from('mcp_servers')
      .select(`*`)
      .eq('submitted_by', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    
    return data?.map(server => convertToServerCard(server)) || []
  },

  // Get user favorites
  async getUserFavorites(userId: string) {
    console.debug('[favorites] fetch start', { userId })
    // Step 1: get favorite server ids in desired order
    const favRes = await getSupabase()
      .from('mcp_user_favorites')
      .select('server_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (favRes.error) {
      console.error('[favorites] list error', { code: (favRes.error as any).code, message: favRes.error.message, details: (favRes.error as any).details })
      throw favRes.error
    }
    const favorites = favRes.data || []
    if (favorites.length === 0) {
      console.debug('[favorites] empty')
      return []
    }
    const orderedIds = favorites.map((f: any) => f.server_id)
    // Step 2: fetch servers by ids
    const srvRes = await getSupabase()
      .from('mcp_servers')
      .select('*')
      .in('id', orderedIds)

    if (srvRes.error) {
      console.error('[favorites] servers fetch error', { code: (srvRes.error as any).code, message: srvRes.error.message, details: (srvRes.error as any).details })
      throw srvRes.error
    }
    const byId = new Map<string, any>()
    ;(srvRes.data || []).forEach((s: any) => byId.set(s.id, s))
    // Preserve favorites ordering
    const serversOrdered = orderedIds
      .map(id => byId.get(id))
      .filter(Boolean)
      .map((s: any) => convertToServerCard(s))
    console.debug('[favorites] fetch success', { count: serversOrdered.length })
    return serversOrdered
  },

  // Add server to favorites
  async addToFavorites(userId: string, serverId: string) {
    const client = getSupabase()
    const payload = { user_id: userId, server_id: serverId }
    console.debug('[favorites] add start', payload)
    const { error } = await client
      .from('mcp_user_favorites')
      .upsert(payload, { onConflict: 'user_id,server_id' })
    if (error) {
      console.error('[favorites] add error', { code: (error as any).code, message: error.message, details: (error as any).details })
      throw error
    }
    console.debug('[favorites] add success')
    return true
  },

  // Remove from favorites
  async removeFromFavorites(userId: string, serverId: string) {
    const client = getSupabase()
    console.debug('[favorites] remove start', { user_id: userId, server_id: serverId })
    const { error } = await client
      .from('mcp_user_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('server_id', serverId)
    if (error) {
      console.error('[favorites] remove error', { code: (error as any).code, message: error.message, details: (error as any).details })
      throw error
    }
    console.debug('[favorites] remove success')
    return true
  },

  // Get user activity  
  async getUserActivity(userId: string) {
    try {
      const { data, error } = await getSupabase()
        .from('mcp_user_activity')
        .select(`
          *,
          mcp_servers (
            name,
            author
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        // If table doesn't exist yet, return empty array
        console.log('User activity table not available:', error.message)
        return []
      }
      return data || []
    } catch (error) {
      // Fallback for any database errors
      console.log('Error fetching user activity:', error)
      return []
    }
  },

  // Update user profile
  async updateUserProfile(userId: string, updates: Partial<MCPUser>) {
    const { data, error } = await getSupabase()
      .from('mcp_users')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  }
}

// Categories API
export const categoriesApi = {
  async getCategories() {
    const { data, error } = await getSupabase()
      .from('mcp_categories')
      .select('*')
      .order('name')

    if (error) throw error
    return data || []
  }
}

// Leaderboard API
export const leaderboardApi = {
  async getTopServers(limit = 20) {
    const { data, error } = await getSupabase()
      .from('mcp_servers')
      .select('*')
      .eq('status', 'approved')
      .order('votes', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data?.map(convertToServerCard) || []
  },

  async getTopUsers(limit = 20) {
    const { data, error } = await getSupabase()
      .from('mcp_users')
      .select('*')
      .order('total_votes', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  }
}

// Database utility functions
export const dbUtils = {
  // Create database functions if they don't exist
  async createDatabaseFunctions() {
    const { error } = await getSupabase().rpc('create_increment_votes_function')
    if (error && !error.message.includes('already exists')) {
      console.error('Error creating database functions:', error)
    }
  }
}

// GitHub API utilities
export const githubApi = {
  // Accepts full repo URL like https://github.com/owner/repo
  async getRepoStars(repoUrl: string): Promise<number | null> {
    try {
      let owner: string | null = null
      let repo: string | null = null

      // Normalize: accept full URL or plain slug "owner/repo"
      const urlLike = repoUrl.trim()

      // Case 1: full GitHub URL
      const urlMatch = urlLike.match(/github\.com\/(.+)$/i)
      if (urlMatch) {
        const rest = urlMatch[1]
        const parts = rest.split('/')
        if (parts.length >= 2) {
          owner = parts[0]
          repo = parts[1]
        }
      }

      // Case 2: plain slug "owner/repo"
      if (!owner || !repo) {
        const slugMatch = urlLike.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?$/)
        if (slugMatch) {
          owner = slugMatch[1]
          repo = slugMatch[2]
        }
      }

      if (!owner || !repo) return null

      // Strip .git and trailing pieces
      repo = repo.replace(/\.git$/i, '')

      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`)
      if (!res.ok) return null
      const json = await res.json()
      return typeof json?.stargazers_count === 'number' ? json.stargazers_count : null
    } catch {
      return null
    }
  },
  // Keep search util for scripts; avoid calling this at runtime in the UI
  async searchLikelyRepo(name: string): Promise<{ owner: string; repo: string; html_url: string; stars: number } | null> {
    try {
      const q = `${name} MCP in:name,description`
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=1`
      const res = await fetch(url)
      if (!res.ok) return null
      const json = await res.json()
      const item = json?.items?.[0]
      if (!item) return null
      return {
        owner: item.owner?.login,
        repo: item.name,
        html_url: item.html_url,
        stars: item.stargazers_count ?? 0,
      }
    } catch {
      return null
    }
  }
}