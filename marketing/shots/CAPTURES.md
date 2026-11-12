# Main-site screenshots: what each crop shows

Written by `tooling/captures.py` after a capture run; regenerate it rather than editing it by hand
(the opening sections live in that script). Captured on 11 November 2026 from a local production
build of the site (`BASE=http://localhost:3190`), which has today's figures (Today's CAPE 39.8,
1 November 2026). Light set: `shots/crops/` (for the PDFs). Dark set: `shots/crops-dark/`, the same
file names (for the decks). The Dashboard's own shots are in `shots/dash/` (see `tooling/dash.mjs`).

How a file is named: `<page>_<n>_<card heading slug>` is a card (16 px of page around it, 2x);
`<page>_view` is the first 1440x900 screen; `*_full` is the whole page; `*_dialog` is an open dialog
with page ground around it; `*_fullscreen_view` is a chart's Full screen mode.

## Sample inputs

| Where | Household | Script |
| --- | --- | --- |
| Most tools | The tool's own defaults | `shoot2.mjs` |
| Advanced (`advanced_*`) | 30 now, retiring at 65 (35 years): $60,000 saved, $1,000 per month rising 3% per year, 7.5% return, 2.5% inflation, 0.1% fees, $45,000 after-tax target. Changes ahead: 1. Kids at home, save $400 per month less from 38 until 50; 2. Peak earning, save $1,500 per month more from 50 until 58; 3. An inheritance, $50,000 at 55 | `shoot2.mjs` (`advanced`) |
| Budget | A filled-in budget, $95,000 single salary, Illinois | `shoot2.mjs` (`budget`) |
| Healthcare `hc95_*` | Couple retiring at 60 on $95,000, just over the ACA subsidy cliff | `recap.mjs` |
| Mortgage `mx_*` | $300 extra per month, $10,000 in month 24, a refinance to 6.25% | `recap.mjs` |
| Readiness Guide and report | Couple, 38 and 36, retiring at 62 | `guide.mjs`, `rp.mjs` |
| Paycheck to Retirement | The Budget household, 34, retiring at 62, walked through by its own Next buttons; the Advanced target is set to $35,000 (the default $100,000 shows "Not on track") | `plan.mjs` |
| Learn | Four lessons with widgets: when-to-claim, sequence-risk, four-percent-rule, compound-growth | `shoot2.mjs` (`learn`) |
| Household story `st_*` | Alex (34, $92,000) and Jordan (32, $68,000) (the Dashboard's sample is Sam and Jordan, 42 and 40, so the story keeps Alex), married, Illinois, $60,000 saved, one child planned | `story.mjs` |

## Advanced: the Changes ahead sample (`advanced_*`), as captured

- Changes: "1. Kids at home −$153K", "2. Peak earning +$238K", "3. An inheritance +$80K"; "See the 5 stages".
- Reading: After-tax income **$55,731 per year** (inflation adjusted, first year of retirement); future
  value $3,757,415 "Across 5 stages, 35 years"; $1,583,266 inflation adjusted; target $45,000 per year
  after tax, **On track**.
- Reach your target: **"Stop saving at 54"** ("Put nothing more in from 54, and your savings still grow to
  $1,279,882 by 65, enough for your target.", button Add to my changes) and **"Retire at 62"** ("…you'd
  have $1,337,455 by 62, enough for your target: 3 years sooner than the 35 planned.", button Retire at 62).
  Portfolio needed, inflation adjusted $1,278,409; That pays, after tax $45,000 per year.
- Historical: 781 rolling 35-year windows; 88.9% reach $1,278,409; median $1,724,096; worst window May
  1945 ($941,836), best May 1926 ($4,248,976). Monte Carlo: 55% of 5,000 runs reach it; median $1,369,402.
- The big view's sentences: "Save $400 per month less from 38 until 50.", "Save $1,500 per month more
  from 50 until 58.", "$50,000 put into your savings on the day you turn 55."

## The household story, step by step (`st_*`)

One browser session, the site's own buttons between steps. Alex is 34 and Jordan 32 (born 1992 and
1994), married, Illinois, $92,000 and $68,000 pay, $60,000 saved, retiring at 65 (31 years).

1. **Budget, Paycheck tab** (`st_pc_*`). Their budget line by line, both paychecks every two weeks,
   then **The usual order**. Saved and invested: **$1,803 per month, 13.5% of gross pay, plus $457 in
   employer matches** ($2,260.07 with match). Free before saving $1,491; still unassigned $0. Each month
   $13,333 gross: saving $1,803 (14%), taxes $2,650 (20%), expenses $8,880 (67%). Bills and spending
   $8,430 per month ($101,160 per year).
   - Hand-off: **Copy to Advanced** (`#pcCopyOut`) goes straight to /advanced. Toast: "Copied $832.35
     every two weeks into Advanced, split by account type" ($316.92 traditional, $346.20 Roth, $0
     brokerage, $169.23 HSA; plus a $211 per two weeks match). No "Replace it" prompt (Advanced held no saving).
2. **Advanced, after the copy** (`st_adv_copied`). Before any change: after-tax income $86,413 per
   year, $2,226,841 at 65 in today's dollars, On track for a $40,000 target; Reach your target says
   Stop saving at 44 / Retire at 55.
3. **Advanced, Changes ahead → Add a change → Children** (`st_kids_dialog`, `st_cover_dialog`,
   `st_adv_*`). One child planned, the first in 2 years, no paid childcare (costs $1,300 / $1,400 /
   $1,500 per month at birth-5 / 6-12 / 13-18). **How will you cover this?**: Brokerage first
   (Recommended); "What this means for your plan": Roth goes first, traditional tops it up, "HSA isn't
   touched." Then **Add them**.
   - Changes ahead row: **"1. Children −$1.0M"**; **"See the 5 stages"**: 34-36 Saving ($1,803 →
     $1,812 per month), 36-42 A young child ($521 → $566), 42-49 A child at school ($474 → $530),
     49-55 A teenager ($439 → $487), 55-65 Saving ($1,997 → $2,087).
   - Reading: **After-tax income $47,514 per year**; future value $2,580,143 "Across 5 stages, 31
     years"; **$1,200,063 in today's dollars**; target $40,000 per year after tax, **On track**.
     Amount invested $866,518; growth $1,713,625.
   - Reach your target: **Stop saving at 60** ($1,027,461 by 65) / **Retire at 63** ($1,034,088 by
     63, "2 years sooner than the 31 planned"); portfolio needed $1,000,000.
   - Historical (829 rolling 31-year windows): **83.4% of windows reach $1,000,000**; median outcome
     **$1,546,552**; worst window Aug 1951 ($715,227); best Jan 1926 ($2,700,364).
4. **Social Security Calculator** (`st_ss_*`), the same couple, both claiming at 67 (full retirement
   age 67 for both). **$6,236 per month for both**: $3,376 Alex's, $2,860 Jordan's, today's dollars;
   **$74,830 per year**; total over both lifetimes $1,814,459; survivor benefit $3,376 per month.
   vs. 62: +$1,013 per month; vs. 70: −$810 per month; claiming at 70 collects $111,798 more by 90.
   Checks start in 2059.
   - Hand-off back: on /advanced, **Test withdrawals** (`#toDrawdown`, card "Take it further"). Toast:
     "Portfolio set to $1,200,063, your balance in today's dollars".
5. **Drawdown Simulator** (`st_dd_*`). Advanced inputs, age at retirement 65, 30 years, Social Security
   **Copy from Social Security Calculator**. The Drawdown's spending is the household's total, Social
   Security included, so the starting rate is set to **8%: $96,005 per year ($8,000 per month)**,
   fixed and rising with inflation (at the 4% default, Social Security alone would pay the whole of
   it and the portfolio would never be touched). In the year-by-year table the portfolio pays about
   $62,000 of it at 65 and 66 and about $22,000 once both checks run.
   - Result: **Success rate 100.0%, 835 of 835 monthly starts lasted 30 years**; median ending
     balance **$2,943,319**; worst case **$1,212,457** (never ran out). Spending scorecard: never below
     the $76,804 comfort line; typical lifetime spending $2.88M. Return sensitivity: 100.0% even at
     −2% per year (median $1,807,862).

## Old → new names (October set → this set)

The October crops were moved to `.preview/capture/old-crops/` (not deleted).

| October name | Now | Why |
| --- | --- | --- |
| `stages_view` | `advanced_view` | Stages is gone; Advanced with Changes ahead replaces it |
| `stages_0_your-stages` | `advanced_changes_ahead` (or `advanced_changes_dialog`) | The change list on Advanced |
| `stages_6_stage-by-stage` | `advanced_stages_dialog` | "The stages behind this" table |
| `stages_hist_45000` | `advanced_chart_hist` | Historical chart with change markers |
| `stages_chart_mc` | `advanced_chart_mc` | Monte Carlo chart |
| `advanced_chart_mc` | `advanced_chart_mc` | Same name, now the Changes ahead sample, not defaults |
| `st_stg_0_your-stages` | `st_adv_changes_dialog` / `st_adv_0_your-savings` | Story step 2 is Advanced now |
| `st_stg_1_after-tax-income-per` | `st_adv_1_after-tax-income-per` | |
| `st_stg_4_balance-over-time-in` | `st_adv_4_balance-over-time-in` | |
| `st_stg_7_stage-by-stage` | `st_adv_stages_dialog` | |
| `drawdown_2_every-historical-sta` | `drawdown_3_every-historical-sta` | New "What this tool answers" card at 2 |
| `drawdown_cmp_3_strategy-showdown` | `drawdown_cmp_4_strategy-showdown` | New "Risk target" card before it |
| `drawdown_safe_4_success-grid` | `drawdown_safe_5_success-grid` | Same |
| `roth_1_converting-wins-on-b` | `roth_1_the-two-measures-dis` | Default headline changed |
| `debt_1_debt-freesep-20303y-` | `debt_1_debt-freeoct-20303y-` | Default payoff now Oct 2030 |
| `guide_number_view` | `guide_number_view` | Same name, now captured at /guide/readiness |
| `home_view` | `home_view` | Same name, new homepage |

Every other October name is captured again under the same name.

## New in this set

`header_nav`, `home_full`, `home_0..4_*` (homepage sections), `calculator_switch`,
`calculator_fullscreen_view`, `advanced_changes_ahead`, `advanced_changes_dialog`,
`advanced_stages_dialog`, `advanced_addchange_dialog`, `advanced_chart_hist`,
`advanced_fullscreen_view`, `drawdown_fullscreen_view`, `guide_landing_*`, `learn_*`,
`plan_stages_*` (Changes ahead in the walkthrough), `incometax_3_your-paycheck`, `st_adv_*`,
`st_kids_dialog`, `st_cover_dialog`, `tools_charts_full`.

## Not captured, or worth knowing

- The Paycheck to Retirement **Summary** step isn't captured (it needs a full walkthrough state; no build uses it).
- Budget's emergency budget (Normal / In an emergency columns) isn't captured.
- Each change's figure on Advanced ("−$153K", "−$1.0M") is what it does to the balance at retirement in
  today's dollars: in the story the inflation-adjusted balance falls from $2,226,841 to $1,200,063
  when the child is added.
- The kids dialog reads "1 children" (a site plural slip) in `st_kids_dialog`.

## Every crop
Sizes are in device pixels (captured at 2x, so a 1440-wide view is 2880). "Figures" are read from the page text when the crop was taken, in order; check the image before quoting anything subtle. Files marked (light only) have no dark twin.

### Homepage, header and tool list
- `home_2_your-whole-plan-in-o` 2620x2094 (light only). Homepage "Your whole plan, in one place." Dashboard tile (laptop + iPhone). Dashboard: not for the main one-pager. Figures: Readiness score, of 100 $610,500; Net worth today 100%
- `home_view` 2880x1800 (light only). Homepage, first screen: hero "The complete retirement planning toolkit." with the century bar chart and the three buttons. Figures: every market since 1926; Every year of the stock market since 1926
- `tools_compact_full` 2880x1908 (light only). /tools in Compact view, whole page: all 14 tools in 3 groups

### Calculator: Basic
- `calculator_0_how-old-are-you-yrs-` 890x988 (light only). Card "How old are you?". Figures: Growth after inflation 4.50% per year
- `calculator_1_balance-over-time` 1754x1936. Card "Example: value at retirement". Figures: Example: value at retirement $537,803; Someone aged 30 with $10,000 saved: enter your own numbers to see yours; Income, per month $1,793; Income, per year $21,512; Taking 4% per year; Starting from $10,000; You put in $206,672; Growth adds $321,131; You add $500 per month; If returns run better (6.00%); Your setting (4.50%); If returns run worse (3.00%)

### Calculator: Advanced, with Changes ahead (sample: 30 now, three changes)
- `advanced_1_after-tax-income-per` 1754x872. Card "After-tax income, per year". Figures: After-tax income, per year $55,731; Future value $3,757,415; Inflation adjusted $1,583,266; Inflation of 2.50% over 35 years; Your target $45,000 per year, after tax; Amount invested $1,055,234; Growth $2,702,181; Total contributions $995,234; Final contribution, inflation adjusted $1,180 per month; Annual withdrawal $150,297; Annual withdrawal, inflation adjusted $63,331; After tax, per year $55,731; After tax, per month $4,644
- `advanced_2_reach-your-target` 1754x780. Card "Reach your target". Figures: When you could stop saving Stop saving at 54; Put nothing more in from 54, and your savings still grow to $1,279,882 by 65, enough for your target.; When you could retire Retire at 62; Saving as you are, with your changes, you'd have $1,337,455 by 62, enough for your target: 3 years sooner than the 35 planned.; Retire at 62; Portfolio needed, inflation adjusted $1,278,409; That pays, after tax $45,000 per year
- `advanced_changes_dialog` 2176x1084. The "Changes ahead" big view: lanes by age, each change with its sentence. Figures: Kids at home −$400/mo; Peak earning +$1,500/mo; An inheritance +$50,000; 48 Retiring at 65; 1. Kids at home −$153K; Save $400 per month less from 38 until 50.; 2. Peak earning +$238K; Save $1,500 per month more from 50 until 58.; 3. An inheritance +$80K; $50,000 put into your savings on the day you turn 55.
- `advanced_chart_hist` 1754x1624. Balance over time, Historical mode, with change markers 1-3 and the note. Figures: Asset mix 80% US stocks, 20% bonds
- `advanced_fullscreen_view` 2880x1800 (light only). Balance over time (Historical) in full screen (1440x900 viewport). Figures: Asset mix 80% US stocks, 20% bonds
- `advanced_stages_dialog` 2176x884 (light only). "The stages behind this" table (5 stages). Figures: 1 30 to 38 8 $1,000 → $1,035 0.5%/yr — 7.50% Saving; 2 38 to 50 12 $640 → $697 0.8%/yr — 7.50% Kids at home; 3 50 to 55 5 $2,602 → $2,624 0.2%/yr — 7.50% Peak earning; 4 55 to 58 3 $2,629 → $2,640 0.2%/yr +$50,000 into savings 7.50% Peak earning, An inheritance; 5 58 to 65 7 $1,146 → $1,180 0.5%/yr — 7.50% Saving

### Readiness Guide (/guide/readiness) and its report
- `guide_number_view` 2880x1800. First screen of the page (1440x900 viewport). Figures: On course at 62: $1,875,549. The plan needs: $840,000. Covered: 2.2×; Step 13 of 19 · about 26 minutes left; . For you that's $75,022; from $1.88M; The 4% rule is a rough guide drawn from history, so the guide tests your own plan, year by year, through every market since; 1926; Savings at 4%:; $75,022; Social Security: $67,159; A year's spending and its tax: $84,669; What this means On course at 62; $1,875,549; What $1,800/mo grows to; The plan needs $840,000
- `report_p00` 1632x2112. Guide report sheet 1 (US Letter page, 816x1056 CSS px)
- `report_p01` 1632x2112. Guide report sheet 2 (US Letter page, 816x1056 CSS px)
- `report_p02` 1632x2112. Guide report sheet 3 (US Letter page, 816x1056 CSS px)
- `report_p03` 1632x2112. Guide report sheet 4 (US Letter page, 816x1056 CSS px)
- `report_p04` 1632x2112. Guide report sheet 5 (US Letter page, 816x1056 CSS px)
- `report_p05` 1632x2112. Guide report sheet 6 (US Letter page, 816x1056 CSS px)
- `report_p06` 1632x2112. Guide report sheet 7 (US Letter page, 816x1056 CSS px)
- `report_p07` 1632x2112. Guide report sheet 8 (US Letter page, 816x1056 CSS px)
- `report_p08` 1632x2112. Guide report sheet 9 (US Letter page, 816x1056 CSS px)
- `report_p09` 1632x2112. Guide report sheet 10 (US Letter page, 816x1056 CSS px)
- `report_p10` 1632x2112. Guide report sheet 11 (US Letter page, 816x1056 CSS px)
- `report_p11` 1632x2112. Guide report sheet 12 (US Letter page, 816x1056 CSS px)

### Paycheck to Retirement (/guide/paycheck)
- `plan_paycheck_0_gross-pay-3-654per-p` 2620x248 (light only). Card "Gross pay". Figures: Gross pay $3,654; Taxes $748; $19,456 per year; Take-home $2,320; $60,320 per year; Spending $2,032; $4,402 per month; Saved and invested $874; $22,724 per year; Left over $0
- `plan_paycheck_2_saved-and-invested-e` 1754x866. Card "Saved and invested, each check". Figures: Saved and invested, each check $874; 23.9% of gross pay, plus $110 from your employer; Free before saving $703; Still unassigned $0; Each check $3,654; Savings and investing $87424%; Taxes $74820%; Expenses $2,03256%
- `plan_paycheck_3_where-the-rest-goes` 1754x1430. Card "Where the rest goes". Figures: Saved and invested $874; $983.63 with match; Available to save $874; Taxes $748; $170.75 saved; Unassigned $0.00; Limit $219.23 · costs your deposit $160.15; Limit $169.23 · up to $207.69 if you are 55 or older · costs your deposit $110.68; Limit $288.46 · up to $330.76 if you are 50 or older; Limit $723.07 · up to $1,030.77 if you are 50 or older · costs your deposit $143.97
- `plan_paycheck_4_itemized-paycheck` 1754x1664. Card "Itemized paycheck". Figures: Gross pay $3,653.85 $7,917 $95,000; Traditional 401(k) -$416.32 -$902 -$10,824; HSAexcluded from FICA -$169.23 -$367 -$4,400; Federal income tax -$335.41 -$727 -$8,721; Illinois income tax -$146.31 -$317 -$3,804; Social Security -$216.05 -$468 -$5,617; Medicare -$50.53 -$109 -$1,314; Deposit to your bank $2,320.00 $5,027 $60,320; Bills and spending -$2,031.54 -$4,402 -$52,820; Free to save or invest $288.46 $625 $7,500; Roth IRA -$288.46 -$625 -$7,500; Unassigned $0.00 $0 $0

### Learn (/learn)
- `learn_1_foundations0-of-9-re` 664x1056 (light only). Learn track list (8 tracks with lesson counts). Figures: Foundations 0 of 9 read; Saving and accounts 0 of 9 read; Investing and risk 0 of 10 read; Withdrawing 0 of 10 read; Taxes 0 of 8 read; Social Security and health care 0 of 7 read; Retiring early 0 of 4 read; Big decisions 0 of 9 read
- `learn_compound-growth_widget` 1504x1162. The lesson's interactive widget, alone. Figures: Investment mix Very conservative 2%; Conservative 3%; Balanced 4.5%; Growth 5.75%; Aggressive 7%; Balance at 65; Age saving starts Balance at 65 Total put in; 20 $836,763 $265,721; 21 $794,963 $259,816; 22 $754,963 $253,911; 23 $716,686 $248,006; 24 $680,057 $242,101; 25 $645,006 $236,196; 26 $611,463 $230,292
- `learn_four-percent-rule_widget` 1504x1082. The lesson's interactive widget, alone. Figures: Year retired 4.0%; 1927 7.01%; 1928 5.92%; 1929 4.97%; 1930 5.2%; 1931 5.85%; 1932 7.39%; 1933 7.38%; 1934 5.89%; 1935 6.24%; 1936 5.22%; 1937 4.52%; 1938 5.84%; 1939 5.17%
- `learn_header` 2620x660. Learn shelf header: "Retirement planning, explained", 66 lessons, 8 tracks, 14 hrs, book spines
- `learn_sequence-risk_widget` 1504x930. The lesson's interactive widget, alone. Figures: 0 $1,480,000 $1,480,000 $1,480,000; 1 $1,188,284 $1,528,604 $1,470,939; 2 $977,615 $1,566,333 $1,461,539; 3 $813,066 $1,636,714 $1,451,789; 4 $757,074 $1,666,048 $1,441,674; 5 $721,487 $1,761,245 $1,431,182; 6 $618,599 $1,780,808 $1,420,298; 7 $594,448 $1,835,687 $1,409,008; 8 $558,005 $1,912,035 $1,397,296; 9 $539,653 $1,957,337 $1,385,147; 10 $491,028 $1,967,360 $1,372,544; 11 $453,911 $2,111,138 $1,359,471; 12 $422,480 $2,106,514 $1,345,910; 13 $374,179 $2,224,432 $1,331,843
- `learn_when-to-claim_widget` 1504x1032. The lesson's interactive widget, alone. Figures: Claim at 67; Claim at 62; Claim at 70; Age at death Claim at 67 Claim at 62 Claim at 70; 62 $0 $0 $0; 63 $0 $16,800 $0; 64 $0 $33,600 $0; 65 $0 $50,400 $0; 66 $0 $67,200 $0; 67 $0 $84,000 $0; 68 $24,000 $100,800 $0; 69 $48,000 $117,600 $0; 70 $72,000 $134,400 $0; 71 $96,000 $151,200 $29,760

### Drawdown Simulator
- `drawdown_1_historicalmonte-carl` 1754x656. Card "Historical". Figures: Monte Carlo 1926–2025 · monthly; Success rate 94.0%; 785 of 835 monthly starts lasted 30 years; Median ending balance $1,604,620; Worst case $0; Ran out in 50 of 835 retirements
- `drawdown_3_every-historical-sta` 1754x1444 (light only). Card "Every historical starting month"
- `drawdown_cmp_4_strategy-showdown` 1754x4056. Card "Strategy showdown". Figures: 1/N $2,483,626; Kitces ratchet $1,287,734; Fixed % 95% rule; never below $1; $33,333 $2,483,626 $32,000; Feb 1929; 7.6 $0; Hebeler Autopilot II 1.12% real return; $39,019 $2,406,428 $32,000; Jun 1964; 5.3 $73,309; Variable percentage withdrawal (VPW) 3.54% real return; $52,799 $2,198,358 $32,000; Aug 1929
- `drawdown_safe_5_success-grid` 1754x1624. Card "Success grid". Figures: Rate \ Stocks 0% 10% 20% 30% 40% 50% 60% 70% 80% 90% 100%; 2.50%; under 2.75%; under 3.00%

### Retirement Plan Optimizer
- `optimizer_2_left-for-you-and-you` 1754x582. Card "Left for you and your heirs after tax, in a typical market". Figures: vs. $3.63M the usual way; Lifetime tax $167,402; was $340,554; Lasted in 100%; was 100%; Tried every one of 4,941 plans in all 66 historical retirements since 1926: 326,106 retirements simulated.
- `optimizer_3_what-makes-the-diffe` 1754x834 (light only). Card "What makes the difference". Figures: Claim Social Security at 70 for both of you, instead of 67 for both of you; +$207k left; +$168k left
- `optimizer_5_where-each-year-s-mo` 1754x950. Card "Where each year's money comes from"

### Social Security Calculator
- `ss_1_pick-the-age-you-cla` 2620x986. Card "Pick the age you claim". Figures: Per month, claiming at 67; $3,276; Per year $39,308; Total by 90 $904,090; vs. 62: +$983 per month; vs. 70: −$786 per month; Claiming at 70 collects $70,755 more by 90; Average pay, best 35 years $8,083; → Full benefit at 67; × Claiming at 67, at full age; 100%; Your check $3,276 per month
- `ss_3_best-age-by-how-long` 1328x1060. Card "Best age, by how long you live". Figures: Best age, by how long you live Claim at 62; 69 Claim at 70; Claiming at 67 beats 62 if you live past; Claiming at 70 beats 67 if you live past; Claiming at 70 beats 62 if you live past
- `ss_4_when-waiting-pays-of` 1328x1060. Card "When waiting pays off". Figures: 83 Claim at 70; Claim at 67 (yours); Claim at 62; Claim at 70
- `ss_5_every-age-side-by-si` 1586x1004 (light only). Card "Every age, side by side". Figures: 62 $2,293 70%; $770,442 −$204,403; 63 $2,457 75%; $795,992 −$178,853; 64 $2,621 80%; $817,612 −$157,233; 65 $2,839 87%; $851,679 −$123,166; 66 $3,057 93%; $880,505 −$94,340; 67full age $3,276 100%; $904,090 −$70,755; 68 $3,538 108%; $933,964 −$40,881
- `ss_6_year-by-year` 1070x1004 (light only). Card "Year by year". Figures: Your age Your benefit Added up 67 $39,308 $39,308; 68 $39,308 $78,617; 69 $39,308 $117,925; 70 $39,308 $157,233; 71 $39,308 $196,541; 72 $39,308 $235,850; 73 $39,308 $275,158; 74 $39,308 $314,466; 75 $39,308 $353,774; 76 $39,308 $393,083; 77 $39,308 $432,391; 78 $39,308 $471,699; 79 $39,308 $511,007; 80 $39,308 $550,316

### Early Retirement Bridge
- `bridge_2_ways-to-59` 1754x1472. Card "Ways to 59½". Figures: 72(t) of $60,312/yr · Roth before brokerage; 100% $22,263 $0 $52,499 $1,936,129; 85% $23,566 $0 $118,621 $1,814,081; 53% $13,234 $0 $15,497 $2,002,631; $60,312 per year from an IRA, locked in through age 59; 100% $22,927 $0 $61,290 $1,922,375; Needs you to leave your job at 55 or later; — Pay the 10% penalty; Withdraw from the 401(k) or IRA as needed and pay the extra 10%; 100% $54,531 $81,776 $81,449 $1,736,040
- `bridge_4_where-each-year-s-mo` 1754x1046. Card "Where each year's money comes from". Figures: Today's dollars, an average market, like retiring in 1959.

### Roth Conversion Calculator
- `roth_1_the-two-measures-dis` 1754x906. Card "The two measures disagree, so read them together.". Figures: Lifetime tax saved −$1,073; Lifetime tax + IRMAA, discounted at 3.0% real; After-tax net worth vs doing nothing +$65,102; Peak RMD, doing nothing $169,099; Converting trims it to $0; Average conversion $143,150/yr
- `roth_3_traditional-balance` 1754x1156. Card "Traditional balance"
- `roth_4_converting-vs-not` 1754x700 (light only). Card "Converting vs. not". Figures: Lifetime income tax, converting $305,186; Lifetime income tax, doing nothing $494,485; Present value, tax + IRMAA $288,349 vs $287,275; Lifetime IRMAA $13,836 vs $48,475; Total converted $1,288,352; Traditional at the end $0 vs $1,657,171; Roth at the end $3,057,099 vs $648,291

### Healthcare Cost Planner (defaults: $62,000; hc95: $95,000)
- `hc95_0_income` 890x1228 (light only). Card "Retirement age"
- `hc95_1_aca-premium-before-6` 1754x384. Card "ACA premium before 65". Figures: ACA premium before 65 $2688/mo; 5 yrs Until Medicare at 65; Medicare from 65 ~$716–$876/mo
- `hc95_2_before-65-the-aca-br` 888x1794. Card "Before 65: the ACA bridge". Figures: 2026 ACA rules; $2688/mo; Premium tax credit none (income above 400% FPL); Your net premium $2688/mo; If Congress restores the enhanced credits (in place 2021–2025)
- `hc95_3_from-65-medicare` 890x1794. Card "From 65: Medicare". Figures: Part B premium $203/mo per person; Part D estimate avg plan, no IRMAA ~$35/mo per person; ~$120–$200/mo per person; Estimated total per person ~$358–$438/mo; For the couple both at same IRMAA tier ~$716–$876/mo

### FIRE Calculator
- `fire_hist_1_rate-bandhistoricaly` 1754x1126. Card "Rate band". Figures: Your rate of return, and every market since 1926; Portfolio at FIRE $1,024,146; Target portfolio $1,000,000; Spending $40,000 per year at 4.00%; Historical success rate 50%; 1% (aggressive); 99% (conservative); 50% of historical windows since 1926 show the portfolio reaching the target by age 60.3.; Annual withdrawal $40,000; Contributions, future dollars $444,000; Investment gains, future dollars $2,603,309; Nominal return 8.50%; Real return 5.34%
- `fire_hist_2_portfolio-growth` 1754x1344. Card "Portfolio growth". Figures: 60 Target $1,000,000

### Portfolio Backtest
- `backtest_1_return-per-year9-65-` 1754x1046. Card "Return, per year". Figures: Return, per year 9.65%; Compound annual growth, 1926 to 2025; After inflation 6.52%; Inflation averaged 2.94% per year; Volatility 15.26%; Deepest fall -50.87%; 1928 to 1932; Best year 44.54% in 1933; Worst year -33.24% in 1931; Up years 74 of 100 (74%); Grew to $99,910,217; In today's dollars $5,518,830
- `backtest_2_growth-of-10-000` 1754x1018. Card "Growth of $10,000". Figures: Growth of $10,000
- `backtest_3_rolling-returns` 1754x860 (light only). Card "Rolling returns". Figures: 1 year 100 -33.24% 13.65% 44.54% 74%; 5 years 96 -8.47% 10.58% 24.14% 94%; 10 years 91 0.85% 9.61% 17.22% 100%; 20 years 81 3.86% 9.72% 16.30% 100%; 30 years 71 7.80% 10.09% 12.95% 100%

### College Savings
- `college_1_save-per-month-558fo` 1754x386. Card "Save per month". Figures: Save per month $558; for 18 years at 6.0%; Total projected cost $232,269; 4 years at $27,000/yr, 4.0% inflation; Needed when college starts $212,674; Less than the $232,269 total, since the money still in the account keeps earning 6.0% while later years' tuition is paid
- `college_2_savings-over-time` 1754x998. Card "Savings over time"

### Rent vs. Buy
- `rentbuy_1_each-month-to-start` 1754x818. Card "Better after 30 years". Figures: Renting Ahead by $811,712; Buyer net worth $1,347,907; Renter net worth $2,159,618; Buying, all in $3,393/mo; Renting $1,800/mo; Principal & interest $2,456/mo; Loan amount $360,000; $103,500 (down payment + closing costs)
- `rentbuy_2_net-worth-over-time` 1754x1018. Card "Net worth over time"

### Income Tax
- `incometax_1_after-taxtake-homere` 1754x1026. Card "After tax". Figures: Take-home 2026 rates; Net pay $74,375; 74.4% of gross, after taxes; Per month $6,198; Every two weeks $2,861; All taxes 25.6%; Take-home pay $74,375; Federal income tax $13,170; State income tax $4,805; FICA (Social Security + Medicare) $7,650
- `incometax_ret_1_after-taxtake-homere` 1754x1000. Card "Retirement income". Figures: Retirement income 2026 rates; Income after tax $95,084; 95.1% of what you withdrew; Per month $7,924; Effective tax rate 4.92%; Marginal on the next dollar: 25.5%; All taxes 4.9%; Federal ordinary income tax $4,714; Federal long-term capital gain tax $0; State income tax $202
- `incometax_ret_2_your-capital-gain-an` 1754x898. Card "Your capital gain, and which band it landed in". Figures: 0% ends at $49,450; ordinary income ends $41,350; gain ends $49,350; Ordinary taxable income $41,350; Gain taxed at 0%; $8,000
- `incometax_ret_3_where-each-dollar-ca` 1754x1460. Card "Where each dollar came from, and how it was taxed". Figures: Traditional 401(k) / IRA $40,000 · $2,879 tax (7.2%); Roth account $10,000 · $0 tax (0.0%); Taxable brokerage $20,000 · $202 tax (1.0%); Social Security $30,000 · $1,835 tax (6.1%); Traditional 401(k) / IRA $40,000 $40,000 $2,879 $0 $2,879 7.2%; Roth account $10,000 $0 $0 $0 $0 0.0%; Taxable brokerage $20,000 $8,000 $0 $202 $202 1.0%; Social Security $30,000 $25,500 $1,835 $0 $1,835 6.1%; All sources $100,000 $73,500 $4,714 $202 $4,916 4.9%

### Budget (Budget and Paycheck tabs)
- `budget_1_where-it-goes` 890x1776. Card "Your budget, per month". Figures: Your budget, per month $4,402; Per year $52,820; Housing $2,15049%; Food $91021%; Transportation $76017%; Lifestyle $48211%; Health $1002%; 6-month emergency fund $26,410
- `budget_pc_1_saved-and-invested-e` 1754x866. Card "Saved and invested, each check". Figures: Saved and invested, each check $874; 23.9% of gross pay, plus $110 from your employer; Free before saving $703; Still unassigned $0; Each check $3,654; Savings and investing $87424%; Taxes $74820%; Expenses $2,03256%
- `budget_pc_2_where-the-rest-goes` 1754x1442. Card "Where the rest goes". Figures: Saved and invested $874; $983.63 with match; Available to save $874; Taxes $748; $170.75 saved; Unassigned $0.00; Limit $219.23 · costs your deposit $160.15; Limit $169.23 · up to $207.69 if you are 55 or older · costs your deposit $110.68; Limit $288.46 · up to $330.76 if you are 50 or older; Limit $723.07 · up to $1,030.77 if you are 50 or older · costs your deposit $143.97

### Debt Payoff
- `debt_1_debt-freeoct-20303y-` 1754x386. Card "Debt-free". Figures: Debt-free Oct 2030; Total interest $8,155; on $49,400 borrowed, $57,555 paid in all; Saved vs. minimums $10,167
- `debt_2_avalanche-vs-snowbal` 1754x786. Card "Avalanche vs. snowball". Figures: Avalanche, highest rate first Oct 2030 3y 11m $8,155 1y 11m; Snowball, smallest balance first Nov 2030 4 years $8,578 6 months; Minimums only, no extra Feb 2037 10y 3m $18,321 3y 1m
- `debt_3_what-you-owe-month-b` 1754x1000. Card "What you owe, month by month"

### Mortgage Calculator (defaults; mx: extra payments and a refinance)
- `mx_2_extra-payments-and-r` 1754x1390. Card "Extra payments and refinancing". Figures: Interest saved $201,179; Refinancing to 6.25% for 30 years; New payment $2,217/mo; Principal & interest, from $2,456/mo; Saves −$239/mo; Over the life of the loan Saves $39,855
- `mx_3_loan-balance-and-wha` 1754x998. Card "Loan balance and what you've paid"

### Sign in
- `signin_dialog` 680x892. Sign-in dialog (Google, or a 6-digit code by email)

### Household story (one session through the hand-offs; see the chain above)
- `st_adv_1_after-tax-income-per` 1754x872. Card "After-tax income, per year". Figures: After-tax income, per year $47,514; Future value $2,580,143; Inflation adjusted $1,200,063; Inflation of 2.50% over 31 years; Your target $40,000 per year, after tax; Amount invested $866,518; Growth $1,713,625; Total contributions $806,518; Final contribution, inflation adjusted $1,207 every two weeks; Annual withdrawal $103,206; Annual withdrawal, inflation adjusted $48,003; After tax, per year $47,514; After tax, per month $3,959
- `st_adv_4_balance-over-time-in` 1754x1622. Card "Balance over time, inflation adjusted". Figures: Asset mix 80% US stocks, 20% bonds
- `st_adv_changes_dialog` 2176x664. Story 3: Changes ahead big view with the Children change. Figures: Children up to −$1,500/mo; 50 Retiring at 65; 1. Children −$1.0M
- `st_dd_1_historicalmonte-carl` 1754x656. Card "Historical". Figures: Monte Carlo 1926–2025 · monthly; Success rate 100.0%; 835 of 835 monthly starts lasted 30 years; Median ending balance $2,943,319; Worst case $1,212,457; This plan survived every historical period, including the Great Depression, the 1970s stagflation and the 2008 crash.
- `st_pc_1_saved-and-invested-e` 1754x866. Card "Saved and invested, each month". Figures: Saved and invested, each month $1,803; 13.5% of gross pay, plus $457 in employer matches; Free before saving $1,491; Still unassigned $0; Each month $13,333; Savings and investing $1,80314%; Taxes $2,65020%; Expenses $8,88067%; Unassigned $00%
- `st_ss_1_pick-the-age-you-cla` 2620x998. Card "Pick the age you claim". Figures: Per month for both of you, you claiming at 67; $6,236; $3,376 yours, $2,860 your spouse's at 67. Today's dollars.; Per year $74,830; Total, both lifetimes $1,814,459; Survivor benefit $3,376/mo; After the first of you passes away, the other keeps your check, in place of $6,236 for both.; vs. 62: +$1,013 per month; vs. 70: −$810 per month; Claiming at 70 collects $111,798 more by 90; Average pay, best 35 years $8,749; → Full benefit at 67; $3,376; × Claiming at 67, at full age
