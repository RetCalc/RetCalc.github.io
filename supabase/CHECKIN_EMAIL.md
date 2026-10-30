# Monthly check-in email

An opt-in email that reminds Dashboard users to update their balances. Off
unless switched on (Dashboard, Profile, "Monthly check-in email").

- Sent by a daily run to people with it on whose latest balance entry is 30+
  days old (or who have none) and who weren't sent one in the last 28 days.
- Holds a first name, the date balances were last updated, a list of what a
  check-in is, an "Open my Dashboard" button and an unsubscribe link. No
  dollar figures, no plan results.
- From `RetCalc <checkin@retcalc.app>`, reply-to `contact@retcalc.app`, with
  `List-Unsubscribe` and `List-Unsubscribe-Post` (one-click) headers.

## Where things are

| What | Where |
| --- | --- |
| Tables `email_prefs`, `email_log`; function `checkin_candidates()` | `supabase/migrations/20261029120000_checkin_email.sql` |
| The email, the "who is due" rule, the unsubscribe token | `supabase/functions/_shared/checkin.ts` |
| The Edge Function (daily run + unsubscribe) | `supabase/functions/checkin-email/index.ts` |
| The schedule (run by hand) | `supabase/checkin_email_schedule.sql` |
| Switch on Profile, Next steps step | `web/components/account/checkin.ts`, `web/components/dashboard/Profile.tsx`, `nextsteps.ts` |
| Unsubscribe page (the email's footer link) | `web/app/unsubscribe/`, `web/components/account/Unsubscribe.tsx` |
| Tests | `npm run test:checkin`, `npm run test:rls` (from `web/`) |
| Preview, nothing sent | `npm run email:preview` (from `web/`), writes `web/scripts/email/preview/` |

The unsubscribe link goes to `retcalc.app/unsubscribe?t=...`, a page that
posts the token to the function, because Supabase functions can't serve HTML.
Mail apps' own unsubscribe button posts to the function directly.

## Going live

Nothing here has been run against the live project. In order, from the repo
root (the CLI is `npx supabase`, linked to project `dlnwkvamjdcefoukpaqw`):

1. **Tables.** `npx supabase db push` applies the new migration. Check it
   lists only `20261029120000_checkin_email.sql`.
2. **Secrets.** Three values: the Resend key and two long random strings
   (`openssl rand -base64 48`). Keep the cron one for step 4.

   ```sh
   npx supabase secrets set RESEND_API_KEY=re_... \
     CHECKIN_SECRET="$(openssl rand -base64 48)" \
     CHECKIN_CRON_SECRET=<a long random value; keep it for step 4>
   ```

   `RESEND_API_KEY` can be the key used for sign-in mail if it's allowed to
   send from retcalc.app (the domain is already verified). Changing
   `CHECKIN_SECRET` later breaks the unsubscribe links in emails already sent.
3. **Function.** `npx supabase functions deploy checkin-email --no-verify-jwt`
   (`config.toml` sets the same; the schedule and the unsubscribe links carry
   no sign-in token).
4. **Site.** Merge to main so `retcalc.app/unsubscribe` and the Profile switch
   are live. The site needs no new environment variables.
5. **Schedule.** In the SQL editor, run `supabase/checkin_email_schedule.sql`
   with `CHECKIN_CRON_SECRET`'s value in place of the placeholder. Don't save
   the edited copy. It runs daily at 15:00 UTC.

## Test with one account

With steps 1 to 4 done, and before step 5:

1. Sign in on retcalc.app with a test account and switch the email on in
   Dashboard, Profile.
2. Find its user id (Authentication, Users), then in the SQL editor:

   ```sql
   -- Who would get it today, without sending (counts only):
   select net.http_post(
     url := 'https://dlnwkvamjdcefoukpaqw.supabase.co/functions/v1/checkin-email',
     headers := jsonb_build_object('Content-Type', 'application/json', 'x-checkin-cron', '<CHECKIN_CRON_SECRET>'),
     body := '{"dry_run": true}'::jsonb);

   -- Send to that one account now, due or not:
   select net.http_post(
     url := 'https://dlnwkvamjdcefoukpaqw.supabase.co/functions/v1/checkin-email',
     headers := jsonb_build_object('Content-Type', 'application/json', 'x-checkin-cron', '<CHECKIN_CRON_SECRET>'),
     body := '{"only": "<user id>", "force": true}'::jsonb);
   ```

   Replies are in `select * from net._http_response order by created desc limit 5;`
   and in the function's logs (counts only, no addresses).
3. Check the email in Gmail and Apple Mail, light and dark. Click "Turn off
   this email": the page should say it's off, and Profile should show the
   switch off. Switch it on again and try Gmail's own "Unsubscribe" too.
4. `select * from email_log order by sent_at desc;` shows the send.

## Turning it off

- Stop sending: `select cron.unschedule('checkin-email');` People's choices
  stay as they are.
- Take the function down as well: `npx supabase functions delete checkin-email`.
  Unsubscribe links in emails already sent then stop working, so leave it up
  for a month or two after the last send.
- The Profile switch keeps writing `email_prefs` either way; hide it in
  `Profile.tsx` (`CheckinEmail`) and drop the Next steps step in
  `nextsteps.ts` if the email is retired for good.

## Limits worth knowing

- At most 100 sends per run, one every 600 ms, stopping after about 110
  seconds; whoever is left goes out the next day, longest-waiting first.
- A 401 or 403 from Resend (bad key, sender refused) stops the run.
- The same person isn't sent twice on one day even if the run repeats
  (Resend idempotency key), and `email_log` keeps 28 days between sends.
- The footer link turns the email off as soon as the page opens. A mail
  scanner that runs pages' scripts could do that without the person
  clicking; they can switch it back on in Profile.
