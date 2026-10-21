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
export const CALC_PATHS: Record<CalcMode, string> = { simple: "/calculator", single: "/advanced", series: "/stages" };
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
  "optimizer": "optimizer",
  "social-security": "social"
};

/** Old addresses, sent on to their new ones. */
export const ALIASES: Record<string, Slug> = { single: "advanced", series: "stages" };

/** Each strategy page's line under its heading, after the page's name. */
const STRATEGY_LEDE: Partial<Record<Slug, string>> = {
  "4-percent-rule": "Does 4% still work? Test it against every retirement since 1926, and find your own safe rate.",
  "guardrails": "Guyton-Klinger guardrails: start higher, cut when markets fall. How deep did the cuts go?",
  "vpw": "Variable percentage withdrawal: spend it all by the end, never run out. How low did it go?",
  "vanguard-dynamic-spending": "A share of the portfolio, but spending moves at most +5% or −2.5% per year. Tested since 1926.",
  "risk-based-guardrails": "Change spending only when the odds of lasting leave a band. How often did it move, and how far?",
  "rmd-withdrawal-strategy": "Spend the balance divided by the IRS life-expectancy divisor, every year. Tested since 1926.",
  "ratcheting-withdrawal": "The 4% rule with raises: 10% more whenever the portfolio is up 50%. How often did they come?",
  "cape-withdrawal": "Spend more when stocks are cheap, less when they're dear. Today's rate, and how it did since 1926."
};

/** The eight strategy pages (the Drawdown Simulator set up for one
    strategy), in the strategy picker's order. */
export const STRATEGY_PAGES = ["4-percent-rule", "ratcheting-withdrawal", "rmd-withdrawal-strategy", "vpw", "guardrails",
  "risk-based-guardrails", "vanguard-dynamic-spending", "cape-withdrawal"] as const satisfies readonly Slug[];
export function isStrategyPage(slug: Slug): boolean {
  return (STRATEGY_PAGES as readonly Slug[]).includes(slug);
}

/** A strategy page's own line under its heading (the question the page answers). */
export function strategyLede(slug: Slug): string | null {
  return isStrategyPage(slug) ? STRATEGY_LEDE[slug] ?? null : null;
}

/** Pages laid out in one column (the rest put inputs beside results). */
// The homepage, Basic, Advanced, Stages, the Drawdown Simulator (with its strategy
// pages), Income Tax, the Plan Optimizer, the Early Retirement Bridge (with
// /72t), Roth Conversion (with /rmd), College Savings and Rent vs. Buy lay out their own columns (components/home/Home.tsx, tools/basic/Basic.tsx,
// tools/advanced/Advanced.tsx, tools/stages/Stages.tsx, tools/drawdown/Drawdown.tsx,
// tools/tax/Tax.tsx, tools/optimizer/Optimizer.tsx, tools/bridge/Bridge.tsx, tools/roth/Roth.tsx).
const SOLO = new Set<string>(["home", "calculator", "advanced", "stages", "incometax", "optimizer", "social-security", "bridge", "72t", "roth", "rmd", "healthcare", "fire", "backtest", "college", "rentbuy", "tools", "guide", "about", "budget", "debt", "mortgage", "compare", "account", "privacy", "guide/report", "guide/paycheck", "guide/paycheck/report"]);
export function isSolo(slug: Slug): boolean {
  return SOLO.has(slug) || TOOL_SUB[slug] === "drawdown";
}

/** The homepage sits under no tab: the logo is the way back to it. */
export function tabFor(slug: Slug): Tab | null {
  if (slug === "home") return null;
  if (slug === "guide" || (slug as string).startsWith("guide/")) return "guide";
  if (slug === "about" || slug === "privacy") return "about";
  if (slug === "calculator" || slug === "advanced" || slug === "stages" || (slug as string) === "compare") return "calc";
  return "tools";
}

/** Pages with a tool on them, which get its saved scenarios (in the tool
    header, or ToolBar.tsx on the calculator's pages). */
export function hasToolControls(slug: Slug): boolean {
  return slug !== "home" && slug !== "about" && slug !== "tools" && slug !== "privacy";
}

export function calcModeFor(slug: Slug): CalcMode | null {
  return slug === "calculator" ? "simple" : slug === "advanced" ? "single" : slug === "stages" ? "series" : null;
}

/** The page an address shows ("/" is the homepage). */
export function slugFromPath(path: string): Slug {
  const seg = path.replace(/^\/+|\/+$/g, "");
  return (seg || "home") as Slug;
}

export function pathFor(slug: Slug): string {
  return slug === "home" ? "/" : "/" + slug;
}

export function urlFor(slug: Slug): string {
  return SITE + pathFor(slug);
}
