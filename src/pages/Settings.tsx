import SEO from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { User, Bell, Shield, Palette, Github, Mail, MapPin, Save, AlertCircle, Wrench } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUpdateProfile } from "@/hooks/useServers";

const Settings = () => {
  const { profile, user, loading: authLoading } = useAuth()
  const updateProfile = useUpdateProfile()
  
  // Form state
  const [formData, setFormData] = useState({
    username: '',
    bio: '',
    location: '',
    github_id: '',
  })
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('theme') : null
    return (saved === 'light' || saved === 'dark' || saved === 'system') ? (saved as any) : 'system'
  })
  
  // Initialize form data when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        username: profile.username || '',
        bio: profile.bio || '',
        location: profile.location || '',
        github_id: profile.github_id || '',
      })
    }
  }, [profile])

  // Apply theme to document root
  useEffect(() => {
    const root = document.documentElement
    const apply = (t: 'light' | 'dark' | 'system') => {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      const isDark = t === 'dark' || (t === 'system' && prefersDark)
      root.classList.toggle('dark', isDark)
      try { localStorage.setItem('theme', t) } catch {}
    }
    apply(theme)
    // Respond to system theme changes when in system mode
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => { if (theme === 'system') apply('system') }
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [theme])

  const handleSaveProfile = async () => {
    // Validation
    if (!formData.username.trim()) {
      toast({
        title: "Username required",
        description: "Please enter a username.",
        variant: "destructive",
      })
      return
    }

    if (formData.username.length < 3) {
      toast({
        title: "Username too short",
        description: "Username must be at least 3 characters long.",
        variant: "destructive",
      })
      return
    }

    if (formData.username.length > 50) {
      toast({
        title: "Username too long",
        description: "Username must be less than 50 characters.",
        variant: "destructive",
      })
      return
    }

    if (formData.bio && formData.bio.length > 500) {
      toast({
        title: "Bio too long",
        description: "Bio must be less than 500 characters.",
        variant: "destructive",
      })
      return
    }

    try {
      await updateProfile.mutateAsync({
        username: formData.username.trim(),
        bio: formData.bio.trim() || null,
        location: formData.location.trim() || null,
        // GitHub username is managed by OAuth provider and cannot be edited
      })
      
      toast({
        title: "Profile updated",
        description: "Your profile changes have been saved successfully.",
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      toast({
        title: "Error updating profile",
        description: errorMessage.includes('duplicate') ? 
          "This username is already taken. Please choose a different one." : 
          "There was an error saving your changes. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleSave = (section: string) => {
    toast({
      title: `${section} settings saved`,
      description: "Your changes have been saved successfully.",
    });
  };

  // Show loading state while auth is loading
  if (authLoading) {
    return (
      <main className="container py-10">
        <div className="max-w-4xl">
          <div className="mb-8">
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-5 w-96" />
          </div>
          <div className="space-y-8">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </main>
    )
  }

  // Redirect to login if not authenticated
  if (!user || !profile) {
    return (
      <main className="container py-10">
        <Card className="text-center py-12">
          <CardContent>
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-4">Please sign in to access settings</h2>
            <p className="text-muted-foreground mb-4">You need to be logged in to manage your account settings.</p>
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
    '@type': 'SettingsPage',
    name: 'User Settings',
    url: `${window.location.origin}/settings`,
  };

  return (
    <main className="container py-10">
      <SEO
        title="Settings — Catastropic"
        description="Manage your account settings, notifications, privacy preferences, and theme settings."
        jsonLd={jsonLd}
      />
      
      <div className="max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage your account preferences and platform settings.</p>
        </div>

        {/* Profile Completion Banner */}
        {(!profile.bio || !profile.location) && (
          <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-full">
                  <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-blue-900 dark:text-blue-100">Complete your profile</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Add more information to help the community get to know you better.
                  </p>
                  <div className="flex gap-2 mt-3 text-xs">
                    {!profile.bio && <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">Add bio</span>}
                    {!profile.location && <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">Add location</span>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-8">
          {/* Account Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Account Settings
              </CardTitle>
              <CardDescription>
                Update your profile information and account details.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={profile.avatar_url || undefined} alt="Profile picture" />
                  <AvatarFallback>{profile.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <Button variant="outline" size="sm" disabled>Change Avatar</Button>
                  <p className="text-xs text-muted-foreground mt-1">Connected via OAuth provider</p>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input 
                  id="username" 
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter your username"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  Email
                </Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={profile.email} 
                  disabled 
                />
                <p className="text-xs text-muted-foreground">Email cannot be changed (managed by OAuth provider)</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea 
                  id="bio" 
                  rows={3}
                  value={formData.bio}
                  onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Tell the community about yourself... (e.g., your interests, what you're building, your expertise)"
                  maxLength={500}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {!formData.bio ? "A good bio helps others understand your background and interests" : ""}
                  </span>
                  <span>{formData.bio.length}/500 characters</span>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location" className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    Location
                  </Label>
                  <Input 
                    id="location" 
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Your location"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="github" className="flex items-center gap-1">
                    <Github className="h-4 w-4" />
                    GitHub Username
                  </Label>
                  <Input 
                    id="github" 
                    value={formData.github_id}
                    disabled
                    placeholder="GitHub username"
                  />
                  <p className="text-xs text-muted-foreground">Linked via OAuth; cannot be edited.</p>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button 
                  onClick={handleSaveProfile}
                  disabled={updateProfile.isPending}
                  className="inline-flex items-center gap-2"
                >
                  {updateProfile.isPending ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Choose what notifications you want to receive.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <Wrench className="h-4 w-4" />
                <AlertTitle>Work in progress</AlertTitle>
                <AlertDescription>
                  This section is not ready yet. We are working on notification preferences.
                </AlertDescription>
              </Alert>
              <div className="opacity-50 pointer-events-none select-none" aria-disabled>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-votes">Email notifications for votes</Label>
                    <p className="text-sm text-muted-foreground">Get notified when someone votes for your servers.</p>
                  </div>
                  <Switch id="email-votes" defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-submissions">Email notifications for new submissions</Label>
                    <p className="text-sm text-muted-foreground">Weekly digest of new MCP servers.</p>
                  </div>
                  <Switch id="email-submissions" defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-leaderboard">Leaderboard updates</Label>
                    <p className="text-sm text-muted-foreground">Get notified when your rank changes.</p>
                  </div>
                  <Switch id="email-leaderboard" />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="push-notifications">Push notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive push notifications in your browser.</p>
                  </div>
                  <Switch id="push-notifications" />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="marketing-emails">Marketing emails</Label>
                    <p className="text-sm text-muted-foreground">Platform updates, new features, and tips.</p>
                  </div>
                  <Switch id="marketing-emails" defaultChecked />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => handleSave('Notification')} disabled>Save Preferences</Button>
              </div>
              </div>
            </CardContent>
          </Card>

          {/* Privacy Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Privacy Settings
              </CardTitle>
              <CardDescription>
                Control your privacy and data sharing preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <Wrench className="h-4 w-4" />
                <AlertTitle>Work in progress</AlertTitle>
                <AlertDescription>
                  This section is not ready yet. We are working on privacy settings.
                </AlertDescription>
              </Alert>
              <div className="opacity-50 pointer-events-none select-none" aria-disabled>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="public-profile">Public profile</Label>
                    <p className="text-sm text-muted-foreground">Make your profile visible to other users.</p>
                  </div>
                  <Switch id="public-profile" defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="show-activity">Show activity</Label>
                    <p className="text-sm text-muted-foreground">Display your recent votes and submissions publicly.</p>
                  </div>
                  <Switch id="show-activity" defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="analytics">Analytics tracking</Label>
                    <p className="text-sm text-muted-foreground">Help us improve by sharing anonymous usage data.</p>
                  </div>
                  <Switch id="analytics" defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="personalization">Content personalization</Label>
                    <p className="text-sm text-muted-foreground">Personalize your feed based on your preferences.</p>
                  </div>
                  <Switch id="personalization" defaultChecked />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => handleSave('Privacy')} disabled>Save Privacy Settings</Button>
              </div>
              </div>
            </CardContent>
          </Card>


          {/* Danger Zone */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible and destructive actions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg">
                <div>
                  <div className="font-medium">Delete Account</div>
                  <div className="text-sm text-muted-foreground">Permanently delete your account and all data.</div>
                </div>
                <Button variant="destructive" size="sm">Delete Account</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
};

export default Settings;