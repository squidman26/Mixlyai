-- Idempotent schema fixes for hosted Supabase

alter table public.account_connections
  add column if not exists access_token text,
  add column if not exists refresh_token text,
  add column if not exists token_expires_at timestamptz,
  add column if not exists scope text;

alter table public.saved_playlists
  add column if not exists provider text,
  add column if not exists external_playlist_id text,
  add column if not exists external_playlist_url text;

alter table public.account_connections
  drop constraint if exists account_connections_provider_check;

alter table public.account_connections
  add constraint account_connections_provider_check
  check (provider in ('youtube'));

alter table public.accounts
  alter column credits set default 45;

notify pgrst, 'reload schema';
