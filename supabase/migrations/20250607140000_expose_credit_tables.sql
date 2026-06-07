-- Ensure credit tables are visible to the Data API and service role

grant usage on schema public to postgres, service_role;

grant select, insert, update, delete on public.accounts to service_role;
grant select, insert, update, delete on public.generated_playlists to service_role;
grant select, insert, update, delete on public.credit_purchases to service_role;
grant select, insert, update, delete on public.credit_transactions to service_role;

notify pgrst, 'reload schema';
