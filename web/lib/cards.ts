/* Each page's link-preview card (the picture a link shows in Messages,
   Slack or a social feed): the tool's name, the question it answers, one
   line under it, and which of the homepage's charts it shows. The cards are
   drawn by app/og-card (development only) and saved as public/og/<slug>.jpg
   by scripts/og/render.mjs; the words are also the image's alt text.
   Pages without a card of their own (About, Privacy, Account) use the
   site's card, public/og.png, drawn from "home". */
import type { Slug } from "@/lib/site";

export type CardChart = "fan" | "growth" | "score" | "fire" | "bridge" | "health" | "cloud" | "roth"
  | "tax" | "rentbuy" | "mortgage" | "budget" | "college" | "debt" | "tools";

export interface Card {
  /** The tool's name, small above the title. */
  kick?: string;
  title: string;
  text: string;
  chart: CardChart;
  /** Show the Drawdown Simulator's "lasted 30 years" figure (only where the
      page opens on the same 4% plan the figure comes from). */
  lasted?: boolean;
}

const SINCE = "every retirement since 1926";

export const CARDS: Partial<Record<Slug, Card>> = {
  home: { title: "Know your number.", chart: "fan", lasted: true,
    text: "Retirement planning tools that check your plan against every market since 1926." },
  calculator: { kick: "Retirement Calculator", title: "See what your savings grow to.", chart: "growth",
    text: "Your age, what you've saved and what you add each month, and what it all grows to by retirement." },
  advanced: { kick: "Advanced Calculator", title: "Taxes, fees and market swings, built in.", chart: "growth",
    text: "Account types, inflation, fees and a glide path, with every year laid out." },
  stages: { kick: "Stages Calculator", title: "A plan that changes as your life does.", chart: "growth",
    text: "Save in stages, with different contributions, returns and mixes for each." },
  guide: { kick: "Retirement Readiness Guide", title: "Get a readiness score.", chart: "score",
    text: "One question at a time: a score out of 100, a plan, and what to do next." },
  tools: { kick: "RetCalc", title: "A calculator, a guide and 13 planning tools.", chart: "tools",
    text: "Withdrawals, taxes, Roth conversions, healthcare, FIRE, housing and budgets, sharing one household." },

  drawdown: { kick: "Drawdown Simulator", title: "Check that your money lasts.", chart: "fan", lasted: true,
    text: "Retire in every month since 1926, through the Depression, the 1970s and 2008. 15 withdrawal strategies to compare." },
  "4-percent-rule": { kick: "4% Rule Calculator", title: "Does 4% still work?", chart: "fan", lasted: true,
    text: `Test it against ${SINCE}, and find your own safe rate.` },
  guardrails: { kick: "Guyton-Klinger Guardrails", title: "Start higher, cut when markets fall.", chart: "fan",
    text: `How deep did the cuts go? Tested against ${SINCE}.` },
  vpw: { kick: "VPW Calculator", title: "Spend it all, never run out.", chart: "fan",
    text: `Variable percentage withdrawal, tested against ${SINCE}. How low did spending go?` },
  "vanguard-dynamic-spending": { kick: "Vanguard Dynamic Spending", title: "Spending that moves, within limits.", chart: "fan",
    text: "A share of the portfolio, up at most 5% or down at most 2.5% a year. Tested since 1926." },
  "risk-based-guardrails": { kick: "Risk-Based Guardrails", title: "Change spending only when the odds move.", chart: "fan",
    text: "Adjust when the chance of lasting leaves a band. How often did it move, and how far?" },
  "rmd-withdrawal-strategy": { kick: "RMD Withdrawal Strategy", title: "Spend by the IRS table.", chart: "fan",
    text: `The balance divided by the life-expectancy divisor, every year. Tested against ${SINCE}.` },
  "ratcheting-withdrawal": { kick: "Ratcheting Withdrawals", title: "The 4% rule, with raises.", chart: "fan",
    text: "10% more whenever the portfolio is up 50%. How often did the raises come?" },
  "cape-withdrawal": { kick: "CAPE-Based Withdrawals", title: "Spend more when stocks are cheap.", chart: "fan",
    text: "And less when they're expensive. Today's rate, and how it did since 1926." },

  optimizer: { kick: "Plan Optimizer", title: "Decide when to claim Social Security.", chart: "cloud",
    text: "Thousands of claiming ages, withdrawal orders and Roth conversions, to find the plan that leaves you the most." },
  bridge: { kick: "Early Retirement Bridge", title: "Pay for the years before 59½.", chart: "bridge",
    text: "A Roth ladder, 72(t) payments, the rule of 55 or your brokerage account, with the tax and penalties of each." },
  "72t": { kick: "72(t) Calculator", title: "Penalty-free IRA payments before 59½.", chart: "bridge",
    text: "Your payment by the amortization or RMD method, planned as part of your early-retirement bridge." },
  roth: { kick: "Roth Conversion & RMDs", title: "Plan for required distributions.", chart: "roth",
    text: "Your required withdrawals to age 100, and what a conversion schedule saves against doing nothing." },
  rmd: { kick: "RMD Calculator", title: "Your required distributions to 100.", chart: "roth",
    text: "Every year's required minimum, and what converting to Roth first would save." },
  healthcare: { kick: "Healthcare Cost Planner", title: "Price health insurance until Medicare.", chart: "health",
    text: "ACA premiums and subsidies, then Part B, Part D and IRMAA by income." },
  fire: { kick: "FIRE Calculator", title: "Find the year work becomes optional.", chart: "fire",
    text: "When your portfolio reaches financial independence, or when you can coast." },
  backtest: { kick: "Portfolio Backtest", title: "What would your mix have done?", chart: "fan",
    text: "Stocks, small value, bonds and cash, every year back to 1926." },

  incometax: { kick: "Income Tax", title: "See where your paycheck goes.", chart: "tax",
    text: "2026 federal, state and FICA tax in all 50 states, on a salary or a year of retirement withdrawals." },
  rentbuy: { kick: "Rent vs. Buy", title: "Should you rent or buy?", chart: "rentbuy",
    text: "Buyer and renter net worth over any horizon, down payment and home value included." },
  mortgage: { kick: "Mortgage Calculator", title: "Your payment, year by year.", chart: "mortgage",
    text: "Taxes, PMI and extra payments, and how much of each year goes to interest." },
  budget: { kick: "Budget", title: "See where your money goes.", chart: "budget",
    text: "Lay out your income and spending, and see what's left each month." },
  college: { kick: "College Savings", title: "How much to save for college.", chart: "college",
    text: "The monthly amount that covers tuition, from state school to elite." },
  debt: { kick: "Debt Payoff", title: "Avalanche or snowball?", chart: "debt",
    text: "List what you owe and watch both methods race to your payoff date." },
};

/** The card's words as one line, for the image's alt text. */
export function cardAlt(c: Card): string {
  return (c.kick && c.kick !== "RetCalc" ? c.kick + ": " : "RetCalc: ") + c.title + " " + c.text;
}
