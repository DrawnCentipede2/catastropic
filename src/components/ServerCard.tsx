import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flame, Shield, Star } from "lucide-react";
// import MediaCarousel from "./MediaCarousel";
import type { MediaItem } from "./MediaCarousel";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { userApi } from "@/services/api";
import { useEffect, useState } from "react";

export type Server = {
  id: string;
  name: string;
  author: string;
  official?: boolean;
  trending?: boolean;
  description: string;
  votes: number;
  tags?: string[];
  media?: MediaItem[];
  generatedImage?: string; // Base64 string for AI-generated images
  repositoryUrl?: string;
  githubStars?: number;
  websiteUrl?: string;
  maintainerUrl?: string;
  maintainerAvatarUrl?: string;
  maintainerFollowers?: number;
  contributorsCount?: number;
  topContributors?: Array<{ login: string; html_url: string; avatar_url: string; contributions?: number }>;
  license?: string;
  readmeOverview?: string;
  readmeHtmlPreview?: string;
  readmeHtml?: string;
  readmeUrl?: string;
  readme_last_fetched_at?: string;
  views?: number; // total views
};

interface ServerCardProps {
  server: Server;
  priority?: boolean; // For above-the-fold cards
  // Optional: pass browsing context so we can preserve state/scroll when navigating to details
  browseState?: { filter: string; sort: 'stars' | 'views' | 'created'; search: string };
}

const ServerCard = ({ server, priority = false, browseState }: ServerCardProps) => {
  const starsToShow = typeof server.githubStars === 'number' && server.githubStars > 0 ? server.githubStars : null;
  const { user, isAuthenticated } = (useAuth() as any) || {};
  const [isFavorite, setIsFavorite] = useState<boolean>(() => {
    try {
      if (typeof window === 'undefined') return false;
      return !!localStorage.getItem(`mcp_fav_${server.id}`);
    } catch { return false; }
  });
  const [favSubmitting, setFavSubmitting] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      setIsFavorite(!!localStorage.getItem(`mcp_fav_${server.id}`));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.id]);

  // const displayMedia = useMemo(() => [], []);
  // const hasGeneratedImage = false;

  const handleNavigate = () => {
    try {
      if (typeof window !== 'undefined') {
        const scrollY = window.scrollY || 0
        const payload = {
          filter: browseState?.filter ?? null,
          sort: browseState?.sort ?? null,
          search: browseState?.search ?? '',
          scrollY,
          ts: Date.now(),
        }
        sessionStorage.setItem('browse_state', JSON.stringify(payload))
        // Also push the params to the URL so the landing page can restore state on mount
        const params = new URLSearchParams()
        if (payload.filter) params.set('filter', String(payload.filter))
        if (payload.sort) params.set('sort', String(payload.sort))
        if (payload.search) params.set('q', String(payload.search))
        const newUrl = '/' + (params.toString() ? `?${params.toString()}` : '')
        window.history.replaceState(window.history.state, '', newUrl)
      }
    } catch {}
  }

  const toggleFavorite = async () => {
    try {
      if (!isAuthenticated || !user?.id) {
        toast({ title: 'Sign in required', description: 'Please sign in to save favorites.' });
        return;
      }
      if (favSubmitting) return;
      setFavSubmitting(true);
      const next = !isFavorite;
      setIsFavorite(next);
      if (next) {
        await userApi.addToFavorites(user.id, server.id);
        toast({ title: 'Added to favorites' });
      } else {
        await userApi.removeFromFavorites(user.id, server.id);
        toast({ title: 'Removed from favorites' });
      }
    } catch {
      // Revert on failure
      setIsFavorite(!isFavorite);
      toast({ title: 'Action failed', description: 'Please try again later.' });
    } finally {
      setFavSubmitting(false);
    }
  }

  return (
    <Link to={`/servers/${server.id}`} state={{ fromBrowse: true }} onClick={handleNavigate} className="block group" aria-label={`Open ${server.name}`}>
      <Card className="mcp-card cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg md:text-xl group-hover:underline">
                {server.name}
              </CardTitle>
              {server.trending && (
                <Badge className="inline-flex gap-1"><Flame className="h-3.5 w-3.5" /> Trending</Badge>
              )}
              {server.official && (
                <Badge variant="secondary" className="inline-flex gap-1"><Shield className="h-3.5 w-3.5" /> Official</Badge>
              )}
            </div>
            <span className="sr-only">Menu removed</span>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
            {server.maintainerAvatarUrl && (
              <img src={server.maintainerAvatarUrl} alt={server.author} className="h-5 w-5 rounded-full" />
            )}
            <span>by {server.author}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Images removed for MVP */}
          <p className="text-sm text-muted-foreground line-clamp-3">{server.description}</p>
          <div className="flex items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {server.tags?.map((t) => (
                <Badge key={t} variant="outline">{t}</Badge>
              ))}
            </div>
            {starsToShow !== null && (
              <div className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Star className="h-4 w-4 text-yellow-500" />
                <span>{starsToShow}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

export default ServerCard;
