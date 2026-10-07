/* Every address on the site and what it shows. Ported from build.py and
   src/js/app/09-navigation.js; titles and descriptions are in page-meta.json. */
import type { ToolSub } from "@/lib/tools";
import pageMeta from "@/lib/page-meta.json";

export const SITE = "https://retcalc.app";

export type Slug = keyof typeof pageMeta.pages;
export interface PageMeta { h1?: string; title: string; desc: string }
export const PAGES = pageMeta.pages as Record<Slug, PageMeta>;
export const SLUGS = Object.keys(PAGES) as Slug[];

/** The three Calculator modes and their addresses. */
export type CalcMode = "simple" | "single" | "series";
export const CALC_PATHS: Record<CalcMode, string> = { simple: "/", single: "/advanced", series: "/stages" };
export const CALC_MODE_NAMES: Record<CalcMode, string> = { simple: "Basic", single: "Advanced", series: "Stages" };

/** The tab each page belongs to (lights up in the navigation bar). */
export type Tab = "guide" | "calc" | "tools" | "about";

/** Pages that open a tool, and which tool: the strategy pages are the
    Drawdown Simulator set up for one strategy; /rmd is the Roth tool and
    /72t the Bridge, each with its own article. */
export const TOOL_SUB: Partial<Record<Slug, ToolSub>> = {
  "drawdown": "drawdown",
  "4-percent-rule": "drawdown",
  "guardrails": "drawdown",
  "vpw": "drawdown",
  "vanguard-dynamic-spending": "drawdown",
  "risk-based-guardrails": "drawdown",
  "rmd-withdrawal-strategy": "drawdown",
  "ratcheting-withdrawal": "drawdown",
  "cape-withdrawal": "drawdown",
  "bridge": "bridge",
  "72t": "bridge",
  "roth": "roth",
  "rmd": "roth",
  "healthcare": "healthcare",
  "fire": "fire",
  "backtest": "backtest",
  "incometax": "tax",
  "mortgage": "mortgage",
  "rentbuy": "rentbuy",
  "college": "college",
  "budget": "budget",
  "debt": "debt",
  "optimizer": "optimizer"
};

/** Old addresses, sent on to their new ones. */
export const ALIASES: Record<string, Slug> = { single: "advanced", series: "stages" };

/** The link-preview card's alt text, per page; home and about use the site card. */
export const CARD_ALT: Partial<Record<Slug, string>> = {
  "drawdown": "Drawdown Simulator: Will your money last? Test withdrawal strategies against every retirement since 1926.",
  "4-percent-rule": "4% Rule Calculator: Does 4% still work? Test it against every retirement since 1926, and find your own safe rate.",
  "guardrails": "Guardrails Calculator: Guyton-Klinger guardrails: start higher, cut when markets fall. How deep did the cuts go?",
  "vpw": "VPW Calculator: Variable percentage withdrawal: spend it all by the end, never run out. How low did it go?",
  "vanguard-dynamic-spending": "Vanguard Dynamic Spending: A share of the portfolio, but spending moves at most +5% or −2.5% a year. Tested since 1926.",
  "risk-based-guardrails": "Risk-Based Guardrails: Change spending only when the odds of lasting leave a band. How often did it move, and how far?",
  "rmd-withdrawal-strategy": "RMD Withdrawal Strategy: Spend the balance divided by the IRS life-expectancy divisor, every year. Tested since 1926.",
  "ratcheting-withdrawal": "Ratcheting Withdrawals: The 4% rule with raises: 10% more whenever the portfolio is up 50%. How often did they come?",
  "cape-withdrawal": "CAPE-Based Withdrawals: Spend more when stocks are cheap, less when they're dear. Today's rate, and how it did since 1926.",
  "optimizer": "Plan Optimizer: When to claim, what to withdraw, what to convert: thousands of plans, every market since 1926.",
  "bridge": "Early Retirement Bridge: Retiring before 59½? Compare a Roth ladder, 72(t), the rule of 55 and your brokerage.",
  "72t": "72(t) Calculator: Penalty-free IRA payments before 59½, sized and tested against every market since 1926.",
  "backtest": "Portfolio Backtest: Pick a mix of stocks, small value, bonds and cash and see what it did, every year back to 1926.",
  "incometax": "Income Tax: Your 2026 federal, state and FICA tax, on a salary or on a year of retirement withdrawals.",
  "roth": "Roth Conversion & RMDs: Project required distributions to 100, then test a conversion schedule against doing nothing.",
  "rmd": "RMD Calculator: Your required minimum distributions every year to 100, and what converting first would save.",
  "mortgage": "Mortgage Calculator: Your monthly payment, how the balance falls, and the amortization year by year.",
  "college": "College Savings: How much to save each month to cover tuition, from state school to elite.",
  "rentbuy": "Rent vs. Buy: Buyer and renter net worth over any horizon, down payment and home value included.",
  "budget": "Budget: Lay out your income and expenses, see what's left, and find out where your money goes.",
  "debt": "Debt Payoff: List what you owe, then watch the avalanche and snowball methods race to your payoff date.",
  "healthcare": "Healthcare Cost Planner: ACA premiums and subsidies before Medicare, then Part B, Part D and IRMAA by income.",
  "fire": "FIRE Calculator: Find when your portfolio reaches financial independence, or when you can coast.",
  "advanced": "Advanced Calculator: Growth, inflation, taxes, fees and market swings, with account types and a glide path.",
  "stages": "Stages Calculator: Save in stages, with different contributions, returns and mixes as life changes.",
  "guide": "Retirement Readiness Guide: One question at a time: a readiness score out of 100, a plan, and what to do next.",
  "tools": "Retirement Tools: Drawdown, taxes, Roth conversions, healthcare, FIRE, budgets and more."
};

/** Pages laid out in one column (the rest put inputs beside results). */
// The homepage, Advanced, Stages, the Drawdown Simulator (with its strategy
// pages) and Income Tax lay out their own columns (tools/basic/Basic.tsx,
// tools/advanced/Advanced.tsx, tools/stages/Stages.tsx, tools/drawdown/Drawdown.tsx,
// tools/tax/Tax.tsx).
const SOLO = new Set<string>(["home", "advanced", "stages", "incometax", "tools", "guide", "about", "budget", "debt", "compare"]);
export function isSolo(slug: Slug): boolean {
  return SOLO.has(slug) || TOOL_SUB[slug] === "drawdown";
}

export function tabFor(slug: Slug): Tab {
  if (slug === "guide") return "guide";
  if (slug === "about") return "about";
  if (slug === "home" || slug === "advanced" || slug === "stages" || (slug as string) === "compare") return "calc";
  return "tools";
}

export function calcModeFor(slug: Slug): CalcMode | null {
  return slug === "home" ? "simple" : slug === "advanced" ? "single" : slug === "stages" ? "series" : null;
}

export function pathFor(slug: Slug): string {
  return slug === "home" ? "/" : "/" + slug;
}

export function urlFor(slug: Slug): string {
  return SITE + pathFor(slug);
}
