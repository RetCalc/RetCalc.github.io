/* The Dashboard's sections, by id and name, for server and client alike. */

export type Section = "overview" | "profile" | "accounts" | "home" | "income" | "taxes" | "spending" | "savings" | "retirement" | "calculator" | "tools" | "next" | "learn";
export const SECTION_NAMES: Record<Section, string> = {
  overview: "Overview", profile: "Profile", accounts: "Net worth", home: "Home", income: "Income", taxes: "Taxes",
  spending: "Spending", savings: "Savings", retirement: "Retirement", calculator: "Calculator", tools: "Tools", next: "Next steps", learn: "Learn",
};
export const SECTION_IDS = Object.keys(SECTION_NAMES) as Section[];
