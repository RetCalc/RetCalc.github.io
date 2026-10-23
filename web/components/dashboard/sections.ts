/* The Dashboard's sections, by id and name, for server and client alike. */

export type Section = "overview" | "profile" | "accounts" | "home" | "income" | "taxes" | "spending" | "savings" | "retirement" | "tools" | "next";
export const SECTION_NAMES: Record<Section, string> = {
  overview: "Overview", profile: "Profile", accounts: "Accounts", home: "Home", income: "Income", taxes: "Taxes",
  spending: "Spending", savings: "Savings", retirement: "Retirement", tools: "Tools", next: "Next steps",
};
export const SECTION_IDS = Object.keys(SECTION_NAMES) as Section[];
