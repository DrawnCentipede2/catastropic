import SEO from "@/components/SEO";
import ServerCard from "@/components/ServerCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useServers } from "@/hooks/useServers";
import { Flame, Shield, AlertCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getSupabaseAnon } from "@/lib/supabase";

type Filter = 'all' | 'trending' | 'official';

const Index = () => {
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(50);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<'stars'|'views'|'created'>('stars');
  const restoreAppliedRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Fetch servers based on current filter
  // Debug: track filter changes
  console.debug('[ui] filter', { filter })
  const { data, isLoading, error } = useServers({
    trending: filter === 'trending' ? true : undefined,
    official: filter === 'official' ? true : undefined,
    limit: limit,
    // @ts-ignore sort added in API
    sort,
    search: search || undefined,
    // no offset: we request first N; increasing limit handles infinite load
  });
  console.debug('[ui] servers', { isLoading, error: error?.message, total: data?.total, count: data?.servers?.length })
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    require('react').useEffect(() => {
      console.log('[ui] useServers changed', { isLoading, error: error?.message, total: data?.total, servers: data?.servers?.length })
    }, [isLoading, error?.message, data?.total, data?.servers?.length])
  } catch {}

  const servers = data?.servers || [];
  const totalServers = data?.total || 0;

  // Global approved servers count (independent of current filters)
  const [totalApprovedCount, setTotalApprovedCount] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseAnon()
        const { count, error } = await supabase
          .from('mcp_servers')
          .select('*', { head: true, count: 'exact' })
          .eq('status', 'approved')
        if (!error && typeof count === 'number' && !cancelled) setTotalApprovedCount(count)
      } catch {}
    })()
    return () => { cancelled = true }
  }, [])

  // On first mount, read URL params to restore filter/sort/search
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const f = params.get('filter') as Filter | null;
      const s = params.get('sort') as 'stars'|'views'|'created' | null;
      const q = params.get('q');
      if (f && (['all','trending','official'] as string[]).includes(f) && f !== filter) setFilter(f as Filter);
      if (s && (['stars','views','created'] as string[]).includes(s) && s !== sort) setSort(s as any);
      if (typeof q === 'string' && q !== search) setSearch(q);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch highlights for the sidebar (trending and official servers)
  const { data: trendingData, isLoading: loadingTrending, error: trendingError } = useServers({ trending: true, limit: 4 });
  const { data: officialData, isLoading: loadingOfficial, error: officialError } = useServers({ official: true, limit: 3 });
  console.debug('[ui] highlights', {
    loadingTrending,
    trendingError: trendingError?.message,
    trendingTotal: trendingData?.total,
    trendingCount: trendingData?.servers?.length,
    loadingOfficial,
    officialError: officialError?.message,
    officialTotal: officialData?.total,
    officialCount: officialData?.servers?.length,
  })

  const trendingServers = trendingData?.servers || [];
  const officialServers = officialData?.servers || [];

  // Weekly highlights based on score delta from the trending view
  const [trendingHighlights, setTrendingHighlights] = useState<Array<{ id: string; name: string; author: string | null; avatarUrl: string | null; delta: number }>>([])
  const [loadingHighlights, setLoadingHighlights] = useState(false)
  useEffect(() => {
    let cancelled = false
    const loadHighlights = async () => {
      try {
        setLoadingHighlights(true)
        const supabase = getSupabaseAnon()
        // Get top servers by weekly score delta
        const { data: trendingRows, error: trErr } = await supabase
          .from('v_mcp_leaderboard_trending')
          .select('server_id,score_delta')
          .order('score_delta', { ascending: false })
          .limit(6)
        if (trErr) throw trErr
        const ids = (trendingRows || []).map(r => (r as any).server_id as string)
        if (ids.length === 0) {
          if (!cancelled) setTrendingHighlights([])
          return
        }
        // Fetch names/authors/avatars for these ids from main table
        const { data: detailsRows, error: detErr } = await supabase
          .from('mcp_servers')
          .select('id,name,author,maintainer_avatar_url')
          .in('id', ids)
        if (detErr) throw detErr
        const byId: Record<string, { name: string; author: string | null; avatarUrl: string | null }> = {}
        for (const d of detailsRows || []) {
          byId[(d as any).id as string] = {
            name: (d as any).name as string,
            author: ((d as any).author ?? null) as string | null,
            avatarUrl: ((d as any).maintainer_avatar_url ?? null) as string | null,
          }
        }
        const merged = (trendingRows || [])
          .map(r => {
            const id = (r as any).server_id as string
            const delta = Number((r as any).score_delta || 0)
            const meta = byId[id]
            if (!meta) return null
            return { id, name: meta.name, author: meta.author, avatarUrl: meta.avatarUrl, delta }
          })
          .filter(Boolean) as Array<{ id: string; name: string; author: string | null; avatarUrl: string | null; delta: number }>
        if (!cancelled) setTrendingHighlights(merged)
      } catch (e) {
        if (!cancelled) setTrendingHighlights([])
      } finally {
        if (!cancelled) setLoadingHighlights(false)
      }
    }
    loadHighlights()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && servers.length < totalServers) {
          setLimit((prev) => prev + 50);
        }
      });
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [servers.length, totalServers]);

  // Reset limit when filter changes
  useEffect(() => {
    setLimit(50);
  }, [filter]);

  // After data is loaded, restore scroll once if we have a stored position
  useEffect(() => {
    if (restoreAppliedRef.current) return;
    if (isLoading) return;
    if (servers.length === 0) return;
    try {
      const raw = sessionStorage.getItem('browse_state');
      if (!raw) return;
      const browse = JSON.parse(raw) as { scrollY?: number | null };
      const y = typeof browse.scrollY === 'number' ? browse.scrollY : null;
      if (y !== null) {
        setTimeout(() => {
          window.scrollTo({ top: y, behavior: 'instant' as any });
        }, 50);
        restoreAppliedRef.current = true;
      }
    } catch {}
  }, [isLoading, servers.length]);

  const heroJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Catastropic',
    url: window.location.origin,
  };

  const listJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: servers.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s.name })),
  };

  return (
    <main>
      <SEO
        title="Catastropic — Discover Model Context Protocol Servers"
        description="Explore the latest, trending, and official Model Context Protocol servers. Vote weekly, see the leaderboard, and showcase with images or videos."
        jsonLd={[heroJsonLd, listJsonLd]}
      />
      <section className="container pt-10 pb-6">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
              Discover Model Context Protocol Servers
            </h1>
            <p className="text-lg text-muted-foreground mt-4">
              A community hub for MCP servers — explore demos, vote weekly, and monetize your creations.
            </p>
            <div className="mt-6 flex gap-3">
              <Link to="/submit"><Button>Submit your server</Button></Link>
              <Link to="/leaderboard"><Button variant="secondary">View leaderboard</Button></Link>
            </div>
          </div>
          <div className="rounded-xl border p-4 bg-secondary/50">
            <p className="text-sm text-muted-foreground mb-3">This week's highlights</p>
            <div className="flex flex-wrap gap-2">
              {(loadingHighlights ? [] : trendingHighlights).map(s => (
                <Popover key={s.id}>
                  <PopoverTrigger asChild>
                    <button type="button" className="inline-flex">
                      <Badge className="inline-flex items-center gap-1">
                        <Flame className="h-3.5 w-3.5"/> {s.name}
                      </Badge>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start">
                    <Link to={`/servers/${s.id}`} className="block">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {s.avatarUrl && (
                            <img src={s.avatarUrl} alt={s.author || 'author'} className="h-6 w-6 rounded-full" />
                          )}
                          <div>
                            <p className="text-sm font-medium leading-none">{s.name}</p>
                            {s.author && <p className="text-xs text-muted-foreground">by {s.author}</p>}
                          </div>
                        </div>
                        <p className="text-xs">This week: <span className={s.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{s.delta >= 0 ? `+${s.delta}` : s.delta}</span></p>
                      </div>
                    </Link>
                  </PopoverContent>
                </Popover>
              ))}
              {officialServers.map(s => (
                <Popover key={s.id}>
                  <PopoverTrigger asChild>
                    <button type="button" className="inline-flex">
                      <Badge variant="secondary" className="inline-flex items-center gap-1">
                        <Shield className="h-3.5 w-3.5"/> {s.name}
                      </Badge>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start">
                    <Link to={`/servers/${s.id}`} className="block">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {s.maintainerAvatarUrl && (
                            <img src={s.maintainerAvatarUrl} alt={s.author || 'author'} className="h-6 w-6 rounded-full" />
                          )}
                          <div>
                            <p className="text-sm font-medium leading-none">{s.name}</p>
                            {s.author && <p className="text-xs text-muted-foreground">by {s.author}</p>}
                          </div>
                        </div>
                        {typeof s.githubStars === 'number' && s.githubStars >= 0 && (
                          <p className="text-xs">Stars: <span className="text-foreground">{s.githubStars}</span></p>
                        )}
                      </div>
                    </Link>
                  </PopoverContent>
                </Popover>
              ))}
            </div>
            <div className="mt-2">
              <Link to="/leaderboard" className="text-xs text-muted-foreground underline underline-offset-2">See full leaderboard</Link>
            </div>
          </div>
        </div>
      </section>
      <Separator />
      <section className="container py-8">
        <div className="flex flex-wrap items-center gap-3 mb-6 justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Browse</span>
            <div className="inline-flex rounded-lg border bg-card p-1">
            {(['all','trending','official'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f); }}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${filter===f ? 'bg-secondary' : 'hover:bg-secondary'}`}
                aria-pressed={filter===f}
              >
                {f === 'trending' ? 'Trending' : f === 'official' ? 'Official' : 'All'}
              </button>
            ))}
            </div>
          </div>
          {/* Global count shown between filters and search */}
          <div className="hidden md:block text-sm text-muted-foreground">
            {typeof totalApprovedCount === 'number' ? `${totalApprovedCount} servers` : '\u00A0'}
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search servers..."
              className="w-full md:w-64"
            />
            <Select value={sort} onValueChange={(v)=> setSort(v as any)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stars">Stars</SelectItem>
                <SelectItem value="views">Views</SelectItem>
                <SelectItem value="created">Creation date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 mb-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">
                Failed to load servers. Please try again later.
              </p>
            </div>
          </div>
        )}

        {isLoading && servers.length === 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="rounded-lg border bg-card p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-5 w-12" />
                </div>
                <Skeleton className="h-16 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {servers.map((s, index) => (
              <div key={s.id} className="[transform:translateZ(0)] will-change-transform transition-transform hover:-translate-y-0.5">
                <ServerCard server={s} priority={index < 3} />
              </div>
            ))}
          </div>
        )}

        <div ref={sentinelRef} className="h-8" />
        
        {totalServers > 0 && servers.length >= totalServers && (
          <p className="text-center text-sm text-muted-foreground mt-6">You've reached the end.</p>
        )}

        {totalServers === 0 && !isLoading && !error && (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground mb-2">No servers found</p>
            <p className="text-sm text-muted-foreground">
              {filter === 'all' 
                ? 'Be the first to submit a server!' 
                : `No ${filter} servers available yet.`
              }
            </p>
          </div>
        )}

        {/* Fallback "Load more" button in case IntersectionObserver doesn't trigger */}
        {servers.length < totalServers && (
          <div className="flex justify-center mt-4">
            <Button variant="outline" onClick={() => setLimit((prev)=> prev + 50)}>Load more</Button>
          </div>
        )}
      </section>
    </main>
  );
};

export default Index;
