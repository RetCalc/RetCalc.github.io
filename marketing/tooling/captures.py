"""Writes ../shots/CAPTURES.md: every main-site crop in shots/crops (shots/crops-dark has the same
names), with its pixel size and the figures visible in it, read from the text each capture
recorded (../.preview/capture/texts-<theme>.jsonl, written by lib.mjs's rec()). The story
figures come from ../.preview/capture/story-light.log.
Usage (from tooling/, after `npm run capture`): python3 captures.py"""
import json, os, re, struct

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)
crops = os.path.join(root, 'shots', 'crops')
dark = os.path.join(root, 'shots', 'crops-dark')
cap = os.path.join(root, '.preview', 'capture')


def size(p):
    with open(p, 'rb') as f:
        h = f.read(24)
    w, hh = struct.unpack('>II', h[16:24])
    return w, hh


texts = {}
for theme in ['dark', 'light']:  # light wins
    p = os.path.join(cap, 'texts-%s.jsonl' % theme)
    if os.path.exists(p):
        for line in open(p):
            try:
                o = json.loads(line)
            except ValueError:
                continue
            texts[o['file']] = o['text']

GROUPS = [
    ('Homepage, header and tool list', r'^(home_|header_nav|tools_)'),
    ('Calculator: Basic', r'^calculator_'),
    ('Calculator: Advanced, with Changes ahead (sample: 30 now, three changes)', r'^advanced_'),
    ('Guide landing (/guide)', r'^guide_landing'),
    ('Readiness Guide (/guide/readiness) and its report', r'^(guide_|report_p)'),
    ('Paycheck to Retirement (/guide/paycheck)', r'^plan_'),
    ('Learn (/learn)', r'^learn_'),
    ('Drawdown Simulator', r'^drawdown'),
    ('Retirement Plan Optimizer', r'^optimizer'),
    ('Social Security Calculator', r'^ss_'),
    ('Early Retirement Bridge', r'^bridge'),
    ('Roth Conversion Calculator', r'^roth'),
    ('Healthcare Cost Planner (defaults: $62,000; hc95: $95,000)', r'^(healthcare|hc95)'),
    ('FIRE Calculator', r'^fire'),
    ('Portfolio Backtest', r'^backtest'),
    ('College Savings', r'^college'),
    ('Rent vs. Buy', r'^rentbuy'),
    ('Income Tax', r'^incometax'),
    ('Budget (Budget and Paycheck tabs)', r'^budget'),
    ('Debt Payoff', r'^debt'),
    ('Mortgage Calculator (defaults; mx: extra payments and a refinance)', r'^(mortgage|mx_)'),
    ('Sign in', r'^signin'),
    ('Household story (one session through the hand-offs; see the chain above)', r'^st_'),
]

# What a file shows, where its name alone doesn't say.
DESC = {
    'header_nav': 'The site header: logo, tabs Calculator / Tools / Guide / Learn / About, Set up your household, Sign in, theme button (1440 wide, 72 tall)',
    'home_view': 'Homepage, first screen: hero "The complete retirement planning toolkit." with the century bar chart and the three buttons',
    'home_full': 'Whole homepage, top to bottom (scroll reveals off)',
    'home_0_the-complete-retirem': 'Homepage hero section',
    'home_1_from-saving-to-retir': 'Homepage "From saving to retirement." timeline of tools by age',
    'home_2_your-whole-plan-in-o': 'Homepage "Your whole plan, in one place." Dashboard tile (laptop + iPhone). Dashboard: not for the main one-pager',
    'home_3_taxes-debt-housing-a': 'Homepage "Taxes, debt, housing and investing." tiles',
    'home_4_find-out-where-you-s': 'Homepage closing band "Find out where you stand." with the buttons',
    'tools_view': '/tools, first screen (Charts view)',
    'guide_landing_0_am-i-on-track': 'Landing card "Am I on track?" (Retirement Readiness Guide): example score 78, Quick check / Full walkthrough',
    'guide_landing_1_where-does-my-payche': 'Landing card "Where does my paycheck go?" (Paycheck to Retirement): five steps, Start Paycheck to Retirement',
    'learn_0_what-a-retirement-pl': 'Learn "Start here" card: What a retirement plan answers, with its chart',
    'learn_1_foundations0-of-9-re': 'Learn track list (8 tracks with lesson counts)',
    'learn_2_foundations': 'Learn track 1 of 8, Foundations: its 9 lessons',
    'tools_compact_full': '/tools in Compact view, whole page: all 14 tools in 3 groups',
    'tools_charts_full': '/tools in Charts view, whole page',
    'calculator_view': '/calculator (Basic), first screen',
    'calculator_switch': 'Header plus the Calculator title with the Basic | Advanced switch (top 170 px)',
    'calculator_fullscreen_view': 'Basic chart "Balance over time" in full screen (1440x900 viewport)',
    'advanced_view': '/advanced with the Changes ahead sample, first screen',
    'advanced_changes_ahead': 'Just the Changes ahead part of the inputs: three numbered changes with their effect, View or edit / Add a change, The stages behind this',
    'advanced_chart_hist': 'Balance over time, Historical mode, with change markers 1-3 and the note',
    'advanced_chart_mc': 'Balance over time, Monte Carlo mode',
    'advanced_fullscreen_view': 'Balance over time (Historical) in full screen (1440x900 viewport)',
    'advanced_changes_dialog': 'The "Changes ahead" big view: lanes by age, each change with its sentence',
    'advanced_stages_dialog': '"The stages behind this" table (5 stages)',
    'advanced_addchange_dialog': '"Add a change" picker: Save more or less, A lump sum, Different returns, Children',
    'guide_landing_view': '/guide landing "Two ways through your plan", first screen',
    'guide_landing_full': '/guide landing, whole page',
    'guide_report_view': '/guide/report, first screen',
    'guide_report_full': '/guide/report, whole page',
    'learn_view': '/learn, first screen: shelf header, search, Start here card',
    'learn_full': '/learn, whole page',
    'learn_header': 'Learn shelf header: "Retirement planning, explained", 66 lessons, 8 tracks, 14 hrs, book spines',
    'drawdown_fullscreen_view': 'Drawdown "Every historical starting month" chart in full screen (1440x900 viewport)',
    'signin_dialog': 'Sign-in dialog (Google, or a 6-digit code by email)',
    'signin_view': 'Calculator page with the sign-in dialog open',
    'st_pc_view': 'Story 1: Budget, Paycheck tab after The usual order, first screen',
    'st_adv_copied': 'Story 2: Advanced right after Copy to Advanced (split by account type on), first screen',
    'st_kids_dialog': 'Story 3: Children dialog filled in (1 planned, in 2 years, no paid childcare)',
    'st_cover_dialog': 'Story 3: "How will you cover this?" (Brokerage first, Recommended)',
    'st_adv_kids': 'Story 3: Advanced with the Children change, Historical chart, first screen',
    'st_adv_changes_dialog': 'Story 3: Changes ahead big view with the Children change',
    'st_adv_stages_dialog': 'Story 3: The stages behind this (5 stages)',
    'st_ss_view': 'Story 4: Social Security Calculator for the couple, first screen',
    'st_dd_view': 'Story 5: Drawdown after Test withdrawals, Social Security copied in, first screen',
}
for f in ['when-to-claim', 'sequence-risk', 'four-percent-rule', 'compound-growth']:
    DESC['learn_%s_view' % f] = 'Lesson /learn/%s, first screen' % f
    DESC['learn_%s_widget' % f] = 'The lesson\'s interactive widget, alone'
    DESC['learn_%s_lesson' % f] = 'The widget with the lesson text just above it'

MONEY = re.compile(r'[−\-+]?\$[\d,.]+(?:\s?[KMk]\b|M\b)?|\d[\d,.]*\s?%|\b\d{1,3}(?:,\d{3})+\b|\b(?:19|20)\d\d\b|\b\d+ of \d+\b|\bat \d\d\b')


BARE = re.compile(r'^[−\-+]?\$?[\d.,]+\s?[KkMm%]?$|^-?\d+%$')


def figures(t, n=14):
    """The figure-bearing pieces of a crop's text, in order, skipping chart axis ticks
    (runs of bare numbers)."""
    segs = [s.strip() for s in t.split('|')]
    out, seen = [], set()
    for i, s in enumerate(segs):
        if not s or len(s) > 140 or not MONEY.search(s):
            continue
        prev = segs[i - 1] if i else ''
        nxt = segs[i + 1] if i + 1 < len(segs) else ''
        if BARE.match(s) and (BARE.match(prev) or BARE.match(nxt)):
            continue  # an axis tick
        label = prev if prev and len(prev) < 40 and not MONEY.search(prev) else ''
        item = (label + ' ' + s).strip() if label and len(s) < 30 else s
        item = item.replace('\t', ' ')
        if item in seen:
            continue
        seen.add(item)
        out.append(item)
        if len(out) >= n:
            break
    return '; '.join(out)


def heading(t):
    s = (t or '').split('|')[0].strip()
    return s[:70]


HEAD = """# Main-site screenshots: what each crop shows

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
     balance **$3,611,139**; worst case **$1,597,254** (never ran out). Spending scorecard: never below
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
"""


files = sorted(f[:-4] for f in os.listdir(crops) if f.endswith('.png'))
darkset = set(f[:-4] for f in os.listdir(dark) if f.endswith('.png')) if os.path.isdir(dark) else set()


def natkey(n):
    return [int(x) if x.isdigit() else x for x in re.split(r'(\d+)', n)]


rows = {}
for f in files:
    g = next((g for g, r in GROUPS if re.search(r, f)), 'Other')
    rows.setdefault(g, []).append(f)

lines = [HEAD]
lines.append('\n## Every crop\n')
lines.append('Sizes are in device pixels (captured at 2x, so a 1440-wide view is 2880). "Figures" are read from the '
             'page text when the crop was taken, in order; check the image before quoting anything subtle. '
             'Files marked (light only) have no dark twin.\n')
for g, _ in GROUPS + [('Other', '')]:
    if g not in rows:
        continue
    lines.append('\n### %s\n' % g)
    for f in sorted(rows[g], key=natkey):
        w, h = size(os.path.join(crops, f + '.png'))
        t = texts.get(f, '')
        d = DESC.get(f) or (heading(t) and 'Card "%s"' % heading(t)) or ''
        if f.startswith('report_p'):
            d = 'Guide report sheet %d (US Letter page, 816x1056 CSS px)' % (int(f[-2:]) + 1)
        elif f.endswith('_view') and f not in DESC:
            d = 'First screen of the page (1440x900 viewport)'
        fig = figures(t) if t else ''
        extra = '' if f in darkset else ' (light only)'
        lines.append('- `%s` %dx%d%s. %s%s\n' % (f, w, h, extra, d, ('. Figures: ' + fig) if fig else ''))

open(os.path.join(root, 'shots', 'CAPTURES.md'), 'w').write(''.join(lines))
print('wrote shots/CAPTURES.md:', len(files), 'crops,', len(darkset), 'dark')
