-- Run this once in Supabase → SQL Editor
-- https://supabase.com/dashboard/project/npkmlflciakpzkskkqvy/sql

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  spotify_id text not null unique,
  display_name text,
  email text,
  avatar_url text,
  product text,
  last_login_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generated_playlists (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  spotify_playlist_id text not null,
  name text not null,
  url text,
  track_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, spotify_playlist_id)
);

create index if not exists idx_generated_playlists_account_id
  on public.generated_playlists(account_id);

create index if not exists idx_accounts_spotify_id
  on public.accounts(spotify_id);

alter table public.accounts enable row level security;
alter table public.generated_playlists enable row level security;

grant usage on schema public to postgres, service_role;
grant select, insert, update, delete on public.accounts to service_role;
grant select, insert, update, delete on public.generated_playlists to service_role;

notify pgrst, 'reload schema';
