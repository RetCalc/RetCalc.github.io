# RetCalc

The site (retcalc.app) is the Next.js app in `web/`; see `web/README.md`.
The marketing package, one-pager and deck, and everything that builds them,
are in `marketing/`; see `marketing/README.md`.

## Keeping figures current

Tax rules, Medicare and ACA prices, market history, today's CAPE, defaults
and article review dates all go stale. `upkeep/items.json` lists every one
with its source, last update and next due date; `upkeep/UPKEEP.md` says how
to update each and what to check afterwards. A session-start hook lists
whatever is overdue or due within 14 days: mention it to the owner once,
ask before updating, and keep `items.json` current when anything changes.
When a task touches one of these figures, check its entry.
