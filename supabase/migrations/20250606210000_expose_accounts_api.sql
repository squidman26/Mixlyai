-- Ensure accounts tables are visible to the Data API and service role

grant usage on schema public to postgres, service_role;

grant select, insert, update, delete on public.accounts to service_role;
grant select, insert, update, delete on public.generated_playlists to service_role;

-- Refresh PostgREST schema cache after manual table creation
notify pgrst, 'reload schema';
