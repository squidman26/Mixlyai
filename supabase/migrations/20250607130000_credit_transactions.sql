-- Credit usage and purchase ledger in Supabase

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

grant select, insert, update, delete on public.credit_transactions to service_role;

notify pgrst, 'reload schema';
