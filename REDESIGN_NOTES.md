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
  /rmd renders the same tool with `variant="rmd"` (app/rmd/page.tsx): Peak
  RMD, doing nothing leads the figures in amber (Lifetime tax saved drops to
  Text), the pinned reading leads with it, and Year by year opens on Doing
  nothing with the RMD column first, so RMDs by age show on arrival. Same
  figures, inputs and default strategy as /roth.

- **Healthcare Cost Planner (/healthcare): Basic's thirds, then the two
  phases side by side.** Inputs a third, results two thirds from 1024px;
  healthcare joins SOLO (lib/site.ts). Its 8 fields fit a third easily, and
  thirds keep it in line with the other tools; the two-thirds column is
  wide enough to put "Before 65: the ACA bridge" and "From 65: Medicare"
  side by side from 1100px (`wide`), so the timeline reads left to right
  (stacked below 1100px). Inputs card "Your situation" with an intro line:
  retirement age | state, status | household, spouse's age (married only),
  then Title heads Income (MAGI; Copy from Income Tax as the button, Open
  Income Tax as a quiet link; Social Security) and Your own quote (the
  benchmark premium, kept open: healthcare.spec types into it). Results open
  with one reading card: the net ACA premium as the amber hero (its old tile
  label as the note), Years on the ACA bridge and Medicare from 65 (the
  couple's range when married, else per person) at Display size. Retiring
  at 65 or later, Medicare leads in amber with Per person (couple) or Part B
  premium (single) beside it, the "no ACA bridge" sentence becomes a band in
  the reading (it carries #hcACABody, which the help tour focuses) and the
  Medicare card spans the row. The 400% cliff warning and the next-IRMAA-
  tier warning (now the Warning callout, was a Note) move from the bottom of
  their cards to the reading's foot, text unchanged. With no income: dashes
  in Text, a prompt band with an info icon, and a hint under the MAGI field
  ("The one figure this needs"), not an error. The `.hc-stats` tiles go;
  uppercase labels become sentence-case h3 heads; "If Congress restores the
  enhanced credits" and "Plan tier comparison" fold (shadcn Collapsible,
  keepMounted); tier rows lose the medal emoji, Silver gets a check and
  Text instead of a box; the IRMAA badge keeps its colors (premium tax
  credit stays green, owner's call) and gains a check / alert icon; prose
  capped at the copy measure. Phones get a PinnedReading (the hero and its
  last secondary).

- **FIRE Calculator (/fire): Basic's thirds, two methods named apart.**
  Inputs a third, results two thirds from 1024px; fire joins SOLO
  (lib/site.ts). 11-12 fields fit a third easily, and thirds match the other
  tools; sticky with its own scroll from 1024px, static below. Inputs card
  "Your plan" with an intro line: the mode switch, then Title heads You (age;
  planned retirement age beside it in Coast), Saving, Market (return |
  inflation; in Historical a hint at the pair, "Not used with market
  history", wired by aria-describedby, the fields still editable; Stock mix
  #fiHistMix moves here from the chart card, Historical only) and Goal
  (target type | withdrawal rate, one column on phones; the target field
  relabelled "Yearly spending" / "Portfolio target" by type). Results: one
  reading card. Its quiet toolbar holds the method switch (#segFireChart,
  moved from the chart header), since it decides which answers show. Hero:
  the FIRE / Coast FIRE age in amber, labelled "..., at your rate of return"
  (#fiAgeLabel keeps "FIRE age"; the guide trip reads it), years from now in
  its note (#fiYears kept there; "Years until FIRE" stops being a peer, it
  restated the age). Portfolio at FIRE / at coast and Target portfolio (was
  a key/value row, #fiKVTarget kept) at Display size. In Historical the
  reading gains a second band, the slider beside its own answer, labelled
  "FIRE age, in market history" (#fiSuccessAge at Display size, #fiSliderNote
  under both), so the rate-of-return answer and the history answer are both
  in view and named as different questions (the orchestrator's call: the
  headline does not swap figures). A plan that never gets there shows "Not
  in range" in Loss with a cross and the note (Coast now names the
  retirement age), plus one band saying what to change; no target shows
  dashes in Text, a prompt band, and the chart and table fold away.
  Remaining key/values form a quiet two-column strip; gains green only above
  $0. Chart: the target rule starts at the plot edge with "Target $X" above
  it; the FIRE / Coast upright is labelled with its age ("50%: 60.3" in
  Historical); a dot marks where contributions stop in Coast; all labels
  data-screen-only (FIRE has no share kit, so nothing is copied today). The
  ± band sits in the chart header. Year by year folds (shadcn Collapsible,
  keepMounted) and opens full height, so the highlighted FIRE row shows on
  the page's own scroll; a caption in Coast says the table keeps saving
  every year. Phones pin Age and Inflation adj. (Advanced's pattern) and a
  PinnedReading (FIRE age, portfolio then) leads the inputs. NativeRange
  (only FIRE uses it) keeps its 6px track inside a 24px hit area, 44px
  under a finger; the "NOTE" eyebrow and `.fire-slider-*` rules are gone.

- **Portfolio Backtest (/backtest): Basic's thirds, one reading with its
  worst beside its best.** Inputs a third, results two thirds from 1024px;
  backtest joins SOLO. Inputs card "The mix": Asset mix (the custom-mix
  button), "Quick mix, stocks/bonds" (segments labelled 100/0 ... 0/100,
  data-mix values unchanged, full width), rebalancing, then a "Period" group:
  From / Through two-up on every width, a field error under them, the era
  switch (All / Last 50 / Last 30) under the years, then the facts strip.
  Results: HeroReading (Return, per year in amber; After inflation,
  Volatility and Deepest fall at Display size under it, `under` because three
  secondaries beside the hero wrapped raggedly), Best/Worst/Up years and Grew
  to/In today's dollars as key/values, and the Advanced hand-off as the card's
  footer row (#btUseRate now an outline button beside its note, capped to copy
  width; the hero keeps the amber). Then Growth of $10,000, Rolling returns,
  Inflation (moved below rolling; its six key/values in a three-column strip
  over the chart), Year by year (open: e2e clicks its headers). Color: only
  returns that are a gain or a loss, by sign, with an arrow (Best/Worst year,
  rolling Worst and Best, the year table's Your mix and Real); asset columns
  and rolling Median in Text. Phone: PinnedReading (return, after inflation)
  leads the inputs; the era switch sits under the years because above them
  the help tour's phone step had no clear spot to click it between the
  pinned reading and the coach sheet. Shared: the page scroll padding now
  clears a pinned reading under 1024px (00-base.css, `data-pinned-reading`),
  so a scrolled-to field no longer lands under it on any page that has one.
  The mix dialog (shared with Drawdown) gains a composition bar of the four
  typed shares over the total, with matching swatches (series sky, teal,
  lavender, gray: categories, not gains).

- **College Savings (/college): Basic's thirds, one monthly figure with how
  it steps down.** Inputs a third, results two thirds from 1024px; college
  joins SOLO. Inputs card "College plan" with an intro line: the children as
  flat rows (Stages' pattern: a hairline between children, "Child N" with a
  quiet X remove, `.clkid` / `.stagehead button` kept for e2e), each with
  School type full width, then Annual cost / Years until / Years of college
  three across where the column is wide enough (from 640px, and from 1280px
  in the thirds), cost over the two years otherwise; Add a child gets a plus
  icon; then "The account" (saved, return, tuition inflation, the derived
  line). Results: HeroReading (Save per month in amber, its note as the
  sentence with the family step-down; Total projected cost and the third
  figure, label and "?" unchanged, at Display size, notes wrapped short so
  the two sit side by side). Fully funded ($0 a month) the hero is Text, not
  amber, with a Gain badge "Covered by what you've saved" (check + words);
  figure and note text unchanged. Years 0 or cost 0 mark the field (Loss
  edge, icon, message; for a family "until then this child is left out");
  with nothing to plan the figures are dashes in Text, a band names the
  marked field, and Each child, the chart and the table fold away. Each
  child is a full-width table (Child, Starts in, Years of college, Total
  cost) with the left-out line under it. Chart: the cost / still-needed line
  is a plain Teal line on screen; its fill from $0 is kept only for the
  print/share copy (BandChart screenOnly.noBand, new, data-print-only).
  Year by year folds (keepMounted, full height); phones pin Year and Balance
  (Year fixed at 3.5rem so Balance sits beside it). The preset select shows
  Custom once the typed cost no longer matches its preset (display only:
  state and calculation unchanged; picking a preset still fills the cost).
  "for all 1 children" reads "for 1 child". PinnedReading (save per month,
  total projected cost) leads the inputs on phones. Dead rules (.clkid-name,
  #clAddKid margin, the old .clkid field rule) removed.

- **Rent vs. Buy (/rentbuy): Basic's thirds, a verdict with its margin and
  break-even.** Inputs a third, results two thirds from 1024px; rentbuy
  joins SOLO. Inputs card "Your situation" with an intro line: Time horizon
  first (it frames "Better after N years"), then Buying, Renting and
  Assumptions behind hairline group heads. Nothing folds: e2e types into Tax
  on gains and Filing status, and the help tour names Closing and Selling
  costs on its first step. The input column no longer pins on desktop
  (static): at 1006px it overflowed its 824px sticky scroller at 1440x900
  and hid the tax fields; it now scrolls with the page, which is about as
  long. Trade-off: the inputs leave the screen when you scroll to the chart.
  Results: HeroReading (verdict word in amber; "Ahead by $X" under it at
  Body in Text, the rbWinNote span keeping "by $X" so the help chip is
  unchanged; Break-even as a label and sentence under that, "--" now an em
  dash; Buyer and Renter net worth at Display size in Text with their notes
  word for word, wrapped short so they sit side by side). In the same card
  a two-column strip: "Each month, to start" (Buying all in, Renting (the
  rent input echoed), Principal & interest) and "Up front" (Loan amount,
  Renter invests), the derived figures moved out of the inputs with their
  ids. The "Every month, whichever side costs less..." explainer is the
  chart's description, word for word. The chart marks the break-even year
  on the buyer line (tick + "Break-even", data-screen-only, so the
  print/share copy is unchanged). Year by year folds (keepMounted); headers
  spelled out (Buyer net worth, Renter net worth, Mortgage balance), which
  changes the screen CSV's header row only (print uses its own headers in
  share.tsx). Phones: PinnedReading (verdict, ahead by) leads the inputs;
  the table pins Year (3.5rem) and Difference. Price 0: the field is
  marked (Loss edge, icon, "Enter a home price to compare."), the hero is a
  Text dash, the label keeps the horizon, one band says "Enter a home price
  to see which comes out ahead.", and the cost strip, chart and table fold
  away (elements kept, empty, for e2e).

- **Budget (/budget): Basic's thirds, inverted in weight: the ledger in the
  two thirds, the reading in the third, sticky.** From 1024px the lines take
  the wide left two thirds (Budget is all inputs: income, 19 preset lines,
  custom lines) and the reading sits in the right third as a sticky aside
  (scrolls on its own if taller than the screen, static below 1024px), so
  every amount typed shows its effect. Inputs stay on the left as everywhere
  else. One card "Your budget" with an intro line and CSV: Income first
  under its own head (field, /yr|/mo, Copy from Income Tax now a ghost
  button), then the groups as single-column rows with a hairline between
  lines (two-up only when the list itself is 820px+ wide, a container query;
  that's tablets 900-1023px), Add custom item and the two pull-ins with plus
  icons. Below 448px of list width (phones) each line puts its name on its
  own line with the amount (full width) and period under it: no mid-word
  breaks. Empty lines show their name and 0 in Muted (state keeps "0").
  Preset names show a pencil on hover/focus (always, faint, on touch).
  Reading card: HeroReading `under` with Left over per year (bgLeft, the
  old headline, the help tour's "Reading it" target) in amber; over budget
  the label reads "Over budget, per year", Loss with a trending-down glyph
  before the unchanged note; no income: Text, with "Enter your income to
  begin" (no green $0). Income and Total spending (per year) at Display
  size. A CompositionBar of the income: spending (Muted), saving (Sky), left
  over (amber, new PartTone "answer" in Reading.tsx); over budget it is
  spending and saving only. Under it the per-month/per-year totals as a
  plain key/value list (ids kept; left-over rows lose the green, keep Loss
  when negative). Then Emergency fund: the "Target for [6 mo] of monthly
  expenses" sentence moved here beside its answer, efTarget at Display size
  (the dead "v gold" class gone). Phones: PinnedReading (left over, spending
  per year) leads the ledger. The legacy #tab-budget width rules in
  03-navigation.css are removed (the page lays out its own grid in SOLO).
  Segmented `compact` (only Budget uses it) is quieter: chosen option Text at
  medium weight on the shared thumb, no fill or bold; 44px on touch.
  DESIGN.md's Layout line listing Budget among "pages without inputs" is
  corrected.

- **Debt Payoff (/debt): Basic's thirds, the debts as labelled cards, the
  date as the answer.** Inputs a third, results two thirds from 1024px (debt
  was already in SOLO; the old `stack solo` single column is gone). Inputs
  card "Your debts" with an intro line, sticky with its own scroll from
  1024px (static below): each debt a flat card on a hairline (Stages'
  pattern), name field and a quiet X (lucide, 44px on touch, aria-label
  "Remove <name>") on line one, Balance / Rate / Minimum with visible
  labels on line two (three across when the list is 320px+ wide, a container
  query; Balance full width over Rate and Minimum in the 1024px thirds); the
  "?" tips on the first debt only. Add a debt has a plus icon and now
  focuses and selects the new debt's name (the old focusLast selector
  matched nothing). A debt with no balance says "Not counted until it has a
  balance." Then "Your plan": Extra payment with Copy from Budget beside it,
  and the Avalanche/Snowball switch full width with its one-liner under it.
  Results: HeroReading (Debt-free in amber, Total interest and Saved vs.
  minimums at Display size; Saved in Gain with a check before its note).
  Stalled plan (the logged bug): "Never", the $3.7B interest and the
  verdict/warning wording are unchanged; only the hero's tone moves from
  amber to Text (Text over Loss: Loss would need its own glyph and word,
  and the figure itself is the open decision). Underwater minimum: that
  debt's Minimum takes the Loss edge (aria-invalid, aria-describedby) with
  an icon and "This minimum doesn't cover a month's interest." under it;
  the existing #dtWarn sentence, word for word, becomes a Warning callout
  (new shadcn Alert, `warning` variant: Loss 15% over Surface, triangle
  icon) under the reading. Then the race card "Avalanche vs. snowball": the
  verdict sentence at Body leads (was 11.5px muted), the table under it
  marks your approach (check icon labelled "Your plan", Text weight; no
  amber), minimums only quieter, figures kept on one line. The chart, screen
  only: the plan line and its arrowhead stop at the plan's payoff month and
  the x-axis ticks whole years (BandChart `screenOnly.baseEnd` /
  `yearTicks`, ChartFrame XAxis `every`, all new and opt-in); the print
  copy's markup is unchanged (checked: the copied SVG is byte-identical).
  Payoff order's Debt column is left-aligned; the schedule folds
  (Collapsible, keepMounted, CSV unchanged). With nothing owed, the cards
  below the reading fold away (kept in the page, empty). Phones:
  PinnedReading (debt-free, total interest) leads the inputs. Dead
  `.dtrow/.dthead/.dtstrat/.dtwarn` and `.bgincome*` rules removed.

- **Mortgage (/mortgage): Basic's thirds, the payment as the answer, extras
  beside their answers.** Inputs a third, results two thirds from 1024px;
  mortgage joins SOLO. One card "The home and loan" with an intro line in
  four groups (The home, The loan, Monthly costs, Cost of owning); pairs stay
  two-up on phones; the PMI note sits under PMI / HOA at 13px with an icon;
  Loan amount and Down payment stay as derived lines under the down
  payment. Like Rent vs. Buy the column no longer pins on desktop (about
  1,000px of inputs would scroll inside the page). Results: HeroReading
  (Monthly payment amber, "Everything included"; Principal & interest and
  Total interest paid, #moTotInt moved out of the inputs, at Display size),
  then "Where the payment goes" in the same card: Everything else (#moEsc and
  its note) on the heading line and the ShareBar list two-up from 640px,
  padded off the divider. The extras card "Extra payments and refinancing"
  (was "Already have this loan?", with "For a new loan or one you already
  have.") keeps the #moExtrasOn select and its options; when on, two
  columns, Paying extra and Refinancing, each its inputs then its answer in
  a tinted panel (payoff + "N sooner", Interest saved in Gain with a check,
  the recast payment "down from" today's P&I; New payment "from" today's
  P&I, Monthly change "Saves −$334/mo" with a trending-down icon (Costs +$X
  in Loss with trending-up), break-even, lifetime Saves/Costs with an
  icon). On phones each answer follows its own inputs, so every extras
  answer is now after the base result and next to what drives it (the
  e2e steps only set values by id). Price 0 or a down payment above the
  price: the field takes the Loss edge (aria-invalid, -describedby, icon,
  "Enter a home price." / "More than the home price."), the reading drops
  its amber and dims, one band says what to fix, and the chart and table
  fold away (kept in the page). Chart: on screen the fill between the two
  paid lines is gone (BandChart screenOnly.noBand; print/share keep it) and
  it has a one-line description. Amortization folds (keepMounted, CSV
  unchanged); on phones Balance is pinned on the right. The help tour, the
  Guide's "mortOwn" trip and About now name the card "Extra payments and
  refinancing" (they named the old title); the tour's "panel on the right"
  reads "panel under the fields".

- **Retirement Readiness Guide (/guide): step card + a 340px rail, aligned
  to the page.** Not Basic's thirds: the guide is one question at a time,
  so the card takes the measure and the rail keeps the score and route
  beside it (the 1120px cap is gone, so it lines up with the household bar
  at 1330). Results lead with a HeroReading: the score in its rating tone
  (Gain from 70, Text 30-69, Loss under 30) with a glyph and the rating word
  (`.gd-hero .r` kept), the summary under it, then Lasted / Projected at /
  Needed at at Display size (all existing figures; Projected and Needed no
  longer repeated in the tables). The ring is no longer drawn on results;
  the rail card there becomes "What's behind the score" (factor rows).
  Next moves are one ruled, numbered list (the title has its own class, so
  bold figures in the sentence stay inline); Your plan and Your numbers sit
  side by side from 768px. Outlook and Will it last lead with a card-scale
  HeroReading (savings at retirement amber; success rate Gain from 85% with
  a check, else Text) with the other two figures beside it; Outlook's
  verdict moves above the chart. One primary per view: trip buttons, Apply,
  Find my best plan, Use this plan and Review my answers are outline;
  Continue is the amber. The doubled uppercase eyebrow is gone (the
  progress bar names the chapter). Phones: the progress card is one row
  (score, step count) plus the bar, 62px (was 104); chapter bars and route
  rows take 44px hit areas under a finger; a trip opens with the coach
  folded (guide state only, `startTrip`; CoachPanel itself is unchanged,
  so Tool Help is unaffected). Route: chapters fold (Collapsible, the
  current one open, "n of m" done beside each); healthcare and 59½ rows
  stay out until the retirement age is known. Error: an About retirement
  age at or before your age marks the field (Loss edge, icon, the existing
  sentence under it, aria-invalid/-describedby) instead of a Warning
  callout; the disabled Continue's reason is Body small Text with a warning
  glyph. Suggested-amount pills are outline Buttons (`.gd-pick` gone).

- **Tool Help and the Guide's coach (CoachPanel, shared): a sidecar from
  1400px, the floating card below it, a sheet on phones.** From 1400px the
  panel docks full height at the right (340px, Surface, Rule left edge, no
  shadow) and the page narrows by its width (body padding via --gdw; the
  pinned rail's controls and the toast centre on what's left), so it covers
  nothing. 1400, not the critique's 1100: the tools' breakpoints are
  viewport-based, and below 1400 the narrowed content (1400 - 340 - gutters
  = 988px) would drop under the 972px their lg layouts are drawn for (at
  1100 the inputs column would be ~220px). 1024-1399 keeps the bottom-right
  card (Raised, Float). Header: the part title as the panel title, one Muted
  line under it ("Help · Mortgage Calculator · Part 1 of 3"); the tour title
  and both uppercase eyebrows are gone. Under it a row of segment buttons,
  one per part (aria-current, a tooltip with the part's title), reusing the
  part navigation. Back / Next: <next part> sit in the sticky footer (Next
  truncates); Tool Help's last part has Done (#thCoachDone, closes) instead
  of the footer's duplicate "Close help" (the header X stays). On a trip
  Next is outline so Back to guide stays the one primary. Steps in Text,
  14px. The section a part is about (its existing `focus` selector) is
  outlined in Text, 2px at 6px offset (wider than the focus ring), fading
  in, not under reduced motion, not printed; fields ring their row, small
  figures their block, tables their scroll box (`data-coach-mark`, new,
  set and cleared by the panel). Trips now outline their parts too. Phone
  sheet 55vh (was 62); folded keeps the way on (Back/Next for help, Back to
  guide on a trip) and drops a figure-only chip line.

- **Tools (/tools): one full-width column, two-column card grid.** No
  inputs, so no thirds; the picker now runs the full width of main, the
  same edge as the household bar and the article (it was 1,060px inside
  1,278). Two columns from 900px, not three: the groups hold 5/4/4 cards,
  so three columns would leave orphans in every group; a group's odd last
  card spans the row instead (Healthcare). Each card puts icon, name and
  arrow on one row and the description at full width below: descriptions
  went from 2-4 lines to 1-2 on desktop and from 3-7 to 2-4 on a phone
  (cards 115-154px, were 176; page 2,800px, was 3,200). Trade-off: the
  critique's ≤88px phone card needs one-line descriptions, which means
  new copy (the descriptions are shared with tool headers and SEO; the
  owner's call). A visible "Tools" header (set like a tool header) sits
  after the household bar; the SEO h1 stays screen-reader only and the
  visible title is aria-hidden so it isn't read twice.
- **Not found (404): a centered 768px column.** Unknown addresses aren't in
  SOLO, so the page spans main's two columns (`col-span-full`) and centers
  its own: Headline, one line, a primary and a secondary button (links
  drawn with buttonVariants), then four picker cards (Drawdown, Plan
  Optimizer, Roth, FIRE) in the picker's two-column grid.

- **About: a 42rem reading column, with a sticky index beside it from
  1100px.** About has no inputs, so it isn't a thirds page: one centered
  column (672px) with the prose at Body 15px in Text, capped at 65ch;
  from 1100px a 13rem "On this page" index (groups and sections, links
  open the section they point to) sits to its left and stays under the
  rail, filling the empty left side. "What this is" leads under a visible
  "About RetCalc" header; the theme switch and household bar follow as
  "Your settings"; the 22 sections sit in six Eyebrow groups that follow
  the picker (Calculator and Guide, Retirement income, Saving and
  investing, Everyday money, Methods, Sharing and limits), each one panel
  of hairline rows (shadcn Collapsible, h3 around the button, hidden
  until found so the browser's find opens them); Contact and Disclaimer
  close it as "Fine print" without panel chrome. Opening fades the body
  in and drops it 4px (opacity/transform, 200ms); the height no longer
  animates (DESIGN.md Motion: no height animation; the old 300ms sweep
  broke it). Trade-off: the jump in height on open is instant.

## Skipped from critique

- **Tools**: one-sentence descriptions ≤60 characters — new copy shared
  with the tool headers and SEO (orchestrator call: layout instead).
- **Tools**: a "Start here" row (Guide, Calculator) or adding 72(t), RMD
  and strategy pages to the picker — navigation structure.
- **Tools**: icon motion on focus/tap, ≤250ms beats, arrow-step parity in
  the icon animations — Phase 2 (the card's arrow now steps on focus too).
- **Not found**: the Tools tab shows as active on the 404 — `tabFor`
  defaults unknown slugs to "tools", and returning no tab would leave every
  tab at tabIndex -1 in the rail's roving focus (NavBar), so it isn't a
  one-line default; needs a NavBar change.
- **Not found**: Save/Share/Reset stay enabled on the 404 — scenario
  toolbar behavior, logged only.
- **Not found**: "did you mean" suggestions or redirects — routes.
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
- **RMDs (/rmd)**: the doing-nothing first RMD in the facts, and "No
  conversions" as /rmd's default — a new figure and a default change; the
  table opening on Doing nothing shows those RMDs instead.
- **RMDs (/rmd)**: an RMD-specific tool description — the header copy comes
  from the shared tool list; left for the owner.
- **Roth Conversion**: 44px CSV button and the article disclosure's label —
  shared CsvButton size and the shared article component, not this page's.

- **Healthcare**: a default income so a first visit has an answer — data
  change; an empty reading and a hint at the MAGI field instead.
- **Healthcare**: thousands separators on the tool's money figures
  ("$3291/mo", "~$907–$1067/mo") — figure format; the hero repeats them as
  they are.
- **Healthcare**: the "$0/mo" net premium in the Medicaid range, beside the
  sentence saying subsidies don't apply — figure / content for the owner;
  the hero shows the same value the tile did.
- **Healthcare**: "Your own quote" (benchmark premium) as a closed
  disclosure — healthcare.spec types into hcManualPremium on both sites;
  kept open under its own head.
- **Healthcare**: a timeline from retirement to 65 to Medicare, total cost to
  65, distance to both thresholds together, an "if restored" switch on the
  reading — new figures or behavior; not built.
- **Healthcare**: credit rows in Text instead of green — the owner keeps the
  premium tax credit green.
- **Healthcare**: 44px hit areas for the "?" tip dots and the in-sentence
  healthcare.gov link — the dots are the shared TipDot (site-wide pass); the
  link sits inside method text (inline links are exempt; restyle only).
- **Healthcare**: renaming the page title / article label — SEO copy, the
  owner's call.

- **FIRE**: the headline following the chosen method (the historical age in
  Historical) — changes which figure the headline shows (orchestrator's
  call); the headline is labelled "at your rate of return" and the history
  answer sits beside the slider in the reading instead.
- **FIRE**: Historical as the default method, and a reachable Coast default
  (retire at 65 fails with the defaults) — default inputs; the Coast
  failure now says what to change.
- **FIRE**: the Coast failure sentence quoting the full-saving age and
  balance ("you'd reach $1,024,146 only at 66.6") — those are FIRE mode's
  figures, not shown in Coast; the sentence names the retirement age only.
- **FIRE**: scroll the FIRE row into view in the table — new behavior; the
  table opens full height instead, so the row is reached by the page scroll.
- **FIRE**: "Today's dollars" for the "Inflation adj." header — changes the
  CSV header, and Advanced keeps "Inflation adj."; kept.
- **FIRE**: a composition bar (start / contributions / growth) under the
  reading — optional, and its shares would mix the initial balance (today's
  dollars) with future-dollar figures; not built.
- **FIRE**: the method note ("…compounded month by month, 1926–2025… Your
  rate of return and inflation inputs are ignored in this mode") — method
  text, kept word for word under the chart; the field hint is new copy.
- **FIRE**: 44px hit areas for the "?" tip dots and CSV — shared TipDot and
  CsvButton (site-wide pass).

- **Backtest**: "Put the rest in bonds" in the mix dialog — new behavior in
  the dialog Drawdown shares; logged as an idea.
- **Backtest**: correcting From after Through (or the clamp) — model logic;
  Through now carries a field error saying only From is shown.
- **Backtest**: Worst as the second column on phones — reordering cells
  changes the CSV; Worst is already the third column and on screen at 390px.
- **Backtest**: the rebalance counter reading 0 on yearly rebalancing —
  logged bug, left.
- **Backtest**: Year, Your mix, Balance first on phones in the year table —
  CSV column order; Year stays pinned.
- **Backtest**: "Worst (lived through)" header, a "+" on gains, a true minus
  on losses — header copy and figure text; arrows carry the sign instead.
- **Backtest**: renaming the h1 ("... Calculator") — SEO title, owner call.
- **Backtest**: a log-scale growth chart, the worst 30-year window as a
  reading figure — chart capability / content calls.
- **Backtest**: 44px Segmented and CSV hit areas on touch — shared controls,
  left for the shared-controls pass.
- **Backtest**: the mix dialog as a bottom sheet on phones — shared Modal;
  the scrim already covers the tab rail (checked: the overlay is on top at
  the rail), so no z-index fix was needed.

- **College Savings**: relabelling the third figure (shortfall at college
  start for one child, present value today for a family) and aligning it
  with the print sheet's "Needed when college starts" (the target, not the
  shortfall) — figure meaning / labels of a figure; kept as is.
- **College Savings**: the one-child chart running through the college
  years — new rows from the engine; not built.
- **College Savings**: a composition bar (saved covers vs still needed) —
  for one child the total it splits (target at start) isn't on screen, so
  it would be a new split; not built.
- **College Savings**: a "+" on Growth cells — changes the figure text;
  kept green under the "Growth" header.
- **College Savings**: shorter preset option labels with the dollar figure
  as a hint — the options carry the preset figures; kept, and the select
  stays full width.
- **College Savings**: a segmented switch for the presets, collapsible
  child rows on phones, the children as a full-width table above both
  columns at 3+ — new behaviors; flat rows instead.
- **College Savings**: hiding "covers 0% of it" with nothing saved — a
  figure; kept. 44px "?" dots and CSV — shared TipDot / CsvButton.

- **Rent vs. Buy**: both chart lines start at $0 in year 0 (the renter
  really starts with the down payment invested) — plotted values; a figure
  change, left.
- **Rent vs. Buy**: a true minus and a direction-naming header ("Buying ahead
  by") in the Difference column — figure text; kept "-$30,195" under
  "Difference", now pinned on phones.
- **Rent vs. Buy**: shorter counting notes under the net worths, a new
  article label — copy, owner call; kept.
- **Rent vs. Buy**: folding the costs/taxes group — e2e types into the tax
  fields; nothing folded (the column unpins instead).
- **Rent vs. Buy**: the help tour still says the break-even is "under the
  chart" (it never was; now it's under the verdict) — tour text is
  compared against the old site by help.spec; left for the help pass.
- **Rent vs. Buy**: 44px hit areas for the "?" dots and CSV — shared TipDot /
  CsvButton.

- **Budget**: per-group subtotals and highlighting the largest lines —
  new computed figures (hard stop).
- **Budget**: Left over per month as the hero — bgLeft (per year) is the
  existing headline figure, the help tour's focus and the share card's;
  the monthly figure sits in the list right under the bar instead.
- **Budget**: an income line drawn across the composition bar when over
  budget — would need a new marker element and label; the hero carries
  the over-budget state (Loss, glyph, words).
- **Budget**: the help tour and the Guide coach say "Left over at the top" /
  "+ Retirement contribution" — tour and coach text are compared against
  the old site; left for the help pass (on desktop Left over is now top
  right; the buttons have a plus icon instead of a typed "+").
- **Budget**: CSV button size on touch — the shared xs Button already grows
  its hit area to 44px under a finger; visual size unchanged.
- **Budget**: article label "Budget calculator" — SEO/article copy, owner call.

- **Debt Payoff**: the stalled-plan display ("Never", the capped interest,
  "the two orderings land in the same place", the roll-over warning) —
  logged bug, open decision; only the hero's tone changed (amber to Text).
- **Debt Payoff**: undo for removing a debt — a new behavior, not an
  existing mechanism.
- **Debt Payoff**: the +$100 lever as its own figure and first-debt notches
  on the chart — new presentation of figures the critique lists as
  questions; the lever stays in the verdict sentence.
- **Debt Payoff**: a note that the schedule is thinned — text about how the
  table is built; the schedule is folded instead.
- **Debt Payoff**: "blended rate" explained, card-description and "Copy
  from Budget" wording — kept (tool name; the tour compares the button).
- **Debt Payoff**: segmented height matched to fields, "?" and CSV hit
  areas — shared components (Segmented, TipDot, CsvButton).
- **Debt Payoff**: PinnedReading while the debts are on screen on desktop —
  the shared component is phones/tablets only; desktop keeps the reading
  beside the sticky inputs.

- **Mortgage**: clamping or rejecting a down payment above the price (and
  a price of 0) — changes what's computed; the field is marked and the
  reading dimmed instead, figures unchanged.
- **Mortgage**: a separate PITI ("payment to the lender") figure — a new
  computed figure.
- **Mortgage**: "Monthly payment · Everything included" relabelled "Monthly
  cost of owning" — the note is accurate (everything is included); the
  label question (a lender doesn't bill upkeep and utilities) is the
  owner's copy call, and the share card, sheet and tour use the same words.
- **Mortgage**: "Total paid" (P&I only) renamed "Loan payments" — column
  label shared with the print summary and CSV; owner's copy call.
- **Mortgage**: replacing the extras select with a Switch — e2e selects
  #moExtrasOn by value and the tour names its options; restyled and
  retitled instead.
- **Mortgage**: "$334 less a month" wording — figure text kept
  ("−$334/mo"), with "Saves" and a trending-down icon beside it.
- **Mortgage**: the payoff date before extras, the base-loan line on the
  chart, a PMI-end marker — new on-screen figures/data (owner's call).
- **Mortgage**: "?" tip dots and CSV touch size — shared TipDot/CsvButton.
- **Guide**: bow-and-arrow colors (green chapter fills and bow limb,
  always-amber arrow), its motion, a progressbar role and the label/arrow
  sync — Phase 2 (brand motif).
- **Guide**: "89 On track" while an invalid answer drops an area — what the
  score counts is score logic (hard stop); the score's "From N of 5 areas"
  line is now Text weight instead.
- **Guide**: "What's going well" listing Debt beside "#1 pay off your debt"
  — the win threshold is score logic; badges unchanged (owner decision).
- **Guide**: folding the tax and Social Security notes on Outlook into a
  "How this was worked out" disclosure — method text; reordered only.
- **Guide**: native confirm() for Start over / shared link → AlertDialog —
  e2e accepts the native dialog on the shared-link test.
- **Guide**: radio cards (.gd-choice, .gd-opt), factor rows and route rows
  to shadcn components — data-set/data-val/data-opt selectors and the
  compare walks depend on their markup; restyled in place, left for a
  shadcn card-radio variant.
- **Guide**: coach docking in the right gutter on desktop / reserving
  space in the tool — CoachPanel is shared with Tool Help (its own pass).

- **Tool Help**: sidecar from 1100px — from 1400px instead (layouts are
  viewport-based; narrower content would break the tools' lg grids); the
  1024-1399 floating card still covers part of the results.
- **Tool Help**: dropping the chip that repeats the headline figure (or
  showing a tick count instead) — removing/adding a shown figure; kept,
  hidden only when folded on a trip-less panel.
- **Tool Help**: arrow keys between parts (a full tablist) — new behavior;
  the parts are plain buttons in tab order.
- **Tool Help**: tour copy pointing at old places ("Left over at the top",
  "under the chart", Drawdown switching to Advanced without saying so) —
  tour text is the owner's copy and compared with the old site; unchanged.
- **Guide coach**: dropping the trip's chip — it is the figure the guide
  brings back; kept.

- **About**: an "open all" control and a current-section highlight in the
  index — new behavior; links open their section, find-in-page opens a
  folded one.
- **About**: moving Appearance to a masthead settings sheet, and moving
  per-tool sections onto each tool's article — content/IA decisions for
  the owner (critique's open questions); Appearance now follows "What this is".
- **About**: a hint that the masthead's sun/moon also switches the theme,
  and linking "Each tool is described in its own section below" — new
  copy / editing a sentence (hard stop on wording).

## E2E checks edited

- **Debt Payoff** (e2e/debt.spec.ts, "added and removed debts"): the remove
  step's selector `button[aria-label="Remove"]` became
  `button[aria-label^="Remove"]` (the button is now named "Remove <debt>";
  the old site's "Remove" still matches). Same step on both sites; no
  assertion changed.

- **About** (e2e/about.spec.ts, "panels opened"): the clicks
  `#tab-about .panel.about:nth-of-type(4|9|21) h2` became name-based
  selectors for the same three sections ("How the projection works",
  "Plan Optimizer", "Historical"): `.panel.about > h2:text-is(...)` on the
  old site, `h3 > button:text-is(...)` on the new one (sections are now
  grouped and reordered, so position no longer names them). No assertion
  changed; the numbers diffs are text only (Appearance → Your settings,
  the header, index and group names added, sections reordered).

## Later: share card and print summary

Dropped from the 2026-10-06 site-wide pass at the owner's request: the
printed summaries and the share image cards keep their current look until
a pass of their own. Open items for that pass:

- **Rent vs. Buy, the buyer line:** prints and shares as #7d9fd6 (sky);
  it was the plan gold #e9b872 before the chart-colors pass.
- **Early Retirement Bridge, the 72(t) band:** "72(t) payments" goes out
  as #e2795f (rose); it was #c98fb8 before.
- **Income Tax donut, the state tax slice:** goes out as #a98fd6
  (lavender); it was #e9b872 before.
- **Hatch stripes follow the page's theme:** the stripes on hatched
  series (Bridge rungs, Tax pre-tax/other) use the screen's surface color,
  so a card or printout made from a light page differs from one made from
  a dark page.
- **Charts drawn differently on screen than in print** (found in this
  pass; on screen only, by design, so print and share kept their layout):
  Roth's chart keeps its rose third line and gradient band in print
  (screen-only replacements, `BandChart screenOnly`); College, Mortgage
  and Debt charts likewise keep their old band or full-length line in the
  copies. The print/share pass should decide whether to adopt the screen
  drawing.
- **Rent vs. Buy, renter line color when buying wins:** the renter line is
  drawn rose while the legend shows teal (pre-existing; changing it
  changes the print/share colors).

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
