-- OAuth token storage for per-account YouTube connections

alter table public.account_connections
  add column if not exists access_token text,
  add column if not exists refresh_token text,
  add column if not exists token_expires_at timestamptz,
  add column if not exists scope text;

notify pgrst, 'reload schema';
