-- Align accounts table for email/password sign-up with provider + external_id

alter table public.accounts
  add column if not exists provider text,
  add column if not exists external_id text,
  add column if not exists username text,
  add column if not exists password_hash text;

-- Rename legacy spotify_id if still present
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'accounts' and column_name = 'spotify_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'accounts' and column_name = 'external_id'
  ) then
    alter table public.accounts rename column spotify_id to external_id;
  end if;
end $$;

update public.accounts
set provider = coalesce(provider, 'app')
where provider is null;

update public.accounts
set external_id = coalesce(external_id, username, id::text)
where external_id is null;

alter table public.accounts
  alter column provider set default 'app';

alter table public.accounts drop constraint if exists accounts_spotify_id_key;
alter table public.accounts drop constraint if exists accounts_provider_external_id_key;
alter table public.accounts
  add constraint accounts_provider_external_id_key unique (provider, external_id);

create index if not exists idx_accounts_provider_external_id
  on public.accounts(provider, external_id);

create unique index if not exists idx_accounts_username
  on public.accounts(username)
  where username is not null;

notify pgrst, 'reload schema';
