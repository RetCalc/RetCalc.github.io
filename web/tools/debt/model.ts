/* The Debt Payoff tool's inputs. From src/js/app/18-debt.js. */
import type { ToolDef } from "@/components/tools/ToolState";
import { debtRun, debtUnderwater } from "@/lib/engine/typed";
import { groupDigits, parseNum } from "@/lib/format";

export interface DebtRow { desc: string; balance: string; apr: string; min: string }

/* Chosen so the smallest balance is not also the highest rate; otherwise
   avalanche and snowball pick the same order and there's nothing to compare. */
const ROWS: [string, number, number, number][] = [
  ["Credit card", 9800, 22.9, 245], ["Store card", 1900, 8.9, 60],
  ["Car loan", 16200, 7.4, 395], ["Student loan", 21500, 5.5, 230],
];

export const DEBT_DEFAULTS = {
  extra: groupDigits(300, true),
  mode: "avalanche" as "avalanche" | "snowball",
  rows: ROWS.map(([desc, b, apr, min]): DebtRow => ({ desc, balance: groupDigits(b, true), apr: String(apr), min: groupDigits(min, true) })),
};
export type DebtInputs = typeof DEBT_DEFAULTS;

export const DEBT_DEF: ToolDef<DebtInputs> = { id: "debt", label: "Debt Payoff", noun: "debt plan", defaults: DEBT_DEFAULTS };

/** The rows as the engine takes them. */
export const debtList = (rows: DebtRow[]) =>
  rows.map((r) => ({ desc: r.desc, balance: parseNum(r.balance), apr: parseNum(r.apr), min: parseNum(r.min) }));

/** The plan the screen shows, null with nothing owed: both orderings and
    minimums only, the debts whose minimum doesn't cover their interest,
    what the chosen order saves against minimums, how the orderings differ,
    the blended rate, and the same plan with $100 a month more. */
export function debtCompute(s: DebtInputs) {
  const debts = debtList(s.rows);
  const extra = Math.max(0, parseNum(s.extra) || 0);
  const live = debts.filter((d) => d.balance > 0);
  if (!live.length) return { debts, extra, live, plan: null };
  const av = debtRun(debts, extra, "avalanche")!, sn = debtRun(debts, extra, "snowball")!, mn = debtRun(debts, 0, "min")!;
  const pick = s.mode === "snowball" ? sn : av;
  // A minimum that doesn't cover interest invalidates every number below it.
  const warn = debtUnderwater(debts).map((u) => u.desc);
  const saved = mn.totalInterest - pick.totalInterest;
  const sooner = mn.monthsTotal - pick.monthsTotal;
  const borrowed = live.reduce((a, d) => a + d.balance, 0);
  const dInt = sn.totalInterest - av.totalInterest, dMon = sn.monthsTotal - av.monthsTotal, dFirst = sn.firstCleared - av.firstCleared;
  const rate = live.reduce((a, d) => a + d.balance * d.apr, 0) / live.reduce((a, d) => a + d.balance, 0);
  // An extra dollar a month is the most underrated lever in the whole thing.
  const bump = debtRun(debts, extra + 100, s.mode);
  return { debts, extra, live, plan: { av, sn, mn, pick, warn, saved, sooner, borrowed, dInt, dMon, dFirst, rate, bump } };
}
