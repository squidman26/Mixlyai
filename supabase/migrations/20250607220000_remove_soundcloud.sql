-- Remove SoundCloud integration; YouTube-only provider model

delete from public.account_connections where provider in ('soundcloud', 'spotify');

drop table if exists public.app_provider_tokens;

alter table public.account_connections
  drop constraint if exists account_connections_provider_check;

alter table public.account_connections
  add constraint account_connections_provider_check
  check (provider in ('youtube'));

notify pgrst, 'reload schema';
