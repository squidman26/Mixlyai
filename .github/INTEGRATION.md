# Vercel + GitHub + Supabase integration

## Current status

| Integration | Status |
|-------------|--------|
| GitHub → Vercel auto-deploy | **Connected** — pushes to `main` trigger Production deploys; PRs get Preview deploys |
| Vercel → Supabase accounts | **Not complete** — needs setup below |

Verify anytime:

```bash
# Production health (no secrets needed)
curl https://spotifybot-eight.vercel.app/api/health/supabase

# Full account check (needs secret key)
SUPABASE_SECRET_KEY=sb_secret_... node scripts/check-accounts.mjs
```

GitHub Actions also runs `.github/workflows/integration-check.yml` on every push to `main`.

## Finish Supabase setup

### 1. Create tables

Run `supabase/setup.sql` in [Supabase SQL editor](https://supabase.com/dashboard/project/npkmlflciakpzkskkqvy/sql).

### 2. Add Vercel environment variables

In [Vercel project settings](https://vercel.com/playlistmaker-s-projects/spotifybot/settings/environment-variables):

| Variable | Environments |
|----------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Production, Preview |
| `SUPABASE_SECRET_KEY` | Production, Preview |

Redeploy after saving.

### 3. (Optional) GitHub secret for CI account checks

In GitHub → Settings → Secrets → Actions, add:

- `SUPABASE_SECRET_KEY` — same secret key from Supabase

This lets the integration workflow list logged-in accounts after each deploy.

### 4. Allow Spotify users to sign in

Spotify apps start in **Development Mode**. Only the app owner plus up to **5 allowlisted users** can use the API. Anyone else gets a 403: *User is not registered for this application*.

To allow a specific person (e.g. a second Spotify account):

1. Open [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Select the Spotifybot app
3. Go to **Settings** → **Users and Access**
4. Click **Add new user** and enter their **Spotify account email**
5. Wait up to 15 minutes, then connect again

For **any** Spotify user to sign in, apply for **Extended Quota Mode** in the dashboard.

### 5. Public users (no Spotify allowlist)

Users can **create an account** (email/username/password) and use **CSV Import** without connecting Spotify. Song matching uses the app’s Spotify API credentials server-side; results download as CSV with Spotify URIs/links.

Run `supabase/migrations/20250608120000_app_user_auth.sql` in the Supabase SQL editor before enabling signups.

## Vercel ↔ GitHub connection

If deploys stop triggering:

1. [Vercel Dashboard](https://vercel.com/playlistmaker-s-projects/spotifybot) → Settings → Git
2. Confirm repository `squidman26/spotifybot` is connected
3. Production branch should be `main`

Or reconnect: Vercel → Add New → Project → Import `squidman26/spotifybot`.
