-- RetCalc accounts: what a signed-in person has synced (ACCOUNTS_PLAN.md).
-- One row per person per stored item, holding the same JSON value the
-- browser keeps under retcalc.<key>.v<version>: "household", "guide",
-- "scenarios-<tool>". Each person can reach only their own rows.

create table public.user_data (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key        text not null check (char_length(key) between 1 and 64),
  version    integer not null check (version > 0),
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

comment on table public.user_data is
  'Synced browser storage for signed-in users: household, Guide and saved scenarios. Owner-only via RLS.';

-- Tables are not exposed to the Data API automatically (platform default
-- from 2026-10-30): signed-in users get access explicitly; anon gets none.
revoke all on table public.user_data from anon, authenticated;
grant select, insert, update, delete on table public.user_data to authenticated;

alter table public.user_data enable row level security;

-- Signed in AND the row is theirs. Updates check both sides so a row can't
-- be handed to another user.
create policy "user_data: read own" on public.user_data
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_data: insert own" on public.user_data
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "user_data: update own" on public.user_data
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "user_data: delete own" on public.user_data
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- updated_at is the server's clock on every write, for last-write-wins.
create function public.user_data_touch()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.user_data_touch() from public, anon, authenticated;

create trigger user_data_touch
  before insert or update on public.user_data
  for each row execute function public.user_data_touch();
