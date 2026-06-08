-- New accounts default to 45 free credits. Existing balances are unchanged.

alter table public.accounts
  alter column credits set default 45;

notify pgrst, 'reload schema';
