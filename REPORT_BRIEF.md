# Full Retirement Report brief

Draft, 2026-10-14. Covers a new multi-page printable report of the Guide's
results. The one-page summary every other tool prints stays as it is.

## Job

Someone who has finished the Guide wants their plan on paper: to read at the
kitchen table, hand to a partner, and bring to an advisor or CPA. Today they
get one dense grey page. The report replaces that for the Guide with a
finished packet, full color, that reads like something a firm would charge for.

Decided with the owner:

- **Layered.** The front pages tell the household's story in plain words and
  large graphics. The back pages are the appendix an advisor wants: every
  assumption, the year-by-year table, where each number came from.
- **Grows with the plan.** A core set of pages every plan gets, plus pages
  that appear only when they apply.
- **Optional name.** Asked for when printing ("Maya and Sam", "The Ortiz
  household"), kept in the browser like everything else. Without one the
  cover says "Your retirement plan".

## Pages

Core (every plan):

1. **Cover.** Name, date, the plan in one line (retire at 62, $70,000 a year),
   and the three headline figures.
2. **The answer.** Your number against what the plan needs, the readiness
   score, how many of the historical retirements it lasted, in a sentence a
   partner can read aloud.
3. **The road from here.** A timeline by age for both people: saving years,
   retirement, the bridge years, Medicare, Social Security, required
   withdrawals, the end of the plan. The signature graphic of the packet.
4. **Will it last?** Every retirement since 1926 run against the plan: the
   range, the worst start year, what's left at the end.
5. **Where the money comes from.** Each year's spending, tax and health cost,
   stacked by source (Social Security, pension, each account).
6. **Your score, area by area.** The five areas, what each is worth, what
   moves it.
7. **Your next moves.** The Guide's moves in order, with when, and the tool
   that does each one.
8. **Appendix.** Assumptions, sources (entered, estimated, default), the
   year-by-year table, the method, the disclaimers.

Only when they apply: the bridge years (retiring before 59½), health insurance
before Medicare, pension, debt payoff, college, Roth conversions and the Plan
Optimizer's roadmap (when applied), the spouse's Social Security.

## Rules

- **The numbers are the Guide's.** Every figure comes from the same code the
  Guide screen uses (`tools/guide/calc.ts`, `moves.ts`, `score.ts`). The
  report adds no calculation of its own beyond sums and sorting of those
  results. The numbers check stays green.
- **Private.** Built in the browser; nothing is sent anywhere to make it.
- **Prints true.** US Letter, fixed pages, forced background color so it
  prints as designed. Reads well as a PDF on a screen too, and survives a
  black-and-white printer: meaning is never carried by color alone (Never
  Alone Rule), so estimated and default figures are marked by line form and
  a word, not hue.
- **Brand.** The logo exactly as it is, the RetCalc name and tagline, the
  disclaimers. DESIGN.md gives print its own palette, decided by this work.
- **Copy.** Plain and specific, the Guide's own wording. No hype, no
  gamification, no stock imagery.
- **Sample data in the mocks** is the "Maya and Sam" test household from
  `scripts/baseline/guide-fixtures.mjs`, through the Guide's real code.

## Delivery (decided after a direction is chosen)

Recommended: designed print pages in React (option A from the discussion,
2026-10-14), opened from the Guide's Print button as a full-screen preview
of the report with a "Print or save as PDF" button, so people see what they
get before the dialog. A real PDF download (react-pdf) stays open as a later
step.

## Direction (decided 2026-10-14)

Direction C, "Unigrid" (National Park Service brochure): black title band on
every page with the RetCalc logo and wordmark in it (owner: on every page
header), the savings trail map with numbered stops, Public Sans. The full
ten-page mock is `.impeccable/mocks/report/c-full.html` (PDF beside it); the
direction contract is `.impeccable/surfaces/guide-report.md`. A and B stay in
the folder for reference.

Pages in the mock: 1 cover, 2 where you stand (with contents), 3 the road
from here, 4 will it last, 5 where the money comes from, 6 health insurance
before Medicare (conditional), 7 your score, 8 your next moves, 9 assumptions
and sources, 10 year by year.

A second mock, `.impeccable/mocks/report/c-kids.html` (12 pages), runs Maya
and Sam with a second child planned in three years (Changes ahead) and both
children in College Savings, and adds two conditional pages: "Saving as the
family grows" (the saving schedule, household size, with and without the
child) and "College for two" (college years beside retirement, each year's
bill, the overlap move). Both come from the Guide's own code (schedule.ts,
moves.ts, tools/college/model.ts).

Known gaps the report states rather than hides: the Guide treats college
saving as part of the budget, not retirement saving; College Savings works
in future dollars while the rest is in today's dollars; a stage whose
child costs exceed saving reads $0 and the rest is left to the budget.

## Built (2026-10-14, branch guide-report)

- `/guide/report` (web/app/guide/report/page.tsx): the report in React,
  opened by the plan card's "Your full report"; "Print one page" keeps the
  one-page summary. Names are optional, kept in this browser only
  (`retcalc.report.v1`), never in links or the account.
- Figures: `tools/guide/report/model.ts` (tests: tools/guide/tests/report.test.ts);
  pages: `pages.tsx`; charts: `charts.tsx`; styles: `styles/17-report.css`
  (named print page `rp`, so the one-page summary keeps its margins).
- Pages follow the plan: family and college pages, health before Medicare,
  the year-by-year table over as many pages as it needs.
- Fixed in the Guide on the way: a schedule stage the saving can't cover now
  carries its shortfall (`Stage.short`, `shortfall()`), shown in Changes
  ahead and as a move ("Plan for the $X a month your saving can't cover");
  college comes into today's dollars through `tools/guide/college.ts`.

Added the same day, each only when it applies: Getting to 59½ (retiring
before it), Social Security for both of you (couples), Your pension, Your
Plan Optimizer roadmap (once applied), Paying off debt (Debt Payoff's own
plan when the Guide brought the debts back, else the quick totals). Tests:
the fifth test in tools/guide/tests/report.test.ts.

Phones and Safari (2026-10-14): on narrow screens the sheets are scaled
whole with a transform (zoom let Safari's minimum font size and text
autosizing break the layout), so a phone shows the same pages as a desktop,
pinch to zoom. Safari ignores the named page `rp`, so the report page adds
`@page{margin:0}` as an adopted stylesheet while it's open and removes it on
leaving. Checked through WebKit itself (a Swift WKWebView print to PDF and a
390px snapshot), then in Safari on the iOS 26.3 Simulator (iPhone 17):
the screen shows the same pages; printing there ignores @page and adds
iOS's own margins, header and footer while scaling the page to the
printable width, so on iPhone and iPad (html.rp-ios) each printed sheet
sits in an 880px frame, which keeps it to one page: 14 pages, saved to
Files as a PDF (.impeccable/mocks/report/iphone-saved.pdf).

Still to do: the Impeccable finish review against the direction contract and
DESIGN.md's print section.

## Open decisions

- Whether "Print one page" stays beside the full report (it does for now).
- Whether the screen preview should also be shareable as a page.
