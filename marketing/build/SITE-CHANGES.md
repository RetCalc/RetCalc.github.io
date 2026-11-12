# What changed on the site since the marketing refresh (22 Oct 2026)

A change list for updating the marketing PDF, one-pager and deck. Compared:
the copy as committed at `d8decbb` and still at HEAD, against the site at
`main` 54b36e9 (live on retcalc.app) / this branch 995ea87 (CAPE only), on
2026-11-11.

How it was checked:
- Commit messages `d8decbb..HEAD` (214 commits), the code in `web/`, and the
  memory notes. Where a note and the code disagree, the code wins.
- A read-only replay of every capture job against retcalc.app (same clicks,
  same `allCards` slug rule, no screenshots written). The slugs and
  "found / not found" results in section 4 come from that run.
- `python3 tests/run.py` run at HEAD, and again on an archive copy of
  `d8decbb` for comparison. Line counts recounted the way the build page did.

Line numbers are for HEAD. The working tree has an uncommitted reskin of
`marketing/` in progress (colours, fonts, `BASE`/`CROPS`/`THEME` in
`tooling/lib.mjs`, Dashboard capture scripts). It swaps lines in place, so
every line count matches HEAD and the numbers below hold. None of the copy
changes listed here are in it yet.

Everything the Dashboard does belongs in `marketing/build/DASHBOARD-FACTS.md`
(being written separately). This file covers the main site and points at the
Dashboard only where the existing copy is now wrong because of it.

---

## 0. The big five, in one place

1. **The Stages calculator is gone.** `/stages`, `/series` and `/stages.html`
   308-redirect to `/advanced?from=stages`. There, a dismissible alert says:
   "The Stages calculator is part of Advanced now. Add what you see coming
   (a raise, children, easing off, a lump sum) under **Changes ahead**, and
   the plan changes from there." Its article (`web/content/articles/stages.html`),
   preview card (`web/public/og/stages.jpg`) and e2e spec are deleted.
   Everything that handed off to Stages now hands off to Advanced.
2. **There is one Calculator with two modes.** The header menus are gone,
   and a **Basic | Advanced** switch sits under the calculator's title
   (`/calculator` and `/advanced`). "3 calculators" is now **2**.
3. **The Guide tab is a landing page.** `/guide` is "Two ways through your
   plan", with one card for each walkthrough. The Readiness Guide itself
   moved to **`/guide/readiness`**: `?start=quick|full|retired|resume`
   opens it at a pace, and old `/guide#g=` shares redirect there.
   `/guide/report` and `/guide/paycheck` are unchanged.
4. **New header tabs: Calculator, Tools, Guide, Learn, About.** Learn is
   new, with 66 lessons in 8 tracks and 39 interactive widgets. On the right
   are **Sign in** (or the account menu) and the theme button.
5. **The site has a new look and a new area.** "Clear Glass", live
   site-wide since 2026-11-02: a gray `#f5f5f7` ground, white borderless
   cards, SF Pro on Apple devices and Inter elsewhere, true black in dark
   mode, and one colour per kind of money. The Graphite/Paper system and
   IBM Plex Sans that the PDF and deck describe are retired. Separately,
   **My Dashboard** (`/dashboard`) is a free-account area. It is the first,
   amber button on the homepage, and it did not exist on 22 Oct.

`DESIGN.md` § Status says: "Not moved yet: the marketing package
(`marketing/`) and the Dashboard promo video still show the old look (held
by the owner, 2026-11-02)." New screenshots will come back in Clear Glass,
which clashes with the PDF's Paper/Graphite pages. The owner needs to
decide whether the documents move to Clear Glass too. The working-tree
reskin suggests yes.

---

## 1. Claims that are now wrong or stale

### 1a. `marketing/build/build.mjs` (the PDF and the one-pager)

| Line | Says now | Correct fact / what to change |
| --- | --- | --- |
| 73 | `PRODUCT OVERVIEW · OCTOBER 2026` | Refresh month (NOVEMBER 2026). |
| 77 | "A calculator, two guided walkthroughs and fourteen planning tools … Free, and you don't need an account." | Still true for the tools. The homepage now says "Free, with no account needed." Consider adding the 66 Learn lessons. My Dashboard needs a free account, so don't imply that everything works without one. |
| 116 | `home_view` screenshot of the homepage | Homepage rebuilt: hero "The complete *retirement planning* toolkit." with a bar per calendar year of real stock returns since 1926; buttons **My Dashboard →** (amber), **Open the Calculator**, **Start the guide**; a "Your whole plan, in one place." Dashboard tile (laptop + iPhone). Recapture. |
| 117 | stat `['3', 'calculators: Basic, Advanced and Stages']` | **2**: "calculators: Basic and Advanced" (one Calculator, a Basic/Advanced switch). Consider a stat for **66** lessons. |
| 135 | "…and the Budget's savings split goes to the Advanced or Stages calculator." | "…goes to the Advanced calculator" (button **Copy to Advanced**). The Drawdown Simulator can also pull the balance with **Copy from the Calculator**. |
| 152 | "An account is optional: signing in … simply keeps a household, saved scenarios and Guide answers in step across devices." | An account also keeps the Paycheck to Retirement plan, **My Dashboard** (account-only) and the lessons you've read in step. Dashboard users get a monthly check-in email (on by default, one-click off). The quote "Nothing leaves your browser unless you sign in to save it." is still on Basic. |
| 156–171 | Hub diagram: Calculator, Readiness Guide, Paycheck to Retirement → three tool groups | Still right as far as it goes. Consider Learn and My Dashboard. |
| 178 | "Most people start with the Calculator or one of the two guided walkthroughs" | Fine. The Guide tab now opens a chooser ("Two ways through your plan"). |
| 194–195 | card "Basic, Advanced and Stages" / "…then a plan in stages, each with its own saving, return and length." | "Basic and Advanced": six questions for a quick answer, then fees, taxes, account types, a target and **Changes ahead** (saving more or less, a lump sum, different returns, children). |
| 198 | `browserRegion('tools_compact_full', …, 0.165, 0.665)` | The /tools layout changed with Clear Glass; re-pick the fractions after recapture. Still 14 tools in 3 groups. |
| 204 | journey "Calculator / Basic · Advanced · Stages" | "Basic · Advanced". |
| 230 | Highlight "Stages calculator" + `crop('stages_chart_mc',…)` | Replace with **Advanced: Changes ahead** (see 2.1). The crop will be the plain Advanced chart (the /stages redirect), so it is wrong even if the file exists. |
| 254 | glance rows include `['Calculator: Stages', 'What if my saving changes over the years?']` | Remove. Optionally make Advanced's question "Will I reach my target, with the changes I see coming?" |
| 262 | "29 plain-English articles…" | **28** articles (stages.html deleted). Add "and 66 lessons in Learn". |
| 279 | kicker `Calculator 1 and 2 of 3` | "of 2", or drop the count. |
| 280 | "The Calculator comes in three depths." | Two: Basic and Advanced, switched under the title. |
| 297 | Advanced ticks: "**Reach your target:** the contribution or the years it would take, applied in one click" | Now a **Reach your target** card with two answers. **When you could stop saving** ("Stop saving at 54", button **Add to my changes**, which adds a Stop saving change). **When you could retire** ("Retire at 61", button **Retire at 61** / **Use 46 years**, with a **Back to 35 years** undo). Below them: "Portfolio needed, inflation adjusted" and "That pays, after tax". Add a tick for **Changes ahead** and one for full screen. |
| 306–326 | Whole **Stages calculator** page (route `stages`, kicker `Calculator 3 of 3`, `stages_view`, `stages_hist_45000`, `stages_6_stage-by-stage`, "Planning for kids builder", "Hands off to the Drawdown Simulator") | Delete or replace with an **Advanced: Changes ahead** page (2.1). No main-site page has a stage bar or a "Stage by stage" table now. The nearest are the Changes ahead list, the big view and "The stages behind this" dialog. The Planning for kids builder is now the **Children** change and its "How will you cover this?" step. |
| 337 | `region('drawdown_2_every-historical-sta', …)` | Card is now index 3 (`drawdown_3_every-historical-sta`): a new "What this tool answers" card sits at index 2. "835 real 30-year retirements" still right. |
| 340 | `drawdown_cmp_3_strategy-showdown` | Now `drawdown_cmp_4_strategy-showdown` (a "Risk target: never be…" card comes before it). |
| 341 | `drawdown_safe_4_success-grid` | Now `drawdown_safe_5_success-grid`. |
| 415 | Roth desc "Projects required minimum distributions to age 100" | The site now says "through any age up to 100" (copy audit called "to age 100" an overstatement). |
| 417 | `img('roth_1_converting-wins-on-b')` | Default headline is now "The two measures disagree, so read them together." Lifetime tax saved −$1,073 (discounted at 3.0% real), after-tax net worth **+$65,102** at 92, peak RMD $169,099 trimmed to $0. The heirs' rate default fell from 32% to 24%. New slug `roth_1_the-two-measures-dis`. |
| 464 | Backtest q "What would this mix have actually done?" | Site: "What would this mix have done?" (also `tools.json`). |
| 465 | "then see what it actually did" | Site: "see what it did". Style only. |
| 487 | "Private non-profit, about $59,000" | **about $63,000** (presets now 2026-27 College Board: public $27,000, private $63,000, elite $82,000). |
| 493 | Rent vs. Buy "over any horizon" | Site: "over 1 to 40 years". |
| 505–516 | Income Tax "Covers" / "Retirement mode adds" | Still right. Add the optional **Local income tax** group (wage tax or % of state taxable income, shown only in states that have one), the **Your paycheck** table (gross pay down to take-home, by check and by month, with **How often you're paid**), and retirement mode now asking **Your age / Spouse's age** (state rules use each state's real age) in place of a 65-or-older dropdown. |
| 537 | "Six lines, each capped at its 2026 limit" | Caps now include each person's catch-up (401(k) 50+ and 60–63, IRA 50+, HSA 55+) from their age. Still fine as written. |
| 539 | "Connected: Opens in Income Tax; sends the savings split, by account type, to the Advanced or Stages calculator." | "…to the Advanced calculator" (button **Copy to Advanced**). |
| 544 | Debt desc "watch avalanche and snowball race each other … exactly what ordering by motivation instead of rate costs" | The site toned this down to "compare avalanche (highest rate first) and snowball (smallest balance first) on payoff date and total interest". Optional. |
| 546 | `img('debt_1_debt-freesep-20303y-')` | Default is now **Oct 2030** (3y 11m), $8,155 interest, $10,167 saved vs minimums. New slug `debt_1_debt-freeoct-20303y-`. |
| 573 | Readiness Guide `route: 'guide'` (shows and links `retcalc.app/guide`) | `guide/readiness`. |
| 576 | `browser('guide_number_view', 'retcalc.app/guide', 330)` | Address `retcalc.app/guide/readiness`. The capture must go there too (section 4). |
| 581–583 | "Two paces" text | Still matches the landing's Quick check / Full walkthrough copy. |
| 616 | "Five steps, about fifteen minutes" | Still the landing's wording. |
| 625 | "Budget, Advanced and Stages run inside the walkthrough … until **Copy into my tools** sends the results to Income Tax, Budget, Advanced and Stages." | Stages is gone. Copy into my tools now writes **Income Tax, Budget and Advanced** (`tools/plan/copy.ts`). Step 4 runs Advanced's Changes ahead. |
| 626 | "…the road to retirement, life stages if used, and the assumptions." | The report page is "Your stages", headed "Step 4: changes ahead". Say "the changes ahead, if used". |
| 633 | steps5: `['Life stages', 'Optional: Stages, with children']` | `['Changes ahead', 'Optional: kids, a raise or a bigger house']`. On screen: "Changes ahead (optional)"; the landing's line is "Kids, a raise or a bigger house, if you see them coming." |
| 661–723 | **The household story** (Budget → Stages → Social Security → Drawdown) | The chain is now **Budget (Paycheck tab) → Copy to Advanced → Advanced (Changes ahead → Add a change → Children) → Test withdrawals → Drawdown**, with Social Security joining Drawdown through the **Social Security** select's "Copy from Social Security Calculator" option. Every figure must be re-run (see the next rows and section 4). |
| 670 | "carried through four tools" | Still four: Budget, Advanced, Social Security, Drawdown. |
| 677 | "$1,803 per month, 13.5% of pay, plus $457 per month from their employers" | Probably unchanged (same Paycheck engine, no catch-up at 34/32). Re-read after recapture. |
| 681 | handoff `Copy to a calculator → Stages` | `Copy to Advanced`. Still carries **$832.35 every two weeks** (verified live: $316.92 traditional + $346.20 Roth + $0 brokerage + $169.23 HSA), "split by account type". No "Replace it" popup when Advanced is empty. |
| 684–688 | step 2 "Stages · Saving around the children"; "turns one 31-year stage into nine, from *Before children* to *Empty nest*"; `region('st_stg_0_your-stages', …)` | Becomes "Advanced · Saving around the children". The Children change, then **How will you cover this?** (choices **Brokerage first** (Recommended), **A bit from each**, **My own order**). "The stages behind this" button then reads "See the N stages". The 9-stage count, "$743,576", "$487,735" and the 18-year pause all need re-running. The cover rule changed on 5 Nov (one rule for every stage, not amounts typed per stage), so the numbers will move. |
| 696 | "all 829 31-year windows … median finish $993,511 … worst window, starting in 1951, still reaches $488,459" | 829 still holds (history unchanged). The rest needs re-running on Advanced's Historical mode. |
| 700 | handoff `Test withdrawals → Drawdown Simulator` | Same label. The button is now on Advanced's **Take it further** card (`#toDrawdown`), with the toast "Portfolio set to $X, your balance in today's dollars". |
| 704–705 | SS: "$6,236 per month … $3,376 … $2,860 … Waiting until 70 would add $810" | Full retirement age is now worked out from each birth year (1992 and 1994 → 67, so likely unchanged). Re-read. |
| 709 | handoff `Copy from Social Security Calculator` | Same (the `#ddSSMode` option text). |
| 713–721 | "$29,743 per year", "835 of 835", "$104,573", "$1.5M" | Depend on the new balance: re-run. |
| 741 | "Screenshots are from the live site on 22 October 2026" | New date. |
| 760 | Part 3 intro "…accounts that only sync…" | No longer only sync: My Dashboard is account-only, and there is a monthly check-in email. |
| 811 | one-pager lede "Free, private, and no account needed." | True for the tools; qualify if the Dashboard is mentioned. |
| 815 | one-pager stat `['3', 'calculators']` | **2**. |
| 817 | "Private by default … An optional account only syncs a household, scenarios and Guide answers." | Also the Paycheck plan, the Dashboard and lessons read; plus the check-in email. |
| 821 | one-pager tile "Stages calculator" + `stages_chart_mc` | Replace (Advanced: Changes ahead). |
| 831 | one-pager calc group `['Stages', 'saving that changes']` | Remove. Advanced: "fees, tax, accounts, changes ahead". |
| 836 | footer "Built on Next.js and a 5,700-line calculation engine" | **~6,100-line** (section 3). |

### 1b. `marketing/build/build-pages.html` (Part 3, "Under the hood")

| Line | Says now | Correct fact |
| --- | --- | --- |
| 24 | Local storage: "household, saved scenarios and Guide answers, saved first, here" | Plus the Paycheck plan, My Dashboard and the lessons read (privacy page lists all of these). |
| 40–42 | Supabase "optional accounts: sign-in and sync" | Still true for the site's tools. My Dashboard requires an account; signed out, `/dashboard` is its front page. |
| 46–47 | Resend "the 6-digit sign-in codes" | "the 6-digit sign-in codes and the monthly check-in email". The email is sent by a Supabase Edge Function on a daily schedule. Unsubscribe page: `/unsubscribe`. |
| 54 | "There are no API routes: the only thing the site's own server receives is error reports…" | Still true: there are no `route.ts` handlers, and Sentry goes through the `/monitoring` tunnel. If precision matters, the scheduled check-in email runs on Supabase, not on the site's server. |
| 61 | Look: "…Lucide icons; IBM Plex Sans, served by the site itself" | Clear Glass type: SF Pro on Apple devices, Inter elsewhere (Inter self-hosted through next/font). Plex is still loaded but is no longer the face. |
| 64 | Design: "Graphite (dark, the default) and Paper (light) themes, one amber accent, gain and loss colors, five chart hues" | "Clear Glass": a light theme (gray #f5f5f7 ground, white borderless cards) and a dark one (true black, flat gray steps). The theme follows the device unless one is picked. One amber tint, and one colour per kind of money (the "money map"). |
| 69 | stats 39 / ~55,600 / ~7,400 / 29 | **53** page routes (43 outside /dashboard) / **~79,400** / **~8,100** / **28** articles. |
| 73–93 | Palette swatches (Graphite, Surface, Raised, Amber; Paper, Raised, Ink, Amber; "Typeface: IBM Plex Sans") | Clear Glass tokens: glass-ground `#f5f5f7`, surface `#ffffff`, text `#1d1d1f`, amber-text `#975300`, amber-fill `#e88a00`; night-ground `#000000`, surface `#1c1c1e`, raised `#2c2c2e`, night amber `#ff9f0a` / `#ffb340`. Typeface: SF Pro / Inter. The working tree changed the colours but still labels them "Graphite" and "Paper": rename. |
| 98 | "About 5,700 lines of finance" | **About 6,100**. |
| 106–111 | per-file bars 2,389 / 1,435 / ~1,100 / 833 / 471 / 408 | **2,650 / 1,456 / ~1,330 / 897 / 528 / 408**. Rescale the bar widths (math.js is still the longest). |
| 136 | "~618 checks in 55 groups / 209 of them … all 29 articles" | **~1,320 checks in 62 groups**; article checks below; **28** articles. |
| 138 | "On every push … unit tests · 17 end-to-end browser specs" | CI (`.github/workflows/tests.yml`) runs: the calculation suite, the numbers and Guide baselines, unit tests for guide, budget, tax, **dashboard, advanced**, lint, and the production build. It does **not** run Playwright. There are **16** e2e specs (stages.spec.ts deleted), run by hand along with `npm run e2e:smoke`. Say "16 end-to-end specs, run before a release", or drop the claim. |
| 144–148 | stats ~618 / 209 / 7 / 17 / 1,200 | ~1,320 / (article checks) / 7 / 16 / 1,200. |
| 165 | Email: "Sign-in codes go out through Resend…" | Add the monthly check-in email. |
| 185 | `<img src="../../web/public/og/stages.jpg">` | **File deleted**: the image breaks. Use `advanced.jpg`, `guide/readiness.jpg`, `dashboard.jpg` or `financial-dashboard.jpg`. There are 31 cards now (30 in `og/`, plus `og/guide/readiness.jpg`). "About 21 illustration types" still right. |
| 193–194 | "Local first. An account is only a way to sync." / "Everything works without signing in." | The tools, Guide, Paycheck to Retirement and Learn all work signed out. My Dashboard does not: it needs a free account. It too saves to the browser first and syncs. |
| 213 | "What an account stores" list | Add: "your Dashboard (one or more profiles), and which lessons you've read", "whether the monthly check-in email is off, and when each was sent" (privacy page wording). |
| 221 | "Download everything, any time" / "Delete the account…" | Still right ("Download my data", "Delete my account"). |
| 228 | "22 figures, each with a source and a due date." | **24** (`upkeep/items.json`: added `local-tax` and `lessons`). |
| 233–254 | Upkeep table | Add "Local income tax: which states have one, base and notes; yearly" and "Lessons: each re-reviewed, shows the month". "College and child costs" now sits on the 2026-27 College Board figures. |
| 263 | "A new tax year is added beside the old one … Income Tax lets you pick the year." | The **Tax year** field exists (`#txYear`) but shows only once two years are loaded. Today only 2026 is, so nobody sees it. Say "will let you pick the year". |
| 265 | "Articles are re-reviewed every 90 days and show the month." | And the 66 lessons. |

### 1c. `marketing/deck/build-deck.mjs`

| Line | Says now | Correct fact |
| --- | --- | --- |
| 126 | stats `['3', 'calculators']` | **2**. |
| 131 | `card('stages_hist_45000', …)` in slide 2's mosaic | Swap for the Advanced chart with changes (2.1). |
| 135 | notes "…the Stages calculator against history … 14 tools, 3 calculators and 2 guided walkthroughs" | Advanced with changes ahead; 2 calculators. |
| 145 | "An optional account only keeps a household, saved scenarios and the Guide in step across devices." | As 1a line 152. |
| 175 | notes "an account only syncs saved inputs" | As above. |
| 220 | journey "Calculator  Basic · Advanced · Stages" | "Basic · Advanced". |
| 246–258 | **Slide 6, "Stages calculator"** feature (points, note, `stages_hist_45000`, `stages_0_your-stages`) | Replace with **"Advanced: Changes ahead"** (2.1): points like "Changes ahead / Saving more or less, a lump sum, different returns or children, from an age on", "Two answers / When you could stop saving, and when you could retire", "Tested three ways / A rate band, every rolling window since 1926, or 5,000 Monte Carlo runs". |
| 263–264 | Drawdown: 15 strategies, 835, 785 of 835, late-1960s failures | All still right (live: 94.0%, "785 of 835", fails for 1964–1969 starts). |
| 267 | `card('drawdown_safe_4_success-grid', …)` | `drawdown_safe_5_success-grid`. |
| 278 | Income Tax points | Right; could add local tax / Your paycheck. |
| 292 | note "…straight into the Advanced or Stages calculator." | "…into the Advanced calculator." |
| 320 | "Budget, paycheck, your plan, life stages, summary" / "Budget, Advanced and Stages run in the walkthrough" / "sends the results to Income Tax, Budget, Advanced and Stages" | "…your plan, changes ahead, summary" / "Budget and Advanced (with Income Tax's math) run…" / "…to Income Tax, Budget and Advanced". |
| 325 | `steps = [... 'Life stages', ...]` | `'Changes ahead'`. |
| 339–344 | Slide 12 household: `['Stages', '$743,576', …, 'st_stg_1_after-tax-income-per', 'Test withdrawals', …]`, `'Copy to a calculator'`, `'Copy from the calculator'` | Step 2 becomes Advanced. Button labels: **Copy to Advanced**, **Test withdrawals**, and the Drawdown option "Copy from Social Security Calculator". Re-run every figure. |
| 363–364 | "$104,573 … $29,743 … $74,830" and notes ("Stages, with the kids builder…") | Re-run; reword. |
| 375 | "Next.js 16 · React 19 · Tailwind · shadcn/ui" | Right (next 16.3.8, react 19.2.8, tailwind 4.3). |
| 379 | "household, scenarios and the Guide are saved here before anywhere else" | Add the Dashboard and lessons read. |
| 382 | Supabase "optional accounts…" / Resend "the 6-digit sign-in codes" | Add the check-in email; the Dashboard needs an account. |
| 385 | stats `'39'`, `'~618'`, `'22'`, `'0'` | **53**, **~1,320**, **24**, 0. |
| 437 | glance `['Calculator: Stages', …]` | Remove. |
| 448–451 | appendix "Basic and Advanced": "Reach a target: the contribution or years it takes" | "Two answers: when you could stop saving, and when you could retire"; add "Changes ahead". |
| 453–456 | appendix **"Stages: around children"** (route `stages`, stat "9 stages", `st_stg_0/1/7`) | Replace with "Advanced: around children" (the Children change + "How will you cover this?"), route `advanced`. The stat must be re-measured ("See the N stages"). |
| 460 | `drawdown_2_every-historical-sta`, `drawdown_cmp_3_strategy-showdown` | `drawdown_3_…`, `drawdown_cmp_4_…`. |
| 462–465 | Optimizer 326,106 / 4,941 plans / 66 retirements / +$375k | All still right (live: "$4.01M, +$375k vs. $3.63M the usual way"). |
| 477–480 | Roth stat `['+$223,304', 'after-tax net worth from converting, in the sample']`, `roth_1_converting-wins-on-b` | **+$65,102** at 92. Lifetime tax saved is now **−$1,073**, so the page reads "The two measures disagree". Pick a stat that doesn't oversell: "+$65,102 after-tax net worth at 92" or "$169,099 → $0 peak RMD". Slug `roth_1_the-two-measures-dis`. |
| 482–484 | Healthcare $2,688 / $716–876 | Still right. |
| 487 | FIRE "Age 66.6 … $1,024,146" | Still right. |
| 492 | Backtest "9.65%" | Still right. q text: "What would this mix have done?" |
| 496–497 | College "$558" right; "Private non-profit, about $59,000" | **$63,000**. |
| 500 | Rent vs. Buy "$811,712" | Still right ("Ahead by $811,712", "Renting stays ahead throughout"). |
| 505 | Income Tax retirement "4.9%" | Still right (4.92%, $95,084 after tax). |
| 518–520 | Debt `['Sep 2030', 'debt-free in the sample, $10,167 saved']`, `debt_1_debt-freesep-20303y-` | **Oct 2030**; $10,167 still right; slug `debt_1_debt-freeoct-20303y-`. |
| 522–524 | Mortgage "$201,179 … 9 years 7 months … even in 1 year 7 months" | "9y 7m sooner" confirmed live; $201,179 and the refinance break-even not re-read. Check on recapture. |
| 538 | "2 · Stages, after the kids builder" + `st_stg_4_balance-over-time-in` | "2 · Advanced, with the children" + the new Advanced chart crop (`st_adv_…`). |
| 547 | Look: "…IBM Plex Sans served by the site" | SF Pro / Inter (Clear Glass). |
| 549 | stats '39', '~55,600', '~7,400', '29' | 53, ~79,400, ~8,100, 28. |
| 559–560 | title "About 5,700 lines of finance…"; values `[2389, 1435, 1100, 833, 471, 408]` | "About 6,100"; `[2650, 1456, 1330, 897, 528, 408]`. |
| 573, 576 | "~618 checks in 55 groups"; stats ~618 / 209 / 7 / 17 / 1,200 | ~1,320 in 62 groups; article checks; 7; 16; 1,200. Fix the "On every push … end-to-end tests" wording as in 1b line 138. |
| 588 | `og = ['drawdown', 'stages', 'incometax', 'guide']` | **`stages.jpg` no longer exists, so the deck build fails here.** Use `advanced` (and perhaps `dashboard`). |
| 597 | title "Local first. An account is only a way to sync" | See 1b lines 193–194. |
| 601 | "What an account stores" card | Add the Dashboard, lessons read, and the check-in email setting. |
| 609 | "22 figures, each with a source and a due date" | **24**. |

### 1d. `marketing/build/tools.json`

The 14 names are still right. One question changed: `["Portfolio Backtest","What would this mix have actually done?"]` → **"What would this mix have done?"** (`web/lib/tools.ts`).

### 1e. `marketing/README.md`

- Line 14: "Last refreshed 22 October 2026".
- Line 86: `// 6. Stages`.
- Lines 97 and 103: sample-household rows for Stages and the household story chain.
- Lines 115–116: "Counts: … 3 calculators … 29 articles".
- Lines 118–121: the build figures.
- Line 132: "Both documents use the site's own design system": the site has moved to Clear Glass.
- Line 163: the favorites list names Stages. Make it Advanced (changes ahead), and decide whether Learn and My Dashboard join it.
- Lines 182–201 ("When a capture script breaks"): rewrite from section 4.

### 1f. Files the builds read that are missing or quietly stale

- `web/public/og/stages.jpg` is deleted, but `build-pages.html:185` and
  `build-deck.mjs:588` still use it.
- **Old crops will be used silently.** `shots/crops/` still holds the
  22 October files. Wherever a slug moved (drawdown_2→3, cmp_3→4, safe_4→5,
  roth_1, debt_1) or a page is gone (`stages_*`, `st_stg_*`), a recapture
  writes the new name and leaves the old file in place. `npm run prune`
  won't touch the old file either, because the build still names it. Clear
  `shots/crops/` (or compare file dates) before building, or the PDF will
  mix October and November screenshots.

---

## 2. New on the main site since 22 October (worth covering)

### 2.1 Advanced: Changes ahead, and two answers (the Stages replacement)

**Where:** `/advanced`. Inputs column (one card): **Your savings** → (Split by account type) → **Markets** → **Changes ahead** → **Your goal**. Right side: the reading (After-tax income, per year / At retirement, today's dollars, with **On track** / **Not on track**), **By account type** (when split), **Reach your target**, **Balance over time, inflation adjusted**, **Milestones**, **Take it further**, **Year by year** (folded, with CSV).

**What it is:**
- **Changes ahead** (h3 in the inputs card). The intro reads: "What you see coming, and what each does to your savings at the end. The figures above are where the plan starts." Empty, it says: "None yet. Add a raise, a bigger house, easing off before you retire, an inheritance, children or a different view on returns, and see what it does."
- Buttons **Add a change** (`#btnAddChange`) and **View or edit** (`#btnViewChanges`). The picker is titled "Add a change" and offers four kinds:
  - **Save more or less**: "More or less saving from an age on."
  - **A lump sum**: "An inheritance, a home sale, or a big expense."
  - **Different returns**: "A higher or lower return from an age on."
  - **Children**: "What children cost as they grow, out of saving."
- Each change is a numbered row with an on/off switch and its effect on the end balance, e.g. "1. Kids at home −$153K".
- **View or edit** opens the big view, titled "Changes ahead": the chart with each change as a lane across your ages, and every change with its sentence, e.g. "Save $400 per month less from 38 until 50." Clicking a change opens its form.
- **The stages behind this**: a button "See the N stages" opens a table (Stage / Years / Per month / Traditional / Roth / Brokerage / Return), with CSV.
- An optional **Your age** field makes everything read by age ("Retiring at 65.").
- **Children** opens the kids dialog: Children planned, The first in, Then one every, Paid childcare before school?, Each later child costs. With accounts split, it goes on to **How will you cover this?**, with three choices: **Brokerage first** (Recommended), **A bit from each** ("Every account gives up the same share of what goes into it."), and **My own order** (draggable chips). Then come "What this means for your plan" and a "See each stage" link. One rule now covers every stage (since 5 Nov).
- **Reach your target** card, two halves. **When you could stop saving** gives e.g. "Stop saving at 54" with "Put nothing more in from 54, and your savings still grow to $1,279,882 by 65, enough for your target." and a button **Add to my changes**. **When you could retire** gives e.g. "Retire at 61" with "…4 years sooner than the 35 planned." and a button **Retire at 61** (with a **Back to 35 years** undo). Underneath: "Portfolio needed, inflation adjusted" and "That pays, after tax".
- The chart has one control row: **Rate band | Historical | Monte Carlo**, the band, asset mix, Re-roll. Ages run along its axis, the changes are marked ("A change starts"), and there's a **Full screen** button.

**Screenshot:** this share link was tried on the live site and reads well:

```js
const ch=(id,kind,name,from,until,mode,amount,x={})=>({id,kind,name,on:true,from,until,mode,amount,ramp:0,acct:'auto',nominal:0,...x});
go(page,'/advanced','advanced',{initial:'60,000',contrib:'1,000',period:'Monthly',growth:'3',nominal:'7.5',inflation:'2.5',years:'35',
  withdrawal:'4',taxRate:'12',vol:'15',fees:'0.1',age:'30',solveFor:'After-Tax Withdrawal',target:'45,000',
  changes:[ch('k','saving','Kids at home',8,20,'amount',-400),ch('p','saving','Peak earning',20,30,'amount',1500),
           ch('i','lump','An inheritance',25,0,'amount',50000)]});
```

(`from`/`until` are years from now; `until:0` means retirement. A 4th "Coast"
stop change at 30 showed "+$0"; leave it out.) Live results: rows "Kids at
home −$153K", "Peak earning +$285K", "An inheritance +$80K"; button
"See the 5 stages"; After-tax income $57,383 per year, $1,630,206 in today's
dollars; Reach your target: "Stop saving at 54" / "Retire at 61".

Crops:
- `card(page,'Your savings',…)`: the inputs card with the change list.
- `card(page,'Reach your target',…)`.
- `click(page,'Historical','Balance over time')` then `card(page,'Balance over time',…)`: the chart with the change marks.
- `#btnViewChanges` then the `[role="dialog"]` box: the big view.
- `#btnStagesBehind`: the stages table.
- For children: `#btnAddChange` → the kind button starting "Children" → the kids dialog. With accounts split, its next step is **How will you cover this?**.

### 2.2 Basic | Advanced switch; the Basic → Advanced hand-off

`/calculator`: a **Basic | Advanced** switch under the title (aria-label
"Calculator mode"). The header's Calculator tab reopens whichever mode was
last used. Basic's last card is **Want more detail?**, which now mentions
"the changes you see coming", with the button **Open these numbers in
Advanced**. Basic's chart (**Balance over time**) has **Full screen**.
Screenshot: the page title with the switch (top 300 px of `/calculator`).

### 2.3 The Guide landing page (`/guide`)

H1 "Retirement Planning Guides"; h2 "Two ways through your plan". Two cards, each opening on an animated coloured stage:

- **Retirement Readiness Guide**: "Am I on track?", "Start here if you're not sure where you stand."
  - "Two paces, both ending in a score": **Quick check** ("About 10 minutes"), button **Start the Quick check**; **Full walkthrough** ("An hour or more"), button **Start the full walkthrough**.
  - "Already retired? **Start from what you have**".
  - With a guide under way: **Pick up where you left off**.
- **Paycheck to Retirement**: "Where does my paycheck go?", "Five steps, about fifteen minutes", with the step list (Budget, Paycheck, Your plan, Changes ahead (optional), Summary), button **Start Paycheck to Retirement**.

Below: "**Both end with a report in your own numbers**, to print or save as a PDF."

Screenshot: `/guide` with no stored guide (fresh browser); `allCards` gives `_0_am-i-on-track` and `_1_where-does-my-payche`. Wait about 3 s for the stages to play.

### 2.4 Learn (`/learn`, `/learn/<slug>`)

- **66 lessons in 8 tracks**: Foundations 9, Saving and accounts 9, Investing and risk 10, Withdrawing 10, Taxes 8, Social Security and health care 7, Retiring early 4, Big decisions 9. All were audited against 2026 data on 10 Nov.
- **39 interactive widgets**, one each in 39 lessons (e.g. `when-to-claim` → claim-age, `sequence-risk` → sequence, `four-percent-rule` → withdrawal-rate, `compound-growth` → compound, `tax-brackets` → brackets, `roth-conversions` → conversion-brackets, `irmaa` → irmaa-steps, `employer-match` → match).
- Charts read off values on hover or touch.
- Home: eyebrow LEARN, title "Retirement planning, explained", the line "How saving, investing, taxes and Social Security fit into a retirement plan, one idea at a time. Each lesson ends with a tool to try it on your own numbers." Stats **Lessons 66 · Tracks 8 · Reading 14 hrs**. The tracks show as a shelf of book spines (each opens its track). "START HERE: What a retirement plan answers"; search box "Search lessons".
- A lesson has the text beside **Your numbers**, **Try it** (**Open the tool**), **Key terms**, **Go deeper** and **In this lesson**, with **Mark as read** and **Next lesson**. Reading progress syncs to an account.
- Tool articles list their lessons, and lessons join the upkeep reviews.

Screenshots:
- `/learn`: view 0–900 for the shelf header and stats.
- `/learn/when-to-claim`, or `/learn/sequence-risk`: the lesson column plus its widget (find `figure[data-widget]`, screenshot its box).
- One more widget lesson, e.g. `/learn/four-percent-rule`.

Note that the About page still says "**56** short lessons" (`web/tools/about/About.tsx:151`); that's a site copy bug, not marketing.

### 2.5 Full-screen charts

Each has an icon-only **Full screen** button (aria-label "Full screen") in its card header; the chart redraws at the window's size:
- Basic and Advanced: **Balance over time**.
- Drawdown: the Historical / Monte Carlo balance card, **When you retire**, **Strategy showdown**, **Valuations at the start**.
- Social Security: **When waiting pays off**.
- Bridge: **Account balances** (both views).
- Rent vs. Buy: **Net worth over time**.
- FIRE: **Portfolio growth**.
- Backtest: **Growth of $10,000**.

A one-line mention plus one screenshot is enough. Screenshot: `/drawdown`, click the button in "Historical…", then a 1440×900 viewport shot.

### 2.6 Income Tax additions (`/incometax`)

- **Your paycheck** card (`incometax_3_your-paycheck`), after **Tax breakdown**: gross pay down to take-home, per check and per month. Two earners on a joint return get a column each. **How often you're paid** sets the headline too.
- **Local income tax** (optional, 0% by default): shown only in states that have one, with the state's own guidance and lookup links. It reaches the Paycheck tab too.
- Retirement mode asks **Your age** / **Spouse's age**; state rules apply at each state's real age (Iowa 55, Delaware 60, New York 59½, and so on).
- **Tax year** picker: built, but hidden until a second year is added.

Screenshot: `/incometax`, `card(page,'Your paycheck',…)`; for local tax, set state OH or PA and type a rate.

### 2.7 Budget and Paycheck additions (`/budget`)

- **Copy to Advanced** (`#pcCopyOut`, was "Copy to a calculator"): goes straight to `/advanced`, asking "Replace the saving in Advanced?" (**Replace it**) only if Advanced already has saving. Toast: "Copied $X … into Advanced, split by account type".
- **Build an emergency budget**: a second amount per line ("Normal" / "In an emergency" columns; "Normal budget | Emergency budget" switch). The emergency fund can be sized on either. **Remove the emergency budget** undoes it.
- Catch-up contribution limits by age; local income tax.

Screenshot: Budget with `efEmerg` on, card "Your budget".

### 2.8 Drawdown Simulator additions (`/drawdown`)

- **Copy from the Calculator** (`#ddCopy`) under the portfolio, asking "Copy from which calculator?" when both Basic and Advanced hold a balance.
- Simple / Advanced inputs switch (`#segDDIn`) beside the first heading.
- A new **What this tool answers** card. The old "New here" card is gone.
- Full screen on four charts; CSV on the success grid and return sensitivity.
- Today's CAPE in **Valuations at the start** now reads 39.8 (1 November 2026).

### 2.9 Smaller main-site changes (mention only if useful)

- **Social Security**: full retirement age is worked out from the birth year everywhere (66 for 1943–54, rising to 67). "When waiting pays off" has full screen. The lifespan bar scrolls on phones.
- **Optimizer**: Year you were born / Spouse's birth year.
- **Roth**: heirs' rate default 24% (was 32%). The survivor files jointly in the year of death and single after.
- **Healthcare and Bridge**: one Medicaid / coverage-gap rule (`hcCoverage`).
- **Bridge**: 72(t) rate defaults to 5%.
- **College**: presets on the 2026-27 College Board figures.
- **Tool headers**: name and icon at the left, with a small "All tools" line above. The Tools tab remembers the last tool.
- **Home-screen app**: opens the page it was added from.
- **Segmented switches**: one filled-pill style everywhere.
- **Site-wide layout scan** (10 Nov).
- **Assumption rating** ("How your assumptions compare"), **Year by year** (the income-driven table) and **Dashboard profiles** are **Dashboard-only**. Don't put them in the main-site copy.

### 2.10 My Dashboard (for the main-site copy, a mention only)

`/dashboard` is a free-account area. Signed out (or before setup) it shows
its own front page. Its tabs: Dashboard, Plan summary, Profile, Net worth,
Your home, Income, Spending, Taxes & Savings, Retirement, Year by year,
Calculator, Tools, Next steps, Learn, About. Also a printable
`/dashboard/report` and the monthly check-in email. The homepage leads with
**My Dashboard →** and has a "Your whole plan, in one place." section ("A
free account keeps your accounts, pay, spending and retirement together. No
bank logins: you type your own numbers."). The overview, hub diagram,
one-pager and talk slides should at least name it. Details and captures:
`marketing/build/DASHBOARD-FACTS.md`.

---

## 3. Figures typed into the copy: old → new

| Figure | Old (README / copy) | New | How counted |
| --- | --- | --- | --- |
| Tools | 14 | **14** (unchanged) | `web/lib/tools.ts`: 6 + 4 + 4 |
| Calculators | 3 (Basic, Advanced, Stages) | **2** (Basic, Advanced) | Stages retired 28 Oct |
| Walkthroughs | 2 | **2** | /guide/readiness, /guide/paycheck |
| Drawdown strategies | 15 | **15** | `#ddStrategy` options |
| Articles | 29 | **28** | `web/content/articles/*.html` (stages.html deleted) |
| Learn lessons | (none) | **66 lessons, 8 tracks, 39 widgets, ~14 hrs reading** | `web/content/lessons/*.html`; `lib/learn/catalog.ts`; `components/learn/widgets/` (39 components, 39 `data-widget` uses) |
| History | 100 years / 1,200 months, 1926–2025 | **unchanged** | `history.js` returns untouched; only `CAPE_NOW` changed |
| Monte Carlo runs | 5,000 | **5,000** | `MC_RUNS` in `lib/mc-seed.ts` |
| 30-year monthly starts | 835 | **835** | live Drawdown: "785 of 835" |
| 31-year windows | 829 | **829** | history unchanged |
| $1 in 1926 → | about $1,140 | **unchanged** | history unchanged |
| Real declines | −77%, −50%, −45%, −50% | **unchanged** | |
| Today's CAPE | 41.0, 30 September 2026 (not typed in copy) | **39.8, 1 November 2026** | `CAPE_NOW` |
| Calculation checks | "about 618 checks in 55 groups" | **1,322 checks in 62 groups** | `python3 tests/run.py` → "1322 checks passed, 0 failed", 62 groups plus the sitemap line. The same runner on a copy of `d8decbb` prints **1,047 checks in 55 groups**, so "618" was already wrong on 22 Oct. |
| Article checks | 209 | **218** text checks (`says()` calls), or **261** checks inside the "Articles:" groups. The same in both versions. | Tallied in a scratch copy of the suite. Neither count gives 209. Pick one and say what it counts. |
| Guide sample households | 7 | **7** | `web/scripts/baseline/guide.json` |
| End-to-end specs | 17 | **16** | `web/e2e/*.spec.ts` (stages.spec.ts deleted). Not run in CI. |
| Page routes | 39 | **53** (43 outside `/dashboard`, 10 inside) | `page.tsx` files under `web/app` (the same count gives 39 at `d8decbb`). Added: 10 Dashboard pages, `financial-dashboard`, `guide/readiness`, `learn`, `learn/[slug]`, `unsubscribe`. Removed: `stages`. |
| Lines of app code | about 55,600 | **about 79,400** (79,362) | `.ts/.tsx/.js/.jsx/.mjs/.css` in `web/{app,components,lib,tools,styles}`, tests included. The same rule gives 55,631 at `d8decbb`. |
| Engine and its data | about 7,400 | **about 8,100** (8,100) | all of `web/lib/engine` (7,422 at `d8decbb`) |
| "Lines of finance" (engine JS, no data) | about 5,700 (one-pager footer, build page, deck) | **about 6,100** (6,117) | `.js` in `web/lib/engine` outside `data/` (5,714 then) |
| math.js | 2,389 | **2,650** | `wc -l` |
| drawdown.js | 1,435 | **1,456** | |
| data files | ~1,100 | **~1,330** (1,326; 2026.js grew 385 → 607) | |
| plan.js | 833 | **897** | |
| bridge.js | 471 | **528** | |
| calculators.js | 408 | **408** | |
| Tracked figures | 22 | **24** | `upkeep/items.json` (+ `local-tax`, `lessons`) |
| Preview cards | (illustration types ~21) | **21 types, 31 cards** | `web/lib/cards.ts`; `web/public/og` |
| Tax year | 2026 | **2026** | only 2026 data loaded |

Sample figures, re-read live on 2026-11-11 with the capture inputs:

| Figure | Old | Now |
| --- | --- | --- |
| Drawdown | 785 of 835, fails late 1960s | **same** (94.0%) |
| Optimizer | 4,941 plans, 66, 326,106, +$375k | **same** |
| Healthcare (couple at 60, $95,000) | $2,688/mo, $716–876 | **same** |
| FIRE | 66.6, $1,024,146 | **same** |
| Backtest | 9.65% | **same** |
| College | $558/mo; private ~$59,000 | $558 **same**; private **~$63,000** |
| Rent vs. Buy | $811,712 | **same** |
| Income Tax retired | 4.9% | **same** (4.92%) |
| Debt | Sep 2030, $10,167 | **Oct 2030**, $10,167 |
| Roth | +$223,304, "converting wins" | **+$65,102**; lifetime tax **−$1,073**; "The two measures disagree" |
| Mortgage | 9y 7m sooner, $201,179 | 9y 7m confirmed; $201,179 not re-read |
| Social Security default | born 1990, $85,000 | **same** |
| Story: $832.35 biweekly | | **same** (verified) |
| Story: Advanced/Drawdown figures ($743,576, 9 stages, $993,511, $29,743, $104,573, 835 of 835, $1.5M) | | **re-run needed** (Stages path gone; cover rule changed) |

---

## 4. Capture scripts: will they still work?

Card discovery is still sound: `components/ui/card.tsx` still sets
`data-slot="card"` and `data-slot="card-title"`, and the replay found cards
on every page. `.panel` / `.panel.gd-card` no longer match anything, which
does no harm. Storage keys are unchanged: theme
`retcalc.theme.v1` (JSON `"light"`), tools `retcalc.tool-<id>.v1` in
**sessionStorage**, `retcalc.guide.v2`, `retcalc.paycheck-plan.v1`. The share
format `#s=` base64url `{t,d}` is unchanged, but a share is applied only
when `t` equals the page's tool id. `t:'stages'` now lands on `/advanced`
and is **ignored**. Tool ids: basic, advanced, social, healthcare, budget,
tax, drawdown, mortgage, and so on.

### `shoot2.mjs`

| Job | Result | Must change |
| --- | --- | --- |
| `stages` | Runs, but shoots the **default Advanced page** (308 redirect; share ignored), with the "Stages calculator is part of Advanced now" alert at the top. Slugs: `stages_0_your-savings`, `_1_after-tax-income-per`, `_2_reach-your-target`, `_3_balance-over-time-in`, `_4_milestones`, `_5_take-it-further`. The `stages_chart_hist`/`_mc` cards are found but show plain Advanced. `stages_0_your-stages` and `stages_6_stage-by-stage` are never written. | Replace with an `advancedChanges` job: `go(page,'/advanced','advanced',{…changes…})` (2.1); `allCards`; Historical/MC crops; `#btnViewChanges` dialog; `#btnStagesBehind` dialog. |
| `calculator` | OK. Slugs `calculator_0_how-old-are-you-yrs-`, `_1_balance-over-time`, `_2_milestones`, `_3_want-more-detail`. | Maybe crop the Basic/Advanced switch. |
| `advanced` | OK. Slugs `advanced_0_your-savings` … `_5_take-it-further`. Both chart cards are found. On defaults the Reach card says "Not before the end" / "Retire in 46 years". | Use a sample with a reachable target for any crop of Reach your target. |
| `drawdown` | OK. No "New here" card (`closeIntro` is a no-op). **Slugs shifted**: `drawdown_3_every-historical-sta` (was 2), `drawdown_cmp_4_strategy-showdown` (was 3), `drawdown_safe_5_success-grid` (was 4). | Rename in both builders (1a, 1c). |
| `optimizer` | OK. Same slugs (`optimizer_2/3/5` unchanged). | none |
| `ss` | OK. Same slugs. | none |
| `bridge` | OK. Same slugs. | none |
| `roth` | Runs. **`roth_1_converting-wins-on-b` → `roth_1_the-two-measures-dis`**. | Rename; rewrite the caption and stat. |
| `healthcare` | OK (hc95 via `recap.mjs`). | none |
| `fire` | OK. Same slugs. | none |
| `backtest` | OK. Same slugs. | none |
| `college` | OK. Same slugs (`college_1_save-per-month-558fo`). | none |
| `rentbuy` | OK. Same slugs. | none |
| `incometax` | OK. Normal: `_0_your-return`, `_1_after-taxtake-homere`, `_2_tax-breakdown`, **`_3_your-paycheck` (new)**, `_4_federal-brackets-and`. Retirement: same as before (`_1/_2/_3`). | Optionally use `_3_your-paycheck`. |
| `budget` | OK. `budget_1_where-it-goes`, `budget_pc_1_saved-and-invested-e`, `budget_pc_2_where-the-rest-goes`, plus `budget_pc_3_itemized-paycheck`. | none |
| `debt` | Runs. **`debt_1_debt-freesep-20303y-` → `debt_1_debt-freeoct-20303y-`**. | Rename. |
| `mortgage` | OK (mx via `recap.mjs`). | none |
| `home` | OK; **Compact** click works. The homepage is redesigned. | Recrop `tools_compact_full` (1a line 198). |

### `recap.mjs`

- **Stages loop (lines 7–11)**: runs, but `stages_hist_45000` / `_40000` come out as the **default Advanced chart** (redirect + ignored share). Its `note()` finds nothing. Replace it with the Advanced changes sample.
- **Healthcare (hc95)**: OK, same slugs.
- **Mortgage (mx)**: OK, same slugs.
- **Tools Compact**: OK.

### `guide.mjs`

**Wrong page.** It loads `/guide` (line 16), which is now the landing, so every
`guide_<cur>_view` and card is the landing page (`_0_am-i-on-track`,
`_1_where-does-my-payche`). Change to `/guide/readiness`. The replay there
gives `_0_your-number`, `_1_your-number-so-far`, `_2_readiness-score`,
`_3_your-route`, with h1 "Retirement Readiness Guide". The stored state
shape (v2, the step ids `number`, `lasting`, `adjust`, `strategy`, `plan`)
is unchanged. `/guide/report` still works. Add a separate capture of
`/guide` for the landing (2.3), with no guide stored.

### `rp.mjs`

OK. `/guide/report` gives **12** sheets at 816×1056 that pass the
1.2–1.35 ratio rule (`.rp-page`).

### `plan.mjs`

Runs. The stored shape is unchanged (`step`, `reached`, `tools`, `from`, `stagesOn`, `kids`, `cover`; step ids `start`, `budget`, `paycheck`, `plan`, **`stages`** (now named "Changes ahead"), `summary`). The rail reads: Start / Budget / Paycheck / Your plan / Changes ahead (optional) / Summary.

| Step | Result |
| --- | --- |
| `paycheck` | Same slugs: `plan_paycheck_0_gross-pay-3-654per-p`, `_2_saved-and-invested-e`, `_3_where-the-rest-goes`, `_4_itemized-paycheck`. |
| `plan` | Now Advanced: `_1_your-savings`, `_2_after-tax-income-per`, `_3_reach-your-target`, `_4_balance-over-time-in`, `_5_milestones`. |
| `summary` | Only "The summary needs yo…": the seeded `from: {}` isn't enough to build the summary. No build uses it today. |

Add `'stages'` to the loop to show Changes ahead in the walkthrough.

### `story.mjs` (breaks)

The 22 Oct chain no longer exists. Step by step:

| Line | What it does | What happens now |
| --- | --- | --- |
| 13 | `go('/stages','stages',st0)` | Lands on `/advanced`. The share is ignored, so the $60,000 starting balance is **not** set. |
| 26 | `#pcCopyOut` | Exists, now labelled **Copy to Advanced**. It copies and navigates to `/advanced` directly. |
| 27 | `btn('Stages',false)`, `btn('Replace it',false)` | Logs "no button": there is no calculator chooser, and with Advanced empty there is no "Replace it" popup. |
| 32 | `#btnKidsS` | Gone. Optional chaining, so this is a no-op. |
| 34 | `typeIn('#kdPlanned',…)` | `page.click` throws "No element found", which **crashes the script**. No `st_stg_*`, `st_ss_*` or `st_dd_*` files are written; `st_pc_*` already are. |
| 38 | reads `retcalc.tool-stages.v1` | No longer written. |
| 47–48 | `/stages`, then `#toDrawdownS` | Would throw on the null button. Use `#toDrawdown` (**Test withdrawals**) on `/advanced`. |
| 51–54 | `#segDDIn [data-ddin="adv"]`, `#ddRetireAge`, `#ddSSMode` with `'social'` | Still work. |

New flow:
1. `go('/advanced','advanced',{initial:'60,000',years:'31',age:'34',target:'22,000',solveFor:'After-Tax Withdrawal',inflation:'2.5',withdrawal:'4',taxRate:'12',fees:'0.1',nominal:'7.5',vol:'15'})`. `intoAdvanced` seeds the traditional balance from `initial` when it switches the split on.
2. Budget (Paycheck tab), click **The usual order**, then `#pcCopyOut`. You land on `/advanced`, with the split on and $832.35 bi-weekly.
3. `#btnAddChange`, then the `.dsh-sc-kind` button starting "Children":
   - `#kdPlanned` = 2; then `#kdFirst` and `#kdSpacing` appear.
   - **Next: how you'll cover it**, choose under **How will you cover this?**, then **Add them**.
   - Read the stage count from `#btnStagesBehind` ("See the N stages").
   - `allCards(P+'adv')`. Live slugs: `st_adv_0_your-savings`, `_1_after-tax-income-per`, `_2_by-account-type`, `_3_reach-your-target`, `_4_balance-over-time-in`, `_5_milestones`, `_6_take-it-further`.
4. Social Security as before (slugs unchanged: `st_ss_1_pick-the-age-you-cla`, …).
5. `page.goto(BASE+'/advanced')`, then `#toDrawdown`, then the Drawdown steps as before (`st_dd_1_historicalmonte-carl`, `st_dd_3_every-historical-sta`, …).

Also rename `st_stg_*` in both builders.

### `signin.mjs`

OK. **Sign in** is still in the header. The dialog (340×447) opens with
"Sign in to RetCalc / Save your household, scenarios and Guide to an
account…".

### `logo.mjs`, `cards.mjs`

`header a[href="/"]` still holds the logo (it now has a `BASE`).
`cards.mjs` still lists cards. Use it to confirm slugs before a long
capture.

### Names, ids and labels for README § "When a capture script breaks"

- Chart modes "Historical" and "Monte Carlo"; Drawdown tabs "Compare strategies" and "Safe spending"; "Find my best plan"; Income Tax "Retirement income"; the Paycheck tab's "The usual order"; the tool list's "Compact": **all still work**.
- Budget `#pcCopyOut` is "**Copy to Advanced**" (goes straight there; "Replace it" only when Advanced has saving).
- Advanced:
  - `#btnAddChange` → kinds **Save more or less / A lump sum / Different returns / Children**.
  - Kids dialog `#kdPlanned`, `#kdFirst`, `#kdSpacing`, then "Next: how you'll cover it" / "Add them".
  - `#btnViewChanges`, `#btnStagesBehind`, `#btnCoast`, `#btnRetire`, `#reachCard`.
  - `#toDrawdown` ("Test withdrawals").
- Drawdown: `#ddCopy` ("Copy from the Calculator"), `#segDDIn`, `#ddRetireAge`, `#ddSSMode`.
- Guide: `/guide` is the landing, `/guide/readiness` is the Guide.
