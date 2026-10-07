# Redesign report

The site-wide redesign pass on branch `redesign`, 2026-10-06 to 2026-10-07,
after Basic (the homepage, the reference). Every page except Basic was
critiqued, shaped, rebuilt, polished and checked, one commit per page; then
motion (Phase 2), a site-wide audit (Phase 4) and two rounds of a fresh-eyes
review (Phase 5). Phase 3 (share card and print summary) was dropped at the
owner's request. Nothing was merged to main and no pull request was opened.

**Preview:** https://retcalc-8pjfq6n7p-ret-calc.vercel.app (commit 019c148; the report commit only adds this file, behind Vercel deployment
protection). **Production branch:** Vercel deploys `main` to production
(MIGRATION.md; confirmed by the GitHub deployments API: the latest
Production deployment is 7c07e69, the tip of `main`).

Details for every decision are in REDESIGN_NOTES.md (Layout decisions, Audit,
Fresh-eyes review, Skipped from critique, E2E checks edited) and
REDESIGN_PROGRESS.md.

## Pages: what changed

- **Advanced** (/advanced, f9e824f): thirds, hero reading (after-tax income), goal inputs moved left, chart header stacks on phones
- **Stages** (/stages, 4fdf10e): thirds like Advanced, stage editor moved into the inputs with a timeline strip, hero reading, empty and 0-year states
- **Drawdown Simulator** (/drawdown, 7cfb953): thirds, hero reading (success rate in its rating tone), views as tabs each with its own answer, plan as a story, token heat grid; strategy pages share it
- **Income Tax** (/incometax, 36ede43): thirds, hero reading (pay or income after tax), donut + bars as one band with a reconciling note, field error on pre-tax, gain chart up and unclipped, state rules folded
- **Plan Optimizer** (/optimizer, 75d7a3a): thirds, run first on phones, hero reading + moves under it, stale dims; loader motion still Phase 2
- **Early Retirement Bridge** (/bridge, f6fa405): Thirds; hero reading (best plan, holds, cost, at 59½); sticky Following head with the market switch; detail folds
- **72(t)** (/72t, 9078406): Bridge's page with variant="72t": 72(t) terms lead the inputs and facts
- **Roth Conversion & RMDs** (/roth, 202f807): Thirds; verdict as the headline over three peer figures (net worth relabelled vs doing nothing); conversion plan as a lever card; chart screen-only fixes, print unchanged
- **RMDs** (/rmd, 3d2a656): Roth's page with variant="rmd": Peak RMD leads in amber, year table open on Doing nothing, RMD column first
- **Healthcare Cost Planner** (/healthcare, 389e6eb): Thirds; hero reading (net ACA premium, or Medicare at 65+), cliff/IRMAA warnings in the reading, phases side by side from 1100px, what-if and tiers folded
- **FIRE Calculator** (/fire, 0c2d028): Thirds; age at your rate of return as hero, the history answer beside its slider in the reading
- **Portfolio Backtest** (/backtest, e74ef68): Thirds; return per year as hero with after inflation, volatility, deepest fall; gain/loss color by sign only
- **College Savings** (/college, defdc37): Thirds; save per month as hero with the step-down sentence; children as flat rows; field errors, covered state, cost as a plain line on screen
- **Rent vs. Buy** (/rentbuy, 9c44273): Thirds; verdict as hero with ahead-by and break-even sentence; monthly costs moved into the reading; inputs unpinned on desktop; break-even marked on screen only
- **Budget** (/budget, 114c44d): Ledger two thirds + sticky reading third; Left over hero (amber / Loss + Over budget / Text when empty), composition bar, emergency fund beside its field; phone rows name-over-field
- **Debt Payoff** (/debt, 69b41ef): Thirds (debts + plan left, sticky); Debt-free hero (amber / Text when stalled), labelled debt cards, field-level underwater mark + Warning callout, verdict leads the race table, chart plan line ends at payoff + year ticks (screen only), schedule folded
- **Mortgage Calculator** (/mortgage, 1ed5b17): Thirds; payment hero with P&I and total interest, composition under it; extras and refinance inputs beside before/after panels; field errors; chart band screen-only off; table folded, Balance pinned
- **Guide** (/guide, 8e60269): Card + 340px rail; score hero reading (rating tone) with lasted/projected/needed; one amber per step; compact phone progress, 44px hits, coach folded on phone trips; route folds; field error; bow-and-arrow still Phase 2
- **Tools** (/tools, 7c1b18e): Full-width picker, visible header; icon+name+arrow row, description full width; equal rows, odd last card spans; icon motion: Phase 2
- **About** (/about, 1b9a0da): Reading column + sticky index from 1100px; What this is first, settings after; sections in picker groups as Collapsible rows (h3 + button), 15px Text prose, fine print quieter, #disclaimer lands
- **Compare** (/compare, 827f8d0): Slots a third beside the chart; each slot its balance (today's dollars) + difference from A, no amber; slot errors, mixed-calculator note, differences beside their scenario; Drawdown compare same slots with rating glyph
- **Tool Help (the docked help panel)** (on every tool, 902705e): shared CoachPanel: sidecar from 1400px, Back/Next in the footer, clickable parts, the part outlined; Guide trips too
- **Not found** ((404), 381b1b3): Centered column: message, primary + secondary buttons, four picker cards; Tools tab active logged
- **The 4% rule** (/4-percent-rule, d632d7c): representative; own lede (CARD_ALT), full-simulator + How it works links, generic intro hidden, Other strategies nav, article open
- **Guardrails** (/guardrails, d632d7c): shared template; checked desktop/phone, dark/light: preset, lede, no overflow
- **Risk-based guardrails** (/risk-based-guardrails, d632d7c): shared template; checked, no page fix
- **Ratcheting** (/ratcheting-withdrawal, d632d7c): shared template; checked, no page fix
- **VPW** (/vpw, d632d7c): shared template; checked, no page fix
- **Vanguard dynamic spending** (/vanguard-dynamic-spending, d632d7c): shared template; checked, no page fix
- **CAPE-based** (/cape-withdrawal, d632d7c): shared template; checked, no page fix
- **RMD-based** (/rmd-withdrawal-strategy, d632d7c): shared template; checked, no page fix

Shared pieces built or changed for the pass: the hero reading
(`components/common/Reading.tsx`: HeroReading, PinnedReading, CompositionBar,
PartKey), the masthead controls pinned in the rail on every page,
`components/ui/alert.tsx` (warning), Collapsible `row`/`reveal` variants,
`components/common/Signed.tsx` (arrow cells), `cn` with the theme's text
sizes, the Tool Help sidecar, the strategy pages' lede, links and Other
strategies list.

## Motion (Phase 2)

- **Tool-picker icons** (8597d84): one beat per icon, ≤240ms incl. stagger,
  transform only; hover (real hover devices), focus-visible and tap; FIRE's
  endless flicker is one flare; no stroke drawing; reduced motion = border
  colour only.
- **Guide bow-and-arrow** (c3b83c4): translateX/scaleX in a size container
  (arrow and fill agree at every width), 520ms flight, hit 283ms, Text /
  Rule / Muted colours with the bullseye amber at the hit,
  `role="progressbar"` with "Step N of M", reduced motion jumps.
- **Optimizer loader** (cf34bba): same build as the Guide; minimum 5s on
  the first run in a session and 2s after; skip by click, tap, Enter or
  Escape; results at once under reduced motion; landing to results about
  380ms; progressbar role and a polite start/finish status.
- **Transitions, tabs, press, panels** (dddce36): rail arrow slides 240ms;
  panes rise 6px in 220ms; 1px press; folds fade instead of sweeping height;
  toasts 220/150ms; the icon glide 250ms; a global reduced-motion guard.
- The headline count-up is unchanged.

## Skipped from critique

- **Drawdown and strategy pages** (round 2 review): de-duplicating the
  spread chart's "$0 $0 $0" x-axis ticks — changes the tick formatter, so
  figures shown on a chart; hard stop.

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

- **Compare**: masthead "No saved scenarios" with Save/Share/Reset live,
  and the Calculator tab lit with a mode word — needs the shared
  ScenarioBar/NavBar logic (navigation and shared shell; logged, not done).
- **Compare**: card titles at 16/500 vs DESIGN.md Title 14/600 — the
  shared CardTitle sets it for every page; a site-wide call.
- **Compare**: Drawdown "Failure years" as a count with the list in a
  disclosure — the count would be a new displayed figure; list kept.
- **Compare**: percentage differences, a "your plan" slot in amber, a
  choosable baseline — new figures / new behavior.

- **Strategy pages**: a one-line preset summary ("Set up for the 4% rule:
  $1,000,000 in 60/40, $40,000 the first year…") — new copy with figures;
  the page's own CARD_ALT line is used instead.
- **Strategy pages**: a hero secondary that answers each page's question
  (deepest cut, lowest spending, number of raises, today's CAPE rate) —
  new figures in the reading; the scorecard below keeps them.
- **Strategy pages**: carrying an edited plan into /drawdown, or keeping
  edits on reload — behavior change, owner's call; plain links only.
- **Strategy pages**: a per-strategy icon instead of Drawdown's — new
  assets, and tool icons are Phase 2.
- **Strategy pages**: inputs starting collapsed to a preset summary with
  "Change the plan" — the help tour and e2e reach the fields directly, and
  the pinned reading already leads on phones.
- **Strategy pages**: moving the article up under the main chart — it would
  push the three views down; it opens by default and "How it works" jumps
  to it. Article h2 left as written (content unchanged).

- **Basic, Advanced, Stages, FIRE** (audit): a "+" before the green Growth /
  investment-gains figures (DESIGN.md: gain colour with a sign) — changes
  the text of a shown figure (numbers check, CSV, share); hard stop.
- **Drawdown** (audit): a check/cross glyph on "Survived" / "Ran out in year
  N" and a "+" on positive returns in its tables — changes table text the
  numbers check and CSV read; hard stop.
  Done instead without a text change (Phase 5, 0fbbc72): aria-hidden SVG
  icons beside the figures (check/x on Outcome, arrows on Return, rating
  glyphs on the success rates); no "+" and no text glyph, so innerText, the
  CSV and the numbers check are unchanged. See "Fresh-eyes review (Phase 5)".
- **Site-wide** (audit): wrapping the tab rail in a nav landmark — the
  rail's markup is navigation structure that CSS and e2e select on; logged.

## Audit (Phase 4)

Site-wide technical audit, 2026-10-07, on a production build: every route
in REDESIGN_PROGRESS.md (31), dark and light at 1440, axe-core (WCAG 2.1
A/AA + best practice), DESIGN.md heuristics (amber places, gain/loss
colour with sign or icon, tabular numbers, emoji), horizontal overflow at
320/390/768/1024/1440, the dialog/keyboard script, touch targets (Pixel 7
touch emulation), the impeccable detector, and a code scan for colours,
layout transitions and will-change. Score 16/20 (a11y 3, performance 3,
responsive 3, theming 4, integrity 3). No page scrolls sideways at any
width; no emoji; no number outside tabular figures; amber only on the key
result, the primary button, the active tab and "your plan" legend swatches;
no raw colours outside tokens and the print sheet; every focus stop shows
a ring (focus check, 1314 stops); every dialog passes the keyboard script.

### Fixed
- Article headings open from the keyboard: the h2's text sits in a button
  with aria-expanded/aria-controls; text, level and ids unchanged; chevron
  no longer wraps on phones (47f9c2d).
- Guide trips on phones: a folded trip coach keeps its tour's Back/Next
  (the drawdown tour's `[data-cp="1"]` was hidden, guide.spec timed out on
  phone; a Phase 1 regression of 8e60269 + 902705e) (a164e40).
- Help copy pointing at old places: Budget trip "Left over at the top",
  Rent vs. Buy "break-even under the chart", Drawdown's part that silently
  switches to Advanced now says so (0595521). Checked and left as true:
  Budget's "+ Retirement contribution" (the button shows a plus icon),
  Stages' "Stage by stage, under the chart", Drawdown's "Advanced, at the
  top of the panel".
- axe: empty #tipbox tooltip without a name (all pages), the Tools tab's
  aria-controls to a missing panel (every tool page), Budget's unlabelled
  emergency-fund months field, Drawdown's unfocusable scrolling year table,
  Income Tax's 40%-opacity bracket rows (2.5:1) (6f17e69).
- 404 shows no active tab: a no-tab state of the rail, first tab keeps the
  tab stop (8ac8a11).

### Logged
- **Optimizer's amber "Find my best plan" vs the Guide's outline one**:
  both follow the Four Places Rule. On /optimizer it is the view's one
  primary action; in the Guide, Continue is the step's one primary, so the
  optimizer's run button is outline there. No change.
- **Tool Help floating card, 1024 to 1399px**: covers about a third of the
  results column (390px card at the right, e.g. Drawdown at 1200). The
  sidecar can't start lower without breaking the tools' lg grids (decided
  in 902705e); the card folds with its chevron. Not simple and safe; left.
- **Tab rail outside a landmark** (axe "region", every page): `nav` carries
  role=tablist, so it isn't a navigation landmark. The fix (a nav wrapping
  a tablist div) touches the rail's markup and every `nav[role=tablist]`
  selector in CSS and e2e; left for a pass of its own.
- **Toggles with a "?" inside** (axe nested-interactive: Advanced's Split
  by account type and Glide path, Stages' Split by account type): the
  TipDot button sits inside the toggle button. Moving it out changes the
  CheckToggle markup the stage cards lay out by; left for a pass of its own.
- **Drawdown touch targets**: views and Simple/Advanced tabs are 41-42px
  tall, and "How the strategies compare" / "Reproduce a classic study" are
  22px text buttons, under 44px on touch. Guide's Start over is 43px.
- **Guide factor bars animate width** (styles/12-guide.css .gd-fac .bar i,
  400ms): the only layout-property transition (detector); scaleX would do.
- **Positive figures in green without a "+"**: Growth (Basic, Advanced,
  Stages kv rows and the Stages table) and FIRE's investment gains carry a
  word but no sign; Drawdown tables' positive returns and "Survived" /
  "Ran out in year N" carry a word or column header but no glyph. See
  Skipped from critique. (Drawdown's: done with icons in Phase 5, 0fbbc72.)

## Fresh-eyes review (Phase 5)

Round 1 findings: redesign-baseline/review/round1-findings.md (none P0;
five P1). Round 2 confirmed every round-1 fix, reviewed the lower halves of
the long phone pages (which round 1 couldn't see: the screenshot tool broke
past 16k device px and was fixed), and found one P1 and six smaller items,
all fixed or logged below.

Round 1 by a fresh agent (redesign-baseline/review/round1-findings.md),
triaged by the orchestrator. Numbers check unchanged after every commit.

### Fixed
- **Drawdown and strategy pages, "How each starting year/month fared"**
  clipped "CAPE at start" at 1440 (860px min-width in an 843px column): the
  figures stay on one line and long headers wrap; fits at 1440 down to
  1100, scrolls narrower, phones unchanged. **Return sensitivity** (and the
  claiming-age table) run edge to edge with the site's cells (3c96ed2).
- **Never Alone on Drawdown's tables** (audit had logged these as hard
  stops): Outcome gets a check / x, the year-by-year Return Backtest's
  up/down arrow, the success rates in Return sensitivity and claiming ages
  the rating glyph (check from 95%, warning circle from 85%, x below), not
  an arrow, since a success rate is a rating. All aria-hidden SVGs beside
  the figure: no "+", no text glyph, so innerText, CSV and numbers are
  identical. A zero return goes from green to Text (no arrow to carry).
  Backtest's arrow cell is shared as components/common/Signed.tsx (0fbbc72).
- **Amber outside its four places**: the scatter's "start picked in the
  table" is a Text ring around its own Lasted/Ran out dot (new Scatter
  `sel`; the showdown's plan point stays amber); Bridge/72(t) "Total" is
  the accounts' sum, so lavender. Neither chart is copied into the print
  summary or share card (#chartDD / #chartBR are), so those are unchanged
  (e29dbc7).
- **Phone layout**: Drawdown card titles keep their "?" with the last word
  (Tipped in a span, eight titles); "Pin as baseline" full width; Bridge /
  72(t) Filing status and Optimizer "Must last in" take the full row
  (88378a5).
- **Empty states and consistency**: an empty hero reading's dash takes the
  secondaries' size and spacing and the labels line up (Healthcare); the
  pinned reading shares one baseline and one dash size; the scenario
  picker no longer dims where it's disabled (Tools, About, Compare, 404;
  still disabled); Mortgage's extras select takes the first column with a
  line beside it; Stages' Milestones / Take it further stretch to one
  height; the Guide's bars are inset by the bow so it lines up with the
  title (e6dee25).
- **Bridge "Ways to 59½" marks**: the rule (check from 95%, cross under
  80%, none between; the penalty path unrated) is consistent, now named in
  a key line under the table; no row's mark changed. **RMD dark survivor
  shading** uses Rule instead of Raised (text 11:1, Muted 5.2:1), swatch
  too (074cfeb).
- **Strategy pages' disclosures**: "What happened in the marked years" and
  the FAQ use the article heading's chevron instead of the browser's
  triangle; still details/summary, ids and text unchanged (245a13b).

### Logged
- **RMD year table open by default** (9): on purpose, Phase 1 (3d2a656):
  RMD's page leads with the table on Doing nothing.
- **Sticky input column cut off at viewport height** (14): deliberate
  sticky behaviour; a fade at its foot is optional later polish.
- **Household bar position, Basic vs Advanced/Stages** (15): Basic is the
  reference and isn't redesigned in this pass.
- **Budget's layout and its Text "$0" empty state** (18): Phase 1
  decisions (114c44d).
- **Budget's amber "Left over" swatch**: kept. It echoes the key result,
  Reading.tsx's documented PartTone "answer".
- **Stages "Not on track" badge** (3): not added. Advanced's badge is its
  Coast FIRE state (C.state); Stages computes no on-track comparison
  (stagesCompute returns the final-stage solve, not a verdict), so it
  would be a new computed status: hard stop.
- **Bridge / 72(t) "Premiums" select on phones**: it already has the full
  row; "ACA plan, with the subsidy your income earns" needs 306px and the
  row gives 282px at 390px wide. Fitting it means a shorter option label
  (not allowed) or a font under 16px (iOS zooms the page). The reviewer
  listed it under Healthcare; Healthcare's selects all fit.
- **Hover ring on scatters** stays amber (transient pointer feedback, not a
  series); not raised by the reviewer.
- **Round 2: the spread chart's repeated "$0 $0 $0" x-axis ticks** (VPW,
  Risk-based guardrails, where every ending balance is near zero): fixing
  them means changing the tick formatter, which alters figures shown on a
  chart; hard stop (also under Skipped from critique).
- **Round 2: Healthcare's "Open Income Tax" ghost button** kept: it is
  DESIGN.md's ghost button.

### Fixed in round 2
- **Phone layout** (2883b79): the spread card's controls drop under its
  title below sm; labels ending in "?" keep the dot with their last word
  (Optimizer "Your age at retirement" / "Retire at" / "Start from", Income
  Tax "Pre-tax deductions" and the capital gain title, five Backtest
  labels; found by grep); Drawdown's icon cells don't wrap; sticky table
  columns on phones edge in Rule Strong (all pinned columns, so Stages' End
  balance shows where Start slides under it).
- **Card pairs** (a1340ee): Drawdown's scorecard and income cards at one
  height; Stages' Milestones full width with Take it further as a slim
  strip below (see Layout decisions).
- **Empty space** (3a959d3): an empty hero drops its empty note line (the
  Healthcare reading shrinks to its content, light and dark); Return
  sensitivity and the claiming-age table lose the extra 14px under the
  last row. The year-by-year table's foot is the card's own padding below
  a scrolling table, left as is.

## Reverted commits

None. No change moved the numbers check; `baseline.json` was never changed.

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

## Check results (final commit)

- **Lint, typecheck:** pass.
- **Numbers:** all 38 scenarios match the baseline; `baseline.json` unchanged.
- **Contrast:** pass. **Focus:** every focus stop shows a ring (1314 checked).
- **Production build:** pass.
- **Full e2e** (176 tests) against the latest full run on the Basic commit
  (8fa1e04): 71 passed, 102 failed, 2 skipped, 1 flaky. Per test, the
  pass/fail is identical to the Basic run (72 / 102 / 2); the one flaky test
  (phone "a stage can be renamed") timed out starting Chrome and passed on
  retry. The failures are the old-site look comparisons (page size, share
  of pixels) and the numbers-text comparisons inside them, which differ by
  text and layout only (checked page by page); plus the guide's coach-words
  comparisons (the coach header was reordered in 902705e).
- **Smoke set:** 71 passed (36 desktop, 35 phone), 1 flaky (Chrome failed
  to start; passed on retry).
- **Overflow:** no page scrolls sideways (the overflow check at 390 and
  1440, both themes; the audit covered 320/390/768/1024/1440 on all 31
  routes).
- **Screenshots:** all 31 routes, dark and light, desktop and phone, in
  redesign-baseline/pages-final (not committed); before shots in
  pages-before.
- **Print summaries and share cards** (the light check): on all 31 routes,
  both themes, every Share menu option was opened: 23 print summaries and
  20 image cards per theme, all rendered with no console or page errors and
  all cards saved. Every figure in every summary and card is identical to
  the same summary/card at the Basic commit (compared token by token on a
  build of 8fa1e04). Figures not on the page's default view, all pre-existing
  or by design:
  - RMD's summary shows the converting plan's year table; the page's table
    now opens on "Doing nothing" (Phase 1 decision), so those figures are
    one toggle away.
  - Debt's printed chart keeps month ticks (66, 110, 121); the screen chart
    shows year ticks (screen only, Phase 1).
  - Pre-existing and unchanged: Drawdown/strategy cards round the success
    rate to whole percent (94%) where the page shows 94.0%; the Mortgage card
    adds "Total cost of the loan" and "Property tax & insurance"; Bridge,
    72(t) and College summaries carry year tables the page doesn't show;
    input values print formatted (4.00%, $500.00).
  No figure differs, so nothing was reverted.

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

## Things to look at on the preview

- **Drawdown and the 8 strategy pages:** the biggest change. Hero reading,
  the views as tabs, the start-year table fitting at 1440, the new icons in
  Outcome / Return / success-rate cells, and on the strategy pages the
  open article (pages are about 1,000px taller) and the new "Other
  strategies" list and header links.
- **Stages:** the stage editor now lives in the inputs column with a
  timeline strip; Milestones full width with "Take it further" as a strip.
  New hand-off button to Drawdown (#toDrawdownS).
- **Budget:** list left, sticky reading right (a reversal of the usual
  inputs-left/results-right).
- **Bridge / 72(t):** the "Ways to 59½" key line that names the ✓/✕ rule;
  "Total" now lavender.
- **Tool Help** between 1024 and 1399px: the floating card covers about a
  third of the results (logged, not fixed); from 1400px it is a sidecar.
- **Optimizer:** the first run holds about 5s, later runs about 2s; tap,
  Enter or Escape skips. The run button's "about N seconds" estimate still
  floors at 5s (a figure, left alone).
- **Guide:** the bow-and-arrow bar (the bullseye stays amber once finished);
  on phones the folded trip coach is taller now that it keeps Back/Next.
- **Copy written in this pass** (labels and intro lines only, no method
  text): "Your plan", "Reach your target", "Take it further" (Advanced);
  Drawdown's Monte Carlo "10th percentile" label; FIRE's headline label
  "at your rate of return"; Mortgage's card "Extra payments and
  refinancing"; help-tour lines that pointed at old places.
- **CSV text:** Roth's "T2" is now "Tier 2"; Rent vs. Buy's table headers
  are spelled out, so their CSV header lines change.
- **Income Tax:** with no income the headline shows in Text, not amber.
- **404:** no tab is active now.
- **Sticky phone table columns** now edge in Rule Strong everywhere,
  including Basic's table.
- Phones: Bridge's health-insurance select still truncates its longest
  option (logged).
