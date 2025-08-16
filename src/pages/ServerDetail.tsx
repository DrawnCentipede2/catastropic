import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Flame, Shield, Star, Github, ThumbsUp, Heart, ChevronLeft, Globe } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useServer } from "@/hooks/useServers";
import { useToggleFavorite } from "@/hooks/useServers";
import { useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { useAuth } from "@/hooks/useAuth";
import { serverApi, userApi } from "@/services/api";
import { toast } from "@/hooks/use-toast";

const ServerDetail = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data: server, isLoading, error } = useServer(id);
  const starsToShow = (typeof server?.githubStars === 'number' && server.githubStars > 0) ? server.githubStars : null;

  const jsonLd = server ? {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: server.name,
    author: server.author,
    applicationCategory: 'AI Agent MCP Server',
    description: server.description,
    url: window.location.href,
  } : undefined;

  const [showPreview, setShowPreview] = useState(false);
  const readmeRef = useRef<HTMLDivElement | null>(null);
  const [enhancedReadmeHtml, setEnhancedReadmeHtml] = useState<string | null>(null);
  const { user, profile, isAuthenticated, refreshProfile, login, isLoggingIn } = (useAuth() as any) || {};
  const toggleFavoriteMutation = useToggleFavorite();
  const [favSubmitting, setFavSubmitting] = useState(false);
  const [isFavorite, setIsFavorite] = useState<boolean>(() => {
    try { if (typeof window === 'undefined') return false; return !!localStorage.getItem(`mcp_fav_${id}`); } catch { return false; }
  });
  const [voteSubmitting, setVoteSubmitting] = useState(false);
  const [voteCount, setVoteCount] = useState<number | null>(null);
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  useEffect(() => {
    // Record a view once per user/device per day
    const recordView = async () => {
      try {
        if (!server?.id) return;
        const key = `mcp_view_${server.id}_${new Date().toISOString().slice(0,10)}`;
        if (localStorage.getItem(key)) return;
        const viewerId = localStorage.getItem('mcp_viewer_id') || (() => {
          const v = crypto.randomUUID();
          localStorage.setItem('mcp_viewer_id', v);
          return v;
        })();
        const { error } = await getSupabase().rpc('record_server_view', { p_server_id: server.id, p_viewer_id: viewerId });
        if (!error) localStorage.setItem(key, '1');
      } catch {}
    };
    recordView();
  }, [server?.id]);

  useEffect(() => {
    if (typeof server?.votes === 'number') setVoteCount(server.votes);
  }, [server?.votes]);

  // Refresh vote count when page becomes visible again (e.g., navigating back from home)
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (!server?.id) return;
      try {
        const c = await serverApi.getVoteCount(server.id);
        if (active) setVoteCount(c);
      } catch {}
    };
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVis);
    // Also refresh shortly after mount
    const t = setTimeout(refresh, 100);
    return () => { active = false; document.removeEventListener('visibilitychange', onVis); clearTimeout(t); };
  }, [server?.id]);

  const onVote = async () => {
    try {
      if (!server?.id) return;
      // Simple global throttle: allow another vote action after 1s per browser
      const lastTs = Number(localStorage.getItem('mcp_vote_last_ts') || '0');
      if (Date.now() - lastTs < 1_000) {
        toast({ title: 'Please wait a moment', description: 'You can vote again shortly.' });
        return;
      }

      if (!isAuthenticated || !user?.id) { setShowLoginDialog(true); return; }
      if (voteSubmitting) return;
      setVoteSubmitting(true);
      const result = (await serverApi.toggleVote(server.id, user.id)) as any;
      localStorage.setItem('mcp_vote_last_ts', String(Date.now()));
      if (result?.status === 'removed') {
        setVoteCount(result.votes ?? 0);
        toast({ title: 'Removed vote' });
      } else {
        setVoteCount(result?.votes ?? ((voteCount ?? server?.votes ?? 0) + 1));
        toast({ title: 'Thanks for voting!' });
      }
    } catch (err: any) {
      const msg = (err && (err.message || String(err))) || '';
      if (/already voted/i.test(msg)) {
        toast({ title: 'Already voted', description: 'You can only vote once per server.' });
      } else {
        toast({ title: 'Vote failed', description: 'Please try again later.' });
      }
    } finally {
      setVoteSubmitting(false);
    }
  };

  const toggleFavorite = async () => {
    try {
      if (!server?.id) return;
      if (!isAuthenticated || !user?.id) { setShowLoginDialog(true); return; }
      if (favSubmitting) return;
      // Ensure profile (mcp_users row) exists before writing favorites
      let userIdForFavorites = profile?.id as string | undefined;
      if (!userIdForFavorites) {
        try {
          const p = await refreshProfile();
          userIdForFavorites = p?.id;
        } catch {}
      }
      if (!userIdForFavorites) {
        toast({ title: 'Profile not ready', description: 'Please try again in a second.' });
        return;
      }
      setFavSubmitting(true);
      const next = !isFavorite;
      setIsFavorite(next);
      await toggleFavoriteMutation.mutateAsync({ serverId: server.id, isFavorited: !next });
      if (next) {
        localStorage.setItem(`mcp_fav_${id}`, '1');
        toast({ title: 'Added to favorites' });
      } else {
        localStorage.removeItem(`mcp_fav_${id}`);
        toast({ title: 'Removed from favorites' });
      }
    } catch (e: any) {
      setIsFavorite(!isFavorite);
      console.error('[favorites] action error', { message: e?.message, code: e?.code, details: (e as any)?.details });
      toast({ title: 'Action failed', description: 'Please try again later.' });
    } finally {
      setFavSubmitting(false);
    }
  }

  const onBack = () => {
    try {
      const raw = sessionStorage.getItem('browse_state')
      const browse = raw ? JSON.parse(raw) as { filter: string | null; sort: string | null; search: string; scrollY: number | null } : null
      if (browse) {
        const params = new URLSearchParams()
        if (browse.filter) params.set('filter', browse.filter)
        if (browse.sort) params.set('sort', browse.sort as string)
        if (browse.search) params.set('q', browse.search)
        const url = `/` + (params.toString() ? `?${params.toString()}` : '')
        navigate(url)
        setTimeout(() => {
          if (typeof browse.scrollY === 'number') window.scrollTo({ top: browse.scrollY, behavior: 'instant' as any })
        }, 60)
        return
      }
    } catch {}
    navigate(-1)
  }

  useEffect(() => {
    const container = readmeRef.current;
    if (!container) return;

    // Generate GitHub-like slugs for headings
    const slugify = (text: string) => {
      return text
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
    };

    // Ensure headings have IDs for in-page anchor links
    const used = new Set<string>();
    const headings = container.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6");
    headings.forEach((h) => {
      if (!h.id || h.id.trim().length === 0) {
        const base = slugify(h.innerText || h.textContent || "");
        if (!base) return;
        let candidate = base;
        let i = 2;
        while (used.has(candidate)) {
          candidate = `${base}-${i++}`;
        }
        h.id = candidate;
        used.add(candidate);
      } else {
        used.add(h.id);
      }
    });

    // Make README badges flow horizontally and wrap consistently, everywhere
    // 1) Helper to detect nodes containing only badge links/images
    const isBadgeOnlyBlock = (el: Element): boolean => {
      const nodes = Array.from(el.childNodes);
      if (nodes.length === 0) return false;
      let hasImage = false;
      const ok = nodes.every((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          return (node.textContent || '').trim() === '';
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
          const child = node as HTMLElement;
          if (child.tagName === 'BR') return true; // ignore manual line breaks in badge blocks
          if (child.tagName === 'IMG') { hasImage = true; return true; }
          if (child.tagName === 'A') {
            // Anchor may contain one or more images, ignore whitespace
            const anchorChildrenOk = Array.from(child.childNodes).every((n) => {
              if (n.nodeType === Node.TEXT_NODE) return (n.textContent || '').trim() === '';
              if (n.nodeType === Node.ELEMENT_NODE) return (n as HTMLElement).tagName === 'IMG';
              return false;
            });
            if (child.querySelector('img')) hasImage = true;
            return anchorChildrenOk;
          }
          return false;
        }
        return false;
      });
      return ok && hasImage;
    };

    try {
      // 2) Single-block case: multiple badges inside one element (p/div/span)
      const blocks = container.querySelectorAll<HTMLElement>('p, div, span');
      blocks.forEach((el) => {
        if (!isBadgeOnlyBlock(el)) return;
        const imgCount = el.querySelectorAll('img').length;
        const linkCount = el.querySelectorAll('a').length;
        if (imgCount >= 2 || linkCount >= 2) {
          el.classList.add('readme-badges-row');
        }
      });

      // 3) General multi-line case: wrap any consecutive badge-only siblings under any parent
      const wrapConsecutiveBadgeBlocks = (parent: Element, depth: number) => {
        if (depth > 5) return; // safety
        // Process children list
        const kids = Array.from(parent.childNodes);
        let run: HTMLElement[] = [];
        const flush = () => {
          if (run.length >= 2) {
            const wrapper = document.createElement('div');
            wrapper.className = 'readme-badges-row';
            wrapper.setAttribute('data-badges-wrapped', '1');
            const first = run[0];
            first.parentElement?.insertBefore(wrapper, first);
            run.forEach((node) => {
              node.classList.add('readme-badge-item');
              wrapper.appendChild(node);
            });
          }
          run = [];
        };
        kids.forEach((n) => {
          if (n.nodeType === Node.ELEMENT_NODE) {
            const el = n as HTMLElement;
            if (el.tagName === 'BR') {
              // Ignore <br> between badges so they can be grouped horizontally
              return;
            }
            if (el.getAttribute('data-badges-wrapped') === '1' || el.classList.contains('readme-badges-row')) {
              flush();
              return; // already wrapped
            }
            if (isBadgeOnlyBlock(el)) {
              run.push(el);
              return;
            }
            // recurse before flushing, so nested runs can be handled
            wrapConsecutiveBadgeBlocks(el, depth + 1);
          }
          // non-element or not a badge block → end current run
          flush();
        });
        flush();
      };
      wrapConsecutiveBadgeBlocks(container, 0);

      // 4) Heading-line badges: title followed by multiple badge links/images
      // e.g. "# Project [![badge]][link] [![badge2]][link2]"
      const headingSelectors = ['h1', 'h2', 'h3'];
      headingSelectors.forEach((sel) => {
        container.querySelectorAll<HTMLElement>(sel).forEach((h) => {
          const imgs = h.querySelectorAll('img');
          const links = h.querySelectorAll('a');
          if (imgs.length + links.length >= 2) {
            h.classList.add('readme-badges-heading');
          }
        });
      });
    } catch {}

    // Delegate clicks on anchor links that reference in-page headings
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      if (!href.startsWith('#') || href === '#') return;
      e.preventDefault();
      let id = decodeURIComponent(href.slice(1));
      if (id.startsWith('user-content-')) id = id.replace(/^user-content-/, '');
      const esc = (s: string) => s.replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~ ]/g, '\\$&');
      const el = container.querySelector(`#${esc(id)}`) || document.getElementById(id);
      if (el && 'scrollIntoView' in el) {
        (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    container.addEventListener('click', onClick);
    return () => container.removeEventListener('click', onClick);
  }, [server?.readmeHtml, enhancedReadmeHtml]);

  // Client-side enhancement: if stored README HTML lacks <details>, try fetching and rendering with details/summary preserved
  useEffect(() => {
    const shouldEnhance = !!server?.repositoryUrl && !!server?.readmeUrl && !!server?.readmeHtml && !server.readmeHtml.includes('<details');
    if (!shouldEnhance) return;

    let isCancelled = false;

    const parseOwnerRepo = (url: string): { owner: string; repo: string } | null => {
      try {
        // Accept https://github.com/owner/repo[...]
        const m = url.match(/github\.com\/(.+?)\/(.+?)(?:$|\?|#|\/)/i);
        if (m) return { owner: m[1], repo: m[2].replace(/\.git$/i, '') };
        return null;
      } catch { return null; }
    };

    const enhance = async () => {
      const parsed = parseOwnerRepo(server!.repositoryUrl!);
      if (!parsed) return;
      try {
        // Get default branch
        const repoRes = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`);
        const repoJson = await repoRes.json().catch(() => ({}));
        const branch = repoJson?.default_branch || 'main';

        // Get README content (base64)
        const readmeRes = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}/readme`);
        if (!readmeRes.ok) return;
        const readmeJson: any = await readmeRes.json();
        const base64 = readmeJson?.content as string | undefined;
        if (!base64) return;
        const md = decodeURIComponent(escape(window.atob(base64)));

        // Markdown → HTML
        let rawFull = marked.parse(md) as string;

        // Rewrite relative asset links like in seeding script
        const baseRaw = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${branch}/`;
        const baseBlob = `https://github.com/${parsed.owner}/${parsed.repo}/blob/${branch}/`;
        rawFull = rawFull.replace(/(<img[^>]+src=["'])([^"']+)(["'])/gi, (_m, p1, src, p3) => {
          const isAbsolute = /^(https?:|data:)/i.test(src) || src.startsWith('#');
          const fixed = isAbsolute ? src : new URL(src.replace(/^\//, ''), baseRaw).href;
          return `${p1}${fixed}${p3}`;
        });
        rawFull = rawFull.replace(/(<a[^>]+href=["'])([^"']+)(["'])/gi, (_m, p1, href, p3) => {
          const isAbsolute = /^(https?:|mailto:)/i.test(href) || href.startsWith('#');
          const fixed = isAbsolute ? href : new URL(href.replace(/^\//, ''), baseBlob).href;
          return `${p1}${fixed}${p3}`;
        });

        // Sanitize while allowing details/summary and tables
        const safe = sanitizeHtml(rawFull, {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1','h2','h3','img','pre','code','table','thead','tbody','tr','th','td','details','summary']),
          allowedAttributes: {
            a: ['href','name','target','rel'],
            img: ['src','alt'],
            code: ['class'],
            table: ['class'],
            details: ['open']
          },
          allowedSchemes: ['http','https','mailto']
        });

        if (!isCancelled) setEnhancedReadmeHtml(safe);
      } catch {
        // ignore
      }
    };

    enhance();
    return () => { isCancelled = true; };
  }, [server?.repositoryUrl, server?.readmeUrl, server?.readmeHtml]);

  return (
    <main className="container py-8">
      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign in required</DialogTitle>
            <DialogDescription>
              You need to sign in to like or favorite servers. Continue with GitHub?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLoginDialog(false)}>Cancel</Button>
            <Button onClick={() => { login('github'); }} disabled={isLoggingIn}>
              {isLoggingIn ? 'Redirecting…' : 'Continue with GitHub'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SEO
        title={server ? `${server.name} — MCP Server` : 'MCP Server'}
        description={server?.description ?? 'MCP server details'}
        jsonLd={jsonLd}
      />

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 mb-6">
          <p className="text-sm text-destructive">Failed to load server details.</p>
        </div>
      )}

      <section className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="px-2" onClick={onBack} aria-label="Back">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{server?.name ?? '...'}</h1>
                {server?.trending && <Badge className="inline-flex gap-1"><Flame className="h-3.5 w-3.5" /> Trending</Badge>}
                {server?.official && <Badge variant="secondary" className="inline-flex gap-1"><Shield className="h-3.5 w-3.5" /> Official</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={voteSubmitting}
                  onClick={onVote}
                  className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-60"
                  aria-label="Vote for this server"
                >
                  <ThumbsUp className="h-4 w-4" /> {typeof voteCount === 'number' ? voteCount : (server?.votes ?? 0)}
                </button>
                <button
                  disabled={favSubmitting}
                  onClick={toggleFavorite}
                  className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-60"
                  aria-label="Favorite this server"
                >
                  <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} /> {isFavorite ? 'Favorited' : 'Favorite'}
                </button>
              </div>
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              {server?.maintainerAvatarUrl && (
                <img src={server.maintainerAvatarUrl} alt={server?.author} className="h-6 w-6 rounded-full" />
              )}
              {server?.maintainerUrl ? (
                <a href={server.maintainerUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                  {server?.author}
                </a>
              ) : (
                <span>{server?.author ?? '...'}</span>
              )}
              {typeof server?.maintainerFollowers === 'number' && (
                <span className="text-xs text-muted-foreground">· {server.maintainerFollowers.toLocaleString()} followers</span>
              )}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                {server?.readmeUrl ? (
                  <a href={server.readmeUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    README.md
                  </a>
                ) : (
                  'README.md'
                )}
              </CardTitle>
              <CardDescription>Rendered from the repository</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {server?.readmeHtml ? (
                <div
                  ref={readmeRef}
                  className="prose max-w-none dark:prose-invert break-words"
                  dangerouslySetInnerHTML={{ __html: enhancedReadmeHtml || server.readmeHtml }}
                />
              ) : (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{server?.readmeOverview || server?.description || 'No description available.'}</p>
              )}
              {/* Removed bottom README link; title is now clickable */}
              {server?.readme_last_fetched_at && (
                <p className="text-xs text-muted-foreground">Last updated: {new Date(server.readme_last_fetched_at as any).toLocaleString()}</p>
              )}
            </CardContent>
          </Card>

          {/* Simplified: removed Use cases, Tokens & cost, and Benefits */}

          {/* Left side remains description; repo box moved to right */}
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Repository</CardTitle>
                  <CardDescription>Overview and links</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {server?.websiteUrl && (
                    <Button asChild size="sm" variant="outline">
                      <a href={server.websiteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Website
                      </a>
                    </Button>
                  )}
                  {server?.repositoryUrl && (
                    <Button asChild size="sm" variant="outline">
                      <a href={server.repositoryUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
                        <Github className="h-4 w-4" />
                        GitHub
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Stars</span>
                <span className="inline-flex items-center gap-2"><Star className="h-4 w-4 text-yellow-500" /> {server?.githubStars ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Total contributors</span>
                <span>{server?.contributorsCount ?? '—'}</span>
              </div>
              {server?.topContributors && server.topContributors.length > 0 && (
                <div>
                  <p className="text-sm mb-2">Top contributors</p>
                  <div className="flex flex-wrap gap-3">
                    {server.topContributors.slice(0, 5).map((c) => (
                      <a key={c.login} href={c.html_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:underline">
                        <img src={c.avatar_url} alt={c.login} className="h-6 w-6 rounded-full" />
                        <span className="text-sm">{c.login}{typeof c.contributions === 'number' ? ` (${c.contributions})` : ''}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>License</span>
                <span>{server?.license ?? '—'}</span>
              </div>
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  );
}

export default ServerDetail;


