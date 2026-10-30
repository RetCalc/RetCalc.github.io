#!/usr/bin/env node
/* Checks the accounts table's access rules on a real Postgres (PGlite, in
   Node; no Docker or Supabase project needed). Applies every migration in
   ../supabase/migrations over a small stand-in for Supabase's auth schema
   and roles, then tries what each kind of visitor can and can't do.

     npm run test:rls        # from web/; exits 1 on any surprise

   The stand-in: roles anon, authenticated and service_role, auth.users,
   and auth.uid() reading the request's user id the way Supabase's does. */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MIG = join(dirname(fileURLToPath(import.meta.url)), "../../../supabase/migrations");
const A = "11111111-1111-1111-1111-111111111111", B = "22222222-2222-2222-2222-222222222222";

const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; grant usage on schema auth to anon, authenticated;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated, service_role;
  insert into auth.users values ('${A}', 'sam@example.com', '{"first_name":"Sammy"}'), ('${B}', 'jordan@example.com', null);
`);
for (const f of readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort()) await db.exec(readFileSync(join(MIG, f), "utf8"));

/** Runs `sql` as `role`, signed in as `sub`: rows, the count changed, or the error. */
async function as(role, sub, sql) {
  try {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${sub ?? ""}', false); set role ${role};`);
    const r = await db.query(sql);
    return { rows: r.rows, n: r.affectedRows ?? 0 };
  } catch (e) {
    return { error: e.message };
  } finally {
    await db.exec("reset role");
  }
}

let bad = 0;
function check(name, ok, got) {
  console.log((ok ? "✓ " : "✗ ") + name + (ok ? "" : "  got: " + JSON.stringify(got)));
  if (!ok) bad++;
}
const denied = (r) => /permission denied/.test(r.error ?? "");
const rlsBlocked = (r) => /row-level security/.test(r.error ?? "");

let r = await as("authenticated", A, `insert into public.user_data (key, version, value) values ('household', 1, '{"age":40}') returning user_id`);
check("a signed-in user saves their own item (user_id filled in)", r.rows?.[0]?.user_id === A, r);
r = await as("authenticated", B, `insert into public.user_data (key, version, value) values ('household', 1, '{"age":60}')`);
check("another user saves theirs", r.n === 1, r);
r = await as("authenticated", A, `select user_id from public.user_data`);
check("a user reads only their own rows", r.rows?.length === 1 && r.rows[0].user_id === A, r);
r = await as("authenticated", A, `insert into public.user_data (user_id, key, version, value) values ('${B}', 'x', 1, '{}')`);
check("a user can't save a row as someone else", rlsBlocked(r), r);
r = await as("authenticated", A, `update public.user_data set value = '{"x":1}' where user_id = '${B}'`);
check("a user can't change someone else's row", r.n === 0 && !r.error, r);
r = await as("authenticated", A, `update public.user_data set user_id = '${B}' where user_id = '${A}'`);
check("a user can't hand their row to someone else", rlsBlocked(r), r);
r = await as("authenticated", A, `update public.user_data set value = '{"age":41}' where user_id = '${A}'`);
check("a user can change their own row", r.n === 1, r);
r = await as("authenticated", A, `delete from public.user_data where user_id = '${B}'`);
check("a user can't delete someone else's row", r.n === 0 && !r.error, r);
r = await as("anon", null, `select * from public.user_data`);
check("a signed-out visitor can't read the table", denied(r), r);
r = await as("anon", null, `insert into public.user_data (user_id, key, version, value) values ('${A}', 'y', 1, '{}')`);
check("a signed-out visitor can't write to it", denied(r), r);
r = await as("authenticated", B, `select value from public.user_data`);
check("the other user's row is untouched", r.rows?.[0]?.value?.age === 60, r);
r = await as("authenticated", A, `select public.user_data_touch()`);
check("the timestamp helper can't be called directly", denied(r), r);

// The check-in email's choice (email_prefs), its log and the list of who has it on.
r = await as("authenticated", A, `insert into public.email_prefs (checkin) values (true) returning user_id, checkin`);
check("a signed-in user switches on the check-in email (user_id filled in)", r.rows?.[0]?.user_id === A && r.rows[0].checkin === true, r);
r = await as("authenticated", B, `insert into public.email_prefs (checkin) values (false)`);
check("another user saves their choice", r.n === 1, r);
r = await as("authenticated", A, `select user_id from public.email_prefs`);
check("a user reads only their own email choice", r.rows?.length === 1 && r.rows[0].user_id === A, r);
r = await as("authenticated", A, `insert into public.email_prefs (user_id, checkin) values ('${B}', true)`);
check("a user can't save an email choice as someone else", rlsBlocked(r), r);
r = await as("authenticated", A, `update public.email_prefs set checkin = true where user_id = '${B}'`);
check("a user can't switch on someone else's email", r.n === 0 && !r.error, r);
r = await as("authenticated", A, `delete from public.email_prefs where user_id = '${A}'`);
check("email choices can't be deleted from the browser (switched off instead)", denied(r), r);
r = await as("anon", null, `select * from public.email_prefs`);
check("a signed-out visitor can't read email choices", denied(r), r);
r = await as("authenticated", A, `select * from public.email_log`);
check("a user can't read the email log", denied(r), r);
r = await as("authenticated", A, `insert into public.email_log (user_id, kind) values ('${A}', 'checkin')`);
check("a user can't write to the email log", denied(r), r);
r = await as("anon", null, `select * from public.email_log`);
check("a signed-out visitor can't read the email log", denied(r), r);
r = await as("authenticated", A, `select * from public.checkin_candidates()`);
check("a user can't list who gets the email", denied(r), r);
r = await as("anon", null, `select * from public.checkin_candidates()`);
check("a signed-out visitor can't list who gets the email", denied(r), r);
await as("authenticated", A, `insert into public.user_data (key, version, value) values ('dashboard', 1, '{"profile":{"p1":{"name":"  "}},"entries":[{"date":"2026-08-01","items":[]},{"date":"2026-09-02","items":[]},{"date":"junk"}]}')`);
r = await as("service_role", null, `insert into public.email_log (user_id, kind, sent_at) values ('${A}', 'checkin', '2026-09-30T14:00:00Z'), ('${A}', 'other', '2026-10-20T14:00:00Z') returning id`);
check("the service role logs a send", r.rows?.length === 2, r);
r = await as("service_role", null, `select * from public.checkin_candidates()`);
const c = r.rows?.[0];
check("the service role lists only people with the email on", r.rows?.length === 1 && c.user_id === A, r);
check("the list has the address, the account's name when the Dashboard's is blank, and the latest entry",
  c?.email === "sam@example.com" && c.first_name === "Sammy" && c.last_entry === "2026-09-02", c);
check("the list has the last check-in sent, not other kinds", c && new Date(c.last_sent).toISOString() === "2026-09-30T14:00:00.000Z", c);
r = await as("service_role", null, `update public.email_prefs set checkin = false where user_id = '${A}'`);
check("the service role switches it off (the unsubscribe link)", r.n === 1, r);
r = await as("service_role", null, `select * from public.checkin_candidates()`);
check("switched off, nobody is listed", r.rows?.length === 0, r);

await db.query(`delete from auth.users where id = '${B}'`);
r = await db.query(`select count(*)::int as n from public.user_data where user_id = '${B}'`);
check("deleting a user deletes their data", r.rows[0].n === 0, r.rows);
r = await db.query(`select count(*)::int as n from public.email_prefs where user_id = '${B}'`);
check("deleting a user deletes their email choice", r.rows[0].n === 0, r.rows);
await db.query(`delete from auth.users where id = '${A}'`);
r = await db.query(`select count(*)::int as n from public.email_log`);
check("deleting a user deletes their email log", r.rows[0].n === 0, r.rows);

console.log(bad ? `\n${bad} check(s) failed.` : "\nEvery access check passes.");
process.exit(bad ? 1 : 0);
