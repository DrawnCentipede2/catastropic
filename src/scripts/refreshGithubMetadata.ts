/**
 * Refresh GitHub metadata (README, stars, contributors) for MCP servers
 * that are missing a README. Safe to re-run; updates only missing fields.
 *
 * Usage:
 *   - Set env vars in a file (e.g. .env.local):
 *       VITE_SUPABASE_URL=...
 *       SUPABASE_SERVICE_ROLE_KEY=...
 *       (optional) GITHUB_TOKEN=...
 *   - Run with env file loaded:
 *       npx tsx --env-file=.env.local src/scripts/refreshGithubMetadata.ts
 */

import 'dotenv/config'
import sanitizeHtml from 'sanitize-html'
import { marked } from 'marked'
import { getSupabaseAdmin } from '@/lib/supabase'

type DbServer = {
  id: string
  name: string
  repository_url: string | null
  readme_html: string | null
  readme_url: string | null
  github_stars: number | null
  contributors_count: number | null
  top_contributors: any | null
}

// Use the same admin client bootstrap as other scripts
const sb = getSupabaseAdmin()
const GITHUB_API = 'https://api.github.com'

function ghHeaders() {
  const headers: Record<string, string> = { 'Accept': 'application/vnd.github+json' }
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

function parseOwnerRepo(inputUrl: string): { owner: string; repo: string } | null {
  try {
    const m = inputUrl.match(/github\.com\/(.+?)\/(.+?)(?:$|\?|#|\/)/i)
    if (m) return { owner: m[1], repo: m[2].replace(/\.git$/i, '') }
    return null
  } catch { return null }
}

async function fetchRepo(owner: string, repo: string) {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, { headers: ghHeaders() })
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

async function fetchContributors(owner: string, repo: string) {
  try {
    const countRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contributors?per_page=1`, { headers: ghHeaders() })
    let count = 0
    const link = countRes.headers.get('link') || countRes.headers.get('Link')
    if (link) {
      const m = link.match(/\bpage=(\d+)>; rel="last"/)
      if (m) count = parseInt(m[1], 10)
    }
    if (!count) {
      const arr = await countRes.json().catch(() => [])
      if (Array.isArray(arr)) count = arr.length
    }
    const topRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contributors?per_page=5`, { headers: ghHeaders() })
    const topJson: any[] = await topRes.json().catch(() => [])
    const top = Array.isArray(topJson) ? topJson.map((u: any) => ({
      login: u?.login,
      html_url: u?.html_url,
      avatar_url: u?.avatar_url,
      contributions: u?.contributions,
    })).filter(u => u.login && u.html_url) : []
    return { count, top }
  } catch { return null }
}

async function fetchReadme(owner: string, repo: string, branch: string) {
  try {
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/readme`, { headers: ghHeaders() })
    if (!res.ok) return null
    const json: any = await res.json()
    if (!json?.content) return null
    const md = Buffer.from(json.content, 'base64').toString('utf-8')

    // Overview: first non-heading paragraph
    const lines = md.split(/\r?\n/)
    let overview: string | null = null
    for (const line of lines) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      overview = t.replace(/!\[[^\]]*\]\([^\)]*\)/g, '').replace(/<[^>]+>/g, '').slice(0, 600)
      break
    }

    const baseRaw = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/`
    const baseBlob = `https://github.com/${owner}/${repo}/blob/${branch}/`

    const rewrite = (html: string) => html
      .replace(/(<img[^>]+src=["'])([^"']+)(["'])/gi, (_m, p1, src, p3) => {
        const isAbs = /^(https?:|data:)/i.test(src) || src.startsWith('#')
        const fixed = isAbs ? src : new URL(src.replace(/^\//, ''), baseRaw).href
        return `${p1}${fixed}${p3}`
      })
      .replace(/(<a[^>]+href=["'])([^"']+)(["'])/gi, (_m, p1, href, p3) => {
        const isAbs = /^(https?:|mailto:)/i.test(href) || href.startsWith('#')
        const fixed = isAbs ? href : new URL(href.replace(/^\//, ''), baseBlob).href
        return `${p1}${fixed}${p3}`
      })

    const mdPreview = md.split(/\s+/).slice(0, 800).join(' ')
    const htmlPreview = sanitizeHtml(rewrite(marked.parse(mdPreview) as string), {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1','h2','h3','img','pre','code','details','summary']),
      allowedAttributes: { a: ['href','name','target','rel'], img: ['src','alt'], code: ['class'], details: ['open'] },
      allowedSchemes: ['http','https','mailto']
    })
    const htmlFull = sanitizeHtml(rewrite(marked.parse(md) as string), {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1','h2','h3','img','pre','code','table','thead','tbody','tr','th','td','details','summary']),
      allowedAttributes: { a: ['href','name','target','rel'], img: ['src','alt'], code: ['class'], table: ['class'], details: ['open'] },
      allowedSchemes: ['http','https','mailto']
    })
    return { overview, htmlPreview, htmlFull, url: json?.html_url || `https://github.com/${owner}/${repo}#readme` }
  } catch { return null }
}

async function main() {
  console.log('🔎 Selecting servers missing README...')
  const { data: servers, error } = await sb
    .from('mcp_servers')
    .select('id,name,repository_url,readme_html,readme_url,github_stars,contributors_count,top_contributors')
    .or('readme_html.is.null,readme_url.is.null')
    .eq('status', 'approved')
    .limit(2000)

  if (error) {
    console.error('Select failed:', error.message)
    process.exit(1)
  }

  const list = (servers || []).filter(s => (s.repository_url || '').includes('github.com')) as DbServer[]
  console.log(`Found ${list.length} servers to refresh`)

  let updated = 0
  for (const s of list) {
    const parsed = parseOwnerRepo(s.repository_url!)
    if (!parsed) continue
    try {
      const info = await fetchRepo(parsed.owner, parsed.repo)
      const branch = info?.default_branch || 'main'
      const contrib = await fetchContributors(parsed.owner, parsed.repo)
      const rm = await fetchReadme(parsed.owner, parsed.repo, branch)
      const patch: any = {
        updated_at: new Date().toISOString(),
        readme_last_fetched_at: new Date().toISOString(),
      }
      if (info) {
        patch.github_stars = info.stars
        if (info.description) patch.description = info.description
        if (info.license) patch.license = info.license
        // preserve repository_url, but normalize to html_url
        patch.repository_url = info.html_url
        patch.maintainer_name = info.owner
        patch.maintainer_url = info.ownerHtmlUrl
        patch.maintainer_avatar_url = info.ownerAvatarUrl
      }
      if (contrib) {
        patch.contributors_count = contrib.count
        patch.top_contributors = contrib.top
      }
      if (rm) {
        if (!s.readme_url) patch.readme_url = rm.url
        if (!s.readme_html) patch.readme_html = rm.htmlFull
      }
      // Avoid setting website_url to the same value as repository_url or another GitHub URL
      if (info?.homepage && !/github\.com/i.test(info.homepage) && info.homepage !== patch.repository_url) {
        (patch as any).website_url = info.homepage
      } else {
        (patch as any).website_url = null
      }

      const { error: upErr } = await sb.from('mcp_servers').update(patch).eq('id', s.id)
      if (upErr) {
        console.error(`Update failed for ${s.name}:`, upErr.message)
      } else {
        updated++
        console.log(`✅ Updated: ${s.name}`)
      }
      await new Promise(r => setTimeout(r, 300))
    } catch (e: any) {
      console.error(`❌ Error for ${s.name}:`, e?.message || e)
    }
  }

  console.log(`\nDone. Updated ${updated} servers`)
}

main().catch(err => { console.error(err); process.exit(1) })


