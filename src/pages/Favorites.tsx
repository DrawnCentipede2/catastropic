import SEO from "@/components/SEO";
import ServerCard from "@/components/ServerCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useFavorites } from "@/hooks/useServers";

const Favorites = () => {
  const { isAuthenticated } = useAuth()
  const { data: favoriteServers, isLoading } = useFavorites()

  return (
    <main className="container py-10">
      <SEO title="Favorites — Catastropic" description="Your favorite MCP servers" />

      <section className="mb-6">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Favorites</h1>
        <p className="text-muted-foreground">Servers you saved for quick access.</p>
      </section>

      {!isAuthenticated ? (
        <Card>
          <CardContent className="text-center py-12">
            <h3 className="text-lg font-medium mb-2">Please sign in</h3>
            <p className="text-muted-foreground mb-4">Sign in to view your favorite servers.</p>
            <Link to="/">
              <Button>Go to Home</Button>
            </Link>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : favoriteServers && favoriteServers.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {favoriteServers.map((server) => (
            <div key={server.id} className="[transform:translateZ(0)] will-change-transform transition-transform hover:-translate-y-0.5">
              <ServerCard server={server} />
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2"><Heart className="h-5 w-5" /> No favorites yet</CardTitle>
            <CardDescription>Discover servers and add them to your favorites.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/">
              <Button>Explore servers</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </main>
  )
}

export default Favorites;


