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

### YouTube (Google OAuth via Supabase)

1. Create a Google OAuth web client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Add authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
3. Enable YouTube Data API v3 on the project.
4. Set env vars: `GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET`
5. Enable Google provider in Supabase Dashboard → Authentication → Providers, or run:

```bash
SUPABASE_ACCESS_TOKEN=sbp_... \
GOOGLE_CLIENT_ID=... \
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET=... \
node scripts/configure-supabase-google.mjs
```

6. Add your app URL to Supabase Auth → URL configuration → Redirect URLs (e.g. `https://mixlyai.vercel.app/*`)

Users connect YouTube from the Connections panel after signing in to Mixly.
