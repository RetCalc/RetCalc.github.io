/* The tools, grouped as the tool list shows them: the address each lives at,
   its name and its one-line description. From src/main/16-tool-picker.html. */

export type ToolSub = "optimizer" | "drawdown" | "bridge" | "roth" | "healthcare" | "fire" | "backtest" | "college" | "rentbuy" | "tax" | "budget" | "debt" | "mortgage";

export interface ToolCard {
  sub: ToolSub;
  path: string;
  name: string;
  badge?: string;
  desc: string;
  /** The question the tool answers, as the tool list's compact tiles and
      chart cards put it. */
  q: string;
  /** Position in the cards' staggered entrance (the --i custom property). */
  i: number;
}

export interface ToolGroup {
  label: string;
  title: string;
  sub: string;
  cards: ToolCard[];
}

export const TOOL_GROUPS: ToolGroup[] = [
  {
    "label": "Retirement income",
    "title": "Retirement income",
    "sub": "Turning savings into a paycheck",
    "cards": [
      {
        "sub": "drawdown",
        "q": "Will my money last?",
        "path": "drawdown",
        "name": "Drawdown Simulator",
        "desc": "Will your money last? Test withdrawal strategies against every retirement since 1926.",
        "i": 0
      },
      {
        "sub": "optimizer",
        "q": "When should I claim, convert and withdraw?",
        "path": "optimizer",
        "name": "Plan Optimizer",
        "desc": "Tries thousands of ways to claim Social Security, draw down your accounts and convert to Roth, in every market since 1926, and finds the one that leaves you the most.",
        "i": 1
      },
      {
        "sub": "bridge",
        "q": "How do I pay for the years before 59½?",
        "path": "bridge",
        "name": "Early Retirement Bridge",
        "desc": "Retiring before 59½? Compare a Roth ladder, 72(t) payments, the rule of 55 and your brokerage, with the tax, penalties and ACA premiums each costs, and see what's left at 59½.",
        "i": 2
      },
      {
        "sub": "roth",
        "q": "Should I convert to Roth before RMDs start?",
        "path": "roth",
        "name": "Roth Conversion & RMDs",
        "desc": "Project required distributions to age 100, then test a conversion schedule against doing nothing: lifetime tax, after-tax net worth, IRMAA surcharges and the survivor's bracket.",
        "i": 3
      },
      {
        "sub": "healthcare",
        "q": "What will health insurance cost before and after Medicare?",
        "path": "healthcare",
        "name": "Healthcare Cost Planner",
        "desc": "ACA marketplace premiums and subsidies for the gap before Medicare, then Medicare Part B, Part D, and IRMAA surcharges by income.",
        "i": 4
      }
    ]
  },
  {
    "label": "Saving and investing",
    "title": "Saving and investing",
    "sub": "Growing wealth, and weighing the big choices",
    "cards": [
      {
        "sub": "fire",
        "q": "When does work become optional?",
        "path": "fire",
        "name": "FIRE Calculator",
        "desc": "Find when your portfolio reaches financial independence. Toggle to Coast FIRE mode to see the moment you can stop contributing and let compound growth carry you the rest of the way.",
        "i": 5
      },
      {
        "sub": "backtest",
        "q": "What would this mix have actually done?",
        "path": "backtest",
        "name": "Portfolio Backtest",
        "desc": "Pick a mix of stocks, small value, bonds and cash, then see what it actually did: return, volatility, the worst year, the deepest fall, and every rolling window back to 1926.",
        "i": 6
      },
      {
        "sub": "college",
        "q": "How much should I save for college?",
        "path": "college",
        "name": "College Savings",
        "desc": "How much to save each month to cover tuition, with presets for state school, private, and elite colleges.",
        "i": 7
      },
      {
        "sub": "rentbuy",
        "q": "Should I rent or buy?",
        "path": "rentbuy",
        "name": "Rent vs. Buy",
        "desc": "Compare buyer and renter net worth over any horizon, counting what the down payment could have earned and what the home gains in value.",
        "i": 8
      }
    ]
  },
  {
    "label": "Everyday money",
    "title": "Everyday money",
    "sub": "Taxes, budgets, debts and the mortgage",
    "cards": [
      {
        "sub": "tax",
        "q": "How much tax will I owe?",
        "path": "incometax",
        "name": "Income Tax",
        "desc": "Estimate your 2026 federal, state and FICA tax on a salary, or switch to retirement mode and see what a year of withdrawals costs across traditional, Roth, brokerage and Social Security.",
        "i": 9
      },
      {
        "sub": "budget",
        "q": "Where does my money go?",
        "path": "budget",
        "name": "Budget",
        "desc": "Lay out your expenses, then see how each paycheck covers them and where the rest goes.",
        "i": 10
      },
      {
        "sub": "debt",
        "q": "Which debt should I pay off first?",
        "path": "debt",
        "name": "Debt Payoff",
        "desc": "List what you owe, then watch avalanche and snowball race each other: payoff date, total interest, and exactly what ordering by motivation instead of rate costs you.",
        "i": 11
      },
      {
        "sub": "mortgage",
        "q": "What will the house cost each month?",
        "path": "mortgage",
        "name": "Mortgage Calculator",
        "desc": "Calculate your monthly payment, see how the balance falls, and explore amortization year by year.",
        "i": 12
      }
    ]
  }
];

export const TOOLS: Record<ToolSub, ToolCard> = Object.fromEntries(
  TOOL_GROUPS.flatMap((g) => g.cards.map((c) => [c.sub, c])),
) as Record<ToolSub, ToolCard>;

/** Each section of the tool list has one chart series color for its
    icons (DESIGN.md: the series tokens, never rose or amber), so a tool's
    color always matches the section it's listed in (the owner's call,
    2026-10-12). Start here, above the sections, stays in Text. */
export type ToolHue = "sky" | "teal" | "lavender";
const SECTION_HUE: Record<string, ToolHue> = {
  "Retirement income": "sky",
  "Saving and investing": "teal",
  "Everyday money": "lavender",
};
export const TOOL_HUE = Object.fromEntries(
  TOOL_GROUPS.flatMap((g) => g.cards.map((c) => [c.sub, SECTION_HUE[g.label]])),
) as Record<ToolSub, ToolHue>;
