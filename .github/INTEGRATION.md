# Vercel + GitHub + Supabase integration

## Current status

| Integration | Status |
|-------------|--------|
| GitHub → Vercel auto-deploy | **Connected** — pushes to `main` trigger Production deploys; PRs get Preview deploys |
| Vercel → Supabase accounts | **Not complete** — needs setup below |

Verify anytime:

```bash
# Production health (no secrets needed)
curl https://mixly.vercel.app/api/health/supabase

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

### 3. Configure OAuth providers

**YouTube Music (Google Cloud)**
1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable **YouTube Data API v3**
3. Create OAuth 2.0 credentials (Web application)
4. Add redirect URI: `https://your-domain.vercel.app/api/auth/callback`

**SoundCloud**
1. Register an app in the [SoundCloud Developer Portal](https://developers.soundcloud.com/)
2. Add redirect URI: `https://your-domain.vercel.app/api/auth/callback`

### 4. (Optional) GitHub secret for CI account checks

In GitHub → Settings → Secrets → Actions, add:

- `SUPABASE_SECRET_KEY` — same secret key from Supabase

This lets the integration workflow list logged-in accounts after each deploy.
