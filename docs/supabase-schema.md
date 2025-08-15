# Supabase schema snapshot (MVP)

Project: hilvfxdxmefooodneicl
Generated: kept in sync with code as of current edits

Important tables in use:

- mcp_servers
  - Required: id (uuid, default), name (text), author (text)
  - Common nullable: description, repository_url, website_url
  - Status: text ('pending' | 'approved' | 'rejected')
  - Flags: is_verified, is_official, is_trending
  - Metrics: github_stars (int), total_reviews (int), average_rating (numeric), views_count (int)
  - Maintainership: maintainer_name, maintainer_url, maintainer_avatar_url, maintainer_followers
  - Contributors: contributors_count (int), top_contributors (jsonb)
  - README: readme_url, readme_html, readme_last_fetched_at
  - Ownership: submitted_by (uuid), votes (int)
  - Note: NO category_id column in this table

- mcp_server_submissions
  - For queueing non-owner-verified submissions
  - Columns: id, user_id, name, description, repository_url, npm_package, install_command, tags (text[]), author, status (pending|approved|rejected), admin_notes, reviewed_by, reviewed_at, is_owner_verified, verification_code, verified_at, created_at, updated_at
  - category_id (uuid) exists here and may be used later; not used in MVP

- mcp_users
  - Basic profile for app users; linked to auth users

- mcp_user_favorites, mcp_user_votes, mcp_user_activity, mcp_server_views, mcp_server_clicks
  - Interaction/metrics tables

Notes
- No categories feature in MVP. All category filters and category_id writes to mcp_servers have been removed from the app.
- Owner-verified submissions write directly to mcp_servers with status 'approved'. Others write to mcp_server_submissions (or fallback to mcp_servers with status 'pending' if needed).

If schema changes in Supabase, regenerate local types and reflect here.
