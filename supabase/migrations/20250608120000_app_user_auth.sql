-- App user auth: email/username/password accounts (Spotify optional)

alter table public.accounts
  add column if not exists username text,
  add column if not exists password_hash text;

alter table public.accounts
  alter column spotify_id drop not null;

create unique index if not exists idx_accounts_username_lower
  on public.accounts (lower(username))
  where username is not null;

create unique index if not exists idx_accounts_email_lower
  on public.accounts (lower(email))
  where email is not null and password_hash is not null;

notify pgrst, 'reload schema';
