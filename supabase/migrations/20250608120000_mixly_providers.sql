-- Migrate from Spotify-specific schema to provider-agnostic Mixly schema

alter table public.accounts rename column spotify_id to external_id;
alter table public.accounts add column if not exists provider text not null default 'youtube';

alter table public.accounts drop constraint if exists accounts_spotify_id_key;
alter table public.accounts add constraint accounts_provider_external_id_key unique (provider, external_id);

drop index if exists idx_accounts_spotify_id;
create index if not exists idx_accounts_provider_external_id
  on public.accounts(provider, external_id);

alter table public.generated_playlists rename column spotify_playlist_id to external_playlist_id;
alter table public.generated_playlists add column if not exists provider text not null default 'youtube';

alter table public.generated_playlists drop constraint if exists generated_playlists_account_id_spotify_playlist_id_key;
alter table public.generated_playlists add constraint generated_playlists_account_provider_playlist_key
  unique (account_id, provider, external_playlist_id);
