/* The Dashboard's numbers. The profile becomes the Retirement Readiness
   Guide's answers, so every figure comes from the same engine the Guide and
   the tools use: the plan across every historical retirement, its chance of
   lasting, the readiness score's five areas, Social Security and take-home
   pay. Nothing here is a separate model. */

import { FACTORS, retPath, score, sim, taxEst, type FactorId, type Part, type Sim } from "@/tools/guide/calc";
import type { Answers } from "@/tools/guide/store";
import { PER_YEAR, netWorth, type Entry, type Person, type Profile } from "./store";

/** Where the plan's taxes are figured until the profile asks for a state:
    the same stand-in the Guide's plan uses. */
const STATE = "IL";
/** Take-home is about this share of pay before taxes, when only one is known. */
const NET_SHARE = 0.76;

/** Now, as a year with a fraction (October 2026 is 2026.75). */
export function nowYear(d = new Date()): number {
  return d.getFullYear() + d.getMonth() / 12;
}
/** An entry's date as a year with a fraction. */
export const entryYear = (e: Entry) => Number(e.date.slice(0, 4)) + (Number(e.date.slice(5, 7)) - 1) / 12;

/** Age today, in whole years, from the birth month and year. */
export function ageOf(p: Pick<Person, "bm" | "by">, d = new Date()): number | null {
  if (!p.by) return null;
  const months = (d.getFullYear() - p.by) * 12 + d.getMonth() + 1 - (p.bm || 1);
  return Math.floor(months / 12);
}
/** The year someone reaches an age. */
export const yearAt = (p: Pick<Person, "by">, age: number) => (p.by ?? 0) + age;

/** Pay over a year, as entered (before or after taxes). */
export const payYear = (p: Person) => (p.pay == null ? null : p.pay * PER_YEAR[p.per]);
/** Pay over a year before taxes: as entered, or worked back from take-home. */
export const grossYear = (p: Person) => { const y = payYear(p); return y == null ? null : p.taxed === "after" ? y / NET_SHARE : y; };

export const couple = (pr: Profile) => pr.who === "couple";
export const people = (pr: Profile): Person[] => (couple(pr) ? [pr.p1, pr.p2] : [pr.p1]);
export const contribMonth = (pr: Profile) => (pr.contrib == null ? null : (pr.contrib * PER_YEAR[pr.cper]) / 12);

/** The profile as the Guide's answers. */
export function answers(pr: Profile): Answers {
  const two = couple(pr);
  const a: Answers = {
    status: two ? "m" : "s", state: STATE,
    age: ageOf(pr.p1), spouseAge: two ? ageOf(pr.p2) : null, retire: pr.p1.retire,
    income: grossYear(pr.p1), income2: two ? grossYear(pr.p2) : null,
    saved: pr.saved, contrib: contribMonth(pr), employer: 0, match: "none",
    spend: pr.spend, retSpend: pr.spend == null ? null : pr.spend * 12,
    home: pr.home,
  };
  // Take-home: as entered for whoever gave it, worked out for whoever didn't.
  const after = people(pr).filter((p) => p.taxed === "after").reduce((s, p) => s + (payYear(p) ?? 0), 0) / 12;
  const allAfter = people(pr).every((p) => p.taxed === "after");
  const before = allAfter ? 0 : taxEst({ ...a, income: pr.p1.taxed === "before" ? a.income : 0, income2: two && pr.p2.taxed === "before" ? a.income2 : 0 });
  const th = after + before;
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
  /** Savings at retirement, and the year it begins. */
  atRetire: number | null; retireYear: number | null;
  /** Savings over the years, plus today's home equity: steady to retirement,
      then the middle of history with its 10th and 90th percentile. */
  path: Point[];
  equity: number;
}

export function results(pr: Profile, entries: Entry[]): Results {
  const a = answers(pr), S = sim(a);
  const sc = score(a, S);
  const last = entries[entries.length - 1];
  const equity = last ? last.value - last.owed : pr.home === "own" ? (pr.value ?? 0) - (pr.owed ?? 0) : 0;
  const path: Point[] = [];
  let retireYear: number | null = null;
  if (S && a.age != null) {
    const now = nowYear(), toRet = S.retire - a.age;
    retireYear = pr.p1.by != null ? pr.p1.by + S.retire : Math.round(now + toRet);
    S.path.forEach((v, i) => { if (i <= toRet) path.push({ t: now + i, v: v + equity, lo: v + equity, hi: v + equity }); });
    retPath(S).forEach((b, y) => path.push({ t: now + toRet + y + 1, v: b.p50 + equity, lo: b.p10 + equity, hi: b.p90 + equity }));
  }
  return {
    S, success: S ? S.success : null, score: sc.score, parts: sc.P,
    partial: FACTORS.some((f) => !sc.P[f.id]),
    savingsIncome: S ? S.portIncome / 12 : null, ss: S ? S.ss.total / 12 : null,
    takehome: a.takehome ?? null,
    atRetire: S ? S.fv : null, retireYear, path, equity,
  };
}

/** Net worth at each entry, as chart points. */
export const history = (entries: Entry[]) => entries.map((e) => ({ t: entryYear(e), v: netWorth(e) }));

export { FACTORS };
