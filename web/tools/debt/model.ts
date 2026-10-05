/* The Debt Payoff tool's inputs. From src/js/app/18-debt.js. */
import type { ToolDef } from "@/components/tools/ToolState";
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
