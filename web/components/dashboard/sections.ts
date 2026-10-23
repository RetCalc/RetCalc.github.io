/* The Dashboard's sections, by id and name, for server and client alike. */

export type Section = "overview" | "profile" | "accounts" | "home" | "income" | "spending" | "retirement" | "tools" | "next";
export const SECTION_NAMES: Record<Section, string> = {
  overview: "Overview", profile: "Profile", accounts: "Accounts", home: "Home", income: "Income",
  spending: "Spending", retirement: "Retirement", tools: "Tools", next: "Next steps",
};
export const SECTION_IDS = Object.keys(SECTION_NAMES) as Section[];
