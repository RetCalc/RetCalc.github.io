/* Each page's link-preview card (the picture a link shows in Messages,
   Slack or a social feed): what the tool is, in plain words, and an
   illustration of it. A card is seen on its own, so the title names the
   tool and the line says what it does without needing the site around it.
   Drawn by app/og-card (development only) and saved as public/og/<slug>.jpg
   by scripts/og/render.mjs; the words are also the image's alt text.
   Pages without a card of their own (About, Privacy, Account) use the
   site's card, public/og.png, drawn from "home". */
import type { Slug } from "@/lib/site";

export type CardArt = "fan" | "growth" | "accounts" | "stages" | "guide" | "fire" | "bridge" | "sepp" | "health"
  | "optimizer" | "social" | "roth" | "rmd" | "tax" | "rentbuy" | "mortgage" | "budget" | "college" | "debt" | "backtest" | "tools";

export interface Card {
  title: string;
  text: string;
  art: CardArt;
}

const SINCE = "against every retirement since 1926.";

export const CARDS: Partial<Record<Slug, Card>> = {
  home: { title: "The complete retirement planning toolkit.", art: "fan",
    text: "Free calculators for saving, spending and taxes in retirement, tested against every market since 1926." },
  calculator: { title: "Retirement Calculator", art: "growth",
    text: "See how much you'll have saved by the time you retire." },
  advanced: { title: "Advanced Retirement Calculator", art: "accounts",
    text: "Project your savings with taxes, fees, inflation and different account types." },
  stages: { title: "Multi-Stage Retirement Calculator", art: "stages",
    text: "Plan your savings in stages, with different contributions and returns for each." },
  guide: { title: "Retirement Readiness Check", art: "guide",
    text: "Answer a few questions and get a score out of 100, with a plan for what to do next." },
  tools: { title: "Free Financial Planning Tools", art: "tools",
    text: "Calculators for retirement, taxes, Roth conversions, healthcare, mortgages, budgets and debt." },

  drawdown: { title: "Retirement Withdrawal Calculator", art: "fan",
    text: "See whether your savings will last, tested against every market since 1926." },
  "4-percent-rule": { title: "4% Rule Calculator", art: "fan",
    text: "Test the 4% rule " + SINCE },
  guardrails: { title: "Guardrails Withdrawal Calculator", art: "fan",
    text: "Test the Guyton-Klinger guardrails strategy " + SINCE },
  vpw: { title: "VPW Calculator", art: "fan",
    text: "Test variable percentage withdrawal " + SINCE },
  "vanguard-dynamic-spending": { title: "Vanguard Dynamic Spending Calculator", art: "fan",
    text: "Test Vanguard's ceiling-and-floor spending rule " + SINCE },
  "risk-based-guardrails": { title: "Risk-Based Guardrails Calculator", art: "fan",
    text: "Test spending rules based on your odds of success " + SINCE },
  "rmd-withdrawal-strategy": { title: "RMD Withdrawal Strategy Calculator", art: "fan",
    text: "Test spending by the IRS life-expectancy table " + SINCE },
  "ratcheting-withdrawal": { title: "Ratcheting Withdrawal Calculator", art: "fan",
    text: "Test the 4% rule with raises in good years " + SINCE },
  "cape-withdrawal": { title: "CAPE-Based Withdrawal Calculator", art: "fan",
    text: "Set your withdrawal rate by stock market valuation, tested since 1926." },

  optimizer: { title: "Retirement Plan Optimizer", art: "optimizer",
    text: "Find the best age to claim Social Security, withdrawal order and Roth conversions." },
  "social-security": { title: "Social Security Claiming Calculator", art: "social",
    text: "See your benefit at 62, 67 or 70, break-even ages, spousal and survivor benefits, and what waiting is worth." },
  bridge: { title: "Early Retirement Calculator", art: "bridge",
    text: "Plan how to pay for retirement before 59½ without early-withdrawal penalties." },
  "72t": { title: "72(t) Calculator", art: "sepp",
    text: "Calculate penalty-free IRA payments before age 59½." },
  roth: { title: "Roth Conversion Calculator", art: "roth",
    text: "See whether converting to a Roth IRA could lower your lifetime taxes." },
  rmd: { title: "RMD Calculator", art: "rmd",
    text: "Calculate your required minimum distributions for every year to age 100." },
  healthcare: { title: "Retirement Healthcare Cost Calculator", art: "health",
    text: "Estimate health insurance costs before and after Medicare." },
  fire: { title: "FIRE Calculator", art: "fire",
    text: "Find out when you can reach financial independence and retire early." },
  backtest: { title: "Portfolio Backtest", art: "backtest",
    text: "See how any mix of stocks, bonds and cash has performed since 1926." },

  incometax: { title: "Income Tax Calculator", art: "tax",
    text: "Estimate your 2026 federal, state and FICA taxes in all 50 states." },
  rentbuy: { title: "Rent vs. Buy Calculator", art: "rentbuy",
    text: "Compare the long-term cost of renting and buying a home." },
  mortgage: { title: "Mortgage Calculator", art: "mortgage",
    text: "Calculate your monthly payment, with taxes, PMI and extra payments." },
  budget: { title: "Budget Calculator", art: "budget",
    text: "Lay out your income and expenses and see what's left each month." },
  college: { title: "College Savings Calculator", art: "college",
    text: "Find out how much to save each month for college." },
  debt: { title: "Debt Payoff Calculator", art: "debt",
    text: "Compare the avalanche and snowball methods and see when you'll be debt-free." },
};

/** The card's words as one line, for the image's alt text. */
export function cardAlt(c: Card): string {
  return (c === CARDS.home ? "RetCalc: " : "") + c.title.replace(/\.$/, "") + ". " + c.text;
}
