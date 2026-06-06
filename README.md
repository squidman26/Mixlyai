# Spotifybot

AI playlist builder for Spotify — chat with Claude, match tracks, and create or edit playlists.

**Live site:** https://spotifybot-eight.vercel.app

## What's in this repo

- `public/` — Web UI (HTML, CSS, JavaScript)
- `api/` — Vercel serverless routes (Spotify OAuth, Claude chat, apply playlists)
- `lib/` — Server-side Spotify, auth, and session helpers
- `src/` — Original CLI tools (`npm start`, `npm run chat`, `npm run auth`)

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
