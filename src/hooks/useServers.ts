import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { serverApi, userApi, categoriesApi, leaderboardApi, optimizedServerApi } from '@/services/api'
import { submissionVerificationApi } from '@/services/api'
import { githubApi } from '@/services/api'
import { useAuth } from './useAuth'

// Server listing with filters (optimized - no heavy base64 images)
export const useServers = (filters?: {
  trending?: boolean
  official?: boolean
  search?: string
  sort?: 'views' | 'stars' | 'created'
  limit?: number
  offset?: number
}) => {
  return useQuery({
    queryKey: ['servers', filters],
    queryFn: () => optimizedServerApi.getServersWithoutImages(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// LEGACY: Server listing WITH heavy base64 images (use only when images are needed)
// Removed image-generation-based listing for MVP

// Fallback to original servers API (without generated images)
export const useServersLegacy = (filters?: {
  trending?: boolean
  official?: boolean
  search?: string
  limit?: number
  offset?: number
}) => {
  return useQuery({
    queryKey: ['servers-legacy', filters],
    queryFn: () => serverApi.getServers(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Load individual server image on-demand
export const useServerImage = (serverId: string) => {
  return useQuery({
    queryKey: ['server-image', serverId],
    queryFn: () => optimizedServerApi.getServerImage(serverId),
    enabled: !!serverId,
    staleTime: 30 * 60 * 1000,
  })
}

// Single server by ID
export const useServer = (id: string) => {
  return useQuery({
    queryKey: ['server', id],
    queryFn: () => serverApi.getServerById(id),
    enabled: !!id,
  })
}

// GitHub stars for a given repository URL
// REMOVED: runtime GitHub calls. We now rely on Supabase-stored stars populated by scheduled scripts.

// Categories
export const useCategories = () => {
  return useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.getCategories,
    staleTime: 30 * 60 * 1000, // 30 minutes
  })
}

// User's submitted servers
export const useUserSubmittedServers = () => {
  const { profile } = useAuth()
  
  return useQuery({
    queryKey: ['userSubmittedServers', profile?.id],
    queryFn: () => profile ? userApi.getUserSubmittedServers(profile.id) : [],
    enabled: !!profile?.id,
  })
}

// User favorites
export const useFavorites = () => {
  const { user, profile } = useAuth()
  
  return useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: () => (user?.id ? userApi.getUserFavorites(user.id) : []),
    enabled: !!user?.id,
  })
}

// User activity
export const useUserActivity = () => {
  const { profile } = useAuth()
  
  return useQuery({
    queryKey: ['userActivity', profile?.id],
    queryFn: () => profile ? userApi.getUserActivity(profile.id) : [],
    enabled: !!profile?.id,
  })
}

// Leaderboard data
export const useLeaderboard = () => {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const [topServers, topUsers] = await Promise.all([
        leaderboardApi.getTopServers(20),
        leaderboardApi.getTopUsers(20)
      ])
      return { topServers, topUsers }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Mutations for user actions
export const useVoteForServer = () => {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  return useMutation({
    mutationFn: (serverId: string) => {
      if (!profile) throw new Error('Must be logged in to vote')
      // Use existing toggleVote RPC which adds or removes a vote
      return serverApi.toggleVote(serverId, profile.id)
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['servers'] })
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
    },
  })
}

export const useToggleFavorite = () => {
  const queryClient = useQueryClient()
  const { user, profile, refreshProfile } = useAuth()

  return useMutation({
    mutationFn: async ({ serverId, isFavorited }: { serverId: string; isFavorited: boolean }) => {
      if (!user?.id) throw new Error('Must be logged in to manage favorites')
      // Ensure a corresponding profile row exists (avoids FK errors for Google sign-ins)
      if (!profile?.id) {
        try { await refreshProfile() } catch {}
      }
      
      if (isFavorited) {
        return userApi.removeFromFavorites(user.id, serverId)
      } else {
        return userApi.addToFavorites(user.id, serverId)
      }
    },
    onSuccess: () => {
      // Invalidate favorites query
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
    },
  })
}

export const useSubmitServer = () => {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  return useMutation({
    mutationFn: (serverData: {
      name: string
      description: string
      repository_url: string
      npm_package?: string
      install_command?: string
      tags: string[]
      author: string
      is_owner_verified?: boolean
    }) => {
      if (!profile) throw new Error('Must be logged in to submit servers')
      return serverApi.submitServer(serverData, profile.id)
    },
    onSuccess: () => {
      // Invalidate user activity
      queryClient.invalidateQueries({ queryKey: ['userActivity'] })
    },
  })
}

export const useSubmissionVerification = () => {
  const { profile } = useAuth()
  return {
    generateCode: (serverName: string) => {
      const short = (serverName || 'mcp').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 16)
      const rand = Math.random().toString(36).slice(2, 8)
      return `catastropic-verify-${short}-${rand}`
    },
    setCode: (submissionId: string, code: string) => submissionVerificationApi.setVerificationCode(submissionId, code),
    markVerified: (submissionId: string) => submissionVerificationApi.markOwnerVerified(submissionId),
  }
}

// Update user profile
export const useUpdateProfile = () => {
  const queryClient = useQueryClient()
  const { profile, refreshProfile, updateProfileInState } = useAuth()

  return useMutation({
    mutationFn: async (updates: Partial<import('@/services/api').MCPUser>) => {
      if (!profile) throw new Error('Must be logged in to update profile')
      return userApi.updateUserProfile(profile.id, updates)
    },
    onMutate: async (variables) => {
      // Optimistically update the profile in auth state immediately
      updateProfileInState(variables)
      
      // Return the previous values in case we need to rollback
      return { previousProfile: profile }
    },
    onSuccess: async (updatedProfile, variables) => {
      try {
        // Invalidate relevant queries to trigger refetch of related data
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['userProfile'] }),
          queryClient.invalidateQueries({ queryKey: ['favorites', profile?.id] }),
          queryClient.invalidateQueries({ queryKey: ['userSubmittedServers', profile?.id] }),
          queryClient.invalidateQueries({ queryKey: ['userActivity', profile?.id] })
        ])
        
        // Refresh the profile in auth context to ensure consistency with database
        await refreshProfile()
      } catch (error) {
        console.error('Error refreshing profile after update:', error)
        // The optimistic update is still in place, so the UI will show the changes
        // but we log the error for debugging purposes
      }
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update if the mutation failed
      if (context?.previousProfile) {
        updateProfileInState(context.previousProfile)
      }
      console.error('Profile update failed:', error)
    }
  })
}

// Removed all image generation mutations for MVP