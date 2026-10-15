# RetCalc upkeep schedule

Generated from `upkeep/items.json` by `python3 upkeep/check.py --write` on 2026-10-15; don't edit by hand. Status is as of that day: the **Next due** column is what counts. Ask Claude to refresh it, or to update anything that's due.

**0 overdue · 2 due within 30 days · 19 up to date**

| Status | Item | Area | Now covers | Last updated | Next due | How often | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 🟡 Due soon | **Social Security wage base and benefit bend points** | Taxes | 2026 | 2026-09-29 | 2026-11-01 | Yearly. Switch with the federal tax figures on January 1 | SSA's annual COLA and wage-base fact sheet, released in October |
| 🟡 Due soon | **Today's CAPE reading** | Market data | 41.0, the 30 September 2026 reading | 2026-09-30 | 2026-11-05 | Monthly | multpl.com Shiller PE (monthly) |
| 🟢 OK | **College cost presets** | Other defaults | 2025-26 school year | 2026-09-30 | 2026-11-30 | Yearly, after College Board publishes | College Board, Trends in College Pricing (published in late October) |
| 🟢 OK | **Federal income tax brackets and deductions** | Taxes | Tax year 2026 | 2026-09-29 | 2026-12-01 | Yearly. Prepare in November or December; switch on January 1 | IRS revenue procedure for the coming tax year (Rev. Proc. 2025-32 gave 2026), usually out in late October |
| 🟢 OK | **Medicare Part B premium and IRMAA tiers** | Healthcare | 2026 | 2026-10-13 | 2026-12-01 | Yearly. Switch on January 1 | CMS Medicare Parts A and B premiums and deductibles fact sheet, usually out in October or November |
| 🟢 OK | **Medicare Part D and Medigap cost estimates** | Healthcare | 2026 | 2026-10-13 | 2026-12-01 | Yearly, in the fall | CMS Part D premium announcement (summer); KFF or insurer surveys for Medigap |
| 🟢 OK | **Retirement and HSA contribution limits, and the IRA deduction phase-out** | Taxes | Tax year 2026 | 2026-10-15 | 2026-12-01 | Yearly, with the new tax year | IRS notice on retirement plan limits (Notice 2025-67 gave 2026), usually out in late October or November; IRS revenue procedure on HSA limits (Rev. Proc. 2025-19 gave 2026), usually out in May |
| 🟢 OK | **ACA marketplace premiums and subsidies** | Healthcare | 2026 coverage | 2026-09-29 | 2026-12-15 | Yearly, for the coming coverage year | KFF Marketplace Average Benchmark Premiums (late October or November); HHS poverty guidelines (January, used for the next coverage year); IRS applicable-percentage revenue procedure (summer) |
| 🟢 OK | **RMD and life-expectancy tables** | Taxes | 2026 | 2026-09-29 | 2027-01-02 | Yearly check. The tables rarely change (last in 2022); rmdStartAge rolls with the newest tax year | IRS Publication 590-B |
| 🟢 OK | **The tax year named in the site's text** | Taxes | 2026 | 2026-10-13 | 2027-01-02 | Yearly, on January 1, together with the federal switch | Follows the tax items above |
| 🟢 OK | **Article reviews ('Last reviewed' month)** | Articles | 26 articles; oldest review 2026-10-13 (26 of them) | 2026-10-13 | 2027-01-11 | Each article every 90 days (set max_age_days to change it) | The article's own sources and the site's current figures |
| 🟢 OK | **72(t) interest rate default** | Other defaults | 5% | 2026-10-13 | 2027-01-15 | Quarterly check; only matters if 120% of the mid-term rate goes above 5% | IRS Applicable Federal Rates (monthly revenue rulings) |
| 🟢 OK | **Default mortgage rate** | Housing | 7.25% | 2026-10-13 | 2027-01-15 | Quarterly, or sooner if rates move more than half a point | Freddie Mac Primary Mortgage Market Survey (weekly); use a rounded recent average |
| 🟢 OK | **New laws that change the rules mid-year** | Taxes |  | 2026-10-13 | 2027-01-15 | Quarterly check | IRS newsroom, Tax Foundation tracker, KFF for ACA, state revenue departments |
| 🟢 OK | **Stock, bond and inflation history** | Market data | Through December 2025 | 2026-09-29 | 2027-02-15 | Yearly: add the past year's 12 months once December's data is in | Robert Shiller's dataset (Yale), via multpl, for prices, dividends, yields and CAPE; US BLS for CPI-U (December's CPI comes out mid-January) |
| 🟢 OK | **State income tax brackets and deductions (50 states and DC)** | Taxes | As of January 1, 2026 | 2026-09-29 | 2027-02-28 | Yearly, after the Tax Foundation survey comes out | Tax Foundation, State Individual Income Tax Rates and Brackets (as of January 1), usually published in February; state revenue departments for detail |
| 🟢 OK | **Cash (T-bill) and small-cap value history** | Market data | Through December 2025 | 2026-09-29 | 2027-03-15 | Yearly, with the market history, once French posts December | Kenneth R. French Data Library (Dartmouth): the Fama-French factors file for T-bills, the 2x3 size/book-to-market portfolios for small value |
| 🟢 OK | **State rules for retirement income** | Taxes | Tax year 2026 | 2026-10-13 | 2027-03-15 | Yearly, early in the year | State revenue departments; Tax Foundation and AARP state guides as a cross-check |
| 🟢 OK | **Home price, rent and housing-cost defaults** | Housing | $450,000 home, $1,800 rent | 2026-10-05 | 2027-03-31 | Yearly | NAR or Census median home price; Census or Zillow median rent; Tax Foundation property tax rates |
| 🟢 OK | **Debt Payoff example rates** | Other defaults | Credit card 22.9% | 2026-10-05 | 2027-10-01 | Yearly | Federal Reserve G.19 consumer credit report (credit card rates) |
| 🟢 OK | **Long-run assumption defaults** | Other defaults |  | 2026-10-13 | 2027-10-01 | Yearly review; change rarely | Long-run history on the site itself; Vanguard and Morningstar capital-market outlooks as a sanity check |

## What each item covers

- **Social Security wage base and benefit bend points.** The Social Security tax wage cap (also the cap on earnings the benefit estimate counts) and the two bend points in the benefit formula.
- **Today's CAPE reading.** The latest Shiller CAPE, shown against the historical record and used by the CAPE withdrawal strategy's 'today' figures.
- **College cost presets.** The yearly cost of a public in-state and a private school (tuition, room and board) the College Savings tool offers.
- **Federal income tax brackets and deductions.** Federal brackets, standard deduction, long-term capital gains breakpoints, the age-65 extra standard deduction, and the 2025-2028 senior deduction.
- **Medicare Part B premium and IRMAA tiers.** The standard Part B premium and the income tiers that raise Part B and Part D for higher earners.
- **Medicare Part D and Medigap cost estimates.** The average standalone Part D premium and the rough monthly range for a Medigap Plan G policy at 65.
- **Retirement and HSA contribution limits, and the IRA deduction phase-out.** 401(k)/403(b)/457 deferral limit and catch-ups (50+ and 60 to 63), the IRA limit and catch-up, HSA self-only and family limits and the 55+ catch-up, and the MAGI ranges over which a traditional IRA deduction phases out with a plan at work. Income Tax's pre-tax deductions pop-up warns against them and the engine applies the phase-out.
- **ACA marketplace premiums and subsidies.** Average benchmark Silver premium by state, the poverty line the subsidies are measured against, the subsidy percentages, and whether the enhanced credits are back.
- **RMD and life-expectancy tables.** The IRS Uniform Lifetime Table (RMDs), the Single Life table (72(t) payments), and the RMD starting age, which works out birth year from the newest tax year in web/lib/engine/data/.
- **The tax year named in the site's text.** Every place the site says '2026' about its rules: page titles and descriptions, tool badges and headings, the footer, preview cards, articles and FAQs.
- **Article reviews ('Last reviewed' month).** Each tool page's article shows the month it was last reviewed. A review means checking its figures, sources and links still hold; only then move its date.
- **72(t) interest rate default.** The rate the Bridge's 72(t) payment starts with: up to the greater of 5% or 120% of the federal mid-term rate.
- **Default mortgage rate.** The 30-year rate the Mortgage and Rent vs. Buy tools start with. The pages call it a starting point, not a live quote.
- **New laws that change the rules mid-year.** Federal or state legislation that changes brackets, deductions, ACA subsidies (the enhanced credits that expired after 2025), RMD ages or Social Security taxation between the yearly updates.
- **Stock, bond and inflation history.** Monthly S&P 500 total returns, 10-year Treasury returns, CPI-U inflation and the historical CAPE series, January 1926 onward. Every historical test on the site runs on these.
- **State income tax brackets and deductions (50 states and DC).** Every state's brackets, standard deduction, personal exemption and credits. Illinois has extra detail (exemption cliff, 65+ amount). Also which pre-tax deductions each state keeps in its base (states.preTaxed: Pennsylvania, New Jersey, California and Massachusetts as of 2026).
- **Cash (T-bill) and small-cap value history.** Monthly one-month Treasury bill and small-company value returns, July 1926 onward.
- **State rules for retirement income.** Which states tax Social Security, pension and IRA exclusions, extra deductions or credits at 65, and states with no early-withdrawal penalty add-on.
- **Home price, rent and housing-cost defaults.** The starting home price, rent, rent growth, home appreciation, property tax rate and insurance in the Mortgage and Rent vs. Buy tools.
- **Debt Payoff example rates.** The example debts' interest rates, mainly the credit card APR.
- **Long-run assumption defaults.** Default return before inflation (8.5%), inflation (3%), college cost growth (4%), heirs' tax rate and similar starting assumptions.
