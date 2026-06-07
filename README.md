# Mixly

AI playlist curator — chat with Claude to design playlists, then save and export track lists as CSV.

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
