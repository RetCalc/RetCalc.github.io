/* The Budget tool's inputs and totals, apart from its screen so other tools
   can read them (the Guide's budget step, Tool Help). The Budget tab is what
   you spend, and nothing else: no income and no saving. Pay, taxes and
   saving are the Paycheck tab's (paycheck-math.ts), which reads these lines.
   From src/js/app/13-budget.js. */
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
  { group: "Debt", items: [
    { desc: "Other debt payments", freq: 12 }] },
];

export interface BudgetRow { group: string; desc: string; amount: string; freq: number; custom: boolean }

/* Preset rows are only ever renamed, never added or removed, so row i always
   lines up with preset i: a blank rename falls back to that slot's name. */
export const PRESET_DESCS = BUDGET_PRESETS.flatMap((g) => g.items.map((it) => it.desc));

/** The Paycheck tab's inputs (paycheck-math.ts), kept with the Budget's, as typed. */
const PAYCHECK_DEFAULTS = {
  pcGross: "",
  /** Paychecks a year: 52, 26, 24 or 12. */
  pcFreq: "26",
  /** "s" single, "m" married with this one income, "m2" married with two
      incomes (planned by the month, each person's lines their own). */
  pcStatus: "s",
  /** The spouse's gross pay, a year (two incomes only). */
  pcGross2: "",
  /** Blank: the Income Tax tool's state. */
  pcState: "",
  /** Health premiums through work, per check. Blank: the Budget's Health
      insurance row, per check, which then moves here. Set to 0 (not
      through work) and that row stays in the budget. */
  pcHealth: "",
  /** With two incomes, premiums through your spouse's job, per month
      (pcHealth is then yours, per month). */
  pcHealth2: "0",
  pcMatchRate: "50",
  pcMatchUpTo: "6",
  pcMatchRate2: "50",
  pcMatchUpTo2: "6",
  pcHsaFamily: false,
  /** With two incomes and no family coverage: self-only for each of you
      (two self-only limits), not just one of you. */
  pcHsaBoth: false,
  /** The lines' order, comma separated. */
  pcOrder: "match,hsa,ef,rothIra,k401max,brok",
  pcMatch: "0", pcHsa: "0", pcEf: "0", pcRothIra: "0", pcK401max: "0", pcBrok: "0",
  /** The 401(k) lines' kind: Roth when true, traditional when false. */
  pcMatchRoth: false, pcK401maxRoth: false,
  /** Where Fill stops the emergency fund, per check. */
  pcEfCap: "200",
};

export const BUDGET_DEFAULTS = {
  /** Which tab is showing: the budget itself, or the Paycheck tab. */
  view: "budget" as "budget" | "paycheck",
  rows: BUDGET_PRESETS.flatMap((g) => g.items.map((it): BudgetRow => ({ group: g.group, desc: it.desc, amount: "0", freq: it.freq, custom: false }))),
  efMonths: "6",
  ...PAYCHECK_DEFAULTS,
};
export type BudgetInputs = typeof BUDGET_DEFAULTS;

export const BUDGET_DEF: ToolDef<BudgetInputs> = { id: "budget", label: "Budget", noun: "budget", defaults: BUDGET_DEFAULTS };

/** Saving lines from before the Paycheck tab ("Savings & investments", and
    "Retirement contribution" from Basic, Advanced or Stages). Saving is
    planned on the Paycheck tab now, so they're dropped as a budget opens
    (dropPlanned) and never counted. */
export const PLANNED_ON_PAYCHECK = ["Savings & investments", "Retirement contribution"];
export const isPlannedRow = (r: { desc: string }) => PLANNED_ON_PAYCHECK.includes(r.desc);
export const dropPlanned = <B extends { rows: BudgetRow[] }>(b: B): B =>
  b.rows.some(isPlannedRow) ? { ...b, rows: b.rows.filter((r) => !isPlannedRow(r)) } : b;

/* A goal set aside for, not spent: counted in the budget's total, but kept
   out of the emergency fund, which covers spending. */
const SET_ASIDE = ["College savings"];
export const isSavingsRow = (r: { desc: string }) => SET_ASIDE.includes(r.desc);
export const annualize = (r: BudgetRow) => parseNum(r.amount) * r.freq;

/** A year of the budget: everything (totalYr), and the spending in it (the
    rest, less goals set aside for), a year. */
export function budgetTotals(b: BudgetInputs) {
  const rows = b.rows.filter((r) => !isPlannedRow(r));
  const spentYr = rows.reduce((a, r) => a + (isSavingsRow(r) ? 0 : annualize(r)), 0);
  const savedYr = rows.reduce((a, r) => a + (isSavingsRow(r) ? annualize(r) : 0), 0);
  return { spentYr, savedYr, totalYr: spentYr + savedYr };
}

/** The totals, and the emergency fund: its months (6 when blank) and the
    spending it covers. */
export function budgetCompute(b: BudgetInputs) {
  const { spentYr, savedYr, totalYr } = budgetTotals(b);
  const ef = Math.max(1, Math.round(parseNum(b.efMonths)) || 6);
  return { spentYr, savedYr, totalYr, ef, efTarget: (spentYr / 12) * ef };
}

/** Spending by group, a year each, largest first. */
export function budgetGroups(b: BudgetInputs): { group: string; yr: number }[] {
  const g: Record<string, number> = {};
  for (const r of b.rows) if (!isPlannedRow(r) && annualize(r) > 0) g[r.group || "Custom"] = (g[r.group || "Custom"] || 0) + annualize(r);
  return Object.entries(g).map(([group, yr]) => ({ group, yr })).sort((x, y) => y.yr - x.yr);
}
