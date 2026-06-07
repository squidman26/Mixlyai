-- Safe auth column migration (idempotent)

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'accounts'
      and column_name = 'spotify_id'
  ) then
    alter table public.accounts alter column spotify_id drop not null;
  end if;
end $$;

alter table public.accounts
  add column if not exists username text,
  add column if not exists password_hash text;

create unique index if not exists idx_accounts_username
  on public.accounts(username)
  where username is not null;

create unique index if not exists idx_accounts_app_email
  on public.accounts(email)
  where username is not null and email is not null;

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
