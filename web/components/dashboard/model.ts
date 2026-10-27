/* The Dashboard's numbers. The profile and the latest entry become the
   Retirement Readiness Guide's answers, so every figure comes from the same
   engine the Guide and the tools use: the plan across every historical
   retirement, its chance of lasting, the readiness score's five areas,
   Social Security, take-home pay and the withdrawal strategies. Nothing
   here is a separate model. */

import { FACTORS, STRATS, retPath, score, sim, strats, type FactorId, type Part, type Sim, type StratResult } from "@/tools/guide/calc";
import type { Answers } from "@/tools/guide/store";
import { parseNum } from "@/lib/format";
import { budgetFor, drawdownFor, drawdownSuccess, flow, personSaving, retireMix, savingAt, stocksOf, taxState } from "./flows";
import { paycheckInput } from "@/tools/budget/paycheck-math";
import { collegeKid, collegeNeedOf, collegeYears } from "./college";
import { yearlySaving } from "./cover";
import { calcFvOf } from "./calc";
import { payoffDrop } from "./housing";
import { BRIDGE_DOCK, hasBridgePlan, needsBridge } from "./bridge";
import { drawdownSetup } from "@/tools/drawdown/model";
import { DD_STRAT_NAMES } from "@/tools/drawdown/text";
import { OUTSIDE_US, PER_YEAR, hasAccounts, netWorth, sum, type Entry, type Person, type Profile } from "./store";
import { ownerOf } from "./kinds";

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
/** Spending per month: the budget's lines (setup's one number is one of
    them), less premiums the paycheck already takes out of pay. */
export const spendMonth = (pr: Profile): number | null => { const t = paycheckInput(budgetFor(pr), taxState(pr)).spendYear / 12; return t > 0 ? t : pr.spend; };
/** Growth after inflation, per year. */
export const realGrowth = (pr: Profile) => (1 + pr.assume.growth) / (1 + pr.assume.inflation) - 1;

/** Where the latest entry's money sits, for the plan. */
export function holdings(entries: Entry[], pr: Profile) {
  const last = entries[entries.length - 1];
  if (!last) {
    const eq = pr.home === "own" ? (pr.value ?? 0) - (pr.owed ?? 0) : 0;
    return { trad: pr.saved ?? 0, g457: 0, tradBy: [(pr.saved ?? 0) / 2, (pr.saved ?? 0) / 2] as [number, number], workBy: [0, 0] as [number, number], roth: 0, brok: 0, rothBasis: null, brokBasis: null, cash: null, other: 0, home: pr.home === "own" ? pr.value ?? 0 : 0, mortgage: pr.home === "own" ? pr.owed ?? 0 : 0, equity: eq, debts: 0, debtsHigh: 0, accounts: false, total: (pr.saved ?? 0) + eq };
  }
  const it = last.items, accounts = hasAccounts(entries);
  const home = sum(it, "asset", ["home"]), mortgage = sum(it, "debt", ["mortgage"]);
  const debts = sum(it, "debt") - mortgage;
  const debtsHigh = it.filter((i) => i.side === "debt" && i.kind !== "mortgage" && (i.rate ?? 0) >= 0.08).reduce((s, i) => s + i.value, 0);
  // What was put in, when it's given for every account of the kind (a
  // Roth's contributions, a brokerage account's cost basis); null otherwise.
  // A Roth's contributions can't be more than it holds; a cost basis can (a loss).
  const basisOf = (kind: string) => { const xs = it.filter((i) => i.side === "asset" && i.kind === kind && i.value > 0); return xs.length && xs.every((i) => i.basis != null) ? xs.reduce((s, i) => s + (kind === "roth" ? Math.min(i.value, i.basis!) : i.basis!), 0) : null; };
  // A couple's traditional accounts (not a 457(b)) by whose they are, and
  // the workplace plans among them; one not said is half each.
  const names: [string, string] | null = couple(pr) ? [pr.p1.name, pr.p2.name] : null;
  const by = (kinds: string[]): [number, number] => {
    const o: [number, number] = [0, 0];
    for (const i of it) {
      if (i.side !== "asset" || !kinds.includes(i.kind)) continue;
      const w = ownerOf(i, names), v = i.value || 0;
      if (w == null) { o[0] += v / 2; o[1] += v / 2; } else o[w] += v;
    }
    return o;
  };
  return {
    trad: sum(it, "asset", ["workplace", "g457", "ira"]), g457: sum(it, "asset", ["g457"]),
    tradBy: by(["workplace", "ira"]), workBy: by(["workplace"]), roth: sum(it, "asset", ["roth", "hsa"]), brok: sum(it, "asset", ["brokerage"]),
    rothBasis: basisOf("roth"), brokBasis: basisOf("brokerage"),
    cash: accounts ? sum(it, "asset", ["cash"]) : null, other: sum(it, "asset", ["other"]),
    home, mortgage, equity: home - mortgage, debts, debtsHigh, accounts, total: netWorth(last),
  };
}

/** When your partner stops work against when you retire: the year, and
    whether it's before you (they stop saving then) or after (they keep
    working, `years` past your retirement). Null for one person, the same
    year, or before both ages are in. */
export function partnerStop(pr: Profile): { year: number; before: boolean; years: number } | null {
  if (!couple(pr)) return null;
  const { p1, p2 } = pr;
  if (p1.by == null || p1.retire == null || p2.by == null || p2.retire == null) return null;
  const r1 = p1.by + p1.retire, r2 = p2.by + p2.retire;
  return r2 === r1 ? null : { year: r2, before: r2 < r1, years: Math.abs(r2 - r1) };
}

/** The profile and latest entry as the Guide's answers. */
export function answers(pr: Profile, entries: Entry[] = []): Answers {
  const two = couple(pr), abroad = outsideUS(pr), H = holdings(entries, pr);
  const F = flow(pr);
  const spend = F.spendPaid > 0 ? F.spendPaid : pr.spend;
  const saved = H.trad + H.roth + H.brok;
  // Spending once retired, left blank, follows today's, which pays the
  // mortgage: paid off by retirement, the payment comes out of it.
  const drop = pr.retSpend == null ? payoffDrop(pr, entries) : null;
  const retYear = pr.p1.by != null && pr.p1.retire != null ? pr.p1.by + pr.p1.retire : null;
  const paidOff = drop && retYear != null && drop.year <= retYear ? drop.monthly : 0;
  const retSpend = pr.retSpend ?? (spend == null ? null : Math.max(0, spend - paidOff));
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
    contrib: F.hasPay ? F.invested : contribMonth(pr), employer: F.hasPay ? F.match : 0,
    match: F.fullMatch == null ? "none" : F.fullMatch ? "full" : "partial",
    spend, retSpend: retSpend == null ? null : retSpend * 12,
    home: pr.home, risk: realGrowth(pr), retMix: stocksOf(retireMix(pr)),
    ssClaim: pr.ss.claim, ssOwn: pr.ss.own1, ssOwn2: two ? pr.ss.own2 : null,
  };
  // The mix once retired, in full when it's more than stocks and bonds.
  const mix = retireMix(pr);
  if (mix.sv > 0 || mix.cash > 0 || mix.end != null) a.retMixAll = mix;
  // What was put in, when the accounts say: Roth contributions, cost basis.
  if (H.rothBasis != null) a.rothBasisNow = H.rothBasis;
  if (H.brokBasis != null) a.brokBasisNow = H.brokBasis;
  // The share of Social Security expected.
  if (pr.ss.pct != null && pr.ss.pct < 100) a.ssScale = pr.ss.pct / 100;
  // Where each month's saving goes, by how it's taxed.
  if (F?.hasPay && F.invested > 0) Object.assign(a, { splitTrad: (F.trad / F.invested) * 100, splitRoth: (F.roth / F.invested) * 100, splitBrok: (F.brok / F.invested) * 100 });
  // Changes ahead: saving that grows (each line to its limit), children
  // (the Guide's own costs by age, above what's spent on them today) and
  // college, each taking from what's saved in the years it runs.
  const events: NonNullable<Answers["events"]> = [];
  if (F?.hasPay && a.age != null && a.retire != null) {
    let before = savingAt(pr, 0, F);
    for (let k = 1; k < Math.min(45, a.retire - a.age); k++) {
      const now = savingAt(pr, k, F);
      if (now - before > 0.5) events.push({ id: "grow" + k, kind: "raise", at: a.age + k, extra: now - before });
      before = now;
    }
  }
  const kids = pr.kidList.slice(0, pr.kids).filter((k) => k.by).map((k) => ageOf(k)!).filter((x) => x >= 0 && x < 30);
  if (kids.length) a.kidsNow = kids;
  if (pr.planned.count > 0) Object.assign(a, { kidsPlanned: pr.planned.count, firstIn: pr.planned.firstIn, spacing: pr.planned.spacing });
  if (kids.length || pr.planned.count > 0) {
    const C = pr.childCosts, n = (v: string) => (v.trim() === "" ? null : parseNum(v));
    Object.assign(a, { childcare: pr.childcare, careArea: pr.careArea, college: pr.college.help === "none" ? "no" : "yes",
      childEarly: n(C.early), childSchool: n(C.school), childTeen: n(C.teen), childLater: n(C.later) == null ? null : n(C.later)! / 100 });
  }
  // College, a month in each year from now, as well as an event for its words.
  const college: number[] = [];
  if (pr.college.help !== "none" && a.age != null) {
    // Saved ahead in the budget: that share of college is paid from it, not
    // from saving in the college years.
    const need = collegeNeedOf(pr), ahead = need > 0 ? Math.min(1, F.college / need) : 0;
    // Applied from College Savings: tuition's own inflation beyond prices in
    // general (the plan is in today's dollars), and what's already saved,
    // growing at its return until it pays the first bills.
    const P = pr.college.plan, infl = pr.assume.inflation;
    const realT = P ? (1 + P.infl / 100) / (1 + infl) - 1 : 0, realR = P ? (1 + P.ret / 100) / (1 + infl) - 1 : 0;
    const per: { i: number; k: number; m: number }[] = [];
    collegeYears(pr).forEach((y, i) => {
      // A child already in college has its years still to go.
      const kid = collegeKid(pr, i);
      for (let k = Math.max(0, y); k < y + kid.years; k++) per.push({ i, k, m: (kid.cost * Math.pow(1 + realT, k)) / 12 });
    });
    let fund = P?.saved ?? 0;
    const last = per.reduce((t, p) => Math.max(t, p.k), -1);
    for (let k = 0; k <= last; k++) {
      const due = per.filter((p) => p.k === k), total = due.reduce((t, p) => t + p.m * 12, 0);
      const paid = Math.min(fund, total), left = total > 0 ? 1 - paid / total : 1;
      fund = (fund - paid) * (1 + realR);
      due.forEach((p) => {
        const monthly = p.m * left * (1 - ahead);
        if (monthly < 1) return;
        events.push({ id: "college" + p.i + "-" + k, kind: "custom", from: a.age! + k, to: a.age! + k + 1, delta: -monthly, label: "College" });
        college[k] = (college[k] ?? 0) + monthly;
      });
    }
  }
  if (events.length) a.events = events;
  // Saving year by year, account by account: the children's costs and
  // college come out of the accounts "How will you cover it?" names, then
  // in the dashboard's order, so the plan's account mix, match and taxes
  // follow those choices.
  if (F.hasPay && a.age != null && a.retire != null && a.retire > a.age) {
    const rows = yearlySaving(pr, F, a, { college: Array.from({ length: a.retire - a.age }, (_, k) => college[k] ?? 0) }).rows.map((y) => ({ ...y }));
    // Outside the US every account is counted as tax-free, as below.
    // A partner who stops work before you retire stops saving through work then.
    const stop2 = partnerStop(pr);
    if (stop2 != null && stop2.before) {
      const ps = personSaving(F, 1), from = Math.max(0, Math.round(stop2.year - Math.floor(nowYear())));
      rows.forEach((y, k) => { if (k >= from) { y.t = Math.max(0, y.t - ps.t); y.r = Math.max(0, y.r - ps.r); } });
    }
    Object.assign(a, { yearly: abroad ? rows.map((y) => ({ t: 0, r: y.t + y.r + y.b, b: 0, short: y.short })) : rows, yearlyBase: F.invested + F.match });
  }
  // A partner who keeps working after you retire: their pay, and their own
  // saving through work, count in the plan until they stop.
  const stop2 = partnerStop(pr);
  if (stop2 != null && !stop2.before && !abroad && F.hasPay && F.pi.two) {
    const pay = grossYear(pr.p2) ?? 0, ps = personSaving(F, 1);
    if (pay > 0) a.work2 = { pay, t: ps.t * 12, r: ps.r * 12, b: 0, years: stop2.years };
  }
  // Each of you's own claiming age (the plan's optimizer path, which takes
  // two), each defaulting to 67 or retirement if later, as the fields say.
  if (!abroad) {
    const dflt = (p: Person) => Math.min(70, Math.max(67, p.retire ?? 67));
    Object.assign(a, { optC1: pr.ss.claim ?? dflt(pr.p1), optC2: two ? pr.ss.claim2 ?? dflt(pr.p2) : pr.ss.claim ?? dflt(pr.p1), optF: 0, optU: 0, optIm: 0, optAc: 0 });
  }
  if (abroad) Object.assign(a, { splitTrad: 0, splitRoth: 100, splitBrok: 0, ssOwn: 1e-6, ssOwn2: two ? 1e-6 : null, hcIncl: "yes" });
  if (H.cash != null) a.cash = H.cash;
  // The emergency fund in months of the budget it's set for on Spending:
  // the emergency budget when that's chosen, as the Dashboard's tile counts it.
  if (F.efTarget > 0 && F.efMonths > 0) Object.assign(a, { cashSpend: F.efTarget / F.efMonths, cashEmergency: F.b.efEmerg && F.b.efBasis === "emergency" });
  if (H.accounts) Object.assign(a, H.debts > 0 ? { debtHas: "yes", debtTotal: H.debts, debtHi: H.debtsHigh } : { debtHas: "no" });
  // Take-home: as entered for whoever gave it, worked out for whoever
  // didn't (not outside the US), plus other income.
  const after = abroad ? people(pr).reduce((s, p) => s + (payYear(p) ?? 0), 0) / 12 : 0;
  const th = (F.hasPay ? F.afterTax : after) + otherMonth(pr);
  if (th > 0) a.takehome = th;
  // The Calculator's result, when it's been changed away from the plan's.
  const fvTo = calcFvOf(pr, entries);
  if (fvTo != null) a.fvTo = fvTo;
  return a;
}

export interface Point { t: number; v: number; lo: number; hi: number }
export interface Results {
  S: Sim | null;
  /** Share of historical retirements that lasted, 0 to 1. */
  success: number | null;
  /** The retirements behind it, when the run counts them (the plan's own
      run; a chosen strategy's quick run gives only the share). */
  runs: { ok: number; of: number } | null;
  score: number | null;
  /** Each scored area, by the Guide's ids; an area missing isn't scored yet. */
  parts: Partial<Record<FactorId, Part>>;
  partial: boolean;
  /** Per month, in today's dollars. */
  savingsIncome: number | null; ss: number | null; takehome: number | null;
  /** Each person's Social Security per month once claimed, and the ages. */
  ss1: number | null; ss2: number | null; claim1: number | null; claim2: number | null;
  /** The year the first of you claims Social Security. */
  ssYear: number | null;
  /** Why the plan can't run yet, in words, when it can't. */
  gap: string | null;
  /** Savings at retirement, and the year it begins. */
  atRetire: number | null; retireYear: number | null;
  /** Net worth over the years: savings steady to retirement, then the middle
      of history with its 10th and 90th percentile, plus the home's equity. */
  path: Point[];
  equity: number;
  /** Months of spending in cash, once accounts are in. */
  cushion: number | null;
  /** The chosen withdrawal strategy, on the Drawdown Simulator with its
      saved settings: its name, chance across history, and first year's
      spending per month. */
  strategy: { id: string; name: string; success: number; first: number } | null;
  /** What the Drawdown Simulator starts from: the plan's figures with the
      spending goal's starting rate (the person's own figures go on top). */
  ddPlan: ReturnType<typeof drawdownPlan>;
  /** Spending once retired per month: the goal from Profile, and what the
      plan spends (the same, unless a starting rate is set on Retirement). */
  goal: number | null; spend: number | null;
  abroad: boolean;
  /** Points held back from the score while retiring before 59½ has no bridge plan. */
  bridgeDock: number;
}

/** What the plan still needs before it can run, in a sentence, or null. */
export function planGap(pr: Profile): string | null {
  const age = ageOf(pr.p1);
  if (age == null) return "Needs your birth month and year, in Profile.";
  if (pr.p1.retire == null) return "Needs the age you plan to retire, in Profile.";
  if (pr.p1.retire <= age) return `Your retirement age (${pr.p1.retire}) isn't after your age today (${age}). Change it in Profile.`;
  if (pr.p1.pay == null) return "Needs your pay, on Income.";
  if (pr.saved == null && spendMonth(pr) == null) return "Needs what you've saved and what you spend.";
  return null;
}

/** The plan's numbers the Drawdown Simulator starts from. */
export function drawdownPlan(S: Sim | null, ss1: number | null, ss2: number | null, claim: number | null) {
  if (!S) return null;
  // The partner's claiming age, counted in the first person's years (the
  // simulator's ages are the first person's): their own start year.
  const P = S.P as unknown as { age1?: number; age2?: number | null };
  const claim2 = ss2 && P.age1 != null && P.age2 != null ? S.ss.claim2 + (P.age1 - P.age2) : null;
  return { fv: S.fv, spendYr: S.spend, taxYr: S.taxYr, years: S.years, ss1: ss1 ?? 0, ss2: ss2 ?? 0, claim: claim ?? 67, claim2, retire: S.retire };
}

export function results(pr: Profile, entries: Entry[]): Results {
  const abroad = outsideUS(pr);
  let a = answers(pr, entries);
  const G = sim(a);
  const ddPlan = G ? drawdownPlan(G, abroad ? 0 : G.ss.a1 / 12, abroad || !couple(pr) ? 0 : G.ss.a2 / 12, G.ss.claim) : null;
  // A starting rate set on Retirement decides what the plan spends: the
  // spending that, with its taxes, comes to that rate of savings at
  // retirement (as the simulator's own starting rate counts them). Taxes
  // don't move in step with spending (spending less leaves more for the
  // required withdrawals later), so it's found by a few secant steps.
  let S0 = G;
  const ownRate = pr.ddOwn?.rate != null ? parseNum(pr.ddOwn.rate) / 100 : null;
  if (G && ownRate != null && G.spend + G.taxYr > 0) {
    const want = ownRate * G.fv, at = (sp: number) => sim({ ...a, retSpend: Math.max(0, sp) });
    let x0 = G.spend, f0 = G.spend + G.taxYr - want;
    let x1 = want * (G.spend / (G.spend + G.taxYr)), S1 = at(x1), f1 = S1 ? S1.spend + S1.taxYr - want : f0;
    for (let k = 0; k < 6 && S1 && Math.abs(f1) > 1 && f1 !== f0; k++) {
      const x2 = x1 - (f1 * (x1 - x0)) / (f1 - f0);
      x0 = x1; f0 = f1; x1 = x2; S1 = at(x1); f1 = S1 ? S1.spend + S1.taxYr - want : f1;
    }
    a = { ...a, retSpend: Math.max(0, x1) };
    S0 = S1 ?? G;
  }
  // A strategy chosen on the Retirement tab is the plan's: its chance across
  // history stands in for spending a fixed amount, in the score too.
  let chosen: Results["strategy"] = null;
  if (S0 && pr.strategy) {
    const d = drawdownFor(pr, ddPlan), set = drawdownSetup(d);
    chosen = { id: pr.strategy, name: DD_STRAT_NAMES[pr.strategy] ?? pr.strategy, success: drawdownSuccess(d), first: set.firstW / 12 };
  }
  const S = S0 && chosen ? { ...S0, success: chosen.success } : S0;
  const sc = score(a, S), H = holdings(entries, pr);
  // Retiring before 59½ with no plan for the years until then: part of the
  // retirement outlook is held back until the bridge is planned.
  const docked = !!(needsBridge(pr) && !hasBridgePlan(pr) && sc.P.outlook);
  if (docked) {
    const o = sc.P.outlook!;
    sc.P.outlook = { ...o, p: o.p * (1 - BRIDGE_DOCK) };
    const have = FACTORS.filter((f) => sc.P[f.id]), w = have.reduce((s, f) => s + f.w, 0);
    sc.score = have.length >= 2 ? Math.round((have.reduce((s, f) => s + f.w * sc.P[f.id]!.p, 0) / w) * 100) : null;
  }
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
  const F = flow(pr), efMonth = F.efTarget > 0 ? F.efTarget / F.efMonths : spend ?? 0;
  // The first year Social Security starts, for either of you.
  const claimYears = S && !abroad ? [pr.p1.by && S.ss.a1 > 0 ? pr.p1.by + S.ss.claim : null, couple(pr) && pr.p2.by && S.ss.a2 > 0 ? pr.p2.by + S.ss.claim2 : null].filter((y): y is number => y != null) : [];
  return {
    S, success: S ? S.success : null, runs: S && !chosen && S.H.total > 0 ? { ok: S.H.survived, of: S.H.total } : null, score: sc.score, parts: sc.P,
    partial: FACTORS.some((f) => !sc.P[f.id]),
    savingsIncome: S ? S.portIncome / 12 : null, ss: S && !abroad ? S.ss.total / 12 : null,
    ss1: S && !abroad ? S.ss.a1 / 12 : null, ss2: S && !abroad && couple(pr) ? S.ss.a2 / 12 : null,
    claim1: S ? S.ss.claim : null, claim2: S && couple(pr) ? S.ss.claim2 : null,
    ssYear: claimYears.length ? Math.min(...claimYears) : null, gap: planGap(pr),
    takehome: a.takehome ?? null,
    atRetire: S ? S.fv : null, retireYear, path, equity,
    // Months of the spending the emergency fund is sized on (the budget, or the emergency budget).
    cushion: H.cash != null && efMonth > 0 ? H.cash / efMonth : null,
    strategy: chosen, ddPlan, goal: G ? G.spend / 12 : null, spend: S ? S.spend / 12 : null, abroad,
    bridgeDock: docked && sc.score != null ? Math.max(1, Math.round(40 * (sc.P.outlook!.p / (1 - BRIDGE_DOCK)) * BRIDGE_DOCK * 100 / (FACTORS.filter((f) => sc.P[f.id]).reduce((s, f) => s + f.w, 0)))) : 0,
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
export { areaPoints } from "@/tools/guide/calc";
