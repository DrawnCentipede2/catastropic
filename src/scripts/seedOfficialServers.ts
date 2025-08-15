/*
  Script: seedOfficialServers.ts
  Purpose:
    - Deletes all rows from mcp_servers
    - Fetches the "🎖️ Official Integrations" section from the MCP registry README
      https://github.com/modelcontextprotocol/servers?tab=readme-ov-file
    - Resolves GitHub metadata (stars, description, owner) when link is a GitHub repo
    - Inserts normalized rows into mcp_servers with is_official=true and status='approved'

  Usage:
    - Set env vars (in .env.local or process env):
        VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
        (optional) GITHUB_TOKEN for higher rate limits
    - Run:  npm run seed:official
*/

import { getSupabaseAdmin } from '@/lib/supabase'
import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

const RAW_README_URL = 'https://raw.githubusercontent.com/modelcontextprotocol/servers/main/README.md'
const GITHUB_API = 'https://api.github.com'

function buildGhHeaders() {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json'
  }
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

type OfficialItem = { name: string; repoUrl?: string; websiteUrl?: string }

async function fetchRegistryReadme(): Promise<string> {
  const res = await fetch(RAW_README_URL)
  if (!res.ok) throw new Error(`Failed to fetch README: ${res.status}`)
  return await res.text()
}

function extractOfficialIntegrations(md: string): OfficialItem[] {
  // Narrow to the exact sub-heading level used in the README
  const subHead = '### 🎖️ Official Integrations'
  const subIdx = md.indexOf(subHead)
  if (subIdx === -1) return []
  const sectionStart = subIdx + subHead.length
  // End at next '### ' or '## ' after this subsection
  const nextSub = md.indexOf('\n### ', sectionStart)
  const nextTop = md.indexOf('\n## ', sectionStart)
  let end = md.length
  if (nextSub !== -1) end = Math.min(end, nextSub)
  if (nextTop !== -1) end = Math.min(end, nextTop)
  const section = md.slice(sectionStart, end)

  const lines = section.split('\n')
  const items: OfficialItem[] = []
  // Prefer bolded name link if present: **[Name](url)**
  const boldNameLink = /\*\*\[([^\]]+)\]\((https?:[^)\s]+)\)\*\*/
  const anyLink = /\[([^\]]+)\]\((https?:[^)\s]+)\)/g

  for (const line of lines) {
    if (!line.trim().startsWith('-')) continue
    let name: string | null = null
    let primaryUrl: string | null = null
    let githubCandidate: string | null = null
    let websiteCandidate: string | null = null

    // 1) Try bold name link
    const boldMatch = line.match(boldNameLink)
    if (boldMatch) {
      name = boldMatch[1].trim()
      primaryUrl = boldMatch[2].trim()
    }

    // 2) Scan all links, pick first as fallback name/url if none, and collect github vs website candidates
    anyLink.lastIndex = 0
    let m: RegExpExecArray | null
    let firstLinkUrl: string | null = null
    let firstLinkText: string | null = null
    while ((m = anyLink.exec(line)) !== null) {
      const text = m[1].trim()
      const url = m[2].trim()
      if (!firstLinkUrl) { firstLinkUrl = url; firstLinkText = text }
      if (/github\.com/i.test(url)) githubCandidate = url
      else if (!websiteCandidate) websiteCandidate = url
    }

    if (!name && firstLinkText) name = firstLinkText
    if (!primaryUrl && firstLinkUrl) primaryUrl = firstLinkUrl
    if (!name || !primaryUrl) continue

    // 3) Decide repo vs website
    let repoUrl: string | undefined
    let websiteUrl: string | undefined
    const primaryIsGithub = /github\.com/i.test(primaryUrl)
    if (primaryIsGithub) {
      repoUrl = primaryUrl
      websiteUrl = websiteCandidate || undefined
    } else {
      repoUrl = githubCandidate || undefined
      websiteUrl = primaryUrl
    }

    items.push({ name, repoUrl, websiteUrl })
  }

  return items
}

function parseOwnerRepo(urlOrSlug: string): { owner: string; repo: string } | null {
  const input = urlOrSlug.trim()
  const urlMatch = input.match(/github\.com\/(.+)$/i)
  if (urlMatch) {
    const rest = urlMatch[1]
    const [owner, repo] = rest.split('/')
    if (owner && repo) return { owner, repo: repo.replace(/\.git$/i, '') }
  }
  const slugMatch = input.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?$/)
  if (slugMatch) return { owner: slugMatch[1], repo: slugMatch[2].replace(/\.git$/i, '') }
  return null
}

async function fetchRepo(owner: string, repo: string) {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, { headers: buildGhHeaders() })
  if (!res.ok) return null
  const json = await res.json()
  return {
    owner: json?.owner?.login || owner,
    ownerHtmlUrl: json?.owner?.html_url || `https://github.com/${owner}`,
    ownerAvatarUrl: json?.owner?.avatar_url || null,
    repo: json?.name || repo,
    html_url: json?.html_url || `https://github.com/${owner}/${repo}`,
    description: json?.description || '',
    stars: json?.stargazers_count ?? 0,
    license: json?.license?.spdx_id || json?.license?.name || null,
    default_branch: json?.default_branch || 'main',
    homepage: (typeof json?.homepage === 'string' && json.homepage?.trim()) ? json.homepage.trim() as string : null,
  }
}

async function fetchMaintainer(owner: string) {
  const res = await fetch(`${GITHUB_API}/users/${owner}`, { headers: buildGhHeaders() })
  if (!res.ok) return null
  const json = await res.json()
  return {
    login: json?.login as string | undefined,
    html_url: json?.html_url as string | undefined,
    avatar_url: json?.avatar_url as string | undefined,
    followers: typeof json?.followers === 'number' ? json.followers as number : undefined,
  }
}

async function fetchContributors(owner: string, repo: string): Promise<{ count: number; top: Array<{ login: string; html_url: string; avatar_url: string; contributions?: number }> } | null> {
  try {
    // 1) Count (efficient): per_page=1 and read Link header last page number
    const countRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contributors?per_page=1`, { headers: buildGhHeaders() })
    let count = 0
    const link = countRes.headers.get('link') || countRes.headers.get('Link')
    if (link) {
      const m = link.match(/\bpage=(\d+)>; rel="last"/)
      if (m) count = parseInt(m[1], 10)
    }
    if (!count) {
      // Fallback if no Link header
      const arr = await countRes.json().catch(() => [])
      if (Array.isArray(arr)) count = arr.length
    }

    // 2) Top 5 contributors
    const topRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contributors?per_page=5`, { headers: buildGhHeaders() })
    const topJson = await topRes.json().catch(() => [])
    const top = Array.isArray(topJson) ? topJson.map((u: any) => ({
      login: u?.login,
      html_url: u?.html_url,
      avatar_url: u?.avatar_url,
      contributions: u?.contributions
    })).filter((u: any) => u.login && u.html_url) : []

    return { count, top }
  } catch {
    return null
  }
}

async function fetchReadme(owner: string, repo: string, branch: string): Promise<{ overview: string | null; htmlPreview: string | null; htmlFull: string | null; url: string } | null> {
  try {
    // Use contents API for README
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/readme`, { headers: buildGhHeaders() })
    if (!res.ok) return null
    const json = await res.json()
    if (!json?.content) return null
    const md = Buffer.from(json.content, 'base64').toString('utf-8')

    // Extract first non-heading paragraph
    const lines = md.split(/\r?\n/)
    let overview: string | null = null
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (trimmed.startsWith('#')) continue
      overview = trimmed.replace(/!\[[^\]]*\]\([^\)]*\)/g, '').replace(/<[^>]+>/g, '').slice(0, 600)
      break
    }
    // Simple preview: first ~800 words from markdown → HTML (sanitized)
    const mdPreview = md.split(/\s+/).slice(0, 800).join(' ')
    let rawHtml = marked.parse(mdPreview) as string

    // Rewrite relative links to absolute repo URLs
    const baseRaw = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/`
    const baseBlob = `https://github.com/${owner}/${repo}/blob/${branch}/`
    // img src
    rawHtml = rawHtml.replace(/(<img[^>]+src=["'])([^"']+)(["'])/gi, (_m, p1, src, p3) => {
      const isAbsolute = /^(https?:|data:)/i.test(src) || src.startsWith('#')
      const fixed = isAbsolute ? src : new URL(src.replace(/^\//, ''), baseRaw).href
      return `${p1}${fixed}${p3}`
    })
    // anchor href
    rawHtml = rawHtml.replace(/(<a[^>]+href=["'])([^"']+)(["'])/gi, (_m, p1, href, p3) => {
      const isAbsolute = /^(https?:|mailto:)/i.test(href) || href.startsWith('#')
      const fixed = isAbsolute ? href : new URL(href.replace(/^\//, ''), baseBlob).href
      return `${p1}${fixed}${p3}`
    })
    const htmlPreview = sanitizeHtml(rawHtml, {
      // Allow GitHub-like collapsible sections and code blocks
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1','h2','h3','img','pre','code','details','summary']),
      allowedAttributes: {
        a: ['href','name','target','rel'],
        img: ['src','alt'],
        code: ['class'],
        details: ['open']
      },
      allowedSchemes: ['http','https','mailto']
    })
    // Full HTML conversion with the same rewriting/sanitization
    let rawFull = marked.parse(md) as string
    rawFull = rawFull.replace(/(<img[^>]+src=["'])([^"']+)(["'])/gi, (_m, p1, src, p3) => {
      const isAbsolute = /^(https?:|data:)/i.test(src) || src.startsWith('#')
      const fixed = isAbsolute ? src : new URL(src.replace(/^\//, ''), baseRaw).href
      return `${p1}${fixed}${p3}`
    })
    rawFull = rawFull.replace(/(<a[^>]+href=["'])([^"']+)(["'])/gi, (_m, p1, href, p3) => {
      const isAbsolute = /^(https?:|mailto:)/i.test(href) || href.startsWith('#')
      const fixed = isAbsolute ? href : new URL(href.replace(/^\//, ''), baseBlob).href
      return `${p1}${fixed}${p3}`
    })
    const htmlFull = sanitizeHtml(rawFull, {
      // Include tables and collapsible sections similar to GitHub
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1','h2','h3','img','pre','code','table','thead','tbody','tr','th','td','details','summary']),
      allowedAttributes: {
        a: ['href','name','target','rel'],
        img: ['src','alt'],
        code: ['class'],
        table: ['class'],
        details: ['open']
      },
      allowedSchemes: ['http','https','mailto']
    })
    return { overview, htmlPreview, htmlFull, url: json?.html_url || `https://github.com/${owner}/${repo}#readme` }
  } catch {
    return null
  }
}

async function seed() {
  const sb = getSupabaseAdmin()

  console.log('Fetching README...')
  const md = await fetchRegistryReadme()
  const official = extractOfficialIntegrations(md)
  if (!official.length) throw new Error('No official integrations found in README')
  console.log(`Found ${official.length} official entries (lines)`) 

  console.log('Clearing mcp_servers...')
  // Delete all rows (requires a filter). Delete where id is not null
  const { error: delErr } = await sb.from('mcp_servers').delete().not('id', 'is', null)
  if (delErr) throw delErr

  console.log('Seeding official servers...')
  // Deduplicate by normalized name (case-insensitive) or by repo slug if available
  const byKey = new Map<string, OfficialItem>()
  function keyFor(item: OfficialItem): string {
    if (item.repoUrl) {
      const parsed = parseOwnerRepo(item.repoUrl)
      if (parsed) return `repo:${parsed.owner.toLowerCase()}/${parsed.repo.toLowerCase()}`
    }
    return `name:${item.name.toLowerCase()}`
  }
  for (const it of official) {
    const k = keyFor(it)
    const prev = byKey.get(k)
    if (!prev) byKey.set(k, it)
    else {
      // Merge website if missing
      if (!prev.websiteUrl && it.websiteUrl) prev.websiteUrl = it.websiteUrl
      if (!prev.repoUrl && it.repoUrl) prev.repoUrl = it.repoUrl
    }
  }

  const merged = Array.from(byKey.values())
  console.log(`After merge: ${merged.length} unique official entries`)

  let inserted = 0
  for (const entry of merged) {
    let name = entry.name
    let author = 'Official'
    let description = ''
    let github_stars: number | null = null
    let repository_url = entry.repoUrl || entry.websiteUrl || ''
    let website_url = entry.websiteUrl
    let maintainer_name: string | null = null
    let maintainer_url: string | null = null
    let license: string | null = null
    let contributors_count: number | null = null
    let top_contributors: Array<{ login: string; html_url: string; avatar_url: string; contributions?: number }> | null = null
    let readme_overview: string | null = null
    let readme_html_preview: string | null = null
    let readme_url: string | null = null
    let readme_html: string | null = null

    const parsed = entry.repoUrl ? parseOwnerRepo(entry.repoUrl) : null
    const isGithubUrl = (u?: string | null) => !!u && /github\.com/i.test(u)
    if (parsed) {
      const info = await fetchRepo(parsed.owner, parsed.repo)
      if (info) {
        repository_url = info.html_url
        author = info.owner
        description = info.description
        github_stars = info.stars
        maintainer_name = info.owner
        maintainer_url = info.ownerHtmlUrl
        var maintainer_avatar_url: string | null = info.ownerAvatarUrl || null
        var maintainer_followers: number | null = null
        const maint = await fetchMaintainer(info.owner)
        if (maint) {
          maintainer_avatar_url = maint.avatar_url || maintainer_avatar_url
          maintainer_followers = typeof maint.followers === 'number' ? maint.followers : maintainer_followers
        }
        license = info.license
        // Prefer a non-GitHub website. If missing or equal to repo, try repo homepage
        if ((!website_url || isGithubUrl(website_url) || website_url === repository_url) && info.homepage && !isGithubUrl(info.homepage) && info.homepage !== repository_url) {
          website_url = info.homepage
        }
      }
      // Fetch contributors metadata (count + top 5)
      const contrib = await fetchContributors(parsed.owner, parsed.repo)
      if (contrib) {
        contributors_count = contrib.count
        top_contributors = contrib.top
      }
      // Fetch README overview/preview
      const rm = await fetchReadme(parsed.owner, parsed.repo, info?.default_branch || 'main')
      if (rm) {
        readme_overview = rm.overview
        readme_html_preview = rm.htmlPreview
        readme_url = rm.url
        readme_html = rm.htmlFull
      }
      await new Promise(r => setTimeout(r, 250))
    }

    // Final normalization to avoid duplicates
    if (website_url === repository_url || isGithubUrl(website_url)) {
      website_url = null
    }

    const row = {
      name,
      author,
      description,
      repository_url,
      website_url: website_url ?? null,
      github_stars: github_stars ?? 0,
      maintainer_name: maintainer_name ?? null,
      maintainer_url: maintainer_url ?? null,
      maintainer_avatar_url,
      maintainer_followers,
      contributors_count: contributors_count ?? null,
      top_contributors: top_contributors ?? null,
      license: license ?? null,
      readme_overview,
      readme_html_preview,
      readme_last_fetched_at: new Date().toISOString(),
      readme_html,
      readme_url,
      is_official: true,
      is_trending: false,
      status: 'approved',
      tags: [] as string[],
      media: [] as any[],
      votes: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { error: insErr } = await sb.from('mcp_servers').insert(row)
    if (insErr) {
      console.error('Insert failed for', name, insErr.message)
      continue
    }
    inserted++
  }

  console.log(`Done. Inserted ${inserted} official servers`)
}

seed().catch(err => {
  console.error(err)
  process.exit(1)
})


