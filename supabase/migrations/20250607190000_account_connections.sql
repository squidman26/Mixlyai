-- Per-account music service connections (separate from app login)

create table if not exists public.account_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  provider text not null check (provider in ('spotify', 'youtube', 'soundcloud')),
  external_id text,
  display_name text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, provider)
);

create index if not exists idx_account_connections_account_id
  on public.account_connections(account_id);

alter table public.account_connections enable row level security;

grant select, insert, update, delete on public.account_connections to service_role;

notify pgrst, 'reload schema';
