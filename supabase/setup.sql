-- Latest Mixly schema (run in Supabase SQL Editor if migrations were not applied)

alter table public.accounts
  add column if not exists username text,
  add column if not exists password_hash text,
  add column if not exists credits integer not null default 100,
  add column if not exists tier text not null default 'free',
  add column if not exists unlimited_credits boolean not null default false;

alter table public.accounts
  drop column if exists spotify_id,
  drop column if exists spotify_refresh_token,
  drop column if exists spotify_access_token,
  drop column if exists spotify_token_expires_at,
  drop column if exists product,
  drop column if exists avatar_url;

drop index if exists idx_accounts_spotify_id;
drop table if exists public.generated_playlists cascade;

create table if not exists public.saved_playlists (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  playlist_slug text not null,
  name text not null,
  description text,
  tracks_json jsonb not null default '[]',
  track_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, playlist_slug)
);

create index if not exists idx_saved_playlists_account_id
  on public.saved_playlists(account_id);

alter table public.saved_playlists enable row level security;
grant select, insert, update, delete on public.saved_playlists to service_role;

create unique index if not exists idx_accounts_username
  on public.accounts(username)
  where username is not null;

create unique index if not exists idx_accounts_app_email
  on public.accounts(email)
  where username is not null and email is not null;

create table if not exists public.account_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  provider text not null check (provider in ('youtube')),
  external_id text,
  display_name text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scope text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, provider)
);

create index if not exists idx_account_connections_account_id
  on public.account_connections(account_id);

alter table public.account_connections enable row level security;
grant select, insert, update, delete on public.account_connections to service_role;

alter table public.saved_playlists
  add column if not exists provider text,
  add column if not exists external_playlist_id text,
  add column if not exists external_playlist_url text;

notify pgrst, 'reload schema';
