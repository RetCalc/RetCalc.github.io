# Paycheck to Retirement: brief

Draft, 2026-10-19. A second walkthrough in the Guide: from gross pay to a
retirement projection, straight to the numbers. Working name **Paycheck to
Retirement**, at `/guide/paycheck`, its report at `/guide/paycheck/report`.

## Job

This is the spreadsheet the site started from. Someone with a paycheck wants
four answers in one sitting:

1. What do I take home after taxes?
2. What do I spend?
3. What's left, and which accounts should it go into?
4. Where does that get me by retirement, and how do kids change it?

The Readiness Guide answers a bigger question (the whole financial picture:
debts, college, mortgage, Social Security, a score). This walkthrough is the
narrow, fast version: pay in, plan out, no detours.

## Decided with the owner

- **The real tools, not cut-down copies.** Each step is the tool itself
  (Income Tax, Budget, the Paycheck tab, Advanced, Stages) with everything it
  can do. Only what the walkthrough doesn't need is left out (for example the
  Budget's tab switcher, since Budget and Paycheck are separate steps).
- **Its own numbers.** What's typed here stays here: the standalone tools
  aren't touched. At the end, one button copies everything into the
  standalone tools.
- **Lives in the Guide.** The Guide's welcome page offers two ways in: the
  full Readiness Guide, and this one, "straight to the numbers".
- **Taxes first, with what you save today.** Step 1 asks for pay and what you
  put in pre-tax now (blank is fine) and works out take-home pay. When the
  accounts change later, take-home pay and everything after it updates.
- **Yearly and per paycheck**, everywhere it matters. Two incomes from the
  start.
- **Advanced first, Stages when you want it.** The plan runs as one steady
  plan in Advanced. Then it offers Stages for life changes, kids first. A
  "straight to Stages" choice skips the steady plan.
- **Kids are the one life event modeled.** The Guide's child costs (by age,
  with or without childcare), pre-filled and editable. Stages are built from
  the kids automatically. A "How will you cover this?" pop-up takes the cost
  out of the brokerage first, then the other accounts, and every account is
  adjustable. No tax credits and no college for now. Stages keeps all of its
  own controls, with a note on using it for other changes.
- **A real summary screen** with its own graphics, not a calculator, and a
  **multi-page PDF report** in the Guide report's style.
- **Saved, synced, shared.** Kept in this browser like the Guide, synced to
  an account when signed in, shareable as a link, filled from the household
  profile.

## The steps

A step rail across the top (1 to 6), a running strip under it with the
numbers so far (take-home, spending, saving, left over), and Back / Next at
the bottom of each step.

0. **Start.** What this is (four questions, about 15 minutes), your age and
   when you'd like to retire, and how often you're paid. Filled from the
   household profile when there is one.
1. **Taxes.** The Income Tax tool. Its pre-tax pop-up is where you say what
   you put in today. The step shows the year and each paycheck.
2. **Budget.** The Budget tool's spending lines.
3. **Your paycheck.** The Paycheck tab, filled in from step 1 the first
   time: pay, schedule, filing status, state, premiums, and today's 401(k),
   HSA and IRA as its starting lines. The sliders and plans decide each
   account. Going back to step 1 shows the taxes for these choices.
4. **Your plan.** Advanced, with the paycheck's saving copied in by account
   type and the years from your ages. Add balances here. Ends with the
   choice: done, or "Plan for kids and other changes in Stages".
5. **Life stages** (optional). First the kids pop-up, then "How will you
   cover this?", then Stages with the stages built from them.
6. **Summary.** Below.

## Kids

- **Asked:** the ages of the children you have, how many you're planning
  and when (the first in N years, then one every N years), and whether
  there's paid childcare before school.
- **Pre-filled costs** (the Guide's, `tools/guide/schedule.ts`): $2,500 a
  month before school with childcare, or $1,300 without, then $1,500 a month
  from 6 to 18. Each later child costs 20% less. Every figure is editable.
- **The stages:** a new stage wherever the monthly cost changes (a birth,
  school, a child leaving at 19), merged where it doesn't. Stage names say
  what's happening ("A child in childcare", "Two children, one in
  childcare", "Empty nest").
- **How will you cover this?** For each stage: the monthly cost, the same
  per paycheck, and what comes out of each account. By default the
  brokerage gives first, then the 401(k) above the match, then the IRA, then
  the HSA. The match is the last thing cut. Anything left over comes out of
  spending, shown in red. Every amount can be typed over.
- Kids you already have are already in today's budget, so only the change
  from today's cost comes off the saving.

## Summary screen

A page to show someone, not another calculator:

- **The headline:** retire at 62 with $1.4M (today's dollars), enough for
  about $56,000 a year.
- **Where your pay goes:** one wide ribbon from gross pay into taxes, each
  budget group, each account and anything unassigned. It can be read by the
  year, month or paycheck.
- **Your accounts:** a tile for each account, with what goes in per paycheck
  and per year, the match, and its balance at retirement.
- **The climb:** the balance by age, stacked by account. Stages appear as
  shaded bands with their names, and each child's birth is marked.
- **The stages**, if there are any: a timeline of each stage's monthly
  saving and child costs.
- **Milestones:** your first $100K, $500K and $1M.
- Buttons: **Print or save the report**, **Copy into my tools**, **Share**,
  **Start over**.

## Report (`/guide/paycheck/report`)

Same system as the Guide report (`styles/17-report.css`, US Letter, Public
Sans, the header on every page, the optional name):

1. **Cover:** the plan in one line and three figures.
2. **Your paycheck:** gross to take-home, taxes by kind, per paycheck.
3. **Your spending:** the budget by group and line.
4. **Your saving:** each account, the match, and what's still unassigned.
5. **The road to retirement:** the climb chart and milestones.
6. **Life stages** (only with Stages): the stage timeline and the kid costs.
7. **Assumptions:** returns, inflation, fees, the tax year, the child costs
   and their source, and the method.

## How it's built

- The walkthrough runs the tool screens themselves inside a **tool scope**: a
  context that gives each tool the walkthrough's copy of its inputs instead
  of the tab's, and turns a tool's "go to Stages" into the walkthrough's next
  step. Every fix to a tool reaches the walkthrough too, and nothing is
  lost.
- All of it is one stored item (`paycheck-plan`, like `guide`): the
  walkthrough's answers and each tool's inputs. It is synced, saved as a
  scenario and shared as a link.
- **No new math.** Taxes, the paycheck, the projection and the stages come
  from the tools' own code. The kids' costs come from the Guide's. The
  walkthrough only adds the kids-to-stages split, which has tests.

## Not now

Child tax credits and childcare credits; college; events other than kids;
Social Security and drawdown (the report points to Drawdown for those).
