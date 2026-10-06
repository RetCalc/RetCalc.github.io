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
