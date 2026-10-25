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

/** One line. `slot` is a preset line's own name, kept through a rename (a
    blank rename falls back to it). A line added to a group, or under
    Custom, is `custom` and has none. */
export interface BudgetRow { group: string; desc: string; amount: string; freq: number; custom: boolean; slot?: string;
  /** What the line would be cut to while living on the emergency fund (the
      Dashboard's emergency budget); unset, the same as `amount`. */
  emerg?: string }

export const PRESET_DESCS = BUDGET_PRESETS.flatMap((g) => g.items.map((it) => it.desc));
export const PRESET_GROUPS = BUDGET_PRESETS.map((g) => g.group);

/* Before lines could be removed, preset rows were only ever renamed, so row
   i lined up with preset i and carried no slot: a row without one takes its
   place's name. Every preset row saved since carries its slot. */
export const rowSlot = (r: BudgetRow, i: number): string | undefined => r.slot ?? (r.custom ? undefined : PRESET_DESCS[i]);

/** A new line's name until it's given one: the group's, then "custom",
    numbered from 2 while the earlier ones keep theirs ("Transportation
    custom", "Transportation custom 2"). Under Custom, "Custom item". */
export function newLineName(rows: BudgetRow[], group: string): string {
  const base = group === "Custom" ? "Custom item" : group + " custom";
  const taken = new Set(rows.map((r) => r.desc.trim().toLowerCase()));
  let n = 1;
  while (taken.has((n === 1 ? base : base + " " + n).toLowerCase())) n++;
  return n === 1 ? base : base + " " + n;
}

/** The Paycheck tab reads Health insurance, so that line can't be renamed
    or removed. */
export const HEALTH_SLOT = "Health insurance";
export const isLockedRow = (r: BudgetRow, i: number) => rowSlot(r, i) === HEALTH_SLOT && r.desc === HEALTH_SLOT;

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.toLowerCase();

/** The line that other tools read by this name (Health insurance, Rent /
    Mortgage, Property tax): the preset line while it keeps its name, or a
    line added under that name. A line renamed to something else is
    something else, so it isn't read as this (the Guide then asks). */
export const slotRow = (rows: BudgetRow[], name: string): BudgetRow | undefined =>
  rows.find((r, i) => rowSlot(r, i) === name && sameName(r.desc, name)) ?? rows.find((r) => !isPlannedRow(r) && sameName(r.desc, name));

/** The Paycheck tab's inputs (paycheck-math.ts), kept with the Budget's, as typed. */
const PAYCHECK_DEFAULTS = {
  pcGross: "",
  /** Paychecks a year: 52, 26, 24 or 12. */
  pcFreq: "26",
  /** The spouse's paychecks a year, with two incomes. */
  pcFreq2: "26",
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
  /** No US taxes on the paycheck (the Dashboard, outside the US). */
  pcNoTax: false,
  /** The lines' order, comma separated. */
  pcOrder: "match,ef,hsa,rothIra,k401max,brok",
  /** The plan the sliders were last set from ("" once one is moved by hand). */
  pcPlan: "",
  /** An emergency fund line: off until added. */
  pcEfOn: false,
  pcMatch: "0", pcHsa: "0", pcEf: "0", pcRothIra: "0", pcK401max: "0", pcBrok: "0",
  /** The 401(k) lines' kind: Roth when true, traditional when false. */
  pcMatchRoth: false, pcK401maxRoth: false,
  /** The IRA line's kind: Roth unless switched to traditional. */
  pcIraRoth: true,
  /** Where Fill stops the emergency fund, per check. */
  pcEfCap: "200",
};

export const BUDGET_DEFAULTS = {
  /** Which tab is showing: the budget itself, or the Paycheck tab. */
  view: "budget" as "budget" | "paycheck",
  rows: BUDGET_PRESETS.flatMap((g) => g.items.map((it): BudgetRow => ({ group: g.group, desc: it.desc, amount: "0", freq: it.freq, custom: false, slot: it.desc }))),
  efMonths: "6",
  /** The Dashboard's emergency budget: shown, and whether the emergency
      fund is sized on it rather than the budget itself. */
  efEmerg: false,
  efBasis: "normal" as "normal" | "emergency",
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

/** A budget as it opens: the planned lines dropped, unnamed lines named,
    and each preset line from before slots given its own, so removing a line never shifts which
    one is which. */
export function openBudget<B extends { rows: BudgetRow[] }>(b: B): B {
  let d = dropPlanned(b);
  // A line left without a name (a custom line could be, once) takes its group's.
  if (d.rows.some((r) => r.custom && !r.desc.trim())) {
    const rows: BudgetRow[] = [];
    for (const r of d.rows) rows.push(r.custom && !r.desc.trim() ? { ...r, desc: newLineName([...rows, ...d.rows], r.group || "Custom") } : r);
    d = { ...d, rows };
  }
  if (d.rows.some((r, i) => !r.slot && rowSlot(r, i)))
    d = { ...d, rows: d.rows.map((r, i) => (r.slot ? r : { ...r, ...(rowSlot(r, i) ? { slot: rowSlot(r, i) } : {}) })) };
  /* Health insurance renamed (before it was locked) is that line now: it
     stays, as a line of its own, and Health insurance comes back above it. */
  if (d.rows.some((r) => r.slot === HEALTH_SLOT && r.desc === HEALTH_SLOT)) return d;
  const at = d.rows.findIndex((r) => r.slot === HEALTH_SLOT);
  const fresh: BudgetRow = { group: "Health", desc: HEALTH_SLOT, amount: "0", freq: 12, custom: false, slot: HEALTH_SLOT };
  const rows = d.rows.map((r) => (r.slot === HEALTH_SLOT ? { group: r.group, desc: r.desc, amount: r.amount, freq: r.freq, custom: true } : r));
  const where = at >= 0 ? at : Math.max(0, rows.findIndex((r) => r.group === "Health"));
  return { ...d, rows: [...rows.slice(0, where), fresh, ...rows.slice(where)] };
}

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
  const efSpentYr = b.efEmerg && b.efBasis === "emergency" ? emergencyYear(b) : spentYr;
  return { spentYr, savedYr, totalYr, ef, efTarget: (efSpentYr / 12) * ef };
}

/** A year of the emergency budget: each line as it would be cut, or as it is. */
export function emergencyYear(b: BudgetInputs): number {
  return b.rows.filter((r) => !isPlannedRow(r) && !isSavingsRow(r)).reduce((a, r) => a + parseNum(r.emerg ?? r.amount) * r.freq, 0);
}

/** Spending by group, a year each, largest first. */
export function budgetGroups(b: BudgetInputs): { group: string; yr: number }[] {
  const g: Record<string, number> = {};
  for (const r of b.rows) if (!isPlannedRow(r) && annualize(r) > 0) g[r.group || "Custom"] = (g[r.group || "Custom"] || 0) + annualize(r);
  return Object.entries(g).map(([group, yr]) => ({ group, yr })).sort((x, y) => y.yr - x.yr);
}
