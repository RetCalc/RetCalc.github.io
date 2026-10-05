/* The household profile: the handful of facts nearly every tool asks for,
   entered once. It's a one-way fill: saving writes these numbers into each
   tool's own inputs, and from then on each tool is free to drift. Nothing
   reads it live, so an edit in one tool never quietly changes another.
   Ported from src/js/app/27-household.js. */
import { fmtNum, money } from "@/lib/format";

export interface Household {
  status: "s" | "m";
  age: number | null;
  spouseAge: number | null;
  retire: number | null;
  state: string | null;
  saved: number | null;
  monthly: number | null;
  income: number | null;
  income2: number | null;
  spend: number | null;
}

/** As stored: the profile plus when it was saved, which tells each tool
    whether it has taken this version in yet. */
export interface SavedHousehold extends Household {
  savedAt: number;
}

/** Stored under retcalc.household.v1. */
export const HOUSEHOLD_STORE = { key: "household", version: 1 } as const;

const has = (v: number | null) => v != null && isFinite(v);

/** The tools that take the profile in, in the order the save confirmation
    lists them, and whether a given profile gives each anything to fill
    (from hhApply() in src/js/app/27-household.js). Each tool is added as
    it's ported; its fill runs via useHouseholdFill. */
export const HOUSEHOLD_TOOLS: { name: string; takes: (h: Household) => boolean }[] = [
  { name: "Income Tax", takes: () => true },
  { name: "Budget", takes: (h) => has(h.income) && (h.income! + (h.status === "m" && has(h.income2) ? h.income2! : 0)) > 0 },
];

export function isEmptyHousehold(h: Household | null): boolean {
  return !h || Object.entries(h).every(([k, v]) => k === "status" || v == null);
}

/* $825K, $1.2M: the phone version of the summary. */
function short$(v: number): string {
  const a = Math.abs(v), sign = v < 0 ? "-" : "";
  const f = (x: number, u: string) => sign + "$" + +x.toFixed(x < 10 ? 1 : 0) + u;
  return a >= 1e6 ? f(a / 1e6, "M") : a >= 1e3 ? f(a / 1e3, "K") : money(v);
}

/** The collapsed bar's one-line summary: full wording for wide screens,
    a compact one that fits two lines on a phone. */
export function householdSummary(h: Household, stateName: (code: string) => string | undefined): { long: string[]; short: string[] } {
  const long: string[] = [], short: string[] = [];
  if (h.age != null) {
    const ages = fmtNum(h.age) + (h.status === "m" && h.spouseAge != null ? " & " + fmtNum(h.spouseAge) : "");
    long.push("Age " + ages);
    short.push("Age " + ages);
  }
  if (h.retire != null) {
    long.push("retire at " + fmtNum(h.retire));
    short.push("retire " + fmtNum(h.retire));
  }
  if (h.saved != null) {
    long.push(money(h.saved) + " saved");
    short.push(short$(h.saved) + " saved");
  }
  if (h.monthly != null) {
    long.push(money(h.monthly) + "/mo");
    short.push(short$(h.monthly) + "/mo");
  }
  const inc = (h.income || 0) + (h.income2 || 0);
  if (inc > 0) {
    long.push(money(inc) + "/yr income");
    short.push(short$(inc) + " income");
  }
  if (h.spend != null) {
    long.push("spend " + money(h.spend) + "/yr");
    short.push(short$(h.spend) + " spend");
  }
  const name = h.state ? stateName(h.state) : undefined;
  if (h.state && name) {
    long.push(name);
    short.push(h.state);
  }
  return { long, short };
}
