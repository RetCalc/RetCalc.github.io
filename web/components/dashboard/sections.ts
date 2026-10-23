/* The Dashboard's sections, by id and name, for server and client alike. */

export type Section = "overview" | "summary" | "profile" | "accounts" | "home" | "income" | "taxes" | "spending" | "savings" | "retirement" | "calculator" | "tools" | "next" | "learn" | "about";
export const SECTION_NAMES: Record<Section, string> = {
  overview: "Dashboard", summary: "Plan summary", profile: "Profile", accounts: "Net worth", home: "Home", income: "Income", taxes: "Taxes",
  spending: "Spending", savings: "Savings", retirement: "Retirement", calculator: "Calculator", tools: "Tools", next: "Next steps", learn: "Learn", about: "About",
};
export const SECTION_IDS = Object.keys(SECTION_NAMES) as Section[];
