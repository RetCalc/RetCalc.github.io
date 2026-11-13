/* The plan put through "If things go wrong" (stress.ts): each event on the
   plan's own Drawdown run (drawdownFor, the run behind the chance of
   success), or, for a year without work before retirement, the whole plan
   run again with that year in it (results() on a copy of the profile with
   hidden scenarios). Worked out after the page draws, and kept for the
   profile it was worked out for, so Plan summary and the Dashboard's
   Chance of success tile share one run. No React. */

import { drawdownSetup } from "@/tools/drawdown/model";
import type { DdOpts, DdPrep } from "@/lib/engine/typed-drawdown";
import { lumpShortfalls } from "./calc";
import { drawdownFor } from "./flows";
import { ageOf, holdings, nameOf, planYearsOf, results, type Results } from "./model";
import type { Scenario } from "./scenarios";
import type { TipId } from "./tips";
import { OUTSIDE_US, type Entry, type Person, type Profile } from "./store";
import {
  CARE_DEFAULT, SS_SHARE, SURVIVOR_AGE, SURVIVOR_SPEND, WORK_AGE, badStarts, careItems, coverFor, holds, runSet, ssCutItems, ssStreams, survivorRun, type RunSet,
} from "./stress";

export type StressId = "death" | "work" | "market" | "care" | "ss";
/** Each test's name, as the page and the report say it. */
export const STRESS_NAMES: Record<StressId, string> = {
  death: "A partner dies", work: "A year without work", market: "Retiring into a bad market", care: "Long-term care", ss: "Social Security pays less",
};
/** Each test's explanation (tips.ts), what it assumes. */
export const STRESS_TIPS: Record<StressId, TipId> = { death: "stressDeath", work: "stressWork", market: "stressMarket", care: "stressCare", ss: "stressSs" };

export interface StressTest {
  id: StressId;
  /** The plan with the event: its chance and the median market (null for
      the bad markets, which are single starts). */
  event: RunSet | null;
  holds: boolean;
  /** The calendar year it happens, and who's what age then. */
  year: number | null; age: number | null; who: string;
  /** A partner dies: the run with it, for the life insurance that covers it. */
  death?: { o: DdOpts; P: DdPrep; k: number };
  /** A year without work: whose pay stops (2 both), what that year's
      spending takes, and from where; savings at retirement with it. */
  work?: { whose: 0 | 1 | 2; need: number; cash: number; brok: number; ret: number; other: number; atRetire: number | null };
  /** A partner dies: the share of spending kept after. */
  spend?: number;
  /** Retiring into a bad market: each start the record covers. */
  starts?: { year: number; end: number; outAge: number | null }[];
  /** Long-term care, as tested. */
  care?: { amount: number; years: number; age: number };
  /** Social Security paid less: the share of each benefit tested, and
      whether the plan's own expected share already counts that much. */
  ss?: { share: number; already: boolean };
}

export interface Stress { base: RunSet; tests: StressTest[]; held: number; of: number }

/** Born, as a year with a fraction. */
const born = (p: Person) => (p.by ?? 0) + ((p.bm || 1) - 1) / 12;

/** The older of you (the only one, for one person). */
export function olderOf(pr: Profile): 0 | 1 {
  return pr.who === "couple" && pr.p2.by != null && pr.p1.by != null && born(pr.p2) < born(pr.p1) ? 1 : 0;
}

/** Each test's assumptions: as set on Plan summary, else the usual ones.
    death.age and work.age are the age of whoever it happens to (work: the
    first of you's, when both stop); spend and share are fractions. */
export interface StressAssume {
  death: { who: 0 | 1; age: number; spend: number };
  work: { who: 0 | 1 | 2; age: number };
  care: { amount: number; years: number; age: number };
  ss: { share: number };
}
export function stressAssume(pr: Profile): StressAssume {
  const s = pr.stress ?? {}, two = pr.who === "couple";
  const wWho = two ? s.work?.who ?? 2 : 0, wP = wWho === 1 ? pr.p2 : pr.p1, now = ageOf(wP);
  return {
    death: { who: two ? s.death?.who ?? olderOf(pr) : 0, age: s.death?.age ?? SURVIVOR_AGE, spend: s.death?.spend != null ? s.death.spend / 100 : SURVIVOR_SPEND },
    work: { who: wWho, age: s.work?.age ?? Math.max(WORK_AGE, now != null ? now + 1 : WORK_AGE) },
    care: { ...CARE_DEFAULT, ...s.care },
    ss: { share: s.ss?.share != null ? s.ss.share / 100 : SS_SHARE },
  };
}

/** The plan's run, as the chance of success comes from it. */
export function planRun(pr: Profile, R: Results): { o: DdOpts; P: DdPrep } | null {
  if (!R.S || !R.ddPlan) return null;
  const { o, P } = drawdownSetup(drawdownFor(pr, R.ddPlan));
  return { o, P };
}

const CACHE = new Map<string, Stress | null>();
const keyOf = (pr: Profile, entries: Entry[]) => JSON.stringify([pr, entries]);
/** Already worked out for this profile: the result, null when it can't run,
    or undefined when it hasn't been yet. */
export const stressCached = (pr: Profile, entries: Entry[]) => CACHE.get(keyOf(pr, entries));

/** Every test the plan can take. */
export function stressTests(pr: Profile, entries: Entry[], R: Results = results(pr, entries)): Stress | null {
  const key = keyOf(pr, entries);
  if (CACHE.has(key)) return CACHE.get(key)!;
  const out = run(pr, entries, R);
  if (CACHE.size > 12) CACHE.delete(CACHE.keys().next().value!);
  CACHE.set(key, out);
  return out;
}

function run(pr: Profile, entries: Entry[], R: Results): Stress | null {
  const plan = planRun(pr, R);
  if (!plan || R.retireYear == null || pr.p1.by == null) return null;
  const { o, P } = plan, base = runSet(o, P), abroad = pr.state === OUTSIDE_US;
  const two = pr.who === "couple" && pr.p2.by != null;
  const old = olderOf(pr), oldP = old ? pr.p2 : pr.p1, oldName = nameOf(pr, old), A = stressAssume(pr);
  const split: [number, number] = [R.ss1 ?? 0, R.ss2 ?? 0];
  // A year of retirement (0 the first) from one of you's age.
  const yearOf = (age: number, p: Person = oldP) => Math.max(0, Math.round(p.by! + age - R.retireYear!));
  const tests: StressTest[] = [];
  const add = (t: Omit<StressTest, "holds">, ok?: boolean) => tests.push({ ...t, holds: ok ?? (t.event ? holds(base.rate, t.event.rate) : false) });

  // A partner dies, at the age set (or your first year of retirement if later).
  if (two) {
    const dP = A.death.who ? pr.p2 : pr.p1, k = dP.by != null ? yearOf(A.death.age, dP) : o.years;
    if (k < o.years) {
      const S = survivorRun(o, P, k, split, A.death.spend), year = R.retireYear + k;
      add({ id: "death", event: runSet(S.o, S.P), year, age: year - dP.by!, who: nameOf(pr, A.death.who), death: { o: S.o, P: S.P, k }, spend: A.death.spend });
    }
  }

  // A year without work, before retirement.
  const w = yearOff(pr, entries);
  if (w) add(w);

  // Retiring into a bad market: holds up only if every start shown lasts.
  const starts = badStarts(o, P);
  if (starts.length) add({ id: "market", event: null, year: null, age: null, who: nameOf(pr, 0), starts }, starts.every((s) => s.outAge == null));

  // Long-term care, for the older of you.
  const c = { ...CARE_DEFAULT, ...pr.stress?.care }, kc = yearOf(c.age);
  if (c.amount > 0 && c.years > 0 && kc < o.years) {
    const year = R.retireYear + kc;
    add({ id: "care", event: runSet({ ...o, expenseItems: [...o.expenseItems, ...careItems(o, kc, c.amount, c.years)] }, P), year, age: year - oldP.by!, who: oldName, care: c });
  }

  // Social Security paid less: every benefit at the share set, from the day
  // it starts, after any share the plan already counts.
  const paid = ssStreams(o, split).some((s) => s.a > 0);
  if (!abroad && paid) {
    const scale = (pr.ss.pct ?? 100) / 100, share = scale > 0 ? Math.min(1, A.ss.share / scale) : 1;
    const already = share >= 1 - 1e-9;
    const event = already ? base : runSet({ ...o, expenseItems: [...o.expenseItems, ...ssCutItems(o, 0, share, split)] }, P);
    add({ id: "ss", event, year: null, age: null, who: nameOf(pr, 0), ss: { share: A.ss.share, already } });
  }

  return { base, tests, held: tests.filter((t) => t.holds).length, of: tests.length };
}

/** The year without work: at the age set (55, or next year if that's past,
    unless set), kept between next year and the last year of work. Whoever
    it's set for (either of you, or both) loses that year's pay, nothing is
    saved, and what the year's spending needs beyond what's still coming in
    after tax comes out of cash first, then the brokerage, then retirement
    accounts. Through the plan's own scenarios (hidden: ids
    starting "__"): a pay change of 100% less for each of you that year and
    Stop saving for it, so the plan follows from there (cover.ts: spending
    carries on when pay comes back), and lump sums taken out on that
    birthday. Null when it doesn't apply. */
export function yearOffProfile(pr: Profile, entries: Entry[], W = stressAssume(pr).work): { pr: Profile; at: number; age: number; whose: 0 | 1 | 2; need: number; cash: number; brok: number; other: number } | null {
  const whose = pr.who === "couple" ? W.who : 0, p = whose === 1 ? pr.p2 : pr.p1;
  const age = ageOf(pr.p1), own = ageOf(p), retire = p.retire;
  if (age == null || own == null || retire == null || pr.p1.retire == null) return null;
  // At their age, kept between next year and their last year of work; the
  // plan's years count by the first of you's age.
  const ageAt = Math.min(Math.max(Math.round(W.age), own + 1), retire - 1);
  if (ageAt < own + 1) return null;
  const at = ageAt + (age - own);
  if (at >= pr.p1.retire && whose !== 1) return null;
  const sc = (id: string, over: Partial<Scenario>): Scenario => ({ id, kind: "income", name: "", on: true, from: at, until: at + 1, mode: "pct", amount: -100, ramp: 0, acct: "auto", nominal: 0, ...over });
  // Without the pay, saving is stopped outright that year too (the plan
  // would otherwise still put in what an IRA allows).
  const off = [...(whose !== 1 ? [sc("__off0", { who: 0 })] : []), ...(whose !== 0 ? [sc("__off1", { who: 1 })] : []), sc("__offS", { kind: "saving", mode: "stop", amount: 0 })];
  const lump = (id: string, amount: number, acct: Scenario["acct"]) => sc(id, { kind: "lump", until: 0, mode: "amount", amount: -Math.round(amount), acct });
  const withLumps = (b: number, t: number): Profile => ({ ...pr, scenarios: [...(pr.scenarios ?? []), ...off, ...(b > 0.5 ? [lump("__offB", b, "brok")] : []), ...(t > 0.5 ? [lump("__offT", t, "trad")] : [])] });
  // The plan still puts in what it frees that year (children costing less
  // than today, a debt paid off) with nothing to pay it from: taken back
  // out with the year's spending, so nothing goes in.
  const Y0 = planYearsOf(withLumps(0, 0), entries).years.find((y) => y.age === at);
  const Y = planYearsOf(pr, entries).years.find((y) => y.age === at);
  if (!Y0 || !Y) return null;
  // The year's spending as the plan has it (with the pay stopped, the plan's
  // own "spending" that year is only what's left over), less what still
  // comes in after tax: other income, and the other one's pay when only one
  // stops.
  const other = Y0.other * 12, need = Math.max(0, (Y.spending - (Y0.income - Y0.taxes)) * 12);
  const cash = Math.min(need, Math.max(0, holdings(entries, pr).cash ?? 0));
  const putIn = (Object.values(Y0.saved).reduce((s, v) => s + v, 0) + Y0.match) * 12;
  let brok = need - cash, next = withLumps(brok + putIn, 0);
  // What the brokerage can't cover on the day comes from retirement accounts.
  const short = brok + putIn > 0.5 ? lumpShortfalls(next, entries, age).__offB : undefined;
  if (short) { const b = Math.max(0, short.have); next = withLumps(b, need - cash + putIn - b); brok = Math.max(0, b - putIn); }
  return { pr: next, at, age: ageAt, whose, need, cash, brok, other };
}

function yearOff(pr: Profile, entries: Entry[]): Omit<StressTest, "holds"> | null {
  const Y = yearOffProfile(pr, entries);
  if (!Y) return null;
  const R2 = results(Y.pr, entries), plan = planRun(Y.pr, R2);
  return {
    id: "work", event: plan ? runSet(plan.o, plan.P) : null, year: pr.p1.by! + Y.at, age: Y.age, who: nameOf(pr, Y.whose === 1 ? 1 : 0),
    work: { whose: Y.whose, need: Y.need, cash: Y.cash, brok: Y.brok, ret: Math.max(0, Y.need - Y.cash - Y.brok), other: Y.other, atRetire: R2.atRetire },
  };
}

const COVERS = new Map<string, number | null>();
/** Life insurance that would cover a partner's death: the one-time sum,
    paid that year, that brings the plan's chance back to its own. */
export function lifeCover(pr: Profile, entries: Entry[], S: Stress): number | null {
  const t = S.tests.find((x) => x.id === "death");
  if (!t?.death) return null;
  const key = keyOf(pr, entries);
  if (COVERS.has(key)) return COVERS.get(key)!;
  const { o, P, k } = t.death;
  const out = coverFor(o, P, k, S.base.rate, { start: Math.max(100000, P.initial / 4) });
  if (COVERS.size > 12) COVERS.delete(COVERS.keys().next().value!);
  COVERS.set(key, out);
  return out;
}
export const lifeCoverCached = (pr: Profile, entries: Entry[]) => COVERS.get(keyOf(pr, entries));
