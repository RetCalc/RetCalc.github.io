-- "Enable automatic RLS" (chosen at project setup) installs
-- public.rls_auto_enable(), a SECURITY DEFINER event-trigger function that
-- turns on row-level security for every new table in public. Postgres
-- grants EXECUTE on new functions to PUBLIC, so the Data API lists it as
-- callable by anon and authenticated (Supabase advisors 0028/0029). Its
-- trigger fires without that privilege, so revoking it changes nothing
-- about the trigger and removes the function from the public API.
-- Guarded so a project without the option (or a fresh local stack) skips it.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
