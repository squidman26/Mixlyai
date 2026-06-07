-- Music-service-linked user accounts and generated playlist history

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_id text not null,
  display_name text,
  email text,
  avatar_url text,
  product text,
  last_login_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id)
);

create table if not exists public.generated_playlists (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  provider text not null,
  external_playlist_id text not null,
  name text not null,
  url text,
  track_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, provider, external_playlist_id)
);

create index if not exists idx_generated_playlists_account_id
  on public.generated_playlists(account_id);

create index if not exists idx_accounts_provider_external_id
  on public.accounts(provider, external_id);

alter table public.accounts enable row level security;
alter table public.generated_playlists enable row level security;

grant select, insert, update, delete on public.accounts to service_role;
grant select, insert, update, delete on public.generated_playlists to service_role;
