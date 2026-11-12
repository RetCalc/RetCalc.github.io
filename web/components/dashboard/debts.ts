/* Debts being paid off: Net worth's Plan payments, and what they mean for
   the plan. Each planned debt is paid a set amount a month (the Debt Payoff
   tool's own engine works out when it's gone); with `roll`, a paid-off
   debt's payment goes on to the next, highest rate first. The mortgage is
   paid as Home has it.

   These payments are fixed in dollars, so in today's dollars they shrink a
   little each year, and they stop once the debt is paid off. What they
   free goes to saving (cover.ts), and once retired, a payment still being
   made is spending on top of the rest, until it ends (model.ts answers).
   A car loan to be replaced by the next one isn't counted as ending, nor
   is a card paid in full each month (that's spending, not a debt to pay
   down). No React. */

import { debtRun } from "@/lib/engine/typed";
import type { DdItem } from "@/lib/engine/typed-drawdown";
import type { DebtKind, DebtPay, Entry, Profile } from "./store";

/** The debts Plan payments covers: everything but the mortgage. */
export const PLAN_KINDS: readonly DebtKind[] = ["card", "student", "loan", "car"];

/** A planned debt as the plan runs it: the latest balance and rate, and its payment. */
export interface DebtLine { id: string; name: string; kind: DebtKind; balance: number; rate: number; pay: number }

/** The planned debts still owed on the latest entry, each paid down (not
    a card paid in full, nor a car loan to be replaced). */
export function planLines(pr: Profile, entries: Entry[]): DebtLine[] {
  const last = entries[entries.length - 1], P = pr.debtPlan;
  if (!last || !P) return [];
  return P.debts.flatMap((d) => {
    const it = last.items.find((i) => i.id === d.id && i.side === "debt");
    if (!it || !(it.value > 0) || d.full || (d.kind === "car" && d.replace) || !(d.pay > 0)) return [];
    return [{ id: d.id, name: it.name || d.name, kind: d.kind, balance: it.value, rate: it.rate ?? 0, pay: d.pay }];
  });
}

export interface Payoff {
  /** What's paid each month, in dollars, from month 1 (index 0); past the
      end, nothing (or `pool` a month on, when a debt never gets paid off). */
  months: number[]; pool: number;
  /** Each debt's month it's paid off (1 is next month), or null: never at its payment. */
  paid: Record<string, number | null>;
  /** Interest each debt costs on the way, and all of it. */
  interest: Record<string, number>; total: number;
  stalled: boolean;
}

/** Paying the debts down: each its own payment, and with `roll` a
    paid-off one's payment going on to the next (highest rate first). */
export function payoff(lines: DebtLine[], roll: boolean): Payoff {
  const live = lines.filter((l) => l.balance > 0 && l.pay > 0);
  const R = live.length ? debtRun(live.map((l) => ({ desc: l.id, balance: l.balance, apr: l.rate * 100, min: l.pay })), 0, roll ? "avalanche" : "min") : null;
  if (!R) return { months: [], pool: 0, paid: {}, interest: {}, total: 0, stalled: false };
  const M = R.months, months: number[] = [];
  for (let m = 1; m < M.length; m++) months.push(Math.max(0, M[m - 1].balance + (M[m].interest - M[m - 1].interest) - M[m].balance));
  const paid: Payoff["paid"] = {}, interest: Payoff["interest"] = {};
  for (const d of R.debts) { paid[d.desc] = d.paidMonth > 0 ? d.paidMonth : null; interest[d.desc] = d.interest; }
  // Stalled, the payments go on as long as anything's owed (without the roll, only those not paid off).
  const pool = R.stalled ? (roll ? R.monthlyPool : live.filter((l) => paid[l.id] == null).reduce((s, l) => s + l.pay, 0)) : 0;
  return { months, pool, paid, interest, total: R.totalInterest, stalled: R.stalled };
}

/** The mortgage's payment a month and the months left on it, from Home. */
export interface MortStream { pay: number; months: number }

export interface FixedYears {
  /** The payments a month today, in dollars. */
  today: number;
  /** Payments a month in plan year `k` (0 is the coming year), in today's dollars. */
  realAt: (k: number) => number;
  /** What's paid off in which plan year. */
  paidOff: { k: number; name: string }[];
}

/** The planned debts' and the mortgage's payments year by year, in
    today's dollars: each year's payments over (1 + inflation)^k. Plan
    year k is calendar year k from this one, as Year by year shows them:
    this year from this month (`month0`, 0 for January), paid as today. */
export function fixedYears(lines: DebtLine[], roll: boolean, mort: MortStream | null, infl: number, month0 = new Date().getMonth()): FixedYears {
  const P = payoff(lines, roll), mp = mort && mort.pay > 0 && mort.months > 0 ? mort : null;
  const today = lines.filter((l) => l.balance > 0).reduce((s, l) => s + l.pay, 0) + (mp ? mp.pay : 0);
  // Month m from now (0 this month, paid as today; 1 next month).
  const nominal = (m: number) => (m === 0 ? today : (m <= P.months.length ? P.months[m - 1] : P.pool) + (mp ? mp.pay * Math.max(0, Math.min(1, mp.months - (m - 1))) : 0));
  const yearOf = (m: number) => Math.floor((month0 + m) / 12);
  const cache: number[] = [];
  const realAt = (k: number) => {
    if (cache[k] != null) return cache[k];
    const from = Math.max(0, 12 * k - month0), to = 12 * k - month0 + 11;
    let s = 0;
    for (let m = from; m <= to; m++) s += nominal(m);
    return (cache[k] = s / (to - from + 1) / Math.pow(1 + infl, k));
  };
  const paidOff: FixedYears["paidOff"] = [];
  for (const l of lines) { const m = P.paid[l.id]; if (m != null) paidOff.push({ k: yearOf(m), name: l.name }); }
  if (mp) paidOff.push({ k: yearOf(Math.max(1, Math.ceil(mp.months))), name: "Mortgage" });
  return { today, realAt, paidOff: paidOff.sort((a, b) => a.k - b.k) };
}

/** A payment's interest alone, a month: paying less never pays it off. */
export const interestOnly = (balance: number, rate: number) => (balance * rate) / 12;

/** The plan's payments laid out for a debt list as Plan payments edits it. */
export const linesOf = (debts: (DebtPay & { balance: number; rate: number })[]): DebtLine[] =>
  debts.filter((d) => !d.full && !(d.kind === "car" && d.replace) && d.balance > 0 && d.pay > 0)
    .map((d) => ({ id: d.id, name: d.name, kind: d.kind, balance: d.balance, rate: d.rate, pay: d.pay }));

/** Loan payments still being made once retired (debts, the mortgage), as
    the Drawdown's future expenses: `extra` is each year's payments in
    today's dollars from the first year retired; in the Drawdown, a fixed
    amount is in dollars of the first year retired and inflation wears it
    down from there, so each year is put back in those dollars, and years
    at the same amount are one expense. */
export function loanItems(extra: number[], infl: number, years: number, tag: string): DdItem[] {
  const lvl = extra.slice(0, Math.max(0, Math.round(years))).map((v, j) => Math.round(v * Math.pow(1 + infl, j) / 10) * 10);
  const out: DdItem[] = [];
  for (let j = 0; j < lvl.length; ) {
    let n = 1;
    // (Within rounding of the same: one fixed payment, put back in dollars of the first year retired.)
    while (j + n < lvl.length && Math.abs(lvl[j + n] - lvl[j]) <= Math.max(20, lvl[j] * 0.002)) n++;
    if (lvl[j] > 0) out.push({ name: "Loan payments" + tag, annual: lvl[j], inflate: false, startYear: j + 1, duration: { type: "years", years: n } });
    j += n;
  }
  return out;
}
