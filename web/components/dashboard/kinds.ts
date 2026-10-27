/* The kinds of things a household has and owes, the groups the picture
   shows them in, and how each feeds the plan (model.ts holdings()). */

import type { AssetKind, DebtKind } from "./store";

export const ASSET_KINDS: { kind: AssetKind; name: string; group: Group }[] = [
  { kind: "workplace", name: "401(k) or 403(b)", group: "ret" },
  { kind: "g457", name: "457(b)", group: "ret" },
  { kind: "ira", name: "Traditional IRA", group: "ret" },
  { kind: "roth", name: "Roth IRA or Roth 401(k)", group: "ret" },
  { kind: "hsa", name: "HSA", group: "ret" },
  { kind: "brokerage", name: "Brokerage", group: "inv" },
  { kind: "cash", name: "Checking or savings", group: "cash" },
  { kind: "home", name: "Home", group: "home" },
  { kind: "other", name: "Other: car, business, collectibles", group: "oth" },
];
export const DEBT_KINDS: { kind: DebtKind; name: string; group: Group }[] = [
  { kind: "mortgage", name: "Mortgage", group: "mort" },
  { kind: "car", name: "Car loan", group: "loan" },
  { kind: "student", name: "Student loan", group: "loan" },
  { kind: "loan", name: "Other loan", group: "loan" },
  { kind: "card", name: "Credit card", group: "card" },
];

export type Group = "ret" | "inv" | "cash" | "home" | "oth" | "mort" | "loan" | "card";
export const ASSET_GROUPS: { id: Group; name: string }[] = [
  { id: "ret", name: "Retirement accounts" }, { id: "inv", name: "Investments" }, { id: "cash", name: "Cash" },
  { id: "home", name: "Home" }, { id: "oth", name: "Other" },
];
export const DEBT_GROUPS: { id: Group; name: string }[] = [
  { id: "mort", name: "Mortgage" }, { id: "loan", name: "Loans" }, { id: "card", name: "Credit cards" },
];
export const groupOf = (kind: string): Group => ([...ASSET_KINDS, ...DEBT_KINDS].find((k) => k.kind === kind)?.group ?? "oth");
export const kindName = (kind: string) => [...ASSET_KINDS, ...DEBT_KINDS].find((k) => k.kind === kind)?.name ?? "Other";

/** The kinds that ask what was put in, and what it's called for each: a
    brokerage account's cost basis, a Roth's own contributions. */
export const BASIS_KINDS: Partial<Record<string, { name: string }>> = {
  brokerage: { name: "Cost basis" },
  roth: { name: "Your contributions" },
};
