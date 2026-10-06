# RetCalc redesign notes

Issues found during the redesign that are logged here rather than fixed in
the pass that found them. Each says where it is and what fixing it involves.

## Open

### System theme doesn't follow the OS while a page is open

Found 2026-10-06, during the redesign's setup pass.

With the theme set to System (the default, and "System" on the About page's
switch), the theme is worked out once, when the page loads: the inline
script in `<head>` (`web/lib/theme-script.ts`) reads
`prefers-color-scheme` and sets `data-theme` on `<html>`. Nothing listens
for that preference changing afterwards, so if the OS switches between
light and dark (by hand, or on a schedule at sunset) an open RetCalc page
keeps the old theme until it is reloaded or another page is opened.

- Where: `web/lib/theme.ts` (`resolveTheme`, `applyTheme`, `setThemeChoice`)
  and `web/lib/theme-script.ts`. No `matchMedia(...).addEventListener("change", ...)`
  anywhere in `web/`.
- Not a regression: the old site (`src/js/app/19-widgets-theme.js`) behaved
  the same way, and the migration carried it over unchanged.
- Fixing it: while the stored choice is "system", listen for
  `matchMedia("(prefers-color-scheme: light)")` changes and call
  `applyTheme(resolveTheme("system"))`; stop when the visitor picks Light
  or Dark. One small client-side listener, e.g. in a component mounted once
  in the layout. It changes the toggle's behavior, so it's left for a
  separate, deliberate change: the brief says to keep the toggle and its
  behavior as they are.

### Portfolio Backtest: invisible count bug, fix and re-record in the math audit

Found 2026-10-06. On the yearly rebalancing setting `backtest()` reports
`rebalances: 0`. That setting takes a shortcut (one blended return a year)
and only the other settings count; run as "every 1 year" or with a 0-point
drift band, the returns match to 2e-16 and the count is 99 over 1926-2025.

- Where: `backtest()` in `web/lib/engine/math.js`, the `rb === "year"` branch.
- Invisible: the screen shows the count only on the drift-band setting
  (`rebalNote()` in `web/tools/backtest/Backtest.tsx` returns nothing for
  yearly), and nothing else calls `backtest()`.
- Fix: count one rebalance per year after the first, matching the
  "rebalances after the start" convention in `tests/math.test.js`. It
  changes the numbers baseline for "Portfolio Backtest: defaults: 80/20,
  rebalanced yearly, 1926-2025" (rebalances 0 => 99), so re-record it with
  the fix. Engine change: left for the math audit, not the redesign.

### Debt Payoff: a plan that itself never clears still shows its runaway interest

Found 2026-10-06, while fixing the minimums-only case (which is fixed). When
the chosen plan stalls too (every debt underwater, nothing rolling over),
the headline's Total interest and "paid in all", the table's interest cells
and the printed summary still show the 60-year capped figure (trillions for
a $5,000 loan at 36% with a $100 minimum). Same cause as the minimums-only
case: `debtRun()` in `web/lib/engine/math.js` reports accrued, unpaid
interest for a stalled run. Same kind of fix, in `web/tools/debt/Debt.tsx`
and `share.tsx`: show "Keeps growing" or a dash instead. It changes numbers
shown, so it needs an explicit decision.

### Share card and print summary: three chart colors changed (accepted)

Found 2026-10-06 in the chart-colors pass (122d62d, 1e59077); accepted as
is, and the starting point for the share/print pass. Charts name their
colors by series (web/lib/hues.ts), and components/shell/share.ts maps
each series to the one hue it replaced for the card and the printed
summary. Three charts used a hue that series no longer maps to, so their
copies changed:

- Rent vs. Buy (#chartRB): the buyer line is sky, so it prints and shares
  as #7d9fd6 (was the plan gold #e9b872).
- Early Retirement Bridge (#chartBR): "72(t) payments" is rose, so it
  goes out as #e2795f (was #c98fb8).
- Income Tax donut (#txPie): the state tax slice is lavender, so it goes
  out as #a98fd6 (was #e9b872).

Everything else in the ten copied charts is unchanged (checked by opening
every summary and saving every card on both builds, in both themes).

Later, the series fixes (2026-10-06) changed three more copied charts, on
purpose: the Drawdown fan (#chartDD) draws its "each starting year" traces
in the muted guide tone (#8b97ad on the card) and outlines its bands
(dashed outer, solid inner); Bridge (#chartBR) draws ladder rungs as
hatched teal; and the Tax donut draws pre-tax deductions as hatched gray.
The hatches are SVG patterns whose stripes use the screen's surface color,
so on the card they take whatever theme the page was in: settle that in
the share/print pass.

### Drawdown: "Retiring in" has no options until the comparison finishes

Found 2026-10-06. On the Compare strategies view, #ddSpotYear is empty
until the strategy comparison has run, so for a moment it can't be opened
(by keyboard or pointer) and shows nothing. Worth a placeholder ("Working
it out…") or a disabled state while it fills.

### Post-redesign ideas from the homepage critique (new figures, so not now)

Raised by the homepage critique (2026-10-06, `.impeccable/critique/`); left
for after the redesign because each shows numbers the page doesn't show
today, which the redesign doesn't do.

- **What-if levers.** A row of one-tap changes under the reading ("+$100 a
  month", "retire two years later", "a more aggressive mix"), each showing
  how the value at retirement would move. Why: the homepage answers "what
  will I have?" but not "what would change it?", which is the question a
  saver asks next; today they have to edit a field and remember the old
  figure, or leave for Advanced. The engine already runs the plan
  (`projectBasic`), so each lever is the same run with one input nudged;
  the deltas are the new figures. They'd follow the Never Alone Rule (a
  sign and a word with any gain or loss color).
- **A historical range on the homepage.** Alongside or instead of the
  ±1.5-point band, one honest line from market history: in what share of
  historical windows since 1926 the plan reached what amount (e.g. "in 90%
  of 35-year runs since 1926: $X to $Y"). Why: RetCalc's edge is testing
  against every market since 1926, but the front door draws a band any
  calculator could; the advanced planner (PRODUCT.md) judges the suite by
  this page. The history engine exists (Advanced's Historical mode); the
  range is a new figure on the homepage and needs a decision on which
  windows and percentiles to show.

## Planned

### Masthead controls in the pinned tab rail, site-wide

Approved 2026-10-06 after trying it on the homepage (commit 5a18669); not
built for the other pages yet. On desktop, once the tab rail is pinned and
the masthead has scrolled away, the scenario picker, Save/Share/Reset and
the household and theme buttons move into the rail's empty right side,
centered on it, and return to the masthead when you scroll back up.

- How it's built today: CSS only, in `web/styles/01-masthead-layout.css`.
  While `.navbar.stuck` is on the page, `.scenariobar` is fixed into the
  rail's right edge (aligned to the 1330px measure) and the header, which
  is its own stacking layer, lifts above the rail. Same elements and ids,
  so menus, dialogs and the e2e checks see nothing new.
- Rolling it out: drop the homepage-only `:has(#tab-simple)` from both
  rules (the rule and the header lift), so it applies wherever the rail
  pins. DESIGN.md's Navigation section already describes it site-wide.
- To check on the way: pages whose masthead shows fewer controls (no
  scenario picker), the tool pages' header, the Guide's pinned progress
  card (which also sits under the rail), the installed web app (its rail
  is a bottom bar, so this should stay off there), and widths around
  1024px where the tabs and controls come closest (about 190px apart on
  the homepage).
- Open: the controls are 36px tall in a 44px rail, which reads snug.
  Either shrink them while they ride in the rail or give the pinned rail a
  few more pixels; decide when it goes site-wide.

## Design decisions from the homepage review (2026-10-06)

Made in conversation while acting on the homepage critique
(`.impeccable/critique/`) and in the follow-ups after it. Each is built and
written into DESIGN.md unless it says otherwise.

- **Answer first.** The homepage puts the questions and the reading on one
  first screen instead of a form beside a stack of equal cards; below it
  come Milestones beside the Advanced hand-off, the year-by-year table
  (folded), the household offer and the article.
- **Hero reading (homepage exception).** The value at retirement stands
  alone at about twice Display size; tool pages keep the three equal
  figures. (DESIGN.md, Headline readout.)
- **Thirds, not 40/60.** Questions a third of the width, the reading two
  thirds, from 1024px. 2/5 + 3/5 was tried first and narrowed the chart
  more than the reading needed.
- **Two zones at the top of the reading.** From 1100px: the value on the
  left; behind a hairline, the monthly and yearly incomes side by side,
  spread across the rest of the width and centered vertically against the
  value. Stacked was tried and rejected; top-aligned looked off. Below
  1100px the incomes sit under the value. Adds a 1100px breakpoint token
  (`wide`).
- **Incomes at Display size.** 35px (30px on phones), not 24px: the amber
  value still leads by size and color, and the incomes no longer look like
  footnotes. Adds `--text-display` and `--text-label` tokens.
- **Pinned reading on phones.** A compact copy of the value and monthly
  income leads the page and stays under the tab rail while the questions
  are in view.
- **Household offer after the result** on the homepage only; the masthead's
  house button scrolls to it there.
- **Year by year folded** behind its title (shadcn Collapsible); on phones
  Age and Balance stay pinned and Year steps out.
- **Milestones on the plan line,** screen-only: they're kept out of the
  printed summary and the share card, which keep their own layout.
- **Errors at the field.** A bad retirement age marks the field (Loss edge,
  icon, message); the figures clear to dashes as before, and the empty
  chart folds away. Keeping the last result visible but dimmed was
  considered and not done: it would show figures that don't match the
  inputs, and an e2e check pins the clearing.
- **Copy (owner's wording):** "Answer a few questions to see what you could
  have at retirement.", "Nothing leaves your browser.", and the article
  titled "About this calculator".
- **Calculator tab reads "Calculator | Basic".**
- **Light-mode outline buttons take the Rule Strong edge** (site-wide).
- **44px touch targets** everywhere under a finger (site-wide).
- **Masthead controls ride in the pinned rail** on desktop: built on the
  homepage, approved for the whole site (see Planned).
- **Not done (left for later):** folding the phone scenario toolbar into a
  menu (it would hide Save/Share/Reset behind a tap and break phone e2e
  checks), the what-if levers and the historical range (new figures; see
  Open), and new copy beyond the three lines above.

## Fixed

### Escape inside a dialog's select list also closes the dialog

Found 2026-10-06 (keyboard test of the selects; also on 1e59077, so not
caused by the NativeSelect change). In a dialog (the contribution
converter, the Drawdown asset mix), opening a select's list and pressing
Escape closes the list and the dialog, and focus goes to the button that
opened the dialog. The list's Escape (web/lib/select-menus.js) doesn't
stop the event, so the dialog's own Escape handler (components/shell/
Modal.tsx) runs too. Fix in the overlays batch: Escape should close only
the innermost layer.

Fixed 2026-10-06 with the move to shadcn's Dialog: the list now stops its
own Escape (and Tab) from reaching the dialog, and inside a dialog it opens
in the dialog rather than on <body>. Escape closes the list and focus goes
back to the select; a second Escape closes the dialog.
