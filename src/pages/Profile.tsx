import SEO from "@/components/SEO";
import ServerCard from "@/components/ServerCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Github, MapPin, Calendar, Heart, Settings, Trophy, Upload, Wrench } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserSubmittedServers, useFavorites, useUserActivity } from "@/hooks/useServers";

const Profile = () => {
  const { profile, user, loading: authLoading } = useAuth()
  const { data: submittedServers, isLoading: submittedLoading } = useUserSubmittedServers()
  const { data: favoriteServers, isLoading: favoritesLoading } = useFavorites()
  const { data: userActivity, isLoading: activityLoading } = useUserActivity()
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTabRaw = (searchParams.get('tab') || 'submitted') as 'submitted' | 'favorites' | 'activity'
  const currentTab = (currentTabRaw === 'submitted' || currentTabRaw === 'activity') ? currentTabRaw : 'submitted'

  // Show loading state while auth is loading
  if (authLoading) {
    return (
      <main className="container py-10">
        <div className="space-y-6">
          <div className="flex items-center gap-6">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-96" />
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Redirect to login if not authenticated (this could also be handled at the route level)
  if (!user || !profile) {
    return (
      <main className="container py-10">
        <Card className="text-center py-12">
          <CardContent>
            <h2 className="text-2xl font-semibold mb-4">Please sign in to view your profile</h2>
            <p className="text-muted-foreground mb-4">You need to be logged in to access your profile page.</p>
            <Button asChild>
              <Link to="/">Go to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.username,
    url: `${window.location.origin}/profile`,
    ...(profile.github_id && { sameAs: `https://github.com/${profile.github_id}` }),
  };

  return (
    <main className="container py-10">
      <SEO
        title={`${profile.username} — Catastropic Profile`}
        description={`${profile.username}'s profile on Catastropic. View submitted MCP servers, favorites, and activity stats.`}
        jsonLd={jsonLd}
      />
      
      {/* Profile Header */}
      <section className="mb-8">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <Avatar className="h-24 w-24">
            <AvatarImage src={profile.avatar_url || undefined} alt={profile.username} />
            <AvatarFallback>{profile.username.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 space-y-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{profile.username}</h1>
              <p className="text-muted-foreground">@{profile.username}</p>
            </div>
            
            <p className="text-lg text-muted-foreground max-w-2xl">
              {profile.bio || "No bio provided yet. Update your profile to tell the community about yourself!"}
            </p>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {profile.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {profile.location}
                </div>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>
              {profile.github_id && (
                <a 
                  href={`https://github.com/${profile.github_id}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <Github className="h-4 w-4" />
                  GitHub
                </a>
              )}
            </div>
            
            <div className="flex gap-3">
              <Link to="/settings">
                <Button variant="outline" className="inline-flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Edit Profile
                </Button>
              </Link>
              <Link to="/submit">
                <Button className="inline-flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Submit Server
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Separator className="mb-8" />

      {/* Stats Cards */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Servers Submitted</CardDescription>
            <CardTitle className="text-2xl">{profile.servers_submitted}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Votes Received</CardDescription>
            <CardTitle className="text-2xl">{profile.total_votes.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Favorite Servers</CardDescription>
            <CardTitle className="text-2xl">{favoriteServers?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="inline-flex items-center gap-1">
              <Trophy className="h-4 w-4" />
              Community Rank
            </CardDescription>
            <CardTitle className="text-2xl">
              {profile.community_rank > 0 ? `#${profile.community_rank}` : 'Unranked'}
            </CardTitle>
          </CardHeader>
        </Card>
      </section>

      {/* Content Tabs */}
      <section>
        <Tabs value={currentTab} onValueChange={(v) => setSearchParams({ tab: v })} className="space-y-6">
          <TabsList>
            <TabsTrigger value="submitted">Submitted Servers</TabsTrigger>
            <TabsTrigger value="activity" disabled aria-disabled title="Work in progress">Activity</TabsTrigger>
          </TabsList>
          
          <TabsContent value="submitted" className="space-y-6">
            {submittedLoading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-64 w-full" />
                ))}
              </div>
            ) : submittedServers && submittedServers.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {submittedServers.map((server) => (
                  <div key={server.id} className="[transform:translateZ(0)] will-change-transform transition-transform hover:-translate-y-0.5">
                    <ServerCard server={server} />
                  </div>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No servers submitted yet</h3>
                  <p className="text-muted-foreground mb-4">Share your first MCP server with the community.</p>
                  <Link to="/submit">
                    <Button>Submit your first server</Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          
          
          <TabsContent value="activity" className="space-y-6">
            <Alert>
              <Wrench className="h-4 w-4" />
              <AlertTitle>Work in progress</AlertTitle>
              <AlertDescription>
                The activity section is not ready yet. We are working on it.
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
};

export default Profile;