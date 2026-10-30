-- Schedules the monthly check-in email's daily run: 15:00 UTC (11:00 in
-- New York). The run sends only to people who are due, so a daily schedule
-- means each person gets it about when their balances turn 30 days old.
-- Run once, by hand, in the Supabase SQL editor, AFTER the migration is
-- pushed, the function is deployed and its secrets are set
-- (supabase/CHECKIN_EMAIL.md). Not a migration, because it holds the shared
-- secret: replace PUT-THE-SAME-VALUE-AS-CHECKIN_CRON_SECRET-HERE below, run
-- it, and don't save the edited copy anywhere.
--
-- To stop it: select cron.unschedule('checkin-email');

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('PUT-THE-SAME-VALUE-AS-CHECKIN_CRON_SECRET-HERE', 'checkin_cron_secret');

select cron.schedule(
  'checkin-email',
  '0 15 * * *',
  $$
  select net.http_post(
    url     := 'https://dlnwkvamjdcefoukpaqw.supabase.co/functions/v1/checkin-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-checkin-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'checkin_cron_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
