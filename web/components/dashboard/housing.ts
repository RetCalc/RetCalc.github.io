/* The home as the plan has it. Owning: the Mortgage Calculator on your
   own loan (what the home is worth and what's owed, from Net worth; the
   rate and payment, from Home; the years left, from those), with what
   owning costs beyond the loan set there. Renting: the rent and renter's
   insurance. Either way those costs are the budget's housing lines, which
   Spending shows but doesn't let you change (they're changed on Home). */

import { withDefaults, type ToolInputs } from "@/components/tools/ToolState";
import { groupDigits } from "@/lib/format";
import { MORTGAGE_DEF, mortgageCompute, type Inputs as MortgageInputs } from "@/tools/mortgage/model";
import { mortgage } from "./model";
import { ALL_TOGETHER, budgetFor, budgetMonth, detailed, setAllTogether } from "./flows";
import type { Entry, Profile } from "./store";

/** What the profile keeps from the Mortgage Calculator: what owning costs
    beyond the loan, and the extra payments and refinance tried there. */
const KEEP = ["tax", "ins", "pmi", "hoa", "maint", "util", "extrasOn", "extraMo", "extraOnce", "extraWhen", "recast", "refiRate", "refiTerm", "refiCost"] as const;

/** The Mortgage Calculator on your own loan: the home's value as its price,
    what's owed as the loan, the years left at your payment as its length,
    and your own costs (or its usual ones until they're set). */
export function mortgageFor(pr: Profile, entries: Entry[]): MortgageInputs {
  const cur = withDefaults(MORTGAGE_DEF, (pr.tools.mortgage ?? {}) as Partial<MortgageInputs>);
  const M = mortgage(pr, entries), value = Math.max(M.value, M.owed);
  const down = Math.max(0, value - M.owed);
  const years = M.months != null ? M.months / 12 : 30;
  return {
    ...cur, price: groupDigits(Math.round(value), true), downAmt: groupDigits(Math.round(down), true),
    downPct: value > 0 ? String(Math.round((down / value) * 1000) / 10) : "0",
    rate: M.rate != null ? String(Math.round(M.rate * 100000) / 1000) : cur.rate, term: String(Math.round(years * 1000) / 1000),
  };
}

/** Whether the calculator's costs are still the ones it opened with: a
    tool can write its inputs back as it opens, which isn't a change. */
export const sameCosts = (a: MortgageInputs, b: MortgageInputs) => KEEP.every((k) => String(a[k]) === String(b[k]));

/** What the profile keeps when the calculator changes. The first time,
    a budget that's still setup's one number (everything else together)
    gives up what the new housing lines now count, so the household's
    spending stays what it said it was. */
export function fromMortgage(pr: Profile, d: MortgageInputs, entries: Entry[]): Profile {
  const keep = Object.fromEntries(KEEP.map((k) => [k, d[k]])) as ToolInputs;
  const next: Profile = { ...pr, tools: { ...pr.tools, mortgage: keep } };
  const costs = costsOf(next, entries), out: Profile = { ...next, homeCosts: costs };
  const b = budgetFor(pr);
  if (pr.homeCosts || detailed(b) || !b.rows.some((r) => r.desc === ALL_TOGETHER)) return out;
  const added = costs.tax + costs.ins + costs.pmi + costs.hoa + costs.maint + costs.util;
  return { ...out, tools: { ...out.tools, budget: setAllTogether(b, budgetMonth(b) - added) as unknown as ToolInputs } };
}

/** Owning's costs per month beyond the loan's principal and interest, in
    dollars, as the budget takes them: worked out from the calculator's
    figures (property tax and upkeep are shares of the home's value). */
export interface HomeCosts { tax: number; ins: number; pmi: number; hoa: number; maint: number; util: number }
function costsOf(pr: Profile, entries: Entry[]): HomeCosts {
  const R = mortgageCompute(mortgageFor(pr, entries)).R;
  const r = (v: number) => Math.round(v * 100) / 100;
  return { tax: r(R.tax), ins: r(R.ins), pmi: r(R.pmi), hoa: r(R.hoa), maint: r(R.maint), util: r(R.util) };
}

/** The budget's housing lines Home sets, by the line's own name, per
    month: owning, once its costs are set on Home (the mortgage line once
    there's a payment); renting, the rent and renter's insurance once given. */
export const HOA_LINE = "HOA", UPKEEP_LINE = "Home maintenance";
export function housingLines(pr: Profile): Record<string, number> {
  if (pr.home === "rent") return { ...(pr.rent != null ? { "Rent / Mortgage": pr.rent } : {}), ...(pr.rentIns != null ? { "Home / Renters insurance": pr.rentIns } : {}) };
  if (pr.home !== "own") return {};
  const C = pr.homeCosts;
  return {
    ...(pr.mortPay != null ? { "Rent / Mortgage": pr.mortPay + (C?.pmi ?? 0) } : {}),
    ...(C ? { "Property tax": C.tax, "Home / Renters insurance": C.ins, Utilities: C.util, [HOA_LINE]: C.hoa, [UPKEEP_LINE]: C.maint } : {}),
  };
}

/** Owning per month, everything in: the loan's payment and the costs. */
export function ownCost(pr: Profile): number | null {
  if (pr.home !== "own" || !pr.homeCosts) return null;
  return Object.values(housingLines(pr)).reduce((s, v) => s + v, 0);
}

/** The mortgage's payment (and PMI), monthly, that ends when it's paid
    off; the year it does. */
export function payoffDrop(pr: Profile, entries: Entry[]): { monthly: number; year: number } | null {
  const M = mortgage(pr, entries);
  if (pr.home !== "own" || M.payoff == null || !pr.mortPay) return null;
  return { monthly: pr.mortPay + (pr.homeCosts?.pmi ?? 0), year: M.payoff };
}
