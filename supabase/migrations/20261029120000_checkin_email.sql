-- The monthly check-in email (supabase/CHECKIN_EMAIL.md): a reminder to
-- update balances on the Dashboard. On for everyone who has set up the
-- Dashboard, unless they turn it off (Profile, or any email's link).
--
-- email_prefs: the person's own choice, written from the browser (Profile
--   on the Dashboard) and by the unsubscribe link; no row means they haven't
--   chosen, which is on once the Dashboard is set up. A table of its own, not
--   a field in the synced Dashboard JSON, so turning it off from an email
--   can't be undone by a browser's next sync.
-- email_log: one row per email sent, so no one gets two in 28 days. The
--   service role alone reads and writes it.
-- checkin_candidates(): everyone the email is on for, with what the email
--   and the "who is due" rule need, for the checkin-email function.

create table public.email_prefs (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  checkin    boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table public.email_prefs is
  'Email choices per person: the monthly check-in email (no row: on once the Dashboard is set up). Owner-only via RLS.';

revoke all on table public.email_prefs from anon, authenticated;
grant select, insert, update on table public.email_prefs to authenticated;
grant select, insert, update on table public.email_prefs to service_role;

alter table public.email_prefs enable row level security;

create policy "email_prefs: read own" on public.email_prefs
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "email_prefs: insert own" on public.email_prefs
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "email_prefs: update own" on public.email_prefs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- The same server-clock timestamp as user_data.
create trigger email_prefs_touch
  before insert or update on public.email_prefs
  for each row execute function public.user_data_touch();


create table public.email_log (
  id      bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind    text not null check (char_length(kind) between 1 and 32),
  sent_at timestamptz not null default now()
);

comment on table public.email_log is
  'Emails sent to each person (kind and time only), for spacing them out. Service role only.';

create index email_log_user_kind_sent on public.email_log (user_id, kind, sent_at desc);

revoke all on table public.email_log from anon, authenticated;
grant select, insert on table public.email_log to service_role;

-- RLS on with no policies: nobody but the service role (which bypasses it)
-- can reach a row.
alter table public.email_log enable row level security;


-- Everyone the check-in email is on for (switched on, or never chosen with
-- the Dashboard set up): their address, a first name (the
-- Dashboard's, else the account's), the latest balance entry's date
-- (YYYY-MM-DD, null with none) and when the last check-in went out.
create function public.checkin_candidates()
returns table (user_id uuid, email text, first_name text, last_entry text, last_sent timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.id,
    u.email::text,
    coalesce(
      nullif(btrim(d.value -> 'profile' -> 'p1' ->> 'name'), ''),
      nullif(btrim(u.raw_user_meta_data ->> 'first_name'), '')
    ),
    (select max(e ->> 'date')
       from jsonb_array_elements(case when jsonb_typeof(d.value -> 'entries') = 'array' then d.value -> 'entries' else '[]'::jsonb end) e
      where (e ->> 'date') ~ '^\d{4}-\d{2}-\d{2}$'),
    (select max(l.sent_at) from public.email_log l where l.user_id = u.id and l.kind = 'checkin')
  from auth.users u
  left join public.email_prefs p on p.user_id = u.id
  left join public.user_data d on d.user_id = u.id and d.key = 'dashboard'
  where u.email is not null and u.email <> ''
    and (p.checkin is true or (p.user_id is null and d.value ->> 'done' = 'true'));
$$;

revoke execute on function public.checkin_candidates() from public, anon, authenticated;
grant execute on function public.checkin_candidates() to service_role;
