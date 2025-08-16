import SEO from "@/components/SEO";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getSupabaseAnon } from "@/lib/supabase";

const Leaderboard = () => {
  const [top, setTop] = useState<Array<{
    id: string
    name: string
    author?: string | null
    official?: boolean
    trending?: boolean
    tags?: string[]
    // Net votes displayed in the "Votes" column
    votes: number
    // Additional stats for transparency
    upvotes: number
    downvotes: number
    score: number
    scoreDelta?: number | null
  }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const supabase = getSupabaseAnon()

        // Fetch global leaderboard rows
        const { data: globalRows, error: globalErr } = await supabase
          .from("v_mcp_leaderboard_global")
          .select("server_id,name,author,is_official,vpos,vneg,score")
          .order("score", { ascending: false })
          .limit(10)

        if (globalErr) throw globalErr

        // Fetch trending to mark badges and capture weekly score delta (best-effort)
        const { data: trendingRows } = await supabase
          .from("v_mcp_leaderboard_trending")
          .select("server_id,score_delta")
          .order("score_delta", { ascending: false })
          .limit(50)

        const trendingSet = new Set<string>()
        const deltaByServerId = new Map<string, number>()
        if (trendingRows) {
          for (const r of trendingRows) {
            const sid = (r as any).server_id as string
            const delta = Number((r as any).score_delta || 0)
            if (delta > 0) trendingSet.add(sid)
            deltaByServerId.set(sid, delta)
          }
        }

        const mapped = (globalRows || []).map(r => ({
          id: (r as any).server_id as string,
          name: (r as any).name as string,
          author: (r as any).author ?? null,
          official: Boolean((r as any).is_official),
          trending: trendingSet.has((r as any).server_id),
          tags: [] as string[],
          // Net votes (up - down) for display; change to total if desired
          votes: Number((r as any).vpos || 0) - Number((r as any).vneg || 0),
          // Extra stats for the new "Stats" column
          upvotes: Number((r as any).vpos || 0),
          downvotes: Number((r as any).vneg || 0),
          score: Number((r as any).score || 0),
          scoreDelta: deltaByServerId.get((r as any).server_id as string) ?? null,
        }))

        if (!cancelled) setTop(mapped)
      } catch (e) {
        console.error("[leaderboard] fetch error", e)
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load leaderboard")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: top.map((s, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      url: `${window.location.origin}/leaderboard#${s.id}`,
      name: s.name,
    })),
  };

  return (
    <main className="container py-10">
      <SEO
        title="Catastropic Leaderboard — Top Model Context Protocol Servers"
        description="Weekly ranking of the most upvoted Model Context Protocol servers. Discover trending, official, and community favorites."
        jsonLd={jsonLd}
      />
      <section>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-6">Top MCP Servers — Leaderboard</h1>
        <div className="mb-8">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="link" className="p-0 h-auto font-normal">
                How do rankings work?
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-96">
              <div className="text-sm space-y-2">
                <p className="font-medium">How rankings work</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>We sort servers by a weekly score from community votes.</li>
                  <li>Recent votes count more than old ones, so new momentum shows up.</li>
                  <li>We also use safeguards so a few votes don’t unfairly dominate.</li>
                </ul>
                <p className="text-muted-foreground">
                  In short: consistent support over the week ranks highest; spikes fade over time.
                </p>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="p-0 h-auto text-xs text-orange-500">
                      Show technical explanation
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Ranking details</DialogTitle>
                      <DialogDescription>
                        A concise overview of the calculations and variables.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="font-medium">Votes</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Upvotes (vpos) and downvotes (vneg)</li>
                          <li>Net votes = vpos − vneg</li>
                          <li>Positive ratio p = vpos / (vpos + vneg)</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-medium">Confidence adjustment</p>
                        <p className="text-muted-foreground">
                          We use a Wilson lower bound on p (95% confidence) to avoid small-sample spikes.
                        </p>
                      </div>
                      <div>
                        <p className="font-medium">Recency</p>
                        <p className="text-muted-foreground">
                          Recent activity is weighted more than older activity (time decay), so fresh momentum matters.
                        </p>
                      </div>
                      <div>
                        <p className="font-medium">Weekly score and trending</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Weekly score: combines vote quality and recency to rank servers.</li>
                          <li>Trending: week-over-week change in score (Δ).</li>
                        </ul>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Note: The exact computation runs in our database views to ensure consistency and fairness.
                      </p>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Server</TableHead>
                <TableHead className="hidden sm:table-cell">Author</TableHead>
                <TableHead className="hidden md:table-cell">Tags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    Loading leaderboard...
                  </TableCell>
                </TableRow>
              )}
              {!loading && error && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-destructive">
                    {error}
                  </TableCell>
                </TableRow>
              )}
              {!loading && !error && top.map((s, i) => (
                <TableRow key={s.id} id={s.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium">
                    <Link to={`/servers/${s.id}`} className="hover:underline focus:underline">
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{s.author}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex gap-2 flex-wrap">
                      {s.trending && <Badge>Trending</Badge>}
                      {s.official && <Badge variant="secondary">Official</Badge>}
                      {s.tags?.map(t => <Badge key={t} variant="outline">{t}</Badge>)}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </main>
  );
};

export default Leaderboard;
