import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, Shield, ThumbsUp, Image as ImageIcon, Loader2 } from "lucide-react";
// import MediaCarousel, { MediaItem } from "./MediaCarousel";
import { useEffect, useMemo, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useServerImage } from "@/hooks/useServers";
import type { Server } from "./ServerCard";

interface ServerCardWithOnDemandImageProps {
  server: Server;
  loadImageOnDemand?: boolean; // If true, loads image only when requested
  priority?: boolean; // For above-the-fold cards
}

const ServerCardWithOnDemandImage = ({ 
  server, 
  loadImageOnDemand = false,
  priority = false 
}: ServerCardWithOnDemandImageProps) => {
  const [votes, setVotes] = useState(server.votes);
  const [requestedImage, setRequestedImage] = useState(false);
  const votedKey = useMemo(() => `mcp_vote_${server.id}`, [server.id]);

  // Load image if:
  // - on-demand loading is disabled (legacy/full mode)
  // - user explicitly requested
  // - or this card is marked as priority (e.g., above the fold)
  const shouldLoadImage = !loadImageOnDemand || requestedImage || priority;
  
  const { 
    data: imageData, 
    isLoading: imageLoading, 
    error: imageError 
  } = useServerImage(shouldLoadImage ? server.id : '');

  useEffect(() => {
    const existing = localStorage.getItem(votedKey);
    if (existing) {
      try {
        const parsed = JSON.parse(existing) as { votes: number };
        if (parsed?.votes) setVotes(parsed.votes);
      } catch (error) {
        console.warn('Failed to parse vote data:', error);
      }
    }
  }, [votedKey]);

  const onVote = () => {
    const hasVoted = localStorage.getItem(votedKey);
    if (hasVoted) {
      toast({ title: "Already voted", description: "One vote per browser for now." });
      return;
    }
    const newVotes = votes + 1;
    setVotes(newVotes);
    localStorage.setItem(votedKey, JSON.stringify({ votes: newVotes }));
    toast({ title: "Thanks for voting!", description: "Enable Supabase to make this persistent." });
  };

  const handleLoadImage = () => {
    setRequestedImage(true);
  };

  // Create media array with appropriate image handling
  // const displayMedia = useMemo(() => [], []);

  // const hasGeneratedImage = false;
  // const canLoadImage = false;

  return (
    <Card className="mcp-card">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg md:text-xl">{server.name}</CardTitle>
          {server.trending && (
            <Badge className="inline-flex gap-1"><Flame className="h-3.5 w-3.5" /> Trending</Badge>
          )}
          {server.official && (
            <Badge variant="secondary" className="inline-flex gap-1"><Shield className="h-3.5 w-3.5" /> Official</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">by {server.author}</p>
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
          <Button onClick={onVote} className="group" aria-label={`Vote for ${server.name}`}>
            <ThumbsUp className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" /> {votes}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ServerCardWithOnDemandImage;