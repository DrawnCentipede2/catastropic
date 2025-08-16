import { Link, NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Flame, User, Settings, Info, LogOut, Github, Heart, Sun, Moon, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/Catastropic_cat_logo.png";

const activeClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-secondary text-foreground' : 'hover:bg-secondary'}`;
const Header = () => {
  const { user, profile, isAuthenticated, login, logout, isLoggingIn, loading, _v } = useAuth() as any;
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('theme')
      if (saved === 'dark' || saved === 'light') return saved
    } catch {}
    // infer from document or system
    try {
      if (document.documentElement.classList.contains('dark')) return 'dark'
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
    } catch {}
    return 'light'
  })

  useEffect(() => {
    const apply = (t: 'light' | 'dark') => {
      document.documentElement.classList.toggle('dark', t === 'dark')
      try { localStorage.setItem('theme', t) } catch {}
    }
    apply(theme)
  }, [theme])

  const toggleTheme = () => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  // Minimal debug signal for auth state changes during development
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    require('react').useEffect(() => {
      console.debug('[ui] auth state', { isAuthenticated, loading, _v })
    }, [isAuthenticated, loading, _v])
  } catch {}

  return (
    <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b">
      <nav className="container flex items-center justify-between h-16">
        <Link to="/" className="font-semibold tracking-tight text-xl flex items-center gap-2">
          <img src={logo} alt="Catastropic logo" className="h-10 w-10" />
          Catastropic
        </Link>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="hidden md:inline-flex" asChild>
            <Link to="/about">About</Link>
          </Button>
          <Button variant="outline" className="hidden md:inline-flex" asChild>
            <Link to="/leaderboard">Leaderboard</Link>
          </Button>
          {isAuthenticated && (
            <Button variant="outline" className="hidden md:inline-flex" asChild>
              <Link to="/favorites" aria-label="Your favorites">
                Favorites
              </Link>
            </Button>
          )}
        

          {isAuthenticated ? (
            <>
              <Button variant="outline" className="hidden md:inline-flex" asChild>
                <Link to="/submit">Submit Server</Link>
              </Button>
              
              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.avatar_url || undefined} alt="Profile" />
                      <AvatarFallback>
                        {profile?.username?.slice(0, 2).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium">{profile?.username}</p>
                      <p className="w-[200px] truncate text-sm text-muted-foreground">
                        {profile?.email}
                      </p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/contact" className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Contact
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={toggleTheme} className="flex items-center gap-2 cursor-pointer">
                    {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                    {theme === 'dark' ? 'Dark mode' : 'Light mode'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="flex items-center gap-2 text-red-600 cursor-pointer"
                    onClick={logout}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button
              disabled={isLoggingIn}
              className="flex items-center gap-2"
              onClick={() => login('github')}
              aria-label="Sign in with GitHub"
            >
              <Github className="h-4 w-4" />
              {isLoggingIn ? 'Signing in...' : 'Sign in'}
            </Button>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Header;
