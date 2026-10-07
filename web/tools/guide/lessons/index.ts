/* The nineteen lessons (doc 2, "The lessons, in one list"): each tied to the
   card whose question depends on it, with the glossary terms it names (keys
   in lib/glossary.ts) and the tools that go deeper. The copy and figures are
   in lessons/*.tsx; this list is plain data, so tests can check every lesson
   links out and every term exists. Doc 2's table is the checklist: where it
   names no term or no tool, neither does the lesson. */

export interface Term { key: string; label: string }
export interface ToolLink { id: string; name: string; path: string }
export interface LessonInfo { id: string; n: number; title: string; card: string; terms: Term[]; tools: ToolLink[] }

const T = {
  tax: { id: "tax", name: "Income Tax", path: "/incometax" },
  budget: { id: "budget", name: "Budget", path: "/budget" },
  debt: { id: "debt", name: "Debt Payoff", path: "/debt" },
  mortgage: { id: "mortgage", name: "Mortgage Calculator", path: "/mortgage" },
  college: { id: "college", name: "College Savings", path: "/college" },
  basic: { id: "basic", name: "Basic calculator", path: "/" },
  stages: { id: "stages", name: "Stages", path: "/stages" },
  advanced: { id: "advanced", name: "Advanced", path: "/advanced" },
  backtest: { id: "backtest", name: "Portfolio Backtest", path: "/backtest" },
  optimizer: { id: "optimizer", name: "Plan Optimizer", path: "/optimizer" },
  drawdown: { id: "drawdown", name: "Drawdown Simulator", path: "/drawdown" },
  fire: { id: "fire", name: "FIRE Calculator", path: "/fire" },
  healthcare: { id: "healthcare", name: "Healthcare Cost Planner", path: "/healthcare" },
  bridge: { id: "bridge", name: "Early Retirement Bridge", path: "/bridge" },
} satisfies Record<string, ToolLink>;

export const LESSONS: LessonInfo[] = [
  { id: "two-clocks", n: 1, title: "The two clocks", card: "about", terms: [{ key: "fra", label: "Full retirement age" }], tools: [] },
  { id: "take-home", n: 2, title: "Gross versus take-home", card: "income", terms: [{ key: "takehome", label: "Take-home pay" }], tools: [T.tax] },
  { id: "keystone", n: 3, title: "Spending is the number the plan rests on", card: "spending", terms: [], tools: [T.budget] },
  { id: "months", n: 4, title: "Months of spending", card: "cash", terms: [{ key: "emergency", label: "Emergency fund" }], tools: [T.budget] },
  { id: "eight-percent", n: 5, title: "The 8% line", card: "debt", terms: [{ key: "apr", label: "APR" }], tools: [T.debt] },
  { id: "order", n: 6, title: "The order of operations", card: "debt", terms: [{ key: "match", label: "Employer match" }], tools: [] },
  { id: "housing", n: 7, title: "Housing at 28%; retirement before college", card: "goals", terms: [{ key: "piti", label: "PITI" }], tools: [T.mortgage, T.college] },
  { id: "time", n: 8, title: "Time does most of the work", card: "savings", terms: [{ key: "compound", label: "Compound growth" }], tools: [T.basic, T.stages] },
  { id: "real-returns", n: 9, title: "Real returns and the range", card: "invested", terms: [{ key: "realreturn", label: "Real return" }], tools: [T.backtest] },
  { id: "buckets", n: 10, title: "The three tax buckets", card: "accounts",
    terms: [{ key: "bktroth", label: "Roth" }, { key: "bkttrad", label: "Traditional" }, { key: "basis", label: "Cost basis" }], tools: [T.advanced] },
  { id: "not-flat", n: 11, title: "Saving and spending aren't flat", card: "changes", terms: [{ key: "stage", label: "Stage" }], tools: [T.stages, T.college] },
  { id: "eighty", n: 12, title: "The 80% rule, after tax", card: "retspend", terms: [{ key: "replacement", label: "Replacement rate" }], tools: [T.budget] },
  { id: "wait", n: 13, title: "Every year you wait raises it", card: "social",
    terms: [{ key: "pia", label: "PIA" }, { key: "spousal", label: "Spousal benefit" }], tools: [T.optimizer] },
  { id: "income-sources", n: 14, title: "Where a year's income comes from", card: "number", terms: [{ key: "swr", label: "Safe withdrawal rate" }], tools: [T.basic, T.stages] },
  { id: "sequence", n: 15, title: "Sequence risk", card: "lasting", terms: [{ key: "sequence", label: "Sequence-of-returns risk" }], tools: [T.drawdown] },
  { id: "levers", n: 16, title: "The four levers", card: "adjust", terms: [], tools: [T.stages, T.fire] },
  { id: "flexible", n: 17, title: "Flexible spending", card: "strategy",
    terms: [{ key: "guardrails", label: "Guardrails" }, { key: "vpwrate", label: "VPW" }], tools: [T.drawdown] },
  { id: "cliff", n: 18, title: "The subsidy cliff", card: "health", terms: [{ key: "aca", label: "ACA" }, { key: "magi", label: "MAGI" }], tools: [T.healthcare] },
  { id: "ways-across", n: 19, title: "The ways across 59½", card: "bridge",
    terms: [{ key: "rothladder", label: "Roth ladder" }, { key: "t72", label: "72(t)" }, { key: "rule55", label: "Rule of 55" }], tools: [T.bridge] },
];

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);
