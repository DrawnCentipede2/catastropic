/*
  Script: fixRepositoryUrls.ts
  Purpose: Fix only incorrect repository URLs in Supabase, not all rows.
           - Normalize repository_url to canonical https://github.com/owner/repo
           - If website_url is a GitHub URL, move canonical repo to repository_url and clear website_url
           - Backfill stars when we actually fix a row
  Usage:   npx tsx --env-file=.env.local src/scripts/fixRepositoryUrls.ts
           (Recommended) export GITHUB_TOKEN=... to increase rate limits
*/

import { getSupabaseAdmin } from '@/lib/supabase'

const GITHUB_API = 'https://api.github.com'

function buildHeaders() {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json'
  }
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

type RepoInfo = { owner: string; repo: string; html_url: string; stars: number }

const isGithubUrl = (u?: string | null) => !!u && /github\.com/i.test(u)
const isNormalizedGithubRepoUrl = (u?: string | null) => {
  if (!u) return false
  // Accept https://github.com/owner/repo (optional trailing slash)
  const m = u.match(/^https?:\/\/(?:www\.)?github\.com\/[^\/]+\/[^\/]+\/?$/i)
  return !!m
}

function parseOwnerRepo(input: string | null | undefined): { owner: string; repo: string } | null {
  if (!input) return null
  const trimmed = input.trim()

  // Full URL
  const urlMatch = trimmed.match(/github\.com\/(.+)$/i)
  if (urlMatch) {
    const rest = urlMatch[1]
    const [owner, repo] = rest.split('/')
    if (owner && repo) return { owner, repo: repo.replace(/\.git$/i, '') }
  }

  // Slug owner/repo
  const slugMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?$/)
  if (slugMatch) {
    return { owner: slugMatch[1], repo: slugMatch[2].replace(/\.git$/i, '') }
  }
  return null
}

async function fetchRepo(owner: string, repo: string): Promise<RepoInfo | null> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, { headers: buildHeaders() })
  if (!res.ok) return null
  const json = await res.json()
  const html_url: string | undefined = json?.html_url
  const stars: number = json?.stargazers_count ?? 0
  if (!html_url) return null
  return { owner, repo, html_url, stars }
}

async function searchLikelyRepoByName(name: string): Promise<RepoInfo | null> {
  const q = `${name} MCP in:name,description`
  const url = `${GITHUB_API}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=3`
  const res = await fetch(url, { headers: buildHeaders() })
  if (!res.ok) return null
  const json = await res.json()
  const items = Array.isArray(json?.items) ? json.items : []
  if (!items.length) return null
  const item = items[0]
  if (!item?.owner?.login || !item?.name) return null
  return {
    owner: item.owner.login,
    repo: item.name,
    html_url: item.html_url,
    stars: item.stargazers_count ?? 0,
  }
}

async function resolveRepository(server: { id: string; name: string; repository_url: string | null }): Promise<RepoInfo | null> {
  // 1) If repository_url exists and is valid → return
  const parsed = parseOwnerRepo(server.repository_url)
  if (parsed) {
    const existing = await fetchRepo(parsed.owner, parsed.repo)
    if (existing) return existing
  }

  // 2) Try common variations if a slug was present
  if (parsed) {
    const candidates = [
      parsed.repo.replace(/-mcp$/i, ''),
      `mcp-server-${parsed.repo}`,
      parsed.repo.replace(/^mcp-server-/i, ''),
    ]
    for (const cand of candidates) {
      const hit = await fetchRepo(parsed.owner, cand)
      if (hit) return hit
    }
  }

  // 3) Search by server name
  if (server.name) {
    const found = await searchLikelyRepoByName(server.name)
    if (found) return found
  }

  return null
}

async function main() {
  const sb = getSupabaseAdmin()

  // Fetch a reduced candidate set: likely incorrect URLs
  const { data: servers, error } = await sb
    .from('mcp_servers')
    .select('id, name, repository_url, website_url, github_stars, status')
    .eq('status', 'approved')
    .or(
      [
        'repository_url.is.null',
        'repository_url.eq.',
        'repository_url.not.ilike.%github.com%',
        'website_url.ilike.%github.com%'
      ].join(',')
    )

  if (error) throw error
  if (!servers?.length) {
    console.log('No servers found to process.')
    return
  }

  // Final in-code filter to avoid touching already-correct rows
  const candidates = servers.filter(s => {
    const repoOk = isNormalizedGithubRepoUrl(s.repository_url)
    const siteIsGitHub = isGithubUrl((s as any).website_url)
    const needsFix = !repoOk || siteIsGitHub || (s.repository_url && (s as any).website_url && s.repository_url === (s as any).website_url)
    return needsFix
  })

  let fixed = 0
  let skipped = 0
  console.log(`Candidates to check: ${candidates.length}`)
  for (const s of candidates) {
    try {
      const info = await resolveRepository(s)
      if (!info) {
        // Could not resolve via GitHub API → remove invalid GitHub repository URLs
        const site = (s as any).website_url as string | null | undefined
        const cleanup: any = { updated_at: new Date().toISOString() }
        let willUpdate = false
        // If repository_url is not a canonical GitHub repo URL (or is a non-GitHub URL), set it to null
        if (!isNormalizedGithubRepoUrl(s.repository_url)) {
          cleanup.repository_url = null
          willUpdate = true
        }
        // If website_url points to GitHub, clear it
        if (isGithubUrl(site)) {
          cleanup.website_url = null
          willUpdate = true
        }
        if (willUpdate) {
          const { error: upErr } = await sb.from('mcp_servers').update(cleanup).eq('id', s.id)
          if (upErr) {
            console.error('Cleanup update failed for', s.id, upErr.message)
          } else {
            fixed++
          }
        } else {
          skipped++
        }
        continue
      }
      const normalizedUrl = `https://github.com/${info.owner}/${info.repo}`
      const update: any = {
        updated_at: new Date().toISOString(),
      }
      // Only set repository_url if it's missing or not normalized already
      if (!isNormalizedGithubRepoUrl(s.repository_url) || (s.repository_url && s.repository_url !== normalizedUrl)) {
        update.repository_url = normalizedUrl
        update.github_stars = info.stars
      }
      // If website_url points to GitHub, clear it (keep non-GitHub websites even if equal)
      if (isGithubUrl((s as any).website_url)) {
        update.website_url = null
      }
      const { error: upErr } = await sb
        .from('mcp_servers')
        .update(update)
        .eq('id', s.id)
      if (upErr) {
        console.error('Update failed for', s.id, upErr.message)
        continue
      }
      fixed++
      // Be nice to the API
      await new Promise(r => setTimeout(r, 300))
    } catch (e) {
      console.error('Error processing', s.id, e)
    }
  }

  console.log(`Done. Fixed: ${fixed}, Skipped: ${skipped}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})


