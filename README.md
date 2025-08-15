# Catastropic

Discover, validate, and showcase Model Context Protocol (MCP) servers. Catastropic helps developers find quality MCP servers, vote weekly, and (soon) monetize their creations.

## Features
- MCP server directory with search, filters, and weekly highlights
- GitHub-based validation (README/SDK evidence, license, activity checks)
- Submission flow (MVP: GitHub sign-in required; owner verification via repo topic)
- Favorites and votes with Supabase Row Level Security (RLS)
- README rendering with safe sanitization and dark-mode aware typography
- Global server count and trending highlights
- Contact form (webhook or mailto fallback)

## Tech Stack
- Vite + React + TypeScript + Tailwind + shadcn/ui
- Supabase (Auth, Postgres, RLS)
- React Query (@tanstack/react-query)
- Service Worker for conservative image caching

## Environment Variables
Create a `.env.local` in the project root:

```
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
# Optional (for contact form webhook)
VITE_CONTACT_WEBHOOK_URL=https://formspree.io/f/xxxxxx
```

Notes:
- Image generation and Blob tokens are not used in the MVP; you can remove any old keys safely.

## Development
```
npm i
npm run dev
```
Local preview of the production build:
```
npm run build
npm run preview
```

## Supabase Setup
- Auth redirect URLs (Supabase → Authentication → URL Configuration):
  - Local dev: http://localhost:5173/auth/callback
  - Local preview: http://localhost:4173/auth/callback
  - Production: https://YOUR_DOMAIN/auth/callback
  - Preview: https://YOUR_PROJECT-*.vercel.app/auth/callback
- RLS policies (already applied) support:
  - `mcp_servers` (status-scoped insert/select/update)
  - `mcp_user_favorites` (insert/select/update/delete only for `auth.uid()`)
- Uniqueness:
  - Case-insensitive uniqueness on `repository_url` for servers/submissions

## Deployment (Vercel)
- Preset: Vite (auto-detected)
- Build: `npm run build`
- Output: `dist`
- SPA rewrites and security headers in `vercel.json`
- Set env vars in Vercel → Project Settings → Environment Variables:
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - Optional: `VITE_CONTACT_WEBHOOK_URL`

## Design & UX
- Dark mode default with header toggle (Sun/Moon)
- Submit page shows validation progress and detailed checks
- Settings/Profile mark WIP sections clearly

## Security & Privacy
- README HTML sanitized before rendering
- RLS enforced for data writes/reads
- Basic security headers via `vercel.json` (HSTS, X-Frame-Options, etc.)

## Roadmap (MVP → Next)
- Stricter, language-agnostic MCP heuristics
- Extended analytics and monitoring
- Monetization tools for creators

## License
MIT

---
Built for the MCP community. Contributions and feedback are welcome.
