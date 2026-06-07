-- External provider references for saved playlists (e.g. SoundCloud apply)

alter table public.saved_playlists
  add column if not exists provider text,
  add column if not exists external_playlist_id text,
  add column if not exists external_playlist_url text;

notify pgrst, 'reload schema';
