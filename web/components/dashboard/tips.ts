/* The Dashboard's "?" explanations: what a figure or field is, why it's
   there, and how the plan uses it, in plain words. The site's own glossary
   (lib/glossary.ts) covers the terms the tools share, and is used where it
   fits (fra, ssclaim, match, effrate). */

export const TIPS = {
  /* Calculator scenarios */
  scFrom: "Your age when it starts. The plan counts whole years of age from today, so a change starting at 47 changes saving from the year you turn 47 to retirement, or to the age you set under Until.",
  scAmount: "In today's dollars, like every figure on your Dashboard: $500 per month means what $500 buys today, every year it runs. Saving more goes into the account you pick. Saving less comes out of the accounts in the order shown, and the plan keeps the tax it frees in mind.",
  scPct: "A share of what you save that year, after the changes before this one. Each year compounds: 10% less each year is 90% of the year before, every year it runs.",
  scAcct: "Where the money goes in, or which account gives up saving first. When that account runs out, the rest comes out of the others in the Dashboard's order: the brokerage first, then the 401(k) beyond the match, the IRA and the HSA, and the 401(k) up to the match last. Saving can't go below nothing: the plan never takes money back out of savings before retirement.",
  scLump: "One amount, in today's dollars, put in or taken out on the day you turn that age. Money put in goes into the account you pick and earns from that day. Money taken out leaves that account's balance that day, so the account has to hold at least that much by then. No tax is counted on the sale; the brokerage's cost basis at retirement does follow it.",
  scReturn: "The return your savings earn from that age on, before inflation, in place of the plan's. Stepped, it changes at once; climbing, it moves a little each year until it gets there. Only the Calculator runs returns year by year, so with a returns change on, its result is your plan's savings at retirement.",
  /* Dashboard */
  kidCostNow: "What your plan counts per month for the children you have, at their ages now, from the costs in Profile. It's already part of your spending. As they move into an age that costs more or less, or leave home, the difference comes out of (or goes back to) your saving.",
  netWorth: "What you have, less what you owe: every account, your home and anything else you listed, minus your debts. It comes from your latest entry on Net worth.",
  band: "Markets don't all go the same way. From retirement, the chart is the Retirement tab's: every January since 1926 as a faint line, with your strategy. The outer band is where your net worth landed in 8 of every 10 of them, the inner band the middle half, and the solid line the middle one.",
  atEnd: "The middle of every past market: your savings then, as the Retirement tab's median ending balance, plus your home and anything else you own, less your debts. In today's dollars.",
  atRetire: "Your savings at retirement, plus your home and anything else you own, less your debts. In today's dollars, so it compares with what things cost now.",
  retIncome: "What your plan pays each month once you retire: what you plan to spend, with taxes on top. Savings pay it, and Social Security covers part of it once it starts.",
  ssEstimate: "Until you add the figure from your Social Security statement, each benefit is estimated from today's pay, as if you keep earning about the same until you retire. Your statement at ssa.gov is more accurate.",
  strategy: "The rule for how much you take out of savings each year once retired. Some keep spending steady whatever markets do; others adjust with markets to make the money last. The one you choose sets your chance of success.",
  readiness: "A score out of 100 from five areas, weighted: how your plan holds up, how much you save, your emergency fund, debt and monthly cash flow. Open any one to see why it scored what it did.",
  cushion: "Cash set aside for a job loss or a big surprise bill, counted in months of your spending. It comes from the checking and savings accounts on Net worth, not from retirement accounts.",

  /* Profile */
  growth: "How much your savings earn each year until you retire, before inflation. Less inflation, it's what they really gain, so every figure stays in today's dollars. The usual 7.6% is 4.5% after 3% inflation.",
  inflation: "How fast prices rise each year. Every figure on your Dashboard is in today's dollars, so inflation is taken out: growth before inflation, less this, is what your savings really gain.",
  stratSpend: "What your plan spends each month once retired, before taxes, in today's dollars: your withdrawal strategy's first year, from the starting rate you set on Retirement. Your goal from Profile is shown under it.",
  retSpend: "What you expect to spend each month once retired, in today's dollars, before taxes and health premiums (the plan adds those on top). Many people spend less than while working. Left blank, it's what you spend today, less the mortgage payment if it's paid off by then.",
  saved: "Your retirement and investment accounts: 401(k)s, IRAs, Roth and brokerage accounts, and HSAs. Checking and savings count as your emergency fund instead, and your home isn't spent in retirement.",
  payTaxed: "Before taxes is your gross pay, as on an offer letter or at the top of a pay stub. After taxes is what reaches your bank account; we work back from it.",
  childcare: "Paid care such as daycare or a nanny before a child starts school, usually the most expensive years of raising one. It's added to each child's costs from birth to 5.",
  college: "How much of each child's college you plan to pay. It comes out of what you save in their four college years, unless you save for it ahead in your budget on Spending.",
  cover: "Children's costs come out of what you save. This says which accounts give up that money: unless you choose, the brokerage first and the 401(k) up to the match last, so the most valuable saving is kept longest.",

  /* Net worth and Home */
  assetType: "Each kind is treated its own way: retirement accounts and brokerage pay for retirement, each taxed differently; checking and savings are your emergency fund; your home counts toward net worth but isn't spent in retirement.",
  debtRate: "The interest rate decides how urgent a debt is. Debt at 8% or more usually costs more than saving earns, so paying it down comes first in your next steps.",
  costBasis: "What you paid for what's in a brokerage account, purchases and reinvested dividends together (your brokerage shows it). Only the gain above it is taxed when you sell, so it decides the tax on brokerage money in retirement. Leave it blank and the plan estimates 60% of the balance.",
  putIn: "The money you put in yourself, not what it has grown to: for a brokerage account its cost basis, for a Roth your own contributions. We ask because it changes your taxes and how early you can spend. Only a brokerage account's gain is taxed when you sell, and a Roth's contributions can come out any time, tax- and penalty-free, even before 59½. It's optional: left blank, the plan estimates it.",
  rothContrib: "What you've put into a Roth yourself, not counting its growth. Those contributions can come out any time without tax or penalty, which matters most if you retire before 59½. Leave it blank and the plan estimates half the balance.",
  equity: "What your home is worth, less what's left on the mortgage: the part of it you own.",
  ownCost: "Everything owning costs each month: the mortgage payment, property tax, insurance, PMI, HOA, upkeep and utilities. It's your budget's housing lines on Spending.",
  rentIns: "Insurance for what you own in a rented home, and your liability. Often $15 to $30 per month. It's your budget's insurance line on Spending.",
  interestLeft: "The interest you'll still pay on the mortgage at today's payment, from now until it's paid off. Paying extra brings it down.",

  /* Income, Spending, Taxes & Savings */
  otherIncome: "Money that comes in besides pay, after taxes: side work, rent from a property, a pension. It adds to what you have each month to spend and save.",
  deduction: "What comes off your income before federal income tax is figured. Everyone can take the standard deduction; itemizing (adding up mortgage interest, charity and state and local taxes) only helps when those come to more.",
  fica: "Social Security and Medicare taxes, taken from every paycheck: 6.2% of pay for Social Security, up to a yearly limit, and 1.45% for Medicare.",
  leftAfter: "All income after taxes, less what you spend. Your saving comes out of this. Whatever isn't put toward saving shows on Taxes & Savings as not assigned.",
  notAssigned: "Money left each month after taxes, spending and saving that hasn't been given a place. It sits in checking and earns nothing; putting it toward saving raises your plan.",
  savingsRate: "What goes into savings each month, with your employer's match, as a share of your pay before taxes. Around 15% is a common goal.",
  growLines: "Many people save more as their pay grows. Each line can rise by a share each year beyond inflation, and stops at its legal limit. Your plan counts the rise when it projects your savings.",

  /* Retirement and Plan summary */
  chance: "How often your plan lasted to 95 (or the years set on Retirement) when retirement started in each month since 1926 and lived through what markets did next, drawing down with your withdrawal strategy.",
  taxes: "Taxes on what you take out in retirement, in the plan's average year. Money from traditional accounts is taxed as income, and the required withdrawals that start in your 70s can raise taxes later; Roth money comes out tax-free.",
  ssPct: "The part of your benefit you expect to be paid. Social Security's trust fund is projected to run short in the 2030s; if Congress doesn't act, benefits could be cut to roughly 80%. Set a lower share here to plan for that: every benefit in your plan is scaled by it, from the day each of you claims.",
  ssTotal: "Both of your benefits together, per month in today's dollars, from the year each of you claims. Social Security pays part of your spending and taxes; savings pay the rest.",
} as const;

export type TipId = keyof typeof TIPS;
