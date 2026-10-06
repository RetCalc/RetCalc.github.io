/* The tools, grouped as the tool list shows them: the address each lives at,
   its name and its one-line description. From src/main/16-tool-picker.html. */

export type ToolSub = "optimizer" | "drawdown" | "bridge" | "roth" | "healthcare" | "fire" | "backtest" | "college" | "rentbuy" | "tax" | "budget" | "debt" | "mortgage";

export interface ToolCard {
  sub: ToolSub;
  path: string;
  name: string;
  badge?: string;
  desc: string;
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
        "sub": "optimizer",
        "path": "optimizer",
        "name": "Plan Optimizer",
        "badge": "New",
        "desc": "Tries thousands of ways to claim Social Security, draw down your accounts and convert to Roth, in every market since 1926, and finds the one that leaves you the most.",
        "i": 0
      },
      {
        "sub": "drawdown",
        "path": "drawdown",
        "name": "Drawdown Simulator",
        "desc": "Will your money last? Test withdrawal strategies against every retirement since 1926.",
        "i": 1
      },
      {
        "sub": "bridge",
        "path": "bridge",
        "name": "Early Retirement Bridge",
        "desc": "Retiring before 59½? Compare a Roth ladder, 72(t) payments, the rule of 55 and your brokerage, with the tax, penalties and ACA premiums each costs, and see what's left at 59½.",
        "i": 2
      },
      {
        "sub": "roth",
        "path": "roth",
        "name": "Roth Conversion & RMDs",
        "desc": "Project required distributions to age 100, then test a conversion schedule against doing nothing: lifetime tax, after-tax net worth, IRMAA surcharges and the survivor's bracket.",
        "i": 3
      },
      {
        "sub": "healthcare",
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
        "path": "fire",
        "name": "FIRE Calculator",
        "desc": "Find when your portfolio reaches financial independence. Toggle to Coast FIRE mode to see the moment you can stop contributing and let compound growth carry you the rest of the way.",
        "i": 4
      },
      {
        "sub": "backtest",
        "path": "backtest",
        "name": "Portfolio Backtest",
        "desc": "Pick a mix of stocks, small value, bonds and cash, then see what it actually did: return, volatility, the worst year, the deepest fall, and every rolling window back to 1926.",
        "i": 5
      },
      {
        "sub": "college",
        "path": "college",
        "name": "College Savings",
        "desc": "How much to save each month to cover tuition, with presets for state school, private, and elite colleges.",
        "i": 6
      },
      {
        "sub": "rentbuy",
        "path": "rentbuy",
        "name": "Rent vs. Buy",
        "desc": "Compare buyer and renter net worth over any horizon, counting what the down payment could have earned and what the home gains in value.",
        "i": 7
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
        "path": "incometax",
        "name": "Income Tax",
        "desc": "Estimate your 2026 federal, state and FICA tax on a salary, or switch to retirement mode and see what a year of withdrawals costs across traditional, Roth, brokerage and Social Security.",
        "i": 8
      },
      {
        "sub": "budget",
        "path": "budget",
        "name": "Budget",
        "desc": "Lay out your income and expenses, see what's left, and find out where your money goes.",
        "i": 9
      },
      {
        "sub": "debt",
        "path": "debt",
        "name": "Debt Payoff",
        "desc": "List what you owe, then watch avalanche and snowball race each other: payoff date, total interest, and exactly what ordering by motivation instead of rate costs you.",
        "i": 10
      },
      {
        "sub": "mortgage",
        "path": "mortgage",
        "name": "Mortgage Calculator",
        "desc": "Calculate your monthly payment, see how the balance falls, and explore amortization year by year.",
        "i": 11
      }
    ]
  }
];

export const TOOLS: Record<ToolSub, ToolCard> = Object.fromEntries(
  TOOL_GROUPS.flatMap((g) => g.cards.map((c) => [c.sub, c])),
) as Record<ToolSub, ToolCard>;

/** The four kinds of tool, each with one chart series color for its icon
    (DESIGN.md: the series tokens, never rose or amber). The tool list's
    three sections stay as they are; the taxes-and-healthcare tools sit in
    two of them, and share a color across both. */
export type ToolHue = "sky" | "lavender" | "teal" | "gray";
export const TOOL_CATEGORIES: { label: string; hue: ToolHue; tools: ToolSub[] }[] = [
  { label: "Planning retirement", hue: "sky", tools: ["optimizer", "drawdown", "bridge"] },
  { label: "Taxes and healthcare", hue: "lavender", tools: ["roth", "healthcare", "tax"] },
  { label: "Saving and investing", hue: "teal", tools: ["fire", "backtest", "college", "rentbuy"] },
  { label: "Everyday money", hue: "gray", tools: ["budget", "debt", "mortgage"] },
];
export const TOOL_HUE = Object.fromEntries(
  TOOL_CATEGORIES.flatMap((c) => c.tools.map((t) => [t, c.hue])),
) as Record<ToolSub, ToolHue>;
