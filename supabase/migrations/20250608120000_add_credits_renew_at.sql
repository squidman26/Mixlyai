-- Monthly credit renewal anchor for paid tiers

alter table public.accounts
  add column if not exists credits_renew_at timestamptz;

notify pgrst, 'reload schema';
