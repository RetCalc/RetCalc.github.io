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
  CARE_DEFAULT, SS_CUT, SURVIVOR_AGE, badStarts, careItems, coverFor, holds, runSet, ssCutItems, ssStreams, survivorRun, type RunSet,
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
  /** A year without work: what that year's spending takes, and from where;
      savings at retirement with it. */
  work?: { need: number; cash: number; brok: number; ret: number; other: number; atRetire: number | null };
  /** Retiring into a bad market: each start the record covers. */
  starts?: { year: number; end: number; outAge: number | null }[];
  /** Long-term care, as tested. */
  care?: { amount: number; years: number; age: number };
  /** Social Security paid less: the share of today's benefit paid from
      SS_CUT.year, after any share the plan already counts. */
  ss?: { share: number; already: boolean };
}

export interface Stress { base: RunSet; tests: StressTest[]; held: number; of: number }

/** Born, as a year with a fraction. */
const born = (p: Person) => (p.by ?? 0) + ((p.bm || 1) - 1) / 12;

/** The older of you (the only one, for one person). */
export function olderOf(pr: Profile): 0 | 1 {
  return pr.who === "couple" && pr.p2.by != null && pr.p1.by != null && born(pr.p2) < born(pr.p1) ? 1 : 0;
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
  const old = olderOf(pr), oldP = old ? pr.p2 : pr.p1, oldName = nameOf(pr, old);
  const split: [number, number] = [R.ss1 ?? 0, R.ss2 ?? 0];
  // A year of retirement (0 the first) from the older of you's age.
  const yearOf = (age: number) => Math.max(0, Math.round(oldP.by! + age - R.retireYear!));
  const tests: StressTest[] = [];
  const add = (t: Omit<StressTest, "holds">, ok?: boolean) => tests.push({ ...t, holds: ok ?? (t.event ? holds(base.rate, t.event.rate) : false) });

  // A partner dies, at 75 of the older of you, or your first year of retirement if later.
  if (two) {
    const k = yearOf(SURVIVOR_AGE);
    if (k < o.years) {
      const S = survivorRun(o, P, k, split), year = R.retireYear + k;
      add({ id: "death", event: runSet(S.o, S.P), year, age: year - oldP.by!, who: oldName, death: { o: S.o, P: S.P, k } });
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

  // Social Security paid less from 2034, after any share the plan already counts.
  const paid = ssStreams(o, split).some((s) => s.a > 0);
  if (!abroad && paid) {
    const scale = (pr.ss.pct ?? 100) / 100, share = scale > 0 ? Math.min(1, SS_CUT.share / scale) : 1;
    const k = Math.max(0, SS_CUT.year - R.retireYear), already = share >= 1 - 1e-9;
    const event = already ? base : runSet({ ...o, expenseItems: [...o.expenseItems, ...ssCutItems(o, k, share, split)] }, P);
    add({ id: "ss", event, year: SS_CUT.year, age: SS_CUT.year - pr.p1.by, who: nameOf(pr, 0), ss: { share: SS_CUT.share, already } });
  }

  return { base, tests, held: tests.filter((t) => t.holds).length, of: tests.length };
}

/** The year without work: at 55 (or next year, if that's past), but never
    after your last year of work. Everyone still working loses that year's
    pay, nothing is saved, and the year's spending (as the plan has it,
    less any other income) comes out of cash first, then the brokerage,
    then retirement accounts. Through the plan's own scenarios (hidden: ids
    starting "__"): a pay change of 100% less for each of you that year and
    Stop saving for it, so the plan follows from there (cover.ts: spending
    carries on when pay comes back), and lump sums taken out on that
    birthday. Null when it doesn't apply. */
export function yearOffProfile(pr: Profile, entries: Entry[]): { pr: Profile; at: number; need: number; cash: number; brok: number; other: number } | null {
  const age = ageOf(pr.p1), retire = pr.p1.retire;
  if (age == null || retire == null) return null;
  const at = Math.min(Math.max(55, age + 1), retire - 1);
  if (at < age + 1) return null;
  const Y = planYearsOf(pr, entries).years.find((y) => y.age === at);
  if (!Y) return null;
  const other = Y.other * 12, need = Math.max(0, Y.spending * 12 - other);
  const cash = Math.min(need, Math.max(0, holdings(entries, pr).cash ?? 0));
  const sc = (id: string, over: Partial<Scenario>): Scenario => ({ id, kind: "income", name: "", on: true, from: at, until: at + 1, mode: "pct", amount: -100, ramp: 0, acct: "auto", nominal: 0, ...over });
  // With no pay the plan would still put in what an IRA allows, so saving
  // is stopped outright that year too.
  const off = [sc("__off0", { who: 0 }), ...(pr.who === "couple" ? [sc("__off1", { who: 1 })] : []), sc("__offS", { kind: "saving", mode: "stop", amount: 0 })];
  const lump = (id: string, amount: number, acct: Scenario["acct"]) => sc(id, { kind: "lump", until: 0, mode: "amount", amount: -Math.round(amount), acct });
  const withLumps = (b: number, t: number): Profile => ({ ...pr, scenarios: [...(pr.scenarios ?? []), ...off, ...(b > 0.5 ? [lump("__offB", b, "brok")] : []), ...(t > 0.5 ? [lump("__offT", t, "trad")] : [])] });
  // The plan still puts in what it frees that year (children costing less
  // than today, a debt paid off) with nothing to pay it from: taken back
  // out with the year's spending, so nothing goes in.
  const Y0 = planYearsOf(withLumps(0, 0), entries).years.find((y) => y.age === at);
  const putIn = Y0 ? (Object.values(Y0.saved).reduce((s, v) => s + v, 0) + Y0.match) * 12 : 0;
  let brok = need - cash, next = withLumps(brok + putIn, 0);
  // What the brokerage can't cover on the day comes from retirement accounts.
  const short = brok + putIn > 0.5 ? lumpShortfalls(next, entries, age).__offB : undefined;
  if (short) { const b = Math.max(0, short.have); next = withLumps(b, need - cash + putIn - b); brok = Math.max(0, b - putIn); }
  return { pr: next, at, need, cash, brok, other };
}

function yearOff(pr: Profile, entries: Entry[]): Omit<StressTest, "holds"> | null {
  const Y = yearOffProfile(pr, entries);
  if (!Y) return null;
  const R2 = results(Y.pr, entries), plan = planRun(Y.pr, R2);
  return {
    id: "work", event: plan ? runSet(plan.o, plan.P) : null, year: pr.p1.by! + Y.at, age: Y.at, who: nameOf(pr, 0),
    work: { need: Y.need, cash: Y.cash, brok: Y.brok, ret: Math.max(0, Y.need - Y.cash - Y.brok), other: Y.other, atRetire: R2.atRetire },
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
