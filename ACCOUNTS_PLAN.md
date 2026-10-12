# Accounts plan (Supabase)

Written 2026-10-12, checked against Supabase's changelog and docs the same
day (see "Checked against Supabase's current docs" at the end). A plan, not
a build: nothing here is started.

## Goal

An optional, free account that keeps a person's household profile and saved
scenarios, so they're there on any device and survive cleared browser data.
No payments. Everything keeps working without an account, exactly as today.

## What doesn't change

- No account is ever required. Signed out, the site behaves as it does now.
- The calculations (`lib/engine`) and the numbers baseline are untouched.
- Share links (`#s=...`, `#g=...`) keep working for everyone.
- The browser stays the first place things are saved; the account is a copy
  that follows you ("local first, synced when signed in").

## What gets synced

Today everything goes through `web/lib/storage.ts` (`readStored` / `writeStored`,
keys `retcalc.<key>.v<n>` in localStorage). Of those:

| Data | Key today | Sync? |
| --- | --- | --- |
| Household profile | `household.v1` | Yes |
| Saved scenarios, one list per tool | `scenarios-<tool>.v1` | Yes |
| The Guide's answers and plan | `guide.v2` | Yes |
| Which tools took the household in | `household-applied.v1` | No (per device) |
| Theme, Drawdown's Simple/Advanced, intro seen | `theme.v1`, `retcalc-dd-*` | No (per device) |

Unsaved inputs in an open tool stay in memory only, as now.

## Decisions

1. **Provider: Supabase.** Sign-in and the database in one service, with
   row-level security so each person can only read and write their own rows.
2. **Sign-in: Google, plus a 6-digit code emailed to you (owner's decision,
   2026-10-12).** No passwords to store, reset or protect, and no phone
   numbers (texted codes cost money per message and attract SMS fraud).
   The emailed code works across devices: read it on your phone, type it on
   your laptop. Supabase sends it with `signInWithOtp()` and checks it with
   `verifyOtp({ email, token, type: "email" })`; the "Magic Link" email
   template shows `{{ .Token }}` instead of a link. Codes last an hour by
   default and can be requested once a minute. (Apple sign-in can come
   later; it needs a paid Apple developer account, $99/yr.)
3. **Plan: Supabase Free (owner's decision, 2026-10-12).** Two known costs,
   accepted:
   - **Pausing:** a Free project pauses after 7 days with no requests and
     stays offline until restored by hand in the dashboard (restorable for 90
     days). Regular use keeps it awake; in a quiet week sign-in and sync stop,
     while the site and everything saved in the browser keep working.
   - **No automatic backups:** a weekly export covers that (step 1).
   Pro ($25/mo) removes both if that ever changes.
4. **Email: a sending service (e.g. Resend) on the retcalc.app domain** for
   the sign-in codes. Supabase's built-in email is rate-limited and meant for testing.
5. **An optional first name (owner's decision, 2026-10-12).** Asked once
   after the first sign-in ("What should we call you? Optional") and editable
   on the account page. With Google sign-in it's pre-filled from the Google
   account's first name, and can be cleared. Stored as `first_name` in the
   user's profile metadata (`updateUser({ data: { first_name } })`), used
   only for display ("Hi, Sam"); never for access decisions, since users can
   edit that metadata. Without a name, the menu shows the email.
6. **Data shape: one row per person per item, as JSON.** The site already
   stores each item as one JSON value; the server keeps the same values, so
   no field is re-modeled and nothing about the numbers can change.

## Data model

One table holds everything synced:

```sql
create table public.user_data (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  key        text not null,            -- "household", "scenarios-tax", "guide"
  version    int  not null,            -- the storage version (the .v<n>)
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- New tables are no longer exposed to the Data API by default (enforced for
-- all projects from 2026-10-30): grant signed-in users access explicitly,
-- and nothing to anon.
grant select, insert, update, delete on table public.user_data to authenticated;

alter table public.user_data enable row level security;

-- Signed in AND the row is theirs. `to authenticated` alone would let any
-- signed-in user reach every row; the ownership check is what stops that.
-- Updates need both USING and WITH CHECK, so a row can't be handed to
-- someone else, and a SELECT policy, without which updates silently change
-- nothing.
create policy "read own" on public.user_data for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "insert own" on public.user_data for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "update own" on public.user_data for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own" on public.user_data for delete to authenticated
  using ((select auth.uid()) = user_id);
```

No views, no `security definer` functions, and nothing taken from
`user_metadata` (which users can edit) for access decisions.

`on delete cascade` means deleting the account deletes the data. Size is tiny:
a profile plus a handful of scenarios is a few KB per person, so 500 MB holds
well over 50,000 people.

## How syncing works

- **Signed out:** no change. `readStored` / `writeStored` use localStorage only.
- **Signing in for the first time:** everything syncable in this browser is
  uploaded. If the account already has data (signed in elsewhere before),
  merge per key:
  - household: keep the newer one (it carries `savedAt`), and say which was kept;
  - saved scenarios: combine the lists by name; on a clash keep the newer and
    rename the older "(from this device)";
  - Guide: keep the newer.
- **Signed in:** every write goes to localStorage first (instant, works
  offline), then to the account. On sign-in and when the tab regains focus,
  the account's newer values replace local ones.
- **Signing out:** the account is untouched. The person chooses whether this
  browser keeps a copy ("Keep on this device" / "Remove from this device"),
  which matters on a shared computer.
- **Conflicts:** last write wins per key, by `updated_at`. That fits the data:
  one person, one profile, small lists, rarely edited on two devices at once.

## The work, in order

Each step ships on its own, behind no flag a signed-out visitor can see until
step 3.

1. **Set up** (no visible change)
   - Supabase project; Google and email providers; redirect URLs for
     retcalc.app and Vercel previews.
   - The table, grant and policies above as a migration in the repo
     (`supabase/migrations/`, made with `supabase migration new`), then
     `supabase db advisors` with no warnings.
   - Env vars in Vercel: `NEXT_PUBLIC_SUPABASE_URL` and
     `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The secret key never gets a
     `NEXT_PUBLIC_` name (those are sent to the browser).
   - `@supabase/supabase-js` in `web/`, version pinned, lockfile committed.
   - A weekly backup, since Free has none: a scheduled GitHub Action that
     dumps the `user_data` table to a private artifact (the database password
     as a repository secret). Free.
   - A way to notice a pause: the account menu shows "Account sync is
     unavailable right now" when Supabase can't be reached, instead of an error.
   - **No `proxy.ts`.** Every page stays static: sign-in and sync run in the
     browser, and the database's own rules decide what each person can read.
     A server-side proxy would run on every request (and count against
     Vercel's free limits) for no gain, since no page is rendered per user.
     If a page ever needs to know the user on the server, add `@supabase/ssr`
     and `proxy.ts` then, and check with `getClaims()`, never `getSession()`.
2. **Storage layer** (no visible change)
   - Give `lib/storage.ts` a list of synced keys and an optional remote
     store; signed out it does exactly what it does now.
   - Merge logic as above, with unit tests (`node --test`, like the Guide's).
3. **Sign-in UI**
   - A "Sign in" button in the header, after the household button (the spot
     planned for it). Signed in, it becomes an account menu headed with the
     first name if there is one ("Hi, Sam", with the email under it), else
     the email; then Account and Sign out.
   - After the first sign-in, a one-step "What should we call you?" with a
     first-name field and Skip.
   - A sign-in dialog (shadcn Dialog): "Continue with Google", or your email
     then "Send me a code", then a 6-digit code field (one-time-code
     autofill, paste-friendly, "Resend code" after a minute). One line on
     what's saved and that it's optional.
   - A callback route for Google's return (the emailed code needs none).
4. **Sync on**: household, then saved scenarios, then the Guide, each
   checked on two browsers.
5. **Account page** (`/account`): what's stored, "Download my data" (JSON),
   "Delete my account and data" (with confirmation). Deleting a user needs the
   secret key, so it runs in a Supabase Edge Function that checks the caller's
   token and deletes only that caller. Deleting a user doesn't end their open
   sessions, so the function signs them out everywhere first; the browser
   then clears its copy.
6. **Copy and policy** (below), then announce.

## Privacy: copy and policy changes

"Nothing leaves your browser" appears in about 8 places today. It stays true
for signed-out visitors, so the copy changes to say so, for example:
"Nothing leaves your browser unless you sign in to save it to your account."

Also needed before announcing:
- A privacy page: what's stored (email, household, saved scenarios, Guide
  answers), where (Supabase, region chosen at setup), that it's never sold
  or shared, how to download or delete it.
- PRODUCT.md's principle "Private by construction" and its line "nothing asks
  them to sign up" get updated to "optional, never required".
- Analytics stay as they are (Cloudflare, no cookies, no personal data).

## Costs

| Item | Now | When it matters |
| --- | --- | --- |
| Supabase | $0 (Free: 50,000 monthly active users, 500 MB) | staying on Free; Pro ($25/mo) only if pausing or backups become a problem |
| Email (sign-in codes) | $0 on a free sending tier | grows with sign-ins |
| Google sign-in | $0 | — |
| Vercel | $0 (Hobby) | $20/mo Pro if the site ever earns money; accounts alone don't change this |

$0 on the chosen setup; $20/mo for Vercel Pro only if the site ever earns money.

## Risks and how they're handled

- **Someone reads another person's data:** row-level security on the table,
  plus a test that a second account can't read the first's rows.
- **A bad merge loses a scenario:** merging never deletes; clashes keep both.
- **Supabase is down:** local storage keeps working; sync catches up later.
- **A shared computer:** the sign-out choice to remove this device's copy.
- **Keys:** only the publishable key ships to the browser; the secret key
  lives only in the Edge Function's environment.
- **A deleted account still signed in somewhere:** sessions are revoked before
  the user is deleted.
- **A paused Free project:** sign-in and sync stop until it's restored (it
  stays restorable for 90 days); local saving keeps working throughout.

## Decided (2026-10-12)

- Supabase Free (pausing and backups understood; weekly backup added).
- Google, plus a 6-digit code by email. No passwords, no phone.
- The Guide syncs, with the household and saved scenarios.
- An optional first name, shown in the account menu.

## What the owner needs to do first

These need your accounts, so they're yours to do; everything else is mine.
Values in `<angle brackets>` come from the step before.

1. **Supabase project.** At supabase.com, create an organization (Free) and a
   project named `retcalc`, region **US East**. Save the database password in
   your password manager. Then send me, from Project Settings → API Keys:
   the **project URL** (`https://<project-ref>.supabase.co`) and the
   **publishable key** (`sb_publishable_...`). Never send the secret key.
2. **Auth settings** (Authentication → URL Configuration):
   - Site URL: `https://retcalc.app`
   - Redirect URLs: `https://retcalc.app/**`, `http://localhost:3100/**`,
     `https://retcalc-*-ret-calc.vercel.app/**` (Vercel previews)
3. **Sign in with Google.** In Google Cloud Console: create a project, set up
   the OAuth consent screen (app name RetCalc, your support email, domain
   retcalc.app), then Credentials → Create OAuth client ID → Web application:
   - Authorized JavaScript origins: `https://retcalc.app`
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
   Paste the client ID and secret into Supabase → Authentication → Providers
   → Google, and turn it on.
4. **Sign-in code emails.** Sign up at resend.com, add the domain
   `retcalc.app`, and add the DNS records it shows at Cloudflare (DNS only,
   not proxied). Once verified, put its SMTP details into Supabase →
   Authentication → Emails → SMTP (sender `RetCalc <signin@retcalc.app>`;
   host, port, user and password as Resend shows them). Then in
   Authentication → Emails → Templates → **Magic Link**, set the subject to
   "Your RetCalc sign-in code" and paste in `supabase/templates/magic_link.html`.
5. **Vercel** (Project → Settings → Environment Variables, all environments):
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, the
   two values from step 1.

When step 1 is done I can link the repo to the project
(`npx supabase link`), push the migration (`npx supabase db push`, which
asks for the database password) and deploy the delete-account function.

## Built so far (branch `accounts`, not live)

- `@supabase/supabase-js` 2.117.3 (pinned) and the Supabase CLI 2.120.0
  (dev tool) in `web/`.
- `supabase/`: config (codes not links, no auto-exposed tables, Google ready
  but off, redirect URLs), the sign-in code email template, the migration
  (`migrations/…_user_data.sql`) and the `delete-account` Edge Function.
- `npm run test:rls` (from `web/`): applies the migration to a real Postgres
  (PGlite) and checks 13 access rules: own rows only, no writing as someone
  else, no handing rows over, signed-out visitors refused, data deleted with
  the user.
- `lib/storage.ts`: knows which items sync, stamps when each was written,
  and tells a listener about every synced write. Signed out, nothing changes.
- `lib/sync/`: the merge rules (`merge.ts`, 10 tests in `npm run test:sync`),
  the Supabase adapter (`account.ts`, inert without the env vars) and the
  sync engine (`engine.ts`). Nothing calls the engine until the sign-in UI
  exists (step 3 of the work), which waits for a real project to test against.
- `web/.env.example` with the two variable names.

## Checked against Supabase's current docs (2026-10-12)

What changed in this plan after reading the changelog and docs:
- **Tables aren't exposed to the Data API automatically any more** (enforced
  for all projects from 2026-10-30), so the migration grants `authenticated`
  access explicitly. ([changelog](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically), [securing your API](https://supabase.com/docs/guides/api/securing-your-api))
- **Publishable key, not the legacy anon key**, and the env var name the
  docs now use. ([Next.js server-side auth](https://supabase.com/docs/guides/auth/server-side/nextjs))
- **Policies use `to authenticated` with `(select auth.uid())`**, one per
  operation, per Supabase's security checklist.
- **Account deletion** revokes sessions first and runs where the secret key
  can't leak.
- **Next.js 16 calls the session file `proxy.ts`** (it was `middleware.ts`);
  this plan avoids needing one.
