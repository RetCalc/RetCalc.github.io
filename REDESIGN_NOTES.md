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

### Drawdown: "never below $1" in the strategy showdown

Found 2026-10-06 (Drawdown critique, question 4). In Compare strategies, the
Setting found column reads "never below $1" under rows such as 1/N and the
tuned strategies when the risk target is the comfort line. It may be the
floor the tuning really used, or a display of a near-zero floor; either way
it's a figure and how the showdown's floors are worked out
(the "showdown" job in `web/lib/engine`, shown as `x.floor` in `web/tools/drawdown/CompareView.tsx`),
so it's left for a deliberate look. Related: the success grid shows "100"
for a share that rounds to 100 (99.6%, say); with the target at every start
that cell doesn't get the redesign's check mark, which is right but can
read oddly.

## Planned

### Masthead controls in the pinned tab rail, site-wide (done)

Applied to every page on 2026-10-06 (the homepage-only scope dropped).
Checked scrolled at 1440 and 1024px, dark and light, on the homepage,
Advanced, Stages, Drawdown, Income Tax, Guide, Tools, About and a strategy
page: fixed in the rail, visible, at least 166px clear of the last tab.
Compare is too short to pin the rail, so it never moves there. The snug
fit (36px controls in a 44px rail) is still open.

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

## Layout decisions

- **Advanced (/advanced): Basic's thirds.** Inputs a third of the width,
  results two thirds, from 1024px (`lg:grid-cols-3`; Advanced joins SOLO in
  lib/site.ts and lays out its own grid). The inputs are one card in three
  groups under Title headings (Your savings, Markets, Your goal), with short
  fields two-up on every width, phones included (the legacy `.two` goes to
  one column on phones; Advanced overrides it with `max-sm:grid-cols-2`, and
  rows whose labels can wrap are bottom-aligned for iOS, which gets no
  subgrid). Rate of return runs full width with the glide path under it;
  Solve for and Target stack on phones (the select's text truncated at half
  width). Thirds fit all 22 fields with the split on (about 1,500px of
  inputs); from 1024px the column stays sticky and scrolls on its own when
  taller than the screen, as before; below 1024px it's static, no inner
  scroller. Stages should share the same grid, group headings and two-up
  rule.
- **Stages (/stages): Advanced's thirds, stages in the inputs.** Same grid,
  card ("Your plan") and two-up rule as Advanced; Stages joins SOLO. The
  stage editor moves out of the results into the inputs column as the first
  group, "Your stages": a proportional timeline strip (each segment as wide
  as its years, named; a click jumps to that stage), then the stages as flat
  rows on a rule (`.stagecard` kept, the legacy box overridden), Remove as a
  quiet icon button (StageHead's new `quiet` prop; Drawdown keeps its full
  button), Years beside Rate of return with the glide path under them on the
  final stage, then what the stage puts in. Then Your savings (split, starting
  value), Markets (inflation, fees) and Your goal (solve for, target,
  withdrawal, tax), as on Advanced. Results: ProjectionReading with the
  target band (no on-track badge: Stages has no verdict to show), "Reach your
  target" (SolveOption, now shared in Projection.tsx), the chart, Milestones
  beside "Take it further", Stage by stage open (a few rows), Year by year
  folded. Differs from Advanced: stage rows stay open on phones (see
  Skipped); "Take it further" holds only Test withdrawals, a new hand-off to
  Drawdown with the inflation-adjusted balance, as Advanced's; a 0-year stage
  gets a field message while the figures still follow the input; with no
  stages the reading dims and one "Start with a stage" card replaces
  everything under it. On phones the stage table keeps Stage and End balance
  pinned, the year table Year and Inflation adj.

- **Drawdown Simulator (/drawdown and its eight strategy pages): Basic's
  thirds.** Inputs a third, results two thirds from 1024px; every slug whose
  tool is drawdown joins SOLO (lib/site.ts). 11 Simple / 21 Advanced fields
  fit a third as Advanced's 22 do; the column stays sticky with its own
  scroll from 1024px and is static below. Inputs card renamed "Your inputs"
  (the first result view is "Your plan"), sentence-case group heads (Your
  portfolio at retirement, Your retirement, Withdrawals, Income in
  retirement, Goals, Market history), Age beside Years two-up on phones.
  Results: one reading card (Historical / Monte Carlo, the period badge and
  Pin in a quiet toolbar; the success rate as the hero in its rating tone,
  gain from 95%, text from 85%, loss below, with a check / alert / cross
  glyph before its note; median and worst at Display size, plus the legacy
  goal when set, in Text; baseline deltas under each; the verdict as a
  body-size sentence band, Monte Carlo's method sentence kept quieter; the
  baseline bar). Phones get a PinnedReading (success rate, median). Then the
  intro card, the three views as tabs, and each view's own answer: Your plan
  as a story (balance fan, When you retire, spending fan, the scorecard as a
  key/value list beside What your income looked like, the start table, Year
  by year, Spread, Return sensitivity beside Social Security claiming);
  Compare opens with the strategy that spends most at the target and the
  steadiest; Safe opens with its two answers at Display size. With no
  portfolio (or a retirement too long for the record) everything under the
  reading folds away and the Portfolio field carries the error. The legacy
  figure loses its rating color (secondaries are Text). Success grid on
  Gain/Loss 15% tints with check/cross glyphs and a legend; the CAPE "today"
  line and the showdown's comfort line are guide-colored, not amber.

## Skipped from critique

- **Advanced**: mark Time period 0 or negative as an error and dim the
  figures — deciding that those values are invalid changes what's computed
  and shown (the field is built `negative`); the owner decides the rule,
  then the field-level error styling (Basic's pattern) can be added.
- **Advanced**: a "+" sign on Growth (key/value and table) — changes a
  displayed figure's text. Kept green under its "Growth" label/header.
- **Advanced**: one minus glyph for "Change from current" (hyphen) and
  "Difference" (true minus) — displayed figure text.
- **Advanced**: decimal years ("45.12 years") read as false precision —
  number format of a displayed figure.
- **Advanced**: "you're $61,224 short of your target" as the page's sentence
  — a new computed figure. The reading shows the target beside the answer
  with an on-track badge instead.
- **Advanced**: putting the Historical / Monte Carlo success rate in the
  reading — restates a figure in a second place; left under the chart.
- **Stages**: fold each stage to a one-line summary on phones, one open at a
  time — the e2e walk (stages.spec) types into every stage on both the old
  and the new site with the same steps, so hidden stage fields would fail it.
  The pinned reading answers the P0 instead.
- **Stages**: undo in the Remove / "Use this…" toasts — the shared Toast has
  no action slot; a site-wide change, left for the overlays work.
- **Stages**: show dashes instead of $10,000 / $400 with no stages, refuse a
  0-year stage — displayed figures and the calculation. Dimmed, collapsed and
  flagged at the field instead.
- **Stages**: drop the duplicate "After tax, per year" row — removes the
  `xAfterTax` id. Kept in the totals under the reading.
- **Stages**: "+" on Growth, moving the "?" out of the glide / split toggles,
  44px for the ± flip — figure text, and shared controls (CheckToggle,
  SignFlip) used on other pages; left for the shared-controls pass.

- **Drawdown**: fold "How each starting year fared" and "Year by year"
  behind disclosures — the e2e walk clicks start-table rows and headers on
  both sites with the same steps, and the income test asserts a Year by year
  header is visible; both stay open, moved below the charts instead.
- **Drawdown**: "Capped at 60 years" under Years in retirement when it
  clamps — new copy and behavior the owner would word; not added.
- **Drawdown**: "never below $1" in the showdown — a figure / possible
  display bug; logged under Open.
- **Drawdown**: renaming the views ("Will it last" / "Which rule" / "How much
  can I spend") — the strategy guide, the No-setting note and the help tour
  name them "Your plan", "Compare strategies", "Safe spending"; kept.
- **Drawdown**: phones pinning Strategy and showing Typical lifetime spending
  next — reordering columns changes the CSV; the Strategy and Setting
  columns wrap instead, so Year one and lifetime spending show on a phone.
- **Drawdown**: Advanced inputs split into tabs or disclosures — the help
  tour and e2e steps reach those fields directly; group heads instead.
- **Drawdown**: secondaries side by side on phones — "Ran out in 50 of 835
  retirements" leaves no room at 390px; they stack, as the component allows.

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
