-- Email verification and password reset tokens

alter table public.accounts
  add column if not exists email_verified_at timestamptz;

-- Existing app accounts are grandfathered in as verified.
update public.accounts
set email_verified_at = coalesce(email_verified_at, created_at, now())
where username is not null
  and password_hash is not null
  and email_verified_at is null;

create table if not exists public.auth_tokens (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  token_type text not null check (token_type in ('verify_email', 'reset_password')),
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_auth_tokens_account_type
  on public.auth_tokens(account_id, token_type);

create index if not exists idx_auth_tokens_hash
  on public.auth_tokens(token_hash)
  where used_at is null;

alter table public.auth_tokens enable row level security;

grant select, insert, update, delete on public.auth_tokens to service_role;

notify pgrst, 'reload schema';
