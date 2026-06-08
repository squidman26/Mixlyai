# Mixly

AI YouTube playlist maker — chat with Claude to design playlists, then save and export track lists as CSV. Connect YouTube to apply playlists directly (coming soon).

**Live site:** https://mixlyai.vercel.app

## Structure

- `public/` — Web UI (chat, saved playlists, credits)
- `api/` — Vercel serverless routes (auth, chat, export, credits)
- `lib/` — Server-side auth, Supabase accounts, and session helpers
- `src/` — CLI chat tool
- `supabase/` — Database migrations

## Setup

1. Copy `.env.example` to `.env` and fill in credentials.
2. Run Supabase migrations in `supabase/migrations/`.
3. Deploy to Vercel with `SESSION_SECRET`, `ANTHROPIC_API_KEY`, and Supabase keys.

### Auth

Users sign up with email, username, and password. Sessions are stored in encrypted cookies.

### Credits

- Chat messages cost 1 credit
- Save & export costs 2 credits
- Paid tiers via Square

### YouTube (direct Google OAuth)

1. Create a Google OAuth web client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Add authorized redirect URI: `https://<your-app-domain>/api/auth/youtube-callback` (e.g. `https://mixlyai.vercel.app/api/auth/youtube-callback`). For local dev, also add `http://localhost:3000/api/auth/youtube-callback`.
3. Enable YouTube Data API v3 on the project.
4. Set env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (or `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET` as a fallback).

Users connect YouTube from the Connections panel after signing in to Mixly. OAuth uses PKCE and stores tokens in your Supabase database — Supabase Auth Google provider is not required.

**Database:** If you see missing-column errors (`access_token`, `saved_playlists.provider`, etc.), run `supabase/pending-schema.sql` in [Supabase SQL Editor](https://supabase.com/dashboard/project/npkmlflciakpzkskkqvy/sql/new), or:

```bash
SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-pending-schema.mjs
```
