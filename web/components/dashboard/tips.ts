/* The Dashboard's "?" explanations: what a figure or field is, why it's
   there, and how the plan uses it, in plain words. The site's own glossary
   (lib/glossary.ts) covers the terms the tools share, and is used where it
   fits (fra, ssclaim, match, effrate). */

export const TIPS = {
  /* Dashboard */
  netWorth: "What you have, less what you owe: every account, your home and anything else you listed, minus your debts. It comes from your latest entry on Net worth.",
  band: "Markets don't all go the same way. The shaded band is where your net worth landed in 8 of every 10 past markets since 1926; the dotted line is the middle one.",
  atRetire: "Your savings at retirement, plus your home and anything else you own, less your debts. In today's dollars, so it compares with what things cost now.",
  retIncome: "What your plan pays each month once you retire: what you plan to spend, with taxes on top. Savings pay it, and Social Security covers part of it once it starts.",
  ssEstimate: "Until you add the figure from your Social Security statement, each benefit is estimated from today's pay, as if you keep earning about the same until you retire. Your statement at ssa.gov is more accurate.",
  strategy: "The rule for how much you take out of savings each year once retired. Some keep spending steady whatever markets do; others adjust with markets to make the money last. The one you choose sets your chance of success.",
  readiness: "A score out of 100 from five areas, weighted: how your plan holds up, how much you save, your emergency fund, debt and monthly cash flow. Open any one to see why it scored what it did.",
  cushion: "Cash set aside for a job loss or a big surprise bill, counted in months of your spending. It comes from the checking and savings accounts on Net worth, not from retirement accounts.",

  /* Profile */
  growth: "How much your savings earn each year until you retire, before inflation. Less inflation, it's what they really gain, so every figure stays in today's dollars. The usual 7.6% is 4.5% after 3% inflation.",
  inflation: "How fast prices rise each year. Every figure on your dashboard is in today's dollars, so inflation is taken out: growth before inflation, less this, is what your savings really gain.",
  stocks: "Once you retire, your plan is tested in every market since 1926 instead of at a steady rate. This is the share in stocks then, with the rest in 10-year Treasury bonds. More in stocks swings more, and has usually lasted longer.",
  stratSpend: "What your plan spends each month once retired, before taxes, in today's dollars: your withdrawal strategy's first year, from the starting rate you set on Retirement. Your goal from Profile is shown under it.",
  retSpend: "What you expect to spend each month once retired, in today's dollars, before taxes (the plan adds those on top). Many people spend less than while working.",
  saved: "Your retirement and investment accounts: 401(k)s, IRAs, Roth and brokerage accounts, and HSAs. Checking and savings count as your emergency fund instead, and your home isn't spent in retirement.",
  payTaxed: "Before taxes is your gross pay, as on an offer letter or at the top of a pay stub. After taxes is what reaches your bank account; we work back from it.",
  childcare: "Paid care such as daycare or a nanny before a child starts school, usually the most expensive years of raising one. It's added to each child's costs from birth to 5.",
  college: "How much of each child's college you plan to pay. It comes out of what you save in their four college years, unless you save for it ahead in your budget on Spending.",
  cover: "Children's costs come out of what you save. This says which accounts give up that money: unless you choose, the brokerage first and the 401(k) up to the match last, so the most valuable saving is kept longest.",

  /* Net worth and Home */
  assetType: "Each kind is treated its own way: retirement accounts and brokerage pay for retirement, each taxed differently; checking and savings are your emergency fund; your home counts toward net worth but isn't spent in retirement.",
  debtRate: "The interest rate decides how urgent a debt is. Debt at 8% or more usually costs more than saving earns, so paying it down comes first in your next steps.",
  equity: "What your home is worth, less what's left on the mortgage: the part of it you own.",
  interestLeft: "The interest you'll still pay on the mortgage at today's payment, from now until it's paid off. Paying extra brings it down.",

  /* Income, Taxes, Spending, Savings */
  otherIncome: "Money that comes in besides pay, after taxes: side work, rent from a property, a pension. It adds to what you have each month to spend and save.",
  fica: "Social Security and Medicare taxes, taken from every paycheck: 6.2% of pay for Social Security, up to a yearly limit, and 1.45% for Medicare.",
  leftAfter: "Pay after taxes, less what you spend. Your saving comes out of this; whatever isn't put toward saving shows on Savings as not assigned.",
  notAssigned: "Money left each month after taxes, spending and saving that hasn't been given a place. It sits in checking and earns nothing; putting it toward saving raises your plan.",
  savingsRate: "What goes into savings each month, with your employer's match, as a share of your pay before taxes. Around 15% is a common goal.",
  growLines: "Many people save more as their pay grows. Each line can rise by a share each year beyond inflation, and stops at its legal limit. Your plan counts the rise when it projects your savings.",

  /* Retirement and Plan summary */
  chance: "How often your plan lasted to 95 when retirement started in each month since 1926 and lived through what markets did next, drawing down with your withdrawal strategy.",
  taxes: "Taxes on what you take out in retirement, in the plan's average year. Money from traditional accounts is taxed as income, and the required withdrawals that start in your 70s can raise taxes later; Roth money comes out tax-free.",
  ssTotal: "Both of your benefits together, per month in today's dollars, from the year each of you claims. Social Security pays part of your spending and taxes; savings pay the rest.",
} as const;

export type TipId = keyof typeof TIPS;
