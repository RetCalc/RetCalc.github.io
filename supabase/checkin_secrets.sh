#!/bin/sh
# Sets the check-in email's three secrets on the live project
# (supabase/CHECKIN_EMAIL.md, step 2), without any of them being shown:
# asks for the Resend key, makes the two random ones, and copies the SQL
# that stores the schedule's copy in Vault to the clipboard, to paste into
# the Supabase SQL editor. Run once, from the repo root:  sh supabase/checkin_secrets.sh
set -eu
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/node/bin:$PATH"

printf "Resend API key (sending access, starts with re_): "
stty -echo; read -r RESEND; stty echo; echo
case "$RESEND" in re_*) ;; *) echo "That doesn't look like a Resend key (re_...). Nothing was set."; exit 1;; esac

SIGN=$(openssl rand -base64 48 | tr -d '\n')
CRON=$(openssl rand -hex 32)

npx --yes supabase secrets set RESEND_API_KEY="$RESEND" CHECKIN_SECRET="$SIGN" CHECKIN_CRON_SECRET="$CRON" >/dev/null
echo "Saved RESEND_API_KEY, CHECKIN_SECRET and CHECKIN_CRON_SECRET on the live project."

printf "select vault.create_secret('%s', 'checkin_cron_secret');" "$CRON" | pbcopy
echo "Copied one line of SQL to your clipboard. Paste it into the Supabase SQL editor and press Run:"
echo "  https://supabase.com/dashboard/project/dlnwkvamjdcefoukpaqw/sql/new"
