/* The Budget tool's inputs and totals, apart from its screen so other tools
   can read them ("Copy from Budget" in Debt Payoff). From src/js/app/13-budget.js. */
import type { ToolDef } from "@/components/tools/ToolState";
import { parseNum } from "@/lib/format";

/* Grouped presets. freq is the row's default: 12 = a monthly figure, 1 = an
   annual one. Travel and gifts default to annual, as people think of them. */
export const BUDGET_PRESETS = [
  { group: "Housing", items: [
    { desc: "Rent / Mortgage", freq: 12 }, { desc: "Property tax", freq: 12 },
    { desc: "Utilities", freq: 12 }, { desc: "Internet & phone", freq: 12 },
    { desc: "Home / Renters insurance", freq: 12 }] },
  { group: "Transportation", items: [
    { desc: "Car payment", freq: 12 }, { desc: "Car insurance", freq: 12 },
    { desc: "Gas", freq: 12 }, { desc: "Maintenance & repairs", freq: 1 }] },
  { group: "Health", items: [
    { desc: "Health insurance", freq: 12 }, { desc: "Out-of-pocket medical", freq: 1 }] },
  { group: "Food", items: [
    { desc: "Groceries", freq: 12 }, { desc: "Eating out", freq: 12 }] },
  { group: "Lifestyle", items: [
    { desc: "Activities & hobbies", freq: 12 }, { desc: "Subscriptions", freq: 12 },
    { desc: "Travel", freq: 1 }, { desc: "Gifts", freq: 1 }] },
  { group: "Saving & debt", items: [
    { desc: "Savings & investments", freq: 12 }, { desc: "Other debt payments", freq: 12 }] },
];

export interface BudgetRow { group: string; desc: string; amount: string; freq: number; custom: boolean }

/* Preset rows are only ever renamed, never added or removed, so row i always
   lines up with preset i: a blank rename falls back to that slot's name. */
export const PRESET_DESCS = BUDGET_PRESETS.flatMap((g) => g.items.map((it) => it.desc));

export const BUDGET_DEFAULTS = {
  income: "",
  /** 1 = income typed as annual, 12 = as monthly */
  incomeFreq: 1,
  rows: BUDGET_PRESETS.flatMap((g) => g.items.map((it): BudgetRow => ({ group: g.group, desc: it.desc, amount: "0", freq: it.freq, custom: false }))),
  efMonths: "6",
};
export type BudgetInputs = typeof BUDGET_DEFAULTS;

export const BUDGET_DEF: ToolDef<BudgetInputs> = { id: "budget", label: "Budget", noun: "budget", defaults: BUDGET_DEFAULTS };

/* Money set aside rather than spent: kept out of spending and the emergency
   fund, and shown as saving instead. */
const SAVINGS = ["Savings & investments", "Retirement contribution", "College savings"];
export const isSavingsRow = (r: { desc: string }) => SAVINGS.includes(r.desc);
export const annualize = (r: BudgetRow) => parseNum(r.amount) * r.freq;

export function budgetTotals(b: BudgetInputs) {
  const incomeYr = parseNum(b.income) * b.incomeFreq;
  const spentYr = b.rows.reduce((a, r) => a + (isSavingsRow(r) ? 0 : annualize(r)), 0);
  const savedYr = b.rows.reduce((a, r) => a + (isSavingsRow(r) ? annualize(r) : 0), 0);
  return { incomeYr, spentYr, savedYr, leftYr: incomeYr - spentYr - savedYr };
}
