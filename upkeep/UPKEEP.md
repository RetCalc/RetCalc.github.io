# Keeping RetCalc's figures current

retcalc.app runs on figures that go stale: tax law, Medicare and ACA prices,
market history, today's CAPE, sensible defaults, and the "Last reviewed"
month on every article. This folder keeps track of them.

| File | What it is |
| --- | --- |
| `items.json` | The list. One entry per thing to update: what it is, where it lives, its source, how often, when it was last updated, when it's next due. **The only place dates are kept.** |
| `check.py` | Reads the list and says what's overdue or due soon. `--write` also regenerates the owner's schedule. |
| `SCHEDULE.md`, `schedule.csv` | The owner's view: one table, soonest first. Generated; never edit by hand. |
| `UPKEEP.md` | This file: how Claude handles it all. |

    python3 upkeep/check.py            # what's overdue or due in the next 30 days
    python3 upkeep/check.py --all      # every item
    python3 upkeep/check.py --write    # regenerate SCHEDULE.md and schedule.csv

A hook in `.claude/settings.json` runs `check.py --hook` when a session
starts. If anything is overdue or due within 14 days, that list lands in
Claude's context; otherwise the hook prints nothing.

## What Claude does with it

1. **Call it out once, then let it be.** When the session-start list shows
   items, mention them to the owner in a line or two at a natural point,
   usually at the end of the first reply, and ask whether to update any now.
   Don't derail the task the owner came with, and don't repeat the reminder
   later in the same session unless asked.
2. **Ask before updating.** Updating changes figures people see, so the owner
   says yes first. "Not now" is a fine answer: if they want it pushed back,
   move its `next_due` (and add a word to `notes`), so it stops coming up.
3. **Also notice staleness while working.** When a task touches one of these
   figures, look at its entry. If it's past due, or the code disagrees with
   what `items.json` says, mention it.
4. **Never invent a figure.** Every number comes from the source named in its
   entry, or a better primary source. Cite it in the code comment beside the
   figure and in the commit message. If the source can't be reached or isn't
   out yet, say so and leave the old figure.
5. **Finish the bookkeeping.** After an update: set `last_updated` to today,
   `data_for` to what the figures now cover, and `next_due` to the next time
   (from `cadence`). Then run `python3 upkeep/check.py --write` and commit
   `items.json`, `SCHEDULE.md` and `schedule.csv` with the change.
6. **New figures join the list.** Any new time-sensitive figure added to the
   site gets an entry here in the same commit.
7. **Push rules still apply.** Figure updates go to main only when the owner
   says "push it to main".

## Checks after any update

Run from `web/` unless noted. Expect some to report differences: a figure
update is supposed to move numbers. Read each difference, make sure it's the
one the update should cause, and only then re-record.

- `python3 ../tests/run.py`: the calculation tests, including every worked
  example in the articles (`says(...)` in `tests/math.test.js`). When an
  article's example moves, update the article text and its expected figure
  in `math.test.js` together.
- `node scripts/baseline/numbers.mjs check`: every tool's headline figures.
  Re-record with `record` once the differences are understood, in its own
  commit ("Numbers baseline: re-record for ...").
- `node scripts/baseline/guide.mjs check`: the Guide's fixture households.
  Same rule.
- `npm run test:guide`, `npm run test:tax`, `npm run lint`, `npm run typecheck`, `npm run build`.
- `npx playwright test --project=desktop e2e/guide.spec.ts`: it quotes a few
  Guide figures (the Quick check's "plan needs" amounts).
- `node scripts/lastmod.mjs` when an article changed, so the sitemap dates
  follow.
- Preview cards (`scripts/og/render.mjs`, text in `lib/cards.ts`) only need
  re-rendering if their text changed, such as the tax year.

## Procedures

### The new tax year (prepare in November and December, switch January 1)

Covers `federal-tax`, `ss-wage-base`, `medicare-b-irmaa`,
`medicare-d-medigap`, `aca`, `rmd-tables` and `year-labels`.

A new tax year is **added beside the old one, never written over it**. Each
year's figures live in their own file, `web/lib/engine/data/<year>.js`, and
the engine reads them through `yearData(year)`. The Income Tax tool is the
only place that offers older years: its Tax year picker appears on its own
once there are two years, and defaults to the newest. Every other tool
(Healthcare, Roth, Bridge, Optimizer, Drawdown, Advanced, Stages, the Guide)
always uses the newest year and names it from the data.

1. Gather the coming year's figures once they're published: the IRS revenue
   procedure (brackets, standard deduction, capital-gains breakpoints, the
   age-65 extra deduction), the SSA fact sheet (wage base, bend points), the
   CMS Part B and IRMAA fact sheet, the Part D estimate, KFF benchmark
   premiums, the IRS applicable percentages, and the HHS poverty guidelines
   for the coverage year.
2. Add the year: copy `data/2026.js` to `data/2027.js`, rename its export
   `YEAR_2027` with `year: 2027`, and change its figures and their source
   comments. Leave `2026.js` exactly as it is.
3. Register it in `data/years.js`: an `import { YEAR_2027 } from "./2027.js";`
   and an `addYear(YEAR_2027);`. That's all the wiring there is; the tests,
   the worker build and the picker follow from there.
4. The states usually publish in February, after the IRS. Until then the new
   year keeps the old state figures: `states: YEAR_2026.states` in
   `2027.js` (with `import { YEAR_2026 } from "./2026.js";`). Their own
   `states.year` stays 2026, and Income Tax says the state figures are
   2026's. The state-taxes procedure below replaces them later.
5. Prepare it on a branch ahead of time; merge on or right after January 1.
   The newest year is what every other tool uses, so the site never shows
   next year's rules too early.
6. `rmdStartAge` counts birth years back from the newest year, so it rolls
   on its own. The life tables (`data/tables.js`) only change when the IRS
   changes them.
7. Find every "2026" about the rules (not about history) that is still
   static text:
   `grep -rn 2026 web --include=*.ts --include=*.tsx --include=*.js --include=*.json --include=*.html`.
   The tools name the year from the data; what's left is page titles and
   descriptions (`lib/page-meta.json`), card text (`lib/cards.ts`), the
   footer, the homepage tile, the glossary, the About page and the articles.
   Leave dates of past events alone, and leave `data/2026.js` alone.
8. Re-render the preview cards if their text named the year.
9. Add checks for the new year's published figures to `tests/math.test.js`
   beside the 2026 ones (`yearData(2027)`), and run the checks above; expect
   the tax-dependent figures in every tool but a 2026 Income Tax to move.
   `npm run test:tax` adds a made-up year after the newest and checks the
   picker and the switch still work.

### State taxes (February and March)

Covers `state-tax` and `state-retirement`. When the Tax Foundation's
January 1 survey is out, give the newest year its own state figures: in
`data/<year>.js`, replace a borrowed `states: YEAR_<last>.states` with a
copy of them, set its `states.year` to the new year, and compare every
state's brackets, standard deduction and exemptions with `states.tax`; then
go through each state's retirement rules (`states.retire`,
`states.ssTaxed`, `states.noExpansion`), including the dollar amounts
quoted in their notes. Keep Illinois's special handling (its comment in
`states.tax`). Never edit an earlier year's state figures for a new year's
changes. Then the checks above.

### Market history (February and March)

Covers `market-history` and `french-data`. Both must end on the same month.

1. Append the past year's 12 months to `HIST_M_STOCK`, `HIST_M_BOND`,
   `HIST_M_INFL` and `HIST_M_CAPE` (`web/lib/engine/data/history.js`) from Shiller's data and BLS CPI-U, the
   same way the existing months were made (the comment above
   `HIST_M_STOCK` says how). Then `HIST_M_CASH` and `HIST_M_SV` from the
   French library.
2. Update the comments: the end month, "1,200 months" and the like.
3. Update "1926 to 2025" and similar ranges in the footer, the articles and
   page descriptions.
4. Expect many figures to move: every historical success rate, the homepage
   and Tools page figures (computed at build time from the data), the
   articles' worked examples, both baselines and the Guide e2e figures.
   Update the articles' text and their `math.test.js` expectations together.

### Today's CAPE (monthly)

Covers `cape-now`. In `web/lib/engine/data/history.js`, set `CAPE_NOW` to the latest monthly reading on
multpl.com and `CAPE_NOW_ASOF` to its date, written like "31 October 2026".
`check.py` reads the date from there and sets the next due date to 36 days
after it, so `items.json` needs no edit.

### Article reviews (each article every 90 days)

Covers `articles`. A review means reading the article against the current
site: every figure it quotes is what the tool shows, every source link
works and still says what it's cited for, and nothing describes a rule
that has changed. Only then move its `data-reviewed` date to today. Run the
checks above and `node scripts/lastmod.mjs`. `check.py` works out this
item's dates from the articles themselves; don't edit them in `items.json`.

### Defaults (mortgage rate, housing, college, 72(t), debt, assumptions)

Check the source named in the entry. Round figures are intentional: change
a default when it's clearly off, not for every small move, and raise
judgment calls (`assumptions`) with the owner before changing them. Each
change moves its tool's numbers baseline and any article example that uses
the default.
