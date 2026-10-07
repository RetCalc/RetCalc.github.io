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

- **Income Tax (/incometax): Basic's thirds.** Inputs a third, results two
  thirds from 1024px; incometax joins SOLO (lib/site.ts). 7 normal / 14
  retirement fields fit a third as Advanced's 22 do; the column is sticky
  with its own scroll from 1024px, static below. Inputs card "Your
  situation": the mode switch on its own full-width row, then Income
  (salaries, or the withdrawals two-up: traditional | Roth, brokerage | gain,
  Social Security | other, pension | payer), Your return (status | state, or
  status | 65+ with state full width; pre-tax | deduction; selects one column
  on phones so their text isn't cut), and "How the federal tax was figured"
  over the derived rows. Results: one reading card with a quiet toolbar (Net
  pay / Take-home pay, or the mode label, and the 2026 rates badge), the hero
  (net / take-home / income after tax, amber; Loss with an alert glyph and
  "Below zero." when negative; Text when there's no income), Per month and
  Every two weeks (or Effective tax rate) at Display size; then one band, the
  donut as the picture with the bars as its legend centered beside it. In the
  Net pay view with pre-tax savings, a sentence above the picture reconciles
  Net pay with the Take-home pay bar using figures already shown. With no
  income the band gives way to a one-line prompt (#txPie stays in the DOM).
  In retirement mode the capital-gain band chart follows the reading, then
  the per-source card (with a caption for its tracks), the breakdown, the
  brackets (open), and State rules folded with the "Not included" note in
  view. Phones get a PinnedReading (the answer, per month); the breakdown's
  Share of income steps out (the CSV keeps it) so it fits without a swipe,
  and the brackets pin Tax on the right. The gain chart's two edge labels
  drop to a second row whenever they would touch, and its figures are
  tabular Plex.

- **Plan Optimizer (/optimizer): Basic's thirds, the run first.** Inputs a
  third (about 410px at 1330, the 390px the critique asked for), results two
  thirds from 1024px; optimizer joins SOLO (lib/site.ts). 22 to 29 fields fit
  a third as Advanced's 22 do; sticky with its own scroll from 1024px, static
  below. Inputs card "Your situation": the mode switch on its own row, then
  four groups under Title heads (Household; Saved on the day you retire, with
  Copy as the head's action; In retirement; Health, heirs and safety), short
  fields two-up on every width. Results open with the goal card (the three
  goals, Find my best plan with the estimate beside it, the method paragraph
  kept word for word as a note), then #opOut: the starting point before a
  run, the loader at the reading's height while running, then one reading
  card (HeroReading: the goal figure amber with the +/- badge and "vs. ... the
  usual way" as its note; Lifetime tax, Lasted in and Social Security at /
  Left after tax at Display size, each "was ..." with an arrow and "better" or
  "a trade-off"; the "Tried every one of ..." line at its foot), What makes
  the difference directly under it, the roadmap (flat rows on the timeline,
  no card per stop), the three charts with legends under them, Year by year
  folded (shadcn Collapsible; on phones Age and Left, all accounts pinned),
  Other strong plans as ruled rows in Text, fine print at Note size, 78ch.
  Below 1024px #tab-optimizer is display:contents, so the goal card leads the
  page, then the inputs, then the result; a PinnedReading (the goal figure
  and the usual way) leads the inputs once there's a result. Out of date: the
  figure drops to Text, the result dims, and a band in the reading says why
  with Run it again. No spending: the field is marked (Loss edge, icon,
  message), the reason shows under the button, a previous result stays,
  dimmed. Stop is an outline button beside the running commentary. The
  readiness guide keeps its own hero and section order; it picks up the
  token clean-up (goals, roadmap, moves, alternatives, Stop).

- **Early Retirement Bridge (/bridge, /72t): Basic's thirds, one plan
  followed.** Inputs a third, results two thirds from 1024px; bridge and 72t
  join SOLO (lib/site.ts). 19-20 fields fit a third as Advanced's 22 do;
  sticky with its own scroll from 1024px, static below. Inputs card "Your
  situation": the situation's four fields, then Title group heads (Your
  accounts at retirement, Income, Health insurance, How the plans work),
  short fields two-up on every width. The derived block leaves the inputs
  for a four-up key/value strip at the foot of the reading (ids kept).
  Results in three tiers: one reading card (Historical / Monte Carlo moved
  from the table into its quiet toolbar; the best plan as the amber hero
  with its how-line; Holds up in in its rating tone with a check / alert /
  cross glyph, Cost of the bridge and At 59½ at Display size; the verdict as
  the reading's sentence). The three secondaries sit under the hero at every
  width (HeroReading's new `under`): beside a word-sized hero they wrapped
  into a ragged stack. Then the decision: Ways to 59½ (selected row with a
  check and aria-current, hold cells with glyphs, Penalties plain). Then
  "Following <plan>": a sticky head holding the market switch (#segBRPath,
  moved; full width on phones with "Above / Average / Below"), over What
  you'll have at 59½ with the Send buttons, the flow chart, balances (the
  view switch on its own row, not squeezing the title), the ladder and Year
  by year (folded; Age and Balance pinned on phones). Card titles drop the
  plan and market (the head says them); the market moves to each
  description. The rules fold behind their title. With no spending or
  balances the hero and figures are dashes in Text, the sentence band is the
  prompt with an icon, and everything under the reading folds away (Send
  buttons with it). Phones get a PinnedReading (best plan, holds up in).
  /72t renders the same tool with `variant="72t"` (app/72t/page.tsx): the
  72(t) method and rate lead the inputs under their own head right after the
  situation, and "Most 72(t) could pay" leads the facts strip. Same figures,
  plans, order and default selection as /bridge.

- **Roth Conversion & RMDs (/roth): Basic's thirds, the verdict as the
  headline.** Inputs a third, results two thirds from 1024px; roth (and rmd)
  join SOLO (lib/site.ts). Sticky with its own scroll from 1024px, static
  below. The inputs keep the facts that rarely change (Your situation, What
  you have with Copy from Drawdown as the head's action, Income and
  spending, How to score it: 17 fields); "The conversion plan" (strategy,
  its sub-control, window, tax paid from) leaves them for a lever card right
  under the reading, two-up, next to its effect. Reading: not the hero
  variant. The page's own copy says the two measures are read together and
  Peak RMD answers another question, so the three stay peers, at Display
  size in thirds; what leads is the verdict sentence in Headline type with a
  check / cross / alert glyph (a dash glyph and "This plan converts nothing,
  so there is nothing to compare." when no year converts). Lifetime tax
  saved stays amber (Loss with its minus when negative); "After-tax net
  worth" is relabelled "... vs doing nothing" (it is a difference) in Gain /
  Loss with its sign and an arrow; "Peak RMD" is relabelled "Peak RMD, doing
  nothing" (it is that scenario's) in Text. The explanation sentence
  (unchanged) follows the figures; the derived facts move from the inputs to
  a four-up strip ("First RMD, converting"); the survivor card becomes a band
  at the reading's foot. Then the chart (two named lines; the band a flat
  teal fill, unlabelled, since it only spans the two named lines; ages on
  the axis; the switch on its own row), Converting vs. not (a key line: pairs
  read converting first), Year by year folded (full height from 1024px, a
  key for the shaded survivor rows, one Rule Strong edge where they begin,
  neutral "Tier N" badges for IRMAA). With no balances, or Plan through not
  after Your age (the field gets the Loss edge, icon and message), the
  figures are dashes in Text, the headline band says what to enter, and the
  chart, comparison and table fold away; the lever card stays. Phones get a
  PinnedReading (Lifetime tax saved; Net worth vs doing nothing). The chart's
  screen changes go through BandChart's new `screenOnly` prop: the original
  marks stay in the SVG as data-print-only (hidden on screen by a rule
  scoped to .chartwrap), so the printed summary is unchanged (share.spec
  roth passes).

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

- **Income Tax**: clear the readout to dashes with no income or a negative
  take-home — figure text (an e2e case pins $0); the $0 is shown in Text and
  the picture folds to a prompt, the negative in Loss with a glyph and word.
- **Income Tax**: refuse or change the cap when pre-tax deductions exceed
  gross — engine behavior; the field carries the error instead.
- **Income Tax**: fold Federal brackets — the help tour's third part focuses
  #txBrackets, which a closed fold would hide; kept open.
- **Income Tax**: reword the "Not included" and state-rule texts — disclosure
  text; kept, the rules folded and the note visible.
- **Income Tax**: "All taxes" as a third secondary, and leading retirement
  mode with the 0% gains room — a figure restated in a new place; the gain
  chart moves up under the reading instead.
- **Income Tax**: dropping the Net pay / Take-home pay switch, or changing
  which figure a bar shows — owner's figures-presentation call; a
  reconciling sentence instead.

- **Plan Optimizer**: fold Pension, Heirs' tax rate and Must last in under
  "More assumptions" — the e2e walks fill opPension, opPenAge, opPenCola and
  opTarget directly on both sites with the same steps; a closed fold would
  fail them. Group heads and the run-first phone order answer the P0.
- **Plan Optimizer**: cut the lede to one sentence — it describes how the
  search works (hard stop); kept word for word, moved under the button as a
  quieter note.
- **Plan Optimizer**: a CSV for Year by year — a new capability, the owner's
  call per the critique.
- **Plan Optimizer**: goal picker as shadcn RadioGroup — Base UI's roving
  focus and arrow-key selection would change Tab use (SHADCN_PLAN.md's rule);
  kept as buttons, restyled on tokens, with a clearer selected state.
- **Plan Optimizer**: a Run button in the pinned bar — PinnedReading is
  aria-hidden and has no action slot; on phones the goal card with the button
  leads the page instead, and the stale band in the reading has Run it again.
- **Plan Optimizer**: the loader's motion (skip, minimum, reduced motion,
  hit timing, colors, aria-live) — Phase 2; only its card height and Stop
  changed.
- **Plan Optimizer**: sentence-case "Warning" in the shared callout — the page
  no longer uses .gd-callout; the shared callout (guide, others) is left for
  its own pass.

- **Early Retirement Bridge**: fold "How the plans work" on phones —
  bridge.spec types into brFill and brSeppMethod on both sites with the same
  steps; a closed fold would fail them. The pinned reading answers the P0.
- **Early Retirement Bridge**: the reading following the picked plan instead
  of the best one — the headline, share card and print summary say "Best way
  to 59½"; the sticky Following head names the picked plan instead.
- **Early Retirement Bridge**: scroll the Following head into view when a row
  is picked — new behavior; the head is sticky, and the row gets a check.
- **Early Retirement Bridge**: six plan cards instead of the table on phones,
  and leading the 72(t) row on /72t — the plan table keeps its text and
  order (CSV, coach, e2e); the Plan column narrows so Holds shows.
- **Early Retirement Bridge**: a 72(t)-specific tool description on /72t —
  the header copy comes from the shared tool list; left for the owner.
- **Early Retirement Bridge**: a "Runs short" badge in year-table rows — it
  would add text to the CSV; a cross glyph labelled "Runs short" instead.
- **Roth Conversion**: clamp or warn in the engine for an age past Plan
  through (the age-96 note) — calculation; the field is marked and the
  results wait instead. Blank ages still read as 0 as before (e2e "blank
  ages" compares those figures).
- **Roth Conversion**: "Scoring assumptions" folded under the verdict —
  roth.spec types into rcIrmaaOn and rcHeir; a closed fold would fail them.
  They stay as the last group of the inputs.
- **Roth Conversion**: add the chart's third (rose) line to the legend — it
  is min(converting, doing nothing), so it only ever retraces one of the two
  named lines; hidden on screen instead. The printed summary still draws it
  (print/share are a later phase).
- **Roth Conversion**: Converting vs. not as a two-column mini-table — each
  id (rcTaxPV, rcEndTrad…) holds "x vs y" in one cell; splitting would
  change those ids' text. A key line says the order instead.
- **Roth Conversion**: label the gap fill ("Tax avoided" / "Tax added") —
  its sign changes along the chart, which needs new per-segment marks;
  flattened and left unlabelled between the two named lines.
- **Roth Conversion**: 44px CSV button and the article disclosure's label —
  shared CsvButton size and the shared article component, not this page's.

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
