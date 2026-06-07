-- Remove Spotify integration and add saved playlists

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

notify pgrst, 'reload schema';
