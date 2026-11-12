# RetCalc Dashboard: fact sheet

Source material for the Dashboard pages of the marketing PDF, the Dashboard
one-pager and the Dashboard deck (with its "how it works" appendix). Every
claim below was checked against the code on branch `marketing-refresh`
(HEAD 995ea87, one commit ahead of `main` at 54b36e9, a CAPE update only),
on 2026-11-11. Where a memory note and the code disagree, the code wins and
the difference is flagged.

Quoted strings in **bold** or "quotes" are exact on-screen text (card titles,
button labels, switch options), so screenshots can be cropped by heading.

This file is safe for the public repo: no project IDs, keys, internal URLs,
table or column names.

---

## 1. What the Dashboard is

- The Dashboard is a personal financial hub at retcalc.app/dashboard for
  people who want their whole picture (net worth, pay, taxes, spending,
  saving and retirement) kept in one place and worked out from **one
  profile**, then revisited "each month or quarter" to update balances and
  see where they stand (Landing.tsx hero copy).
- It needs a **free account** (sign in with Google, or with a 6-digit code
  emailed to you; no passwords). There are no payments, no ads and "No bank
  logins: you type your own numbers" (Landing.tsx trust row).
- The Dashboard is written to the browser first and synced to the person's
  account so it appears on every device they sign in on. Only that person can
  read it (database row-level security). All calculations run in the browser;
  the server stores the data, never computes with it.
- Signed out (or signed in but not yet set up), /dashboard shows a front
  page ("My Dashboard": "One place for your money and *your retirement
  plan.*") with screenshots of a made-up household, a 90-second video tour
  that loads only on "Watch the 90-second tour", and "Create a free account" /
  "Sign in" (or "Set up my Dashboard" when signed in). The same page is
  public and indexable at retcalc.app/financial-dashboard; every
  /dashboard/* page is noindex.

---

## 2. Setup flow

File: `web/components/dashboard/Setup.tsx`. Full screen, its own header with
the RetCalc mark, "Set up your Dashboard" (or "Set up <profile name>" when
there are several profiles) and a **Save and finish later** link. A progress
strip of dots runs across the top.

Each step shows "Step N of M · <label>", a question, one line of help, and
**Back**, **Continue** and **Skip for now**. Every answer is saved as it's
typed. Beside the questions, **Your plan so far** ("Fills in as you go")
lists Household, Ages today, Retiring, Pay before taxes (or Pay after taxes
abroad), Saved, Spending and Home equity, and once savings is in it draws
**Net worth at retirement, projected** with a small chart.

The steps (8 at most; "Children" drops out with no children):

| # | Label | Question on screen | What it asks |
|---|---|---|---|
| 1 | Household | "Who is this plan for?" | **Just me** ("One income, one retirement") or **Me and a partner** ("Married or sharing finances"); children who depend on you (stepper, 0 to 8); "Planning on more children?" (0 to 6) and years until the first |
| 2 | About you | "Tell us about you" / "Tell us about the two of you" | First name, birth month and birth year for each person (month + year, not age, "keep every age right as time passes") |
| 3 | Children | "Your child" / "Your children" | Optional name and birth month/year for each child |
| 4 | Retirement | "When do you hope to retire?" | Retirement age for each person; shows "That's 2041, in 15 years" style hint |
| 5 | Pay | "What do you earn?" | Where you live (every state, DC, or "Outside the US"); each person's pay, how often (per week / every two weeks / twice a month / per month / per year), how often paid, **Before taxes** / **After taxes** switch; shows the per-year figure and "about $X take-home per month" |
| 6 | Savings | "What have you saved so far?" | One number "Saved, all together", plus "Adding to it" and how often. Note: treated as a 401(k) until split into accounts |
| 7 | Spending | "What do you spend each month?" | One number per month ("A rough number is fine") |
| 8 | Home | "Do you own or rent your home?" | **I own / We own** (worth today, left on the mortgage) or **I rent / We rent** (rent per month) |

Finish screen: eyebrow "All set", "Here's your starting point, <name>",
three tiles (**Net worth today**, **At retirement, <year>**, **Chance of
success**), a line "Your plan pays about $X per month to spend in retirement,
with taxes on top, in today's dollars", and **Open my Dashboard**.

- Leaving partway ("Save and finish later") counts the unreached steps as
  skipped; the Dashboard then asks for them (Profile dot, "Finish setting up"
  next step).
- Outside the US: no tax or Social Security; pay is entered after tax and
  retirement figures are labelled "before taxes".
- How long: the code and copy never state a time. The front page says "Up to
  eight short steps. Skip anything you don't know yet." Don't claim minutes.

---

## 3. The tabs, in sidebar order

Sidebar order (Frame.tsx `SECTIONS`; names from sections.ts): Profile,
Dashboard, Plan summary, Net worth, Your home, Income, Spending, Taxes &
Savings, Year by year, Calculator, Retirement, Tools, Next steps, Learn,
About. (sections.ts lists them in a different order; the rail order above is
what users see.)

Common to every tab (Frame.tsx):
- **Rail** on the left: icons, labels on hover (always shown on wide screens
  and on touch tablets held sideways), the RetCalc mark, a theme button
  ("Light mode" / "Dark mode" / "Match my device", cycling) and "Back to
  RetCalc".
- A **dot** on a tab that still has something to fill in: Net worth (no
  accounts yet), Retirement (Social Security not checked, or no strategy
  chosen), Profile (setup not finished or steps skipped).
- **Title bar**: the tab's icon in a soft amber square, a small line over
  the title (today's date on the Dashboard tab, "My Dashboard ›" elsewhere,
  "Tools ›" inside a tool), the title, an optional status chip (`meta`),
  **Help** where a guide exists, the page's own buttons and the account menu.
  Once the large title scrolls away, a slim bar pinned to the top keeps the
  page name and Help (iOS-style collapsing title).
- **Footer** line: "An educational tool, not financial or tax advice. Past
  returns don't predict future ones." with Disclaimer, Privacy and Contact.
- Rows of figures shrink to fit at any window size or zoom, switching to
  "/mo" and "/yr" units when "per month" would wrap.

### 3.1 Profile

File: `Profile.tsx`, `Profiles.tsx`. Every setup answer on one page, each
editable where it stands, plus the plan's assumptions.

- **What-changed bar** (top, after any edit): lists up to three changes in
  words ("Retirement age 60 → 58") and their effect on the plan ("chance of
  success 82% → 74%, savings at retirement … → …, readiness … → …"), "Saved.",
  with **Keep** and **Undo**. Edits autosave; there is no save button.
- **Profiles** (only with 2+ profiles; with one, a **New profile** button sits
  in Household's header): one row per profile, "Current" badge on the open
  one, **Open**, and a ⋯ menu with Rename / Delete (Delete off for the last
  one). See section 4.1.
- **Household**: Just me / Me and a partner cards; first names and birth
  month/year; Where you live; Children who depend on you (0 to 8), each with
  optional name and birth date.
- **Retirement**: each person's "retires at age"; **Spending once retired**
  per month (blank = today's spending, less the mortgage payment if it's paid
  off by then).
- **Saving**: "Saved so far" (read-only, with **Split into accounts** or
  **Change in Net worth**) and "Adding to it, with your employer's match"
  (read-only, **Change in Savings**).
- **Pay**: each person's pay fields (same as setup), link "More in Income".
- **Spending**: "Your budget" per month (read-only, **Change in Spending**).
- **Home**: Own / Rent cards; owners edit what it's worth, what's left on the
  mortgage and its interest rate (these write today's Net worth entry);
  renters edit rent. Link "Mortgage details".
- **Children ahead** ("Their costs come out of what you save"): children
  planned (0 to 6), first in N years, years apart, paid childcare yes/no and
  where ("A big city" / "A suburb or small city" / "A rural area or small
  town"), helping with college (No / Some of it (about half) / All of it),
  kind of school (Public, in state $27,000 per year; Private $63,000 per
  year; Elite $82,000 per year), "Plan it in College Savings". A sentence
  gives each child's cost per month to 5, to 12 and to 18 in today's dollars.
  Buttons **Edit child costs** and **How you cover it** (see 4.10).
  Once College Savings has been applied, a "From College Savings:" list shows
  each child's cost per year, start year and years.
- **Assumptions** ("Used by every figure on your Dashboard"): "Savings grow,
  after inflation" figure; **Growth per year, before inflation** and
  **Inflation per year** fields; "Help me choose" presets: Very conservative
  (cash and bonds, 2% after inflation), Conservative (bond heavy, 3%),
  Balanced (a mix of stocks and bonds, 4.5%), Growth (mostly stocks, 5.75%),
  Aggressive (nearly all stocks, 7%). Default: 4.5% after 3% inflation
  (7.635% before inflation). "Back to the usual: balanced, 3% inflation".
- **Email**: "Monthly check-in email" switch, "Sent to <email>" (section 4.5).
- **Reset your Dashboard** (or **Reset this profile**): asked twice ("Yes,
  reset it", then "Are you sure?" / "Reset everything"); clears the profile,
  net worth history and every tab's choices; the rest of RetCalc is not
  affected.

### 3.2 Dashboard (home tab)

File: `Overview.tsx`. Title "Dashboard", crumb = today's date, title-bar
button **Print your plan** (once the plan can run).

- **One-line answer** at the top: "**You're on track:** $1,895,000 in savings
  at 60, and your plan lasted in every past market since 1926." or "**Not
  there yet:** your plan lasted in … It aims for N%. One way there: …"
  (first fix from the readiness solver: save more per month, retire at N,
  or spend less).
- **Welcome / last entry line**: new users see "Welcome, <name>. This is your
  starting point. Fill in the dashed tiles to sharpen it." with "Profile N of
  10" and a segment bar; returning users see "Your last entry was <date>, N
  days ago." and an **Update balances** button.
- **Net worth** tile: switch **Recent / To retirement / Whole plan**, a
  full-screen button; figures **Today** (with change since last entry and
  over the past year), **At retirement, <year>**, **At <ages>, <year>** (end of
  plan). Chart: your dated entries, the projection to retirement with an "8
  in 10 markets" band, then from retirement the Retirement tab's own
  Drawdown run: 10th–90th and 25th–75th percentile fan, median, and a faint
  line for each starting year. Retirement markers ("You both retire" or
  each name). Hover (or tap-and-drag) readout: Net worth/median, percentile
  ranges, "Savings alone, median", ages. Assumptions line under it ("In
  today's dollars. Assumes 4.5% growth per year after inflation until 2041,
  then every market since 1926 invested <mix>") with links to Profile and
  Retirement, ending in the **Your assumptions: <band>** chip (section 4.3).
- **Readiness score** tile: score "of 100" (or "N of M so far" while areas
  are missing), word badge (On track ≥85, Nearly there ≥70, Getting there ≥50,
  Needs work), a split bar, and five rows that open one at a time to say why
  and what would raise it, with a button to the tab that does it: Retirement
  outlook (40 points), Savings rate (20), Emergency fund (15), Debt (15),
  Monthly cash flow (10).
- **Chance of success** tile: percentage, "N of M historical retirements
  lasted to age X", and "With your chosen strategy: <name>" (or a fixed
  amount rising with prices until one is chosen).
- **Retirement income** tile: per month, "To spend $X and pay about $Y in
  taxes, in today's dollars", "Social Security pays $Z of it from <year>.
  Savings pay the rest."
- **Social Security** tile: combined per month, each person's claiming age
  and amount, "Estimated" badge until checked; "When to claim →" / "Check
  your benefit →".
- **Withdrawal strategy** tile: chosen strategy, "Lasted in N% of past
  markets…", "Compare strategies →".
- **Emergency fund** tile: months of spending in cash, amount to reach the
  N-month goal, segment meter.
- Empty tiles are dashed, say what they'll show and offer the one action
  that fills them ("Check your benefit", "Choose a strategy", "Add cash
  accounts").
- **What to do next**: top 4 next steps ("Ordered by how much each moves your
  plan"), "All next steps →".
- **Your profile**: 10 sections with a check or **Fill in**: Household and
  ages, Where you live, Pay, Spending, Accounts, Debts, Home, Retirement
  plans, Social Security, Withdrawal strategy. "Open your profile →".
- **Your timeline** ("Today is the dashed line"): a lane per person (work
  years, retirement, Medicare at 65, Social Security claim, the 59½ bridge
  span "Bridge plan" / "Bridge, not planned" for early retirees, "Retires
  <year>, age N"), a lane per child (daycare to 5 when there's paid childcare,
  college years, "Born about <year>" for planned children), and a Home lane
  to the mortgage payoff. Labels never overlap. On phones it scrolls sideways.

### 3.3 Plan summary

File: `Summary.tsx` (reuses the Paycheck to Retirement summary cards from
`tools/plan/Summary.tsx`, run on the Dashboard's numbers). Title-bar button
**Print your plan**.

- **Your plan**: Savings at retirement, You plan to spend (or "Your strategy
  spends" with "Your goal: $X"), Taxes, on top, Social Security from <year>,
  Chance of success, plus a sentence on how long it lasted and with which
  strategy.
- **Where your pay goes** (card beside it).
- **How your assumptions compare** fold (section 4.3), full-width scale
  visible when folded.
- **Early retirement** (only when someone retires before 59½): you retire
  <year> age N, years before 59½; with a saved bridge: Bridge plan, Lasted to
  59½ (% of past markets), Taxes, penalties and health cover, Left at 59½;
  without: "Not planned yet" and the readiness points held back. Link "See
  the bridge" / "Plan the bridge".
- **Health cover before Medicare** (only when someone is under 65 when the
  last paycheck stops): years with no job's plan, what the plan counts per
  month for marketplace cover, link "Plan health cover".
- **Your budget**: groups as share bars, emergency fund goal and what you
  have, college saving per month.
- **Net worth today**: Assets, Debts, the assets-and-debts bars and legend.
- Folds (each opens in place): **Saving to retirement** (Your accounts, The
  climb, Your stages), **What the children cost** (with "without children or
  their college" comparison), **Readiness score**, **Your timeline**.
- **What to do next**: top 5 steps, "All next steps".

### 3.4 Net worth

Files: `Accounts.tsx`, `networth.tsx`, `kinds.ts`. Route /dashboard/accounts.
Status chip "As of <date>" or "Editing".

- Read-only until **Update balances** (a pencil button under Debts). Editing
  shows an **As of** date (backdating allowed, not past today), "Replaces the
  entry already saved for this day." or "Saving adds this as a new point on
  your net worth line.", **Cancel** and **Save as new entry**. One entry per
  day; a same-day save replaces it.
- Leaving with unsaved edits asks "You have unsaved changes to your balances"
  (**Save as new entry** / **Discard** / **Keep editing**).
- **Whose filter** (couples, not while editing): Everyone / <name> / <name> /
  Shared. It filters every picture, never the lists.
- **Assets and debts** / **Net worth over time** tile with a **Today / Over
  time** switch. Today: Net worth (with change since the last entry), Assets,
  Debts, two bars on one scale grouped by kind (Retirement accounts,
  Investments, Cash, Home, Other; Mortgage, Loans, Credit cards). Over time:
  net worth and "Savings and investments (no home, no debts)" lines by date,
  "Passed $500K"-style milestone marks, figures "In the last 12 months",
  "Since <first date>", "Growth per year, on average", crosshair readout.
- **Assets** and **Debts** tiles: tables (Name, Type, Amount / Amount owed,
  Interest rate for debts, Whose for couples). 9 asset types: 401(k) or
  403(b); 457(b); Traditional IRA; Roth IRA or Roth 401(k); HSA; Brokerage;
  Checking or savings; Home; Other: car, business, collectibles. 5 debt
  types: Mortgage, Car loan, Student loan, Other loan, Credit card.
  Brokerage can carry an optional cost basis and a Roth "your contributions";
  the saved row shows the gain or loss in parentheses, green or red.
- Editing: drag rows by a grip to reorder (mouse at once, touch-and-hold on
  phones, Space + arrows on a keyboard), remove with Undo, **Add an asset** /
  **Add a debt**.
- **When you can spend it** (tip): a dot timeline and table of when each
  dollar can be spent without the 10% penalty: now (cash, brokerage, Roth
  contributions), when a 457(b) owner leaves work, at each owner's 59½
  (401(k), IRA, Roth growth), at 65 (HSA). Dots and rows highlight each other.
- **How it's taxed** (tip): "Taxed when spent" vs "Comes out tax-free" as
  percentages, a bar by Pre-tax / Roth / Brokerage / HSA / Cash with what
  each means, and a one-sentence takeaway. A brokerage basis not given is
  taken as 60% of its balance.
- **Your entries** ("N so far", CSV download): Date, Assets, Debts, Net
  worth, Change, each with a delete (confirmed: "Delete entry").
- The plan always starts from the latest entry.

### 3.5 Your home

File: `Home.tsx`. Route /dashboard/home. Content depends on own or rent.

Owners:
- **Your home**: Equity, Worth, Left on the mortgage, To own it, per month.
  Link "Change in Net worth".
- **Mortgage**: Interest rate and "Payment, principal and interest" per month;
  **Paid off** (month and year) and **Interest still to pay**; a sentence on
  whether the payment drops out of retirement spending (paid off before
  retirement and no "Spending once retired" set) or keeps counting.
- **What owning costs** ("Your budget's housing lines"): the Mortgage
  Calculator on your own loan (worth, owed, rate and years left locked and
  listed), where property tax, insurance, PMI, HOA, upkeep and utilities are
  set, and extra payments or a refinance can be tried. Once any cost is
  changed they become the budget's housing lines on Spending.

Renters:
- **Your home**: Rent and Renter's insurance per month (both budget lines).
- **Renting or buying** ("On your own rent"): the Rent vs. Buy Calculator
  seeded with your rent; what you try is kept.

### 3.6 Income

File: `Income.tsx`.

- **Coming in**: All income after taxes (per month), Pay before taxes (per
  year), Employer match (per month), Other income (per month).
- **Pay**: Where you live, and each person's pay (amount, how often, how
  often paid, before/after taxes, take-home estimate).
- **Employer 401(k) match** (tip): per employer, "Matches __%" "On the first
  __% of pay" (second employer with two incomes), and "You're saving enough
  to get all of it." / "You're not saving enough to get all of it: see Taxes
  & Savings."
- **Other income** (tip): side work, rent from a property, after taxes, per
  month; **Add income**.
- **Social Security**: badge Estimated / Checked / From your pay history.
  Per person: benefit at full retirement age (per month, typed from the
  ssa.gov statement or left estimated), claim age dropdown ("At 67, or at
  retirement if later", At 62 "(the earliest)" … At 70 "(the most per
  month)"), and the resulting "Claimed at N, in <year>" per month. **Share of
  the benefit you expect** (default 100%; hint on the trust fund running short
  in the 2030s and benefits near 80%). **Estimate from my pay history** opens
  "Your pay, year by year" (the Social Security Calculator's editor for each
  of you) → **Use in my plan**. "Back to the estimate".
- Claim ages are shared with the Retirement tab; the share scales every
  benefit everywhere in the plan.

### 3.7 Spending

File: `Spending.tsx` (hosts the Budget tool).

- **Each month**: Spending (per month, noting premiums taken from pay),
  Spending per year, All income after taxes, **Available to save** (or
  "Short"), Emergency fund (N months, $), and, with children, "Your children,
  in the plan now" per month (link "Costs in Profile").
- College tip when helping with college: "saving about $X per month starting
  now covers it" with **Add it to my budget** (or "Raise it to $X") and "See
  how it's worked out" (College Savings).
- Overspending note when spending exceeds after-tax income.
- **Your budget** (the Budget tool): grouped lines, add/rename lines, CSV.
  Setup's one number starts as an "Everything else" line. Housing lines from
  Your home are locked and marked "from your home". Its total is spending
  everywhere on the Dashboard.
- **Emergency fund**: months of spending (6 typical), **Build an emergency
  budget** (a leaner second column; phones get a Normal budget / Emergency
  budget switch), and a switch sizing the fund on the normal or emergency
  budget.

### 3.8 Taxes & Savings

File: `Savings.tsx` (hosts the Budget tool's Paycheck tab). Route
/dashboard/savings.

- **Taxes this year** (tip): Pay after taxes (per month), All taxes (per
  year), Taxes each month, Of your pay (effective rate), and a stacked bar of
  Federal income tax, State income tax, Local income tax (where any), FICA.
- **Each month**: You save and invest (per month), Employer match (green or
  amber dot for full match), To the emergency fund (when on), Savings rate,
  If you saved nothing; bar "Where $X of pay goes each month": Savings, Taxes,
  Expenses, Unassigned (or Short).
- **Your paychecks** inputs column: read-only facts (Filing status, State,
  each person's pay and how often, 401(k) match) with links to Income and
  Profile; then **Taxes**: Deduction (Standard ($X) / Itemized + itemized
  total per year) and, in the 14 states with local income taxes (AL, CO, DE,
  IN, IA, KY, MD, MI, MO, NY, OH, OR, PA, WV), an optional local rate with
  look-up links. Health premiums and HSA coverage stay inputs.
- **Where the rest goes**: live figures (Saved and invested, Available to
  save, Taxes with "$X saved", Unassigned), "Start from a plan:" **The usual
  order / Max tax breaks / Stay flexible**, a slider per line: 401(k) up to
  the match, HSA, Emergency fund (optional, "+ Add an emergency fund"), IRA
  (Traditional or Roth), 401(k) beyond the match, Taxable brokerage; each with
  **Max**. Pre-tax lines lower the taxes above as they move. With two incomes
  the lines split between partners.
- **How your saving grows** (tip): "It follows your pay." with the raise
  sentence and **Set on Year by year**.
- **Itemized paycheck** (CSV).
- The paycheck is the household's one tax calculator: its taxes are
  "pay after taxes" on every tab.

### 3.9 Year by year

File: `YearByYear.tsx`. Status chip "Today's dollars" or "Each year's own
dollars".

- **What shapes the years** (tip): Savings at retirement, Income this year,
  Saved this year with the match, Income in <retirement year>; each person's
  raise per year (beyond inflation); **How much of each raise you save** (The
  same share of pay as now / None of it (spend it all) / A quarter / Half /
  Three quarters / All of it); **Changes ahead** chips (click to switch on or
  off, pencil to edit) and **Add a change** (Pay changes, Spend more or less,
  Save less).
- **Every year to retirement** table: **Today's dollars / Future dollars**
  switch, CSV. Columns grouped Coming in (each person's pay, other income,
  Income), Going out (Taxes, Spending), Saved (Traditional, Roth and HSA,
  Brokerage, Emergency fund, Employer match, All saved), What's going on.
  Click a pay or spending figure to type your own for "Just this year" or
  "Until retirement" (a dot marks it; "Use the plan's figure" undoes it).
  Header sticks to the page on wide screens; crosshair highlights.
- Charts: **Income and spending** and **Where each year's income goes**.
- The plan's savings at retirement, on every tab, are built from these years.

### 3.10 Calculator

File: `Calculator.tsx`, hosting the Advanced calculator's plan screen
(`tools/advanced/PlanScreen.tsx`).

- Inputs column: **Your savings** facts (Traditional, Roth, Brokerage with
  cost basis, HSA, Pay with match, Taxes in retirement, Inflation), each
  linked to where it's set.
- **Changes ahead**: "What you see coming, and what each does to your savings
  at retirement." Each change is one row with an on/off switch and its effect
  at retirement (red "!" when the accounts can't cover it). Children appear
  as a row when the profile has them. **View or edit** opens all changes on
  lanes; **Add a change** offers 5 kinds: **Pay changes** ("A raise, a new
  job, part-time years or time off"), **Spend more or less** ("A bigger
  house, a car payment, a paid-off loan"), **Save less** ("Ease off, or stop
  saving, from an age on"), **A lump sum** ("An inheritance, a home sale, or
  a big expense", on the day you turn an age, into or out of an account),
  **Different returns** ("A higher or lower return from an age on"). Each
  form shows a live sentence and its effect. Link "See every year".
- **The stages behind this**: **See the N stages** opens a read-only table
  "The stages behind your plan". Also Stages, Fees, Total horizon, Total
  contributed; Markets (optional fees); the goal fields.
- Results: after-tax income per year and "At retirement, today's dollars";
  **When you could stop saving** (earliest age you could stop saving
  outright, the match included, and still reach your target; **Add to my
  changes**); the projection chart with **Rate band / Historical / Monte
  Carlo** (Monte Carlo: 5,000 simulations per redraw at 15% volatility),
  historical asset mix (US stocks, small-cap value, bonds, cash, with a
  glide), ages on the axis, change start marks, **Full screen**;
  **Milestones**; **Stage by stage** (CSV); a year table.
- Anything else changed here (fees, the goal, the mix) is saved in place of
  the plan's figures and the Calculator's result becomes savings at
  retirement on every tab ("Use the plan's figures" resets it).

### 3.11 Retirement

File: `Retirement.tsx` (hosts the Drawdown Simulator, Early Retirement Bridge
and Healthcare Cost Planner).

- **At retirement**: Savings, <year>; Chance of success (with strategy name);
  You plan to spend (or Your strategy spends + "Your goal"); Taxes, on top;
  Social Security, from <year>. Link "Ages, spending and assumptions". When
  anyone is under 65 at the last paycheck, a callout ("You stop work in 2041.
  You reach Medicare in 2047: 6 years of health cover to buy yourself. Your
  plan counts about $X per month…") with **Plan health cover**.
- Switch under it: **Drawdown** | **Bridge to 59½** (only when someone
  retires before 59½) | **Health cover** (US only).
- Drawdown view:
  - **The withdrawal strategies** (collapsible, closed by default and
    remembered): closed shows "Your strategy: <name>"; open shows all 15
    strategy cards, each with a one-line blurb and **Use this one** / **Your
    strategy**; "How the withdrawal strategies compare" opens the side-by-side
    comparison; phones show only yours (or the first three) until "Show all
    15 strategies".
  - **Your drawdown**: the Drawdown Simulator on the plan. Savings at
    retirement and retirement ages (from the Calculator and Profile) and
    Social Security (from Income) are listed, not typed. Strategy settings,
    years in retirement, starting rate, guardrails/floors/ceilings, the mix
    once retired (US stocks, small-cap value, bonds, cash, optional glide)
    and spending path are chosen here and saved. Views: Your plan / Compare
    strategies / Safe spending. Four charts have full screen.
    "Reset to my Profile's figures" when a starting rate or years were typed.
- **Bridge to 59½**: "You retire at 52, 7.5 years before 401(k)s and IRAs
  open without the 10% penalty…", **Use this bridge plan** (saved, lifts the
  readiness points held back, "Remove it" later). The Early Retirement Bridge
  runs on the plan (ages, filing, each account at retirement, 457(b), Roth
  contributions, basis, the mix, household, a partner's pay while they work).
  Its withdrawals each year are the chosen strategy's, and a picker shows 5
  markets from history ranked by what the strategy withdraws: 90th, 75th,
  Median, 25th, 10th. Choices: Roth ladder, 72(t), rule of 55/457(b),
  brokerage, part-time work, premiums.
- **Health cover**: the Healthcare Cost Planner on the plan: Work stops,
  ages then, Filing, Household, Income that year, Income at 65 (all from the
  plan); ACA marketplace premiums before 65 and Medicare (Part B, Part D,
  IRMAA) after.
- The chosen strategy's run is the Dashboard's chance of success and its net
  worth chart after retirement.

### 3.12 Tools

File: `ToolsPage.tsx`, routes /dashboard/tools, /dashboard/tools/[tool],
/dashboard/tools/advanced, /dashboard/tools/compare.

- The site's tool list (chart cards or compact tiles), led by the
  **Advanced Calculator** card ("What will my savings grow to, with the
  changes I see coming?"), then all 14 tools in three groups. Each card adds
  a "yours" line from the plan (for example "Your plan: lasted in 92% of past
  markets", "Your taxes: $X per year", "You retire at 55, before 59½").
  The Budget card draws the household's own budget.
- A tool opens inside the Dashboard with everything known filled in, the
  rail kept, and **Back to <the tab you came from>**. Tools without a plan
  tab show the chip "Doesn't change your plan"; those with one say "Filled in
  from your plan, to try things on. Changes here don't change it. To change
  your plan, use <tab>."
- Each tool has the site's saved-scenarios bar (shared with the same tool on
  the rest of the site), Compare (for Advanced), and a share link to the
  site's page. Reset goes back to the plan's figures.
- **College Savings** adds **Apply to my plan**, writing each child's cost
  per year, start, years, amount saved, return and tuition inflation into
  the profile.
- The 14 tools: Drawdown Simulator, Retirement Plan Optimizer, Social Security
  Calculator, Early Retirement Bridge, Roth Conversion Calculator, Healthcare
  Cost Planner (Retirement income); FIRE Calculator, Portfolio Backtest,
  College Savings, Rent vs. Buy (Saving and investing); Income Tax, Budget,
  Debt Payoff, Mortgage Calculator (Everyday money).

### 3.13 Next steps

Files: `NextStepsPage.tsx`, `nextsteps.ts`.

- **To do** ("Ordered by how much each moves your plan"): numbered steps,
  each with title, why, and a button to the right tab. Ranked by how many
  readiness points each would add (or how much it leaves unknown).
- **Done**: completed steps with **Open**.
- Possible steps (shown when they apply): Finish setting up; Split your
  savings into accounts; Add your checking and savings; Say where you live;
  Raise your chance of success from N%; Plan your bridge to 59½; Get the full
  employer match; Put $X per month to work; Build N months of cash; Pay down
  debt at 8% or more; Save $X per month for college; Saving drops to $X per
  month in <year>; Plan college in detail; Check your Social Security;
  Choose a withdrawal strategy; Build a budget; Review your assumptions; Set
  your mortgage and what owning costs; Plan health cover until Medicare; Add
  your Roth contributions / brokerage cost basis; Add your partner's birth
  date; Update your balances.
- Empty list: "Nothing left. Come back each month or so to update your
  balances."

### 3.14 Learn

Files: `web/app/dashboard/learn`, `web/components/learn/`.

- The same 66 lessons as the public /learn, in 8 tracks (Foundations; Saving
  and accounts; Investing and risk; Withdrawing; Taxes; Social Security and
  health care; Retiring early; Big decisions), inside the Dashboard's frame
  with a search box in the title bar.
- Home: "Next for you" (a lesson picked from what the plan needs, with its
  chart), track list with "N of M read" rings, the chosen track as a
  numbered route marked Read / For you / Up next.
- Lesson pages: reading column, "In this lesson" contents, **Your numbers**
  (the lesson's idea with the household's own figures, where the plan has
  them), Try it (39 interactive widgets across lessons), Key terms, Go
  deeper. A lesson counts as read when its "In short" comes into view
  (undoable). Progress syncs to the account. Links stay inside the
  Dashboard (lesson → tab or tool, with "Back to the lesson").

### 3.15 About

File: `About.tsx` (1,480 lines). Reading column with a sticky index and
folded sections.

- "What this is", then **How the Dashboard works** (One profile behind every
  tab; Net worth and its history; Your home; Income, Spending, and Taxes &
  Savings; Year by year; Retirement, the bridge and health cover; What the
  plan assumes; Tools opened here; What's saved to your account),
  **Calculator** (Calculator; How the projection works), each tool's section
  in its group, **Methods** (Historical; Monte Carlo; Where the numbers come
  from), and the fine print (Who makes this, Contact, Disclaimer).
- Data sources stated there: market history monthly January 1926 to
  December 2025 (Shiller dataset, CPI-U from BLS, Kenneth R. French Data
  Library for small-cap value and cash from July 1926); taxes and benefits
  from the IRS and SSA; Medicare from CMS; ACA from KFF and HHS; child costs
  from the USDA study and the Department of Labor's childcare prices by
  county.

---

## 4. Cross-cutting features

### 4.1 Profiles (several Dashboards per account)
- An account can hold several profiles (e.g. a couple's plan and a solo
  one). Driven only from the Profile tab; no switcher in the header.
- **New profile** dialog: Name, **Start fresh** ("Go through setup with
  nothing filled in" → **Create and start setup**) or **Start from a copy** /
  **Copy <name>** ("Everything as it is now, to change on Profile" → **Create
  the copy**), "Copy of" picker with 3+.
- Rename and Delete (never the last). Which profile is open is remembered per
  device; the list and every profile sync. A profile deleted on one device
  can't come back from another.
- Code: `store.ts` (openProfile/addProfile/renameProfile/deleteProfile),
  `Profiles.tsx`, `lib/sync/merge.ts`.

### 4.2 Changes ahead (scenarios)
- Plain-English changes that compile to stages behind the scenes
  (`scenarios.ts`, `calc.ts`, `cover.ts`). Kinds on the Dashboard: Pay
  changes, Spend more or less, Save less, A lump sum, Different returns
  (Calculator), the first three also on Year by year; children are a fixed
  row driven by Profile.
- Each change is saved to the profile, so the whole plan (every tab) follows
  it, can be switched off without deleting, and shows its effect on savings
  at retirement. Lump sums happen on the day you turn the age; withdrawals
  an account can't cover are refused. "When you could stop saving" adds a
  stop-saving change for you.
- Everything in today's dollars.

### 4.3 How your assumptions compare
- Files `AssumptionCheck.tsx`, `assume-bench.ts`, `assumptions.ts`.
- Rates the plan's guesses on a five-band scale: **Very conservative,
  Conservative, Balanced, Aggressive, Very aggressive** (sky blue for
  conservative, teal for balanced, orange for aggressive). No 0–100 number.
- Shown in three places: a fold on Plan summary (opened in place), a chip
  "Your assumptions: <band>" at the end of the Dashboard tab's assumptions
  line, and a report page.
- Header sentence: "Your plan's guesses about the future are balanced." or
  "Your plan assumes a kinder/tougher future than balanced assumptions,
  mostly from <assumption>." Figures: "Savings at retirement, your
  assumptions" vs "With balanced assumptions".
- Table columns: Assumption, Yours, Balanced (with range), Where it sits
  (mini scale), Rating, At retirement ($ effect), and a pencil link to where
  it's set. Up to 8 rows in 4 groups: Growth (Growth, before inflation;
  Inflation), Your life (Raises, beyond inflation; What the children cost),
  Retirement (Social Security share; How long the plan runs), College
  (College prices rising; College fund growth).
- Balanced middles: 4.5% growth after 3% inflation, 3% inflation, 90% of
  Social Security, plan to age 95, 4% tuition inflation, 6% college fund.
  An untouched plan rates Balanced, except the default 0% raise rates
  Conservative.

### 4.4 Printable report
- **Print your plan** on the Dashboard and Plan summary title bars opens
  /dashboard/report: US Letter sheets built in the browser ("nothing is sent
  anywhere to make it"), shown scaled to the window (up to 1.4x on wide
  screens), printed or saved as PDF from the browser. Its own typeface
  (Public Sans), cover with the household's name and "Calculated <date> ·
  Every figure in today's dollars".
- Always present (14 sheet types): cover with contents, Where you stand, Net
  worth, Income and taxes (Income abroad), Spending, Saving and investing,
  The road from here, Will it last?, Where the money comes from, Your
  readiness score, Next steps, Assumptions and method, Saving year by year,
  Retirement year by year (the two tables run over as many sheets as they
  need).
- Conditional (each says why it's there, e.g. "On this report because you
  own your home"): Your home / Renting, Your child(ren) (+ continued),
  Changes ahead, Getting to 59½, Social Security (for both of you) (not
  abroad), Health cover before Medicare, How your assumptions compare.
- Couples' report shows Whose on assets and debts. Crowded sheets zoom to
  fit (down to 80%).

### 4.5 Monthly check-in email
- On by default for everyone whose Dashboard is set up; turned off from
  Profile's **Email** tile ("Monthly check-in email") or one click from any
  email ("Turn off this email"); the unsubscribe page turns it off on a
  button press, not on opening.
- Cadence: a daily run sends it to people whose latest balances are 30 or
  more days old (or who have none) and who weren't sent one in the last 28
  days. So at most roughly once per month, and only when balances are stale.
- Subject "Your monthly RetCalc check-in". Contents: "Hi <first name>,", when
  balances were last updated ("…on October 20, 2026, 31 days ago."), "A
  check-in takes a few minutes:" (Update your balances in Net worth; Look over
  your spending for the month; See how your plan moved since last time), an
  **Open my Dashboard** button, why you get it, the turn-off link, contact.
  **No dollar figures and no plan results** (they're computed in the browser,
  never on the server). Light and dark versions; one-click unsubscribe
  headers.

### 4.6 Help guides and tips
- **Help** in the title bar opens a step-by-step guide in a side panel that
  scrolls to and highlights each part and ticks off tasks. 10 Dashboard
  guides: Net worth, Your home, Income, Spending, Taxes & Savings, Year by
  year, Calculator, Retirement, Retirement for early retirees, Health cover
  (`tours.ts`). Every hosted tool also has the site's own guide (14).
- 53 plain-language "?" tips (`tips.ts`) plus the site's glossary tips:
  what a figure is, why it's there, how the plan uses it.

### 4.7 Learn integration
- Learn tab inside the Dashboard; "Next for you" picks a lesson from the
  plan (e.g. emergency fund when cash covers few months); lessons show "Your
  numbers" from the Dashboard; lessons link to the tab or tool to act on.

### 4.8 Dark mode
- Light, Dark, or Match my device, from the rail (or the phone's More
  menu). Dark is Apple-style black (#000 page, #1c1c1e cards). The Dashboard
  uses SF Pro on Apple devices and Inter elsewhere (loaded only on Dashboard
  pages).

### 4.9 Phones and tablets
- Phones, and touch tablets held upright: no rail; a **bottom tab bar** with
  **Dashboard, Plan summary, Calculator, Retirement, More**. More opens every
  tab ("Your Dashboard" menu) with the theme switch and "Back to RetCalc";
  when you're on another tab, More shows that tab's name. The bar slides away
  while scrolling down and returns on the way up, like Safari's toolbar. Dots
  show on the bar too.
- Touch tablets held sideways (≥1024 px) keep the rail with labels.
- Charts read out by **tap-and-drag** on touch. Timeline and the children's
  cost chart scroll sideways with a swipe note; wide tables scroll inside
  their box. Full-screen chart buttons are hidden on phones and touch.
- Can be added to the home screen and opens full screen as an app (site web
  manifest, `display: standalone`), with safe-area spacing. No offline mode
  (there is no service worker).
- Everything stays reachable on phones; nothing is desktop-only except the
  full-screen chart buttons.

### 4.10 Children and college
- Children you have and children planned; costs by age (to 5, to 12, to 18)
  from USDA-based typical costs plus childcare where you live, a later child
  at a share of the first (80% default), all editable ("Edit child costs").
- **How you cover it** (the "How will you cover it?" dialog): **Brokerage
  first** (Recommended), **A bit from each**, or **My own order** (draggable),
  with "What this means for your plan" and "See each stage". The 401(k) up to
  the match is always given up last. Pre-tax cuts are sized for the tax they
  free. Costs above today's come out of saving; what saving can't cover comes
  from spending.
- College: comes out of saving in the college years unless saved for ahead
  in the budget; College Savings can set each child's cost, start and years.

### 4.11 Privacy
- Calculations always run in the browser. The server keeps the synced
  Dashboard (profiles, entries, choices), lessons read, the email
  preference, email address and optional first name.
- Stored with Supabase (US East); row-level security means each person can
  reach only their own data. Signing out removes synced data from that
  browser; the account keeps it. **Download my data** (JSON) and **Delete my
  account** (signs out every device, erases everything) on the account page.
- Not end-to-end encrypted: don't claim client-side encryption.
- Never sold or shared with advertisers; no ads; no bank connections.
- Error reports (Sentry, production only, errors only, no session replay):
  addresses cut to their path (nothing after ? or #), console messages
  dropped, no user info, cookies, headers, bodies, query params or
  stack-frame variables, IP storage off, sent through the site's own
  tunnel. The numbers you type never reach it.
- Analytics: Cloudflare Web Analytics and Vercel Web Analytics, both
  cookieless.

### 4.12 How the Dashboard reuses the site's tools
- One engine: the Dashboard's figures come from the same engine and
  calculators as the public tools and the Retirement Readiness Guide
  (`model.ts`: "Nothing here is a separate model").
- Five tabs are built on hosted tools whose edits save to the profile: Your
  home (Mortgage Calculator / Rent vs. Buy), Spending (Budget), Taxes &
  Savings (Budget's Paycheck), Calculator (Advanced), Retirement (Drawdown
  Simulator, Early Retirement Bridge, Healthcare Cost Planner). Income uses
  the Social Security Calculator's pay-history editor.
- Each figure is set in one place; later tabs list it as a "fact" with a
  link to where it's set, so tabs can't disagree.
- Tools opened from the Tools tab are a sandbox: filled in from the plan,
  never written back (except College Savings' explicit Apply to my plan).
  Nothing on the Dashboard changes the public site's tools or its saved
  household.

---

## 5. How it works (technical appendix, public-safe)

### Architecture
- Next.js App Router app in `web/` (deployed on Vercel). Dashboard routes:
  `/dashboard` (home tab), `/dashboard/[section]` (statically generated for
  12 sections), `/dashboard/setup`, `/dashboard/report`,
  `/dashboard/tools`, `/dashboard/tools/[tool]` (one per tool, static),
  `/dashboard/tools/advanced`, `/dashboard/tools/compare`,
  `/dashboard/learn`, `/dashboard/learn/[slug]`. All share one link-preview
  card; all are noindex. The page shells are server components; the
  Dashboard itself renders client-side behind a signed-in check (`SignedIn`
  in Frame.tsx).
- Client-side engine: `web/lib/engine` (plain JS math modules for
  projections, the historical and Monte Carlo runs, the Drawdown Simulator,
  the bridge and the plan, with typed wrappers), plus tax, benefit and
  market data in `web/lib/engine/data`. Heavy tool jobs can run in a Web
  Worker built from the engine. Nothing is computed on a server.
- Tools are loaded on demand (`next/dynamic`) only when opened.

### Data model and flow
- One record per profile (`DashData`, `store.ts`): `profile` (household,
  people with birth month/year, retirement ages, pay, state, budget lines,
  home, assumptions, Social Security, chosen strategy and its settings,
  scenarios/changes, children and college, cover rule, year-by-year raises
  and typed figures, each hosted tool's saved choices), `entries` (dated
  net worth snapshots of assets and debts), and setup progress.
- `model.ts` turns the profile and latest entry into the engine's inputs
  ("answers") and runs the plan: savings at retirement, the Drawdown run
  across every historical starting month (chance of success and the
  after-retirement chart), readiness score, Social Security, take-home pay.
- `flows.ts` maps the profile to and from each tool's inputs (Budget /
  Paycheck, Income Tax choices, Social Security pay history, Drawdown).
  `cover.ts` builds the plan year by year (pay with raises, taxes from the
  paycheck calculator, saving by account up to limits, children, college
  and changes taken from saving in the chosen order). `calc.ts` builds the
  Calculator's stages from those years. `scenarios.ts` compiles changes.
- `host.tsx` runs any tool inside a scope: seeded from the profile, with
  locked fields listed as facts, and a `keep` hook that writes edits back
  into the profile (or none, for the Tools sandbox).
- Every tab reads the same record through `useDashboard()`; a change on one
  tab re-runs the plan everywhere.

### Storage, sync and sign-in
- Local-first: every write goes to the browser's storage first (works
  offline and when the account service is down), then is pushed to the
  account shortly after. On sign-in and when the tab regains focus, every
  synced item is merged both ways (three-way merge against the last synced
  copy; deleted profiles tracked so they can't return). Code: `lib/storage.ts`,
  `lib/sync/` (engine, merge, account).
- Backend: Supabase (Postgres with row-level security), called straight from
  the browser with the public key; there is no app server or API route in
  between. Synced items are stored as JSON documents, one per item.
- Sign-in: Supabase Auth with Google (Google Identity Services button) or an
  emailed 6-digit one-time code (sent via Resend). No passwords. PKCE flow.
  Optional first name asked once.
- Account deletion runs in a server-side function that revokes sessions
  first.
- A scheduled backup job keeps encrypted backups of the database (the
  backup artifacts are encrypted; this is not end-to-end encryption of the
  user data).

### Report and email
- Report: `components/dashboard/report/` (model.ts gathers figures, pages.tsx
  lays out sheets, charts.tsx, Report.tsx); rendered in the browser from the
  local data, printed with the browser's print dialog. Reuses the Guide
  report's styles and charts.
- Email: a database function finds who is due; a scheduled serverless
  function (daily) builds and sends the email through Resend. It reads only
  the email address, first name, the date of the latest balance entry and
  when the last check-in went out (people who have set up the Dashboard and
  haven't turned it off). The unsubscribe link carries a token signed with a
  server-side secret.

### Testing
- `npm run test:dashboard` (in CI): 5 files, 33 tests in
  `web/components/dashboard/tests/` (scenarios 15, assumption benchmarks 10,
  bridge budget 4, catch-up 2, cover rule 2); 382 lines.
- `npm run test:sync`: 41 tests across sync, merge and the account layer,
  including a whole sync against a fake account.
- `node scripts/baseline/dashboard.mjs check`: re-runs 13 recorded Dashboard
  plans (couple, single, partner stops early, planned children, save less,
  stop saving, typed pay and spending, maxed 401(k)s…) and compares savings
  at retirement, the share of historical retirements that last, and saving
  year by year.
- `python3 tests/run.py`: the engine's math tests (62 test groups, 1,322 checks as the runner
  counts them) under JavaScriptCore or Node; gates commits and CI.
- Also in CI: the site numbers baseline, the Guide baseline, Guide, Budget,
  Tax and Advanced unit tests (Advanced's tests prove a change that changes
  nothing gives the same figures to the cent), lint and a production build.
- Email: `npm run test:checkin`; database access rules: `npm run test:rls`.
- The Playwright e2e suite (`web/e2e`, 16 specs) covers the public tools,
  not the signed-in Dashboard; Dashboard UI checks were done by hand and
  with screenshot scripts.

### Code size (measured 2026-11-11 with `wc -l`)
- Dashboard components, `web/components/dashboard/` without tests: **12,467
  lines in 55 files** (top level 10,899 + report/ 1,568).
- Dashboard routes, `web/app/dashboard/`: **173 lines in 11 files**.
- Dashboard total: **12,640 lines in 66 files**.
- Dashboard tests: **382 lines in 5 files**.
- Engine, `web/lib/engine/` without `data/`: **6,774 lines in 16 files**
  (largest: math.js 2,650, drawdown.js 1,456, plan.js 897, bridge.js 528).
  `data/` adds 1,326 lines.
- Related code the Dashboard leans on: Learn components 4,125 lines;
  Changes ahead UI 356; sync 492; account 867; Advanced calculator 1,971; all
  tools 30,822. Dashboard CSS: 19-dashboard.css 1,074, 20-dash-landing.css
  141, 22-clear-glass.css 648 (shared with the site).

---

## 6. Headline facts (for big slide stats)

| # | Fact | Verified in |
|---|---|---|
| 1 | **15 tabs** in one Dashboard | `sections.ts`, `Frame.tsx` SECTIONS |
| 2 | **14 tools** open inside it with your numbers filled in (plus the Advanced Calculator) | `lib/tools.ts`, `ToolsPage.tsx`, Landing "All 14" |
| 3 | **15 withdrawal strategies** to test | `tools/drawdown/text.ts` DD_UI |
| 4 | **100 years** of monthly market history (Jan 1926 to Dec 2025) | About.tsx "Where the numbers come from" |
| 5 | Chance of success tested from **every starting month since 1926** | About.tsx "What the plan assumes", flows.ts drawdown runs |
| 6 | **Up to 8** short setup steps, each skippable, saved as you go | `Setup.tsx` STEPS, Landing |
| 7 | Readiness score **out of 100**, across **5 areas** (40/20/15/15/10) | `tools/guide/calc.ts` FACTORS |
| 8 | **66 lessons in 8 tracks**, **39 interactive widgets** | `content/lessons` (66 files), `lib/learn/catalog.ts`, `components/learn/widgets` |
| 9 | **5 markets** from history in the Bridge picker (90th, 75th, median, 25th, 10th) | `tools/bridge/Bridge.tsx` PCTS |
| 10 | **3 views** of retirement: Drawdown, Bridge to 59½, Health cover | `Retirement.tsx` |
| 11 | **5 kinds of change** to plan ahead (pay, spending, save less, lump sum, returns) | `Calculator.tsx` PickKind, `ChangeUI.tsx` |
| 12 | Assumptions rated on a **5-band scale**, up to **8 assumptions** | `assume-bench.ts`, `assumptions.ts` |
| 13 | **9 kinds of assets, 5 kinds of debts** tracked by date | `kinds.ts` |
| 14 | **6 places** each paycheck can go, **3 starting plans** | `tools/budget/paycheck-math.ts` |
| 15 | Taxes for **all 50 states and DC**, plus local income tax in **14 states** | `lib/engine/data/2026.js` (51), `tools/tax/local.ts` |
| 16 | **24 Help guides**: 10 for Dashboard tabs, 14 for the tools | `tours.ts`, `tools/help/tours.ts` |
| 17 | **53 plain-language tips** | `tips.ts` |
| 18 | A printable report of **14 standard pages** plus up to **7 that fit your situation** | `report/model.ts` |
| 19 | **5,000** Monte Carlo simulations per redraw | `PlanScreen.tsx` mcHint |
| 20 | **4-holding** retirement mix: US stocks, small-cap value, bonds, cash | `tools/drawdown/text.ts` DD_ASSETS |
| 21 | **5 risk presets** from very conservative (2% real) to aggressive (7% real) | `lib/engine/calculators.js` RISK_LEVELS |
| 22 | **$0**, **0 bank logins**, **0 ads** | Landing.tsx trust row, FinePrint.tsx |
| 23 | **Several profiles** per account (e.g. a couple's plan and a solo one) | `Profiles.tsx`, `store.ts` |
| 24 | Check-in email **only when balances are 30+ days old**, never with figures | `supabase/functions/_shared/checkin.ts` |
| 25 | **~12,600 lines** of Dashboard code on a **~6,800-line** engine | wc -l (section 5) |

---

## 7. Do NOT mention (shelved or not built)

- **AI chat assistant** on the Dashboard: shelved 2026-10-26 as a possible
  paid-plan feature.
- **Automatic account linking** (Plaid, SnapTrade, broker balance sync):
  shelved; the pitch is "No bank logins".
- **CSV/paste import of brokerage balances**: suggested once, never built.
- **Weekly sign-ups email**: internal, parked, never run.
- **Paid plans / premium tier**: none exists; RetCalc is free.
- Don't mention the old **Stages** calculator page (retired; /stages
  redirects to Advanced) or an Advanced-vs-Stages split in the Dashboard.
- Don't claim: offline use, end-to-end encryption, bank-grade security,
  advice, user counts, testimonials, reviews or press (none on hand), or a
  setup time in minutes.
- Don't claim the email includes balances, figures or the report.

---

## 8. Copy rules to respect

- "per year" / "per month" in sentences, never "a year" / "a month". In
  tight figure rows "/yr" and "/mo" are fine. No two money labels that read
  alike.
- No internal references: never "the full RetCalc tool", "the Guide's
  costs", "the same calculators as the rest of RetCalc". Describe the figure
  and its real-world source.
- Sample households in screenshots and copy: **Sam and Jordan, child Nora**
  (also Alex, Mia/Leo, Pat/Robin in test seeds). Never the owner's real
  names.
- Tool counts: "A calculator, a guide and 14 planning tools." Never "20+"
  or "about 20". The 72(t), RMD and 8 strategy pages are not separate tools.
  Say 15 withdrawal strategies. Official names: Drawdown Simulator,
  Healthcare Cost Planner, Roth Conversion Calculator, Retirement Plan
  Optimizer.
- Tagline: "The complete retirement planning toolkit."
- Voice: plain statements, no punchy slogan headings on Dashboard pages; no
  hype, no gamification, no money emoji, no stock photos of retirees.
- Every figure in today's dollars; disclaimers stay ("An educational tool,
  not financial or tax advice. Past returns don't predict future ones.").
- "Readiness score" and "Chance of success" are different things; the
  assumption rating has no number.

### Notes on stale or conflicting sources
- `PRODUCT.md` says "13 connected planning tools"; the code has 14.
- A comment in `Profile.tsx` calls the check-in email "off until switched
  on"; the behavior (and privacy page, CHECKIN docs) is on by default once
  the Dashboard is set up.
- Memory notes describe a "Reach your target" card; on the Dashboard it is
  "When you could stop saving".
