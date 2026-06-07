-- Remove Spotify from account_connections provider options

delete from public.account_connections
where provider = 'spotify';

alter table public.account_connections
  drop constraint if exists account_connections_provider_check;

alter table public.account_connections
  add constraint account_connections_provider_check
  check (provider in ('youtube', 'soundcloud'));

notify pgrst, 'reload schema';
