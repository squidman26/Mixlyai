# Vercel + GitHub + Supabase integration

## Current status

| Integration | Status |
|-------------|--------|
| GitHub → Vercel auto-deploy | **Connected** — pushes to `main` trigger Production deploys |
| Vercel → Supabase | Configure `SUPABASE_SECRET_KEY` and publishable key in Vercel |

Verify anytime:

```bash
# Production health (no secrets needed)
curl https://mixlyai.vercel.app/api/health/supabase

# Full account check (needs secret key)
SUPABASE_SECRET_KEY=sb_secret_... node scripts/check-accounts.mjs
```

GitHub Actions runs `.github/workflows/integration-check.yml` on every push to `main`.

## Finish Supabase setup

### 1. Create tables

Run migrations in `supabase/migrations/` or `supabase/setup.sql` in the [Supabase SQL editor](https://supabase.com/dashboard/project/npkmlflciakpzkskkqvy/sql).

### 2. Add Vercel environment variables

In [Vercel project settings](https://vercel.com/playlistmaker-s-projects/mixlyai/settings/environment-variables):

| Variable | Environments |
|----------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Production, Preview |
| `SUPABASE_SECRET_KEY` | Production |
| `GOOGLE_CLIENT_ID` | Production, Preview |
| `GOOGLE_CLIENT_SECRET` | Production |

Redeploy after saving.

### 3. (Optional) GitHub secret for CI account checks

In GitHub → Settings → Secrets → Actions, add:

- `SUPABASE_SECRET_KEY` — same secret key from Supabase

### 4. YouTube connect (Google OAuth via Supabase)

1. Enable Google provider in Supabase Auth
2. Add redirect URL `https://mixlyai.vercel.app/*`
3. Enable YouTube Data API v3 in Google Cloud Console

## Vercel ↔ GitHub connection

If deploys stop triggering:

1. [Vercel Dashboard](https://vercel.com/playlistmaker-s-projects/mixlyai) → Settings → Git
2. Confirm repository `squidman26/Mixlyai` is connected
3. Production branch should be `main`
