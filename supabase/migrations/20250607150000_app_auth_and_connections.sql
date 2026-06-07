-- App auth (email/username/password) and persisted Spotify connections

alter table public.accounts
  alter column spotify_id drop not null;

alter table public.accounts
  add column if not exists username text,
  add column if not exists password_hash text,
  add column if not exists spotify_refresh_token text,
  add column if not exists spotify_access_token text,
  add column if not exists spotify_token_expires_at timestamptz;

create unique index if not exists idx_accounts_username
  on public.accounts(username)
  where username is not null;

create unique index if not exists idx_accounts_app_email
  on public.accounts(email)
  where username is not null and email is not null;

notify pgrst, 'reload schema';
