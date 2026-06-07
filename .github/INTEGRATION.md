# Vercel + GitHub + Supabase integration

## Current status

| Integration | Status |
|-------------|--------|
| GitHub → Vercel auto-deploy | **Connected** — pushes to `main` trigger Production deploys; PRs get Preview deploys |
| Vercel → Supabase accounts | **Not complete** — needs setup below |

Verify anytime:

```bash
# Production health (no secrets needed)
curl https://mixlyai.vercel.app/api/health/supabase

# Full account check (needs secret key)
SUPABASE_SECRET_KEY=sb_secret_... node scripts/check-accounts.mjs
```

GitHub Actions also runs `.github/workflows/integration-check.yml` on every push to `main`.

## Finish Supabase setup

### 1. Create tables

Run `supabase/setup.sql` in your Supabase SQL editor.

For existing Spotifybot deployments, also run `supabase/migrations/20250608120000_mixly_providers.sql`.

### 2. Add Vercel environment variables

| Variable | Environments |
|----------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Production, Preview |
| `SUPABASE_SECRET_KEY` | Production, Preview |
| `YOUTUBE_CLIENT_ID` | Production, Preview |
| `YOUTUBE_CLIENT_SECRET` | Production, Preview |
| `SOUNDCLOUD_CLIENT_ID` | Production, Preview |
| `SOUNDCLOUD_CLIENT_SECRET` | Production, Preview |
| `OAUTH_REDIRECT_URI` | Production |
| `APP_BASE_URL` | Production |

Redeploy after saving.

### 3. Migrate Vercel project to MixlyAI

Rename the existing Vercel project (preserves env vars and GitHub integration):

```bash
VERCEL_TOKEN=... npm run migrate:vercel
```

This renames `spotifybot` (or `mixly`) → `mixlyai`, sets `APP_BASE_URL` and `OAUTH_REDIRECT_URI` to `https://mixlyai.vercel.app`, and keeps your deployment history.

To start fresh instead:

```bash
VERCEL_TOKEN=... node scripts/migrate-vercel-to-mixlyai.mjs --recreate --delete-old
```

After migration, remove legacy `SPOTIFY_*` env vars and add `YOUTUBE_*` / `SOUNDCLOUD_*` from `.env.example`.

### 4. Configure OAuth providers

**YouTube Music (Google Cloud)**
1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable **YouTube Data API v3**
3. Create OAuth 2.0 credentials (Web application)
4. Add redirect URI: `https://mixlyai.vercel.app/api/auth/callback`

**SoundCloud**
1. Register an app in the [SoundCloud Developer Portal](https://developers.soundcloud.com/)
2. Add redirect URI: `https://mixlyai.vercel.app/api/auth/callback`

### 5. Rename GitHub repo (optional)

In GitHub → Settings → General → Repository name, rename to `MixlyAI`. Re-link the repo in Vercel if the GitHub integration breaks.

### 6. (Optional) GitHub secret for CI account checks

In GitHub → Settings → Secrets → Actions, add:

- `SUPABASE_SECRET_KEY` — same secret key from Supabase

This lets the integration workflow list logged-in accounts after each deploy.
