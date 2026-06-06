# Spotifybot

AI playlist builder for Spotify — chat with Claude, match tracks, and create or edit playlists.

**Live site:** https://spotifybot-eight.vercel.app

## What's in this repo

- `public/` — Web UI (HTML, CSS, JavaScript)
- `api/` — Vercel serverless routes (Spotify OAuth, Claude chat, apply playlists)
- `lib/` — Server-side Spotify, auth, Supabase accounts, and session helpers
- `src/` — Original CLI tools (`npm start`, `npm run chat`, `npm run auth`)
- `supabase/` — Database migrations for Spotify-linked accounts

## Deploy on Vercel

1. Import this repo in [Vercel](https://vercel.com)
2. Add environment variables from `.env.example`
3. Add Spotify redirect URI: `https://YOUR-DOMAIN.vercel.app/api/auth/callback`

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

1. In [Supabase](https://supabase.com/dashboard/project/npkmlflciakpzkskkqvy) → **Settings → API**, copy the **service_role** key into `SUPABASE_SERVICE_ROLE_KEY`.
2. Apply the schema (pick one):
   - **SQL editor:** paste `supabase/migrations/20250606120000_create_accounts.sql`
   - **CLI:** `supabase link --project-ref npkmlflciakpzkskkqvy && supabase db push`
   - **Script:** `SUPABASE_ACCESS_TOKEN=... npm run setup:production`
3. On Vercel, add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`, or run:
   ```bash
   VERCEL_TOKEN=... SUPABASE_SERVICE_ROLE_KEY=... npm run setup:production
   ```
