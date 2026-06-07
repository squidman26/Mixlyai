-- SoundCloud OAuth tokens on account connections + app-level token cache

alter table public.account_connections
  add column if not exists access_token text,
  add column if not exists refresh_token text,
  add column if not exists token_expires_at timestamptz,
  add column if not exists scope text;

create table if not exists public.app_provider_tokens (
  provider text primary key,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz not null,
  scope text,
  updated_at timestamptz not null default now()
);

alter table public.app_provider_tokens enable row level security;

grant select, insert, update, delete on public.app_provider_tokens to service_role;

notify pgrst, 'reload schema';
