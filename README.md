# Mixly

AI playlist builder for **YouTube Music** and **SoundCloud** — chat with Claude, match tracks, and create or edit playlists.

## What's in this repo

- `public/` — Web UI (HTML, CSS, JavaScript)
- `api/` — Vercel serverless routes (OAuth, Claude chat, apply playlists)
- `lib/` — Server-side YouTube Music, SoundCloud, auth, Supabase accounts, and session helpers
- `src/` — CLI tools (`npm start`, `npm run chat`, `npm run auth`)
- `supabase/` — Database migrations for music-service-linked accounts

## Music providers

| Provider | API | Auth |
|----------|-----|------|
| **YouTube Music** | [YouTube Data API v3](https://developers.google.com/youtube/v3) | Google OAuth 2.0 |
| **SoundCloud** | [SoundCloud API](https://developers.soundcloud.com/) | SoundCloud OAuth 2.0 |

Users choose which service to connect at login. Playlists are created on the connected platform.

## Deploy on Vercel

**Production URL:** https://mixly.vercel.app

### Migrate from Spotifybot (recommended)

If you have the old `spotifybot` Vercel project, rename it in place (keeps env vars and GitHub link):

```bash
VERCEL_TOKEN=... npm run migrate:vercel
```

Or create a fresh project and delete the old one:

```bash
VERCEL_TOKEN=... node scripts/migrate-vercel-to-mixly.mjs --recreate --delete-old
```

If the project is under a team, add `VERCEL_TEAM_ID=team_...`.

### New deployment

1. Import this repo in [Vercel](https://vercel.com) as project **mixly**
2. Add environment variables from `.env.example`
3. Set `APP_BASE_URL=https://mixly.vercel.app` and `OAUTH_REDIRECT_URI=https://mixly.vercel.app/api/auth/callback`
4. Configure the same redirect URI in Google Cloud and SoundCloud developer consoles
5. Enable **YouTube Data API v3** in [Google Cloud Console](https://console.cloud.google.com/)
6. Register your app in the [SoundCloud Developer Portal](https://developers.soundcloud.com/)

Preview deployments redirect OAuth login to production (preview URLs cannot be registered with providers).

## Local development

```bash
npm install
cp .env.example .env
# fill in YouTube, SoundCloud, and Anthropic credentials
npx vercel dev
```

### CLI

```bash
# Log in to YouTube Music
npm run auth -- --provider youtube

# Log in to SoundCloud
npm run auth -- --provider soundcloud

# Chat to design a playlist
npm run chat -- --provider youtube

# Build from CSV
npm start build -f example.csv -n "My Mix" --provider soundcloud
```

## Environment variables

See `.env.example` for required values. Secrets stay on the server — never in the frontend.

### Supabase accounts

On connect, the app upserts a row in Supabase `accounts` (keyed by `provider` + `external_id`) and stores generated playlists in `generated_playlists`.

1. Run the full script in `supabase/setup.sql` in the Supabase SQL editor
2. Copy the **Secret** key into Vercel as `SUPABASE_SECRET_KEY`
3. Check setup: `GET /api/health/supabase` should return `{ "ok": true }`

## Vercel + GitHub + Supabase

See [.github/INTEGRATION.md](.github/INTEGRATION.md) for the full checklist.

```bash
npm run check:integration   # production health
npm run check:accounts      # list Supabase logins (needs SUPABASE_SECRET_KEY)
```
