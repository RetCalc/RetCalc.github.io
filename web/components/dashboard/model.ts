/* The Dashboard's numbers. The profile and the latest entry become the
   Retirement Readiness Guide's answers, so every figure comes from the same
   engine the Guide and the tools use: the plan across every historical
   retirement, its chance of lasting, the readiness score's five areas,
   Social Security, take-home pay and the withdrawal strategies. Nothing
   here is a separate model. */

import { FACTORS, STRATS, retPath, score, sim, strats, taxEst, type FactorId, type Part, type Sim, type StratResult } from "@/tools/guide/calc";
import type { Answers } from "@/tools/guide/store";
import { OUTSIDE_US, PER_YEAR, hasAccounts, netWorth, sum, type Entry, type Person, type Profile } from "./store";

/** Take-home is about this share of pay before taxes, when only one is known. */
const NET_SHARE = 0.76;

/** Now, as a year with a fraction (October 2026 is 2026.75). */
export function nowYear(d = new Date()): number {
  return d.getFullYear() + d.getMonth() / 12;
}
/** An entry's date as a year with a fraction. */
export const entryYear = (e: Entry) => Number(e.date.slice(0, 4)) + (Number(e.date.slice(5, 7)) - 1) / 12 + (Number(e.date.slice(8, 10)) - 1) / 365;

/** Age today, in whole years, from the birth month and year. */
export function ageOf(p: Pick<Person, "bm" | "by">, d = new Date()): number | null {
  if (!p.by) return null;
  const months = (d.getFullYear() - p.by) * 12 + d.getMonth() + 1 - (p.bm || 1);
  return Math.floor(months / 12);
}
/** The year someone reaches an age. */
export const yearAt = (p: Pick<Person, "by">, age: number) => (p.by ?? 0) + age;

export const outsideUS = (pr: Profile) => pr.state === OUTSIDE_US;
/** Pay over a year, as entered (before or after taxes). */
export const payYear = (p: Person) => (p.pay == null ? null : p.pay * PER_YEAR[p.per]);
/** Pay over a year before taxes: as entered, or worked back from take-home. */
export const grossYear = (p: Person) => { const y = payYear(p); return y == null ? null : p.taxed === "after" ? y / NET_SHARE : y; };

export const couple = (pr: Profile) => pr.who === "couple";
export const people = (pr: Profile): Person[] => (couple(pr) ? [pr.p1, pr.p2] : [pr.p1]);
export const nameOf = (pr: Profile, i: 0 | 1) => (i ? pr.p2 : pr.p1).name.trim() || (i ? "Your partner" : "You");
export const contribMonth = (pr: Profile) => (pr.contrib == null ? null : (pr.contrib * PER_YEAR[pr.cper]) / 12);
export const otherMonth = (pr: Profile) => pr.other.reduce((s, o) => s + (o.amount ?? 0), 0);
export const budgetMonth = (pr: Profile) => pr.budget.reduce((s, b) => s + (b.amount ?? 0), 0);
/** Spending per month: the budget's total when it's in use, else setup's number. */
export const spendMonth = (pr: Profile) => (pr.useBudget && pr.budget.length ? budgetMonth(pr) : pr.spend);
/** Growth after inflation, per year. */
export const realGrowth = (pr: Profile) => (1 + pr.assume.growth) / (1 + pr.assume.inflation) - 1;

/** Where the latest entry's money sits, for the plan. */
export function holdings(entries: Entry[], pr: Profile) {
  const last = entries[entries.length - 1];
  if (!last) {
    const eq = pr.home === "own" ? (pr.value ?? 0) - (pr.owed ?? 0) : 0;
    return { trad: pr.saved ?? 0, roth: 0, brok: 0, cash: null, other: 0, home: pr.home === "own" ? pr.value ?? 0 : 0, mortgage: pr.home === "own" ? pr.owed ?? 0 : 0, equity: eq, debts: 0, debtsHigh: 0, accounts: false, total: (pr.saved ?? 0) + eq };
  }
  const it = last.items, accounts = hasAccounts(entries);
  const home = sum(it, "asset", ["home"]), mortgage = sum(it, "debt", ["mortgage"]);
  const debts = sum(it, "debt") - mortgage;
  const debtsHigh = it.filter((i) => i.side === "debt" && i.kind !== "mortgage" && (i.rate ?? 0) >= 0.08).reduce((s, i) => s + i.value, 0);
  return {
    trad: sum(it, "asset", ["workplace", "ira"]), roth: sum(it, "asset", ["roth", "hsa"]), brok: sum(it, "asset", ["brokerage"]),
    cash: accounts ? sum(it, "asset", ["cash"]) : null, other: sum(it, "asset", ["other"]),
    home, mortgage, equity: home - mortgage, debts, debtsHigh, accounts, total: netWorth(last),
  };
}

/** The profile and latest entry as the Guide's answers. */
export function answers(pr: Profile, entries: Entry[] = []): Answers {
  const two = couple(pr), abroad = outsideUS(pr), H = holdings(entries, pr);
  const spend = spendMonth(pr);
  const saved = H.trad + H.roth + H.brok;
  const a: Answers = {
    status: two ? "m" : "s",
    // Outside the US the plan still needs a state to run; its taxes are
    // kept out below (all savings tax-free, no Social Security, no US
    // marketplace premiums).
    state: abroad || !pr.state ? "IL" : pr.state,
    age: ageOf(pr.p1), spouseAge: two ? ageOf(pr.p2) : null, retire: pr.p1.retire,
    income: grossYear(pr.p1), income2: two ? grossYear(pr.p2) : null,
    saved: pr.saved == null && !entries.length ? null : saved,
    rothNow: abroad ? saved : H.roth, brokNow: abroad ? 0 : H.brok,
    contrib: contribMonth(pr), employer: pr.employer ?? 0, match: pr.match ?? "none",
    spend, retSpend: (pr.retSpend ?? spend) == null ? null : (pr.retSpend ?? spend)! * 12,
    home: pr.home, risk: realGrowth(pr), retMix: pr.assume.stocks,
    ssClaim: pr.ss.claim, ssOwn: pr.ss.own1, ssOwn2: two ? pr.ss.own2 : null,
  };
  if (abroad) Object.assign(a, { splitTrad: 0, splitRoth: 100, splitBrok: 0, ssOwn: 1e-6, ssOwn2: two ? 1e-6 : null, hcIncl: "yes" });
  if (H.cash != null) a.cash = H.cash;
  if (H.accounts) Object.assign(a, H.debts > 0 ? { debtHas: "yes", debtTotal: H.debts, debtHi: H.debtsHigh } : { debtHas: "no" });
  // Take-home: as entered for whoever gave it, worked out for whoever
  // didn't (not outside the US), plus other income.
  const after = people(pr).filter((p) => abroad || p.taxed === "after").reduce((s, p) => s + (payYear(p) ?? 0), 0) / 12;
  const anyBefore = !abroad && people(pr).some((p) => p.taxed === "before" && p.pay != null);
  const before = anyBefore ? taxEst({ ...a, income: pr.p1.taxed === "before" ? a.income : 0, income2: two && pr.p2.taxed === "before" ? a.income2 : 0 }) : 0;
  const th = after + before + otherMonth(pr);
  if (th > 0) a.takehome = th;
  return a;
}

export interface Point { t: number; v: number; lo: number; hi: number }
export interface Results {
  S: Sim | null;
  /** Share of historical retirements that lasted, 0 to 1. */
  success: number | null;
  score: number | null;
  /** Each scored area, by the Guide's ids; an area missing isn't scored yet. */
  parts: Partial<Record<FactorId, Part>>;
  partial: boolean;
  /** Per month, in today's dollars. */
  savingsIncome: number | null; ss: number | null; takehome: number | null;
  /** Each person's Social Security per month once claimed, and the ages. */
  ss1: number | null; ss2: number | null; claim1: number | null; claim2: number | null;
  /** Savings at retirement, and the year it begins. */
  atRetire: number | null; retireYear: number | null;
  /** Net worth over the years: savings steady to retirement, then the middle
      of history with its 10th and 90th percentile, plus the home's equity. */
  path: Point[];
  equity: number;
  /** Months of spending in cash, once accounts are in. */
  cushion: number | null;
  /** The chosen withdrawal strategy across history. */
  strategy: StratResult | null;
  abroad: boolean;
}

export function results(pr: Profile, entries: Entry[]): Results {
  const a = answers(pr, entries), S = sim(a);
  const sc = score(a, S), H = holdings(entries, pr), abroad = outsideUS(pr);
  const equity = H.equity + H.other + (H.cash ?? 0) - H.debts;
  const path: Point[] = [];
  let retireYear: number | null = null;
  if (S && a.age != null) {
    const now = nowYear(), toRet = S.retire - a.age;
    retireYear = pr.p1.by != null ? pr.p1.by + S.retire : Math.round(now + toRet);
    S.path.forEach((v, i) => { if (i <= toRet) path.push({ t: now + i, v: v + equity, lo: v + equity, hi: v + equity }); });
    retPath(S).forEach((b, y) => path.push({ t: now + toRet + y + 1, v: b.p50 + equity, lo: b.p10 + equity, hi: b.p90 + equity }));
  }
  const spend = spendMonth(pr);
  const chosen = S && pr.strategy ? strats(a, S).find((r) => r.st.id === pr.strategy) ?? null : null;
  return {
    S, success: S ? S.success : null, score: sc.score, parts: sc.P,
    partial: FACTORS.some((f) => !sc.P[f.id]),
    savingsIncome: S ? S.portIncome / 12 : null, ss: S && !abroad ? S.ss.total / 12 : null,
    ss1: S && !abroad ? S.ss.a1 / 12 : null, ss2: S && !abroad && couple(pr) ? S.ss.a2 / 12 : null,
    claim1: S ? S.ss.claim : null, claim2: S && couple(pr) ? S.ss.claim2 : null,
    takehome: a.takehome ?? null,
    atRetire: S ? S.fv : null, retireYear, path, equity,
    cushion: H.cash != null && spend ? H.cash / spend : null,
    strategy: chosen, abroad,
  };
}

/** The mortgage: what's left (latest entry), its rate and payment, and
    when it's paid off at that payment. */
export function mortgage(pr: Profile, entries: Entry[]) {
  const H = holdings(entries, pr), last = entries[entries.length - 1];
  const item = last?.items.find((i) => i.side === "debt" && i.kind === "mortgage");
  const rate = pr.mortRate ?? item?.rate ?? null, pay = pr.mortPay, owed = H.mortgage;
  let months: number | null = null, interest: number | null = null;
  if (owed > 0 && pay && pay > 0) {
    const r = (rate ?? 0) / 12;
    if (r === 0) months = Math.ceil(owed / pay);
    else if (pay > owed * r) months = Math.ceil(-Math.log(1 - (r * owed) / pay) / Math.log(1 + r));
    if (months != null) interest = Math.max(0, months * pay - owed);
  }
  const payoff = months != null ? nowYear() + months / 12 : null;
  return { owed, value: H.home, rate, pay, months, interest, payoff, tooSmall: owed > 0 && !!pay && months == null };
}

/** Net worth at each entry, as chart points. */
export const history = (entries: Entry[]) => entries.map((e) => ({ t: entryYear(e), v: netWorth(e), date: e.date }));

/** Every strategy across history, for choosing one. */
export function allStrategies(pr: Profile, entries: Entry[]): StratResult[] {
  const a = answers(pr, entries), S = sim(a);
  return S ? strats(a, S) : [];
}

export { FACTORS, STRATS };
