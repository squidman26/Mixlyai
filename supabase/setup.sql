-- Run this once in Supabase → SQL Editor
-- https://supabase.com/dashboard/project/npkmlflciakpzkskkqvy/sql

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  spotify_id text unique,
  username text,
  password_hash text,
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

create unique index if not exists idx_accounts_username_lower
  on public.accounts (lower(username))
  where username is not null;

create unique index if not exists idx_accounts_email_lower
  on public.accounts (lower(email))
  where email is not null and password_hash is not null;

alter table public.accounts enable row level security;
alter table public.generated_playlists enable row level security;

alter table public.accounts
  add column if not exists credits integer not null default 100,
  add column if not exists tier text not null default 'free',
  add column if not exists unlimited_credits boolean not null default false;

alter table public.accounts
  drop constraint if exists accounts_tier_check;

alter table public.accounts
  add constraint accounts_tier_check
  check (tier in ('free', 'basic', 'pro'));

create table if not exists public.credit_purchases (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  tier text not null check (tier in ('basic', 'pro')),
  credits_granted integer not null,
  amount_cents integer not null,
  square_payment_link_id text,
  square_order_id text,
  square_payment_id text unique,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_credit_purchases_account_id
  on public.credit_purchases(account_id);

create index if not exists idx_credit_purchases_square_order_id
  on public.credit_purchases(square_order_id);

alter table public.credit_purchases enable row level security;

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  amount integer not null,
  balance_after integer,
  reason text not null,
  reference_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_credit_transactions_account_id
  on public.credit_transactions(account_id);

create index if not exists idx_credit_transactions_created_at
  on public.credit_transactions(created_at desc);

alter table public.credit_transactions enable row level security;

grant usage on schema public to postgres, service_role;
grant select, insert, update, delete on public.accounts to service_role;
grant select, insert, update, delete on public.generated_playlists to service_role;
grant select, insert, update, delete on public.credit_purchases to service_role;
grant select, insert, update, delete on public.credit_transactions to service_role;

notify pgrst, 'reload schema';
