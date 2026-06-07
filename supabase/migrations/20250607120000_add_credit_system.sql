-- Credit balances, subscription tiers, and Square purchase history

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

grant select, insert, update, delete on public.credit_purchases to service_role;

notify pgrst, 'reload schema';
