/* Where a figure came from, said in words beside it (doc 1, principle 3:
   "Never a number without its source"; doc 2, "Source badges"): you entered
   it, a tool found it, the guide estimated it, or a default stands in. A
   neutral badge with a colored dot and its word (DESIGN.md, Badges: never
   color alone). The dots take the chart series colors, not the jade and
   gold the mockups drew: DESIGN.md keeps the brand colors for the logo and
   amber for its four places. */

import type { Source, SourceKind } from "./store";

/** The tools a trip can bring a figure back from, by name. */
export const TOOL_NAMES: Record<string, string> = {
  budget: "Budget", tax: "Income Tax", debt: "Debt Payoff", mortgage: "Mortgage Calculator", college: "College Savings",
  drawdown: "Drawdown Simulator", bridge: "Early Retirement Bridge", healthcare: "Healthcare Cost Planner", fire: "FIRE Calculator",
  basic: "Basic calculator", stages: "Stages", advanced: "Advanced", backtest: "Portfolio Backtest", optimizer: "Plan Optimizer",
};

/** The badge's words: "you entered", "from Budget", "estimated", "default". */
export function sourceWords(s: Pick<Source, "kind" | "tool">): string {
  if (s.kind === "tool") return "from " + (TOOL_NAMES[s.tool ?? ""] ?? "a tool");
  return s.kind === "entered" ? "you entered" : s.kind === "estimated" ? "estimated" : "default";
}
/** The same, as readouts say it in a sentence. */
export function sourcePhrase(s: Pick<Source, "kind" | "tool">): string {
  if (s.kind === "tool") return "from " + (TOOL_NAMES[s.tool ?? ""] ?? "a tool");
  return s.kind === "entered" ? "as you entered it" : s.kind === "estimated" ? "our estimate" : "a placeholder until you enter it";
}

export function SourceBadge({ s, kind, tool }: { s?: Pick<Source, "kind" | "tool"> | null; kind?: SourceKind; tool?: string }) {
  const src = s ?? (kind ? { kind, tool } : null);
  if (!src) return null;
  return <span className="gd-src" data-src={src.kind}><i aria-hidden="true"></i>{sourceWords(src)}</span>;
}
