# Spotifybot

AI playlist builder for Spotify — chat with Claude, match tracks, and create or edit playlists.

**Live site:** https://spotifybot-eight.vercel.app

## What's in this repo

- `public/` — Web UI (HTML, CSS, JavaScript)
- `api/` — Vercel serverless routes (Spotify OAuth, Claude chat, apply playlists)
- `lib/` — Server-side Spotify, auth, Supabase accounts, and session helpers
- `src/` — Original CLI tools (`npm start`, `npm run chat`, `npm run auth`)
- `supabase/` — Database migrations for Spotify-linked accounts

## Vercel + GitHub + Supabase

GitHub is already connected to Vercel — pushes to `main` deploy to production automatically. See [.github/INTEGRATION.md](.github/INTEGRATION.md) for the full checklist.

```bash
npm run check:integration   # production health
npm run check:accounts      # list Supabase logins (needs SUPABASE_SECRET_KEY)
```

## Deploy on Vercel

1. Import this repo in [Vercel](https://vercel.com)
2. Add environment variables from `.env.example`
3. Add Spotify redirect URI for production:
   `https://spotifybot-eight.vercel.app/api/auth/callback`
   Preview deployments redirect Spotify login to production (preview URLs cannot be registered in Spotify).
4. Set `APP_BASE_URL` and `SPOTIFY_REDIRECT_URI` in Vercel to your production URL.
5. In [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) → your app → **Users and Access**, add each tester’s Spotify email if they need direct playlist push (Development Mode allows up to 5 users). Public users can **sign up with email/username/password** and **import/export CSV** — song matching uses the app’s Spotify API credentials server-side.
6. Run the latest Supabase migration (`supabase/migrations/20250608120000_app_user_auth.sql`) so app accounts support username/password login.

## Local development

```bash
npm install
cp .env.example .env
# fill in Spotify + Anthropic credentials
npx vercel dev
```

## Environment variables

See `.env.example` for required values. Secrets stay on the server — never in the frontend.

### Supabase accounts (Spotify users)

Spotify sign-in still uses the existing OAuth flow. On connect, the app upserts a row in Supabase `accounts` and stores generated playlists in `generated_playlists`.

1. In [Supabase SQL editor](https://supabase.com/dashboard/project/npkmlflciakpzkskkqvy/sql), run the full script in `supabase/setup.sql` (creates `accounts` + `generated_playlists`).
2. In Supabase → **Settings → API**, copy the **Secret** key (`sb_secret_...`) into Vercel as `SUPABASE_SECRET_KEY`.
3. On Vercel, add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`, or run:
   ```bash
   VERCEL_TOKEN=... SUPABASE_SECRET_KEY=... npm run setup:production

Check setup: `GET /api/health/supabase` should return `{ "ok": true }`.
   ```
