/* The readiness guide's numbers: the plan its answers describe, run through
   every historical retirement by the plan engine; what it needs; the ways to
   change it; and the score. Everything here reads the answers it's given and
   changes nothing. From src/js/app/28-guide-core.js and the plan parts of
   30-guide-steps.js. */
import { BASIC_INFL, HIST_START, computeTax, RISKS } from "@/lib/engine/typed";
import { ssEstimate } from "@/lib/engine/typed-drawdown";
import {
  PL_HEIR, plAtRetire, plBands, plBaseTactics, plClaimMin, plDetail, plHistory, plKey, plPrep, plSSParts,
} from "@/lib/engine/typed-plan";
import type { PlHist, PlPlan, PlPrep, PlRow, PlTactics, PlToday } from "@/lib/engine/types";
import { groupDigits, money, pctStr } from "@/lib/format";
import type { Answers } from "./store";

export const ok = (v: unknown): v is number => typeof v === "number" && isFinite(v);
export const pos = (v: unknown): v is number => ok(v) && v > 0;
/** A field's value as it shows: grouped digits, or blank. */
export const gdM = (v: unknown) => (ok(v) ? groupDigits(Math.round(v), true) : "");
export const mar = (a: Answers) => a.status === "m";
export const gross = (a: Answers) => (a.income || 0) + (mar(a) ? a.income2 || 0 : 0);
export const saveMo = (a: Answers) => (a.contrib || 0) + (a.employer || 0);
/** What's going in today: nothing on a plan that coasts from now. */
export const coastNow = (a: Answers) => ok(a.stopAge) && ok(a.age) && a.stopAge <= a.age && !(ok(a.retire) && a.stopAge >= a.retire);
export const saveNow = (a: Answers) => (coastNow(a) ? 0 : saveMo(a));

export function interp(x: number, pts: [number, number][]): number {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
}
export const months = (v: number) => (v >= 10 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, ""));

export function riskLabel(real: number): string {
  return (RISKS.find((x) => Math.abs(x.real - real) < 1e-6) || RISKS[2]).label.toLowerCase();
}

/** Monthly take-home from the salary alone, through the Income Tax tool's
    2026 rules: the fallback when someone skips that step. */
export function taxEst(a: Answers): number {
  const g1 = a.income || 0, g2 = mar(a) ? a.income2 || 0 : 0;
  if (!(g1 + g2 > 0)) return 0;
  const T = (computeTax as (o: object) => { net: number })({ status: mar(a) ? "m" : "s", gross: g1, gross2: g2, pre: 0, dedType: "std", item: 0, state: a.state || "IL" });
  return T.net / 12;
}

/** The share of historical retirements a plan has to survive to count as on
    track: 90% unless more margin is asked for on the Adjust step. */
export const target = (a: Answers) => (a.target === 0.95 || a.target === 1 ? a.target : 0.9);
/** Stocks in retirement: 60% unless changed in the Drawdown Simulator. */
export const retMix = (a: Answers) => (ok(a.retMix) && a.retMix >= 0 && a.retMix <= 100 ? a.retMix : 60);
/** The least the household could live on in a bad stretch: a floor for the
    flexible withdrawal strategies. */
export const minSpend = (a: Answers) => (pos(a.minSpend) ? a.minSpend : 0);

/** When Social Security starts: the age chosen, or 67, or retirement if
    that's later, up to 70; never before retirement in this plan. */
export function claimAge(a: Answers, retire: number): number {
  const r = Math.min(70, Math.round(retire)), c = a.ssClaim;
  if (ok(c)) return Math.max(62, Math.min(70, Math.max(c, r)));
  return Math.max(67, r);
}
/** Each of you's benefit at full retirement age, a month, in today's
    dollars: from a statement, or estimated from income over the years
    worked by retirement, from 22. */
export function pias(a: Answers, retire: number) {
  const yrs1 = Math.max(1, Math.min(35, Math.round(retire) - 22));
  const spAt = mar(a) && ok(a.spouseAge) && ok(a.age) ? a.spouseAge + (retire - a.age) : retire;
  const yrs2 = Math.max(1, Math.min(35, Math.round(spAt) - 22));
  const own = pos(a.ssOwn), own2 = mar(a) && pos(a.ssOwn2);
  return {
    pia1: own ? a.ssOwn! : ssEstimate(a.income || 0, yrs1, 67).pia,
    pia2: !mar(a) ? 0 : own2 ? a.ssOwn2! : ssEstimate(a.income2 || 0, yrs2, 67).pia,
    own, own2, career: yrs1, career2: yrs2,
  };
}
/** The Plan Optimizer's choices, once applied. */
export function tactics(a: Answers): PlTactics | null {
  if (!ok(a.optC1)) return null;
  return { c1: a.optC1, c2: ok(a.optC2) ? a.optC2 : a.optC1, f: a.optF || 0, u: a.optU || 0, im: a.optIm || 0, ac: a.optAc || 0 };
}
export interface SSInfo { a1: number; a2: number; total: number; claim: number; claim2: number; delay: number; own: boolean; own2: boolean; spousal: boolean; career: number; tactics?: boolean }
/** Social Security for a retirement age, while typing: each of you's yearly
    benefit once claimed, at the ages the plan uses. */
export function ssFor(a: Answers, retire: number): SSInfo {
  const pia = pias(a, retire), Tq = tactics(a), claim = claimAge(a, retire);
  const age1 = Math.round(retire);
  const age2 = mar(a) && ok(a.spouseAge) && ok(a.age) ? Math.round(a.spouseAge + (retire - a.age)) : null;
  const c1 = Math.max(plClaimMin(age1), Math.min(70, Tq ? Tq.c1 : claim));
  const c2 = age2 == null ? c1 : Math.max(plClaimMin(age2), Math.min(70, Tq ? Tq.c2 : claim));
  const S = plSSParts({ P: { pia1: pia.pia1, pia2: pia.pia2 }, married: mar(a), gap: age2 == null ? 0 : age2 - age1 }, { c1, c2 });
  return { a1: S.own1 + S.top1, a2: S.own2 + S.top2, total: S.total, claim: c1, claim2: c2,
    delay: Math.max(0, c1 - age1), own: pia.own, own2: pia.own2, spousal: S.top1 + S.top2 > 0, career: pia.career, tactics: !!Tq };
}
function ssOf(a: Answers, C: PlPrep, T: PlTactics, retire: number): SSInfo {
  const pia = pias(a, retire), S = plSSParts(C as unknown as Parameters<typeof plSSParts>[0], T);
  return { a1: S.own1 + S.top1, a2: S.own2 + S.top2, total: S.total, claim: T.c1, claim2: T.c2,
    delay: Math.max(0, T.c1 - Math.round(retire)), own: pia.own, own2: pia.own2, spousal: S.top1 + S.top2 > 0, career: pia.career };
}
export interface IncomeItem { name: string; on: boolean; annual: number; inflate: boolean; startYear: number; duration: { type: string } }
/** A pension or other steady retirement income, in the Drawdown Simulator's
    own form so a trip there carries it. */
export function pensionItems(a: Answers, retire: number): IncomeItem[] {
  if (!pos(a.pension)) return [];
  const from = ok(a.pensionAge) ? a.pensionAge : retire;
  return [{ name: "Pension", on: true, annual: a.pension * 12, inflate: a.pensionCola === "yes",
    startYear: Math.max(1, Math.round(from - retire) + 1), duration: { type: "forever" } }];
}
/** How long the money has to last: to 95, or to the younger spouse's 95. */
export function yearsFor(a: Answers, retire: number): number {
  let end = 95 - Math.round(retire);
  if (mar(a) && ok(a.spouseAge) && ok(a.age)) end = Math.max(end, 95 - Math.round(a.spouseAge + (retire - a.age)));
  return Math.max(20, Math.min(60, end));
}

/* Where the money sits: the Roth and brokerage amounts from the Retirement
   savings step, the rest traditional. */
export const SAVE_TO: [key: string, title: string, sub: string][] = [["trad", "Mostly pre-tax", "A traditional 401(k), 403(b) or IRA"],
  ["roth", "Mostly Roth", "A Roth 401(k) or Roth IRA"],
  ["half", "About half and half", "Some of each"],
  ["brok", "Mostly a taxable account", "A brokerage account outside a retirement plan"]];
export function accts(a: Answers) {
  const saved = Math.max(0, a.saved || 0);
  const roth = Math.min(saved, pos(a.rothNow) ? a.rothNow : 0);
  const brok = Math.min(saved - roth, pos(a.brokNow) ? a.brokNow : 0);
  return { trad: saved - roth - brok, roth, brok };
}
function saveSplit(a: Answers, mine: number) {
  const to = a.saveTo || "trad";
  if (to === "roth") return { t: 0, r: mine, b: 0 };
  if (to === "half") return { t: mine / 2, r: mine / 2, b: 0 };
  if (to === "brok") return { t: 0, r: 0, b: mine };
  return { t: mine, r: 0, b: 0 };
}

/** A different retirement age, monthly saving (yours and your employer's),
    stop age or spending: how the options on the Adjust step are found. */
export interface Over { retire?: number; monthly?: number; stopAge?: number | null; spend?: number }

/** The plan engine's inputs from the answers. */
export function planIn(a: Answers, over: Over = {}): (PlToday & { monthly: number }) | null {
  const has = (k: keyof Over) => Object.prototype.hasOwnProperty.call(over, k);
  if (!ok(a.age) || !ok(a.retire) || !ok(a.saved) || !ok(a.contrib) || !pos(a.retSpend)) return null;
  const retire = has("retire") ? over.retire! : a.retire;
  if (!(retire > a.age)) return null;
  const monthly = has("monthly") ? over.monthly! : saveMo(a);
  const spend = has("spend") ? over.spend! : a.retSpend;
  if (!(spend > 0)) return null;
  let stop = has("stopAge") ? over.stopAge : a.stopAge;
  if (!ok(stop) || stop >= retire) stop = null;
  if (stop != null) stop = Math.max(a.age, stop);
  const emp = Math.min(Math.max(0, monthly), a.employer || 0), sp = saveSplit(a, Math.max(0, monthly - emp));
  const A = accts(a), pia = pias(a, retire), claim = claimAge(a, retire);
  return {
    status: mar(a) ? "m" : "s", state: a.state || "IL", age: a.age,
    spouseAge: mar(a) && ok(a.spouseAge) ? a.spouseAge : null, retire, stopAge: stop ?? null,
    trad: A.trad, roth: A.roth, brok: A.brok, rothBasis: A.roth * 0.5, brokBasis: A.brok * 0.6,
    saveTrad: sp.t + emp, saveRoth: sp.r, saveBrok: sp.b, real: a.risk || 0.045, infl: BASIC_INFL as number,
    spend, pia1: pia.pia1, pia2: pia.pia2, claim1: claim, claim2: claim,
    pension: pos(a.pension) ? a.pension * 12 : 0, pensionAge: ok(a.pensionAge) ? a.pensionAge : null,
    pensionCola: a.pensionCola === "yes", aca: retire < 65 && a.hcIncl !== "yes",
    household: mar(a) ? 2 : 1, rule55: a.rule55 === "yes", heirRate: PL_HEIR, mix: retMix(a),
    years: yearsFor(a, retire), target: target(a), strategy: "fixed", minSpend: 0, fromYear: HIST_START as number,
    monthly,
  };
}

export interface Sim {
  key: string; I: NonNullable<ReturnType<typeof planIn>>; P: PlPlan; C: PlPrep; T: PlTactics; tactics: boolean;
  fv: number; years: number; ss: SSInfo; spend: number; retire: number; monthly: number; real: number;
  stop: number | null; saveYears: number; mix: number; inc: IncomeItem[]; pension: number; path: number[];
  H: PlHist; D: { rows: PlRow[] }; success: number; taxYr: number; hcYr: number; hcYears: number; lifeTax: number;
  portIncome: number; coverage: number;
  retPath?: { p10: number; p50: number; p90: number }[];
  strats?: StratResult[]; stratsFloor?: number;
}

/* Runs are cached by their inputs: typing a digit, then deleting it, finds
   the plan already worked out. */
const cache = new Map<string, unknown>();
function cached<T>(key: string, f: () => T): T {
  if (cache.has(key)) return cache.get(key) as T;
  if (cache.size > 400) cache.clear();
  const v = f();
  cache.set(key, v);
  return v;
}

/** The retirement behind the score: today's balances and saving, account by
    account, grown to retirement at the mix's steady return, then run through
    every historical retirement since 1926, spending a fixed amount that
    rises with inflation, with each year's tax and premiums paid on top.
    `base` ignores any applied optimizer choices. */
export function sim(a: Answers, over?: Over, base = false): Sim | null {
  const I = planIn(a, over);
  if (!I) return null;
  const Tq = base ? null : tactics(a);
  const key = JSON.stringify(I) + "|" + (Tq ? plKey(Tq) : "");
  return cached(key, () => {
    const P = plAtRetire(I), C = plPrep(P);
    let T = plBaseTactics(C);
    if (Tq) T = { ...Tq, c1: Math.max(plClaimMin(C.age1), Math.min(70, Tq.c1)),
      c2: C.married ? Math.max(plClaimMin(C.age2!), Math.min(70, Tq.c2)) : Math.max(plClaimMin(C.age1), Math.min(70, Tq.c1)) };
    const H = plHistory(C, T, { paths: true }), D = plDetail(C, T);
    const ss = ssOf(a, C, T, I.retire);
    // Tax and health premiums in a typical year, from the steady path.
    let tx = 0, hc = 0, hn = 0;
    D.rows.forEach((r) => { tx += r.tax + r.irmaa; if (r.health > 0) { hc += r.health; hn++; } });
    const out: Sim = { key, I, P, C, T, tactics: !!Tq, fv: P.fv, years: C.years, ss, spend: I.spend, retire: I.retire,
      monthly: I.monthly, real: I.real, stop: I.stopAge, saveYears: (I.stopAge == null ? I.retire : I.stopAge) - I.age,
      mix: I.mix, inc: pensionItems(a, I.retire), pension: I.pension, path: (P as unknown as { path: number[] }).path, H, D,
      success: H.successRate, taxYr: D.rows.length ? tx / D.rows.length : 0, hcYr: hn ? hc / hn : 0, hcYears: hn,
      lifeTax: H.medTax, portIncome: P.fv * 0.04, coverage: 0 };
    out.coverage = (out.portIncome + ss.total + I.pension) / (I.spend + out.taxYr);
    return out;
  });
}

/** What the plan has to have saved by retirement to last in the target
    share of history: the same test, solved for the balance at retirement,
    every account scaled together. */
export function need(a: Answers, S: Sim): number {
  const goal = target(a);
  return cached("need|" + goal + "|" + S.key, () => {
    const P = S.P, n = S.H.total, maxFail = Math.floor(n * (1 - goal) + 1e-9);
    const lasts = (fv: number) => {
      const k = S.fv >= 1000 ? fv / S.fv : 0;
      const Q = S.fv >= 1000 ? { ...P, trad: P.trad * k, roth: P.roth * k, rothBasis: P.rothBasis * k, brok: P.brok * k, brokBasis: P.brokBasis * k }
        : { ...P, trad: fv, roth: 0, rothBasis: 0, brok: 0, brokBasis: 0 };
      const H = plHistory(plPrep(Q), S.T, { stopAfter: maxFail });
      return !H.partial && H.total - H.survived <= maxFail;
    };
    let lo = 0, hi = Math.max(S.spend * 60, S.fv * 2);
    if (lasts(0)) return 0;
    for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (lasts(m)) hi = m; else lo = m; }
    return Math.ceil(hi / 1000) * 1000;
  });
}
/** The median balance through retirement, with the 10th and 90th percentile. */
export function retPath(S: Sim) {
  if (!S.retPath) S.retPath = plBands(S.H, S.years);
  return S.retPath;
}

/* ---------- the score ---------- */
export const FACTORS = [
  { id: "outlook", name: "Retirement outlook", w: 40, step: "outlook" },
  { id: "rate", name: "Savings rate", w: 20, step: "savings" },
  { id: "cushion", name: "Emergency fund", w: 15, step: "cash" },
  { id: "debt", name: "Debt", w: 15, step: "debt" },
  { id: "flow", name: "Monthly cash flow", w: 10, step: "spending" },
] as const;
export type FactorId = (typeof FACTORS)[number]["id"];
export interface Part { p: number; txt: string; r?: number; m?: number }

export function parts(a: Answers): Partial<Record<FactorId, Part>> {
  const P: Partial<Record<FactorId, Part>> = {}, inc = gross(a);
  const S = sim(a);
  if (S) P.outlook = { p: interp(S.success, [[0.25, 0], [0.5, 0.35], [0.7, 0.6], [0.85, 0.85], [0.95, 1]]), txt: pctStr(S.success, 0) + " of historical retirements lasted" };
  if (inc > 0 && ok(a.contrib) && a.match) {
    const r = (saveNow(a) * 12) / inc;
    let p = interp(r, [[0, 0], [0.05, 0.35], [0.1, 0.7], [0.15, 1]]);
    // 15% is a rule of thumb for people who don't know what they need. Once
    // the projection shows what's saved is enough, it has done its job.
    const enough = !!S && S.success >= target(a) - 1e-9;
    if (enough) p = 1;
    if (a.match === "partial") p *= 0.75;
    P.rate = { p, r, txt: coastNow(a) && enough ? "Coasting: what you have is enough" : pctStr(r, 1) + " of gross income" +
      (a.match === "partial" ? ", missing some match" : enough && r < 0.15 ? ", enough for your plan" : "") };
  }
  if (ok(a.cash) && pos(a.spend)) {
    const m = a.cash / a.spend;
    P.cushion = { p: interp(m, [[0, 0], [1, 0.3], [3, 0.75], [6, 1]]), m, txt: months(m) + (m === 1 ? " month" : " months") + " of spending" };
  }
  if (a.debtHas === "no") P.debt = { p: 1, txt: "Nothing owed besides any mortgage" };
  else if (a.debtHas === "yes" && ok(a.debtTotal) && inc > 0) {
    const hi = Math.min(a.debtHi || 0, a.debtTotal), lo = a.debtTotal - hi;
    const p = Math.max(0, 1 - Math.min(1, (hi / inc) * 4) * 0.7 - Math.min(1, lo / inc) * 0.3);
    P.debt = { p, txt: money(a.debtTotal) + " owed" + (hi > 0 ? ", " + money(hi) + " at 8% or more" : "") };
  }
  if (pos(a.takehome) && pos(a.spend)) {
    const m = (a.takehome - a.spend) / a.takehome;
    P.flow = { p: interp(m, [[-0.05, 0], [0, 0.25], [0.1, 0.75], [0.2, 1]]), m,
      txt: a.takehome >= a.spend ? money(a.takehome - a.spend) + "/mo not spent" : money(a.spend - a.takehome) + "/mo over take-home" };
  }
  return P;
}
export function score(a: Answers) {
  const P = parts(a);
  const have = FACTORS.filter((f) => P[f.id]);
  const w = have.reduce((s, f) => s + f.w, 0);
  // One area alone says too little to put a number on.
  const sc = have.length >= 2 ? Math.round((have.reduce((s, f) => s + f.w * P[f.id]!.p, 0) / w) * 100) : null;
  return { score: sc, P, n: have.length };
}
export function rating(s: number | null) {
  if (s == null) return { label: "Not scored yet", color: "var(--dimmer)" };
  if (s >= 85) return { label: "On track", color: "var(--jade)" };
  if (s >= 70) return { label: "Nearly there", color: "var(--jade)" };
  if (s >= 50) return { label: "Getting there", color: "var(--gold)" };
  if (s >= 30) return { label: "Needs work", color: "var(--gold)" };
  return { label: "Needs attention", color: "var(--coral)" };
}
export const barColor = (p: number) => (p >= 0.8 ? "var(--jade)" : p >= 0.5 ? "var(--gold)" : "var(--coral)");

/* ---------- the ways to change the plan ----------
   Each solved on its own against the target share of historical
   retirements. Behind: save more, retire later, spend less, keep saving if
   it coasts, or a mix. Ahead: retire sooner, coast, save less, spend more.
   Each option carries the change to the answers (`set`) and its plan (`T`). */
export interface OptSet { retire?: number; contrib?: number; retSpend?: number; stopAge?: number | null }
export interface Opt { id: string; set: OptSet; T: Sim | null }
export type Levers = { retire: boolean; save: boolean; spend: boolean };

export function overFrom(a: Answers, set: OptSet): Over {
  const o: Over = {};
  if ("retire" in set) o.retire = set.retire;
  if ("contrib" in set) o.monthly = set.contrib! + (a.employer || 0);
  if ("retSpend" in set) o.spend = set.retSpend;
  if ("stopAge" in set) o.stopAge = set.stopAge;
  return o;
}
export function options(a: Answers, levers: Levers) {
  const S = sim(a);
  if (!S) return null;
  const goal = target(a);
  return cached("opts|" + JSON.stringify(a) + "|" + goal + "|" + JSON.stringify(levers), () => {
    const okT = (T: Sim | null) => !!T && T.success >= goal - 1e-9;
    const at = (o: Over) => sim(a, o);
    const emp = a.employer || 0, mine = a.contrib || 0, age = Math.round(a.age!), ret = Math.round(S.retire);
    const list: Opt[] = [], add = (id: string, set: OptSet) => {
      const T = sim(a, overFrom(a, set));
      if (T) list.push({ id, set, T });
    };
    const ahead = okT(S);
    if (ahead) {
      // Retire sooner: the earliest age that still passes, a year at a time.
      let r: number | null = null;
      for (let x = ret - 1; x > age; x--) { if (okT(at({ retire: x }))) r = x; else break; }
      if (r != null) add("earlier", { retire: r });
      // Coast: the earliest age contributions could stop, still retiring on time.
      if (S.monthly > 0) {
        const last = S.stop != null ? S.stop : ret;
        for (let x = age; x < last; x++) { if (okT(at({ stopAge: x }))) { add("coast", { stopAge: x }); break; } }
      }
      // Save less: the least you could put in yourself (your employer's
      // share stays). Skipped when stopping altogether already works.
      const coastNowOpt = list.some((o) => o.id === "coast" && o.set.stopAge! <= age);
      if (mine > 0 && !coastNowOpt) {
        let lo = 0, hi = mine;
        if (!okT(at({ monthly: emp }))) {
          for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (okT(at({ monthly: emp + m }))) hi = m; else lo = m; }
        } else hi = 0;
        const v = Math.min(mine, Math.ceil(hi / 25) * 25);
        if (mine - v >= 50) add("less", { contrib: v });
      }
      // Spend more in retirement.
      let lo = S.spend, hi = S.spend * 4;
      if (!okT(at({ spend: hi }))) {
        for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (okT(at({ spend: m }))) lo = m; else hi = m; }
      } else lo = hi;
      const v = Math.floor(lo / 500) * 500;
      if (v >= S.spend + 1000) add("more", { retSpend: v });
    } else {
      // A coast plan that falls short may only need to keep saving.
      if (S.stop != null && okT(at({ stopAge: null }))) add("keepsaving", { stopAge: null });
      // Save more: the smallest extra that gets there, up to a generous cap.
      const cap = Math.max(1000, S.monthly * 3 + 3000);
      if (okT(at({ monthly: S.monthly + cap }))) {
        let lo = 0, hi = cap;
        for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (okT(at({ monthly: S.monthly + m }))) hi = m; else lo = m; }
        add("extra", { contrib: mine + Math.ceil(hi / 25) * 25 });
      }
      // Retire later, up to 75.
      let later: number | null = null;
      for (let x = ret + 1; x <= Math.min(75, ret + 15); x++) { if (okT(at({ retire: x }))) { later = x; break; } }
      if (later != null) add("later", { retire: later });
      // Spend less.
      let lo = 0, hs = S.spend;
      for (let i = 0; i < 18; i++) { const m = (lo + hs) / 2; if (okT(at({ spend: Math.max(1, m) }))) lo = m; else hs = m; }
      const v = Math.floor(lo / 500) * 500;
      if (v > 0) add("less-spend", { retSpend: v });
    }
    balance(a, S, ahead, list, okT, add, levers);
    return { S, goal, ahead, list };
  });
}
/* Balance several changes: every lever allowed moves the same share of the
   way to its own single-lever answer, and that share is solved for. Behind,
   the smallest share that reaches the target; ahead, the largest the plan
   can afford. */
function balance(a: Answers, S: Sim, ahead: boolean, list: Opt[], okT: (T: Sim | null) => boolean, add: (id: string, set: OptSet) => void, levers: Levers) {
  const mine = a.contrib || 0, ret = Math.round(S.retire), age = Math.round(a.age!);
  const find = (id: string) => list.find((o) => o.id === id);
  const d: { retire?: number; save?: number; spend?: number } = {};
  if (ahead) {
    const e = find("earlier"), l = find("less"), c = find("coast"), m = find("more");
    if (levers.retire && e) d.retire = ret - e.set.retire!;
    if (levers.save && mine > 0) d.save = l ? mine - l.set.contrib! : c && c.set.stopAge! <= age ? mine : 0;
    if (levers.spend && m) d.spend = m.set.retSpend! - S.spend;
  } else {
    const x = find("extra"), l = find("later"), s2 = find("less-spend");
    if (levers.retire) d.retire = (l ? l.set.retire! : Math.min(75, ret + 10)) - ret;
    if (levers.save) d.save = x ? x.set.contrib! - mine : Math.max(1000, S.monthly * 3 + 3000);
    if (levers.spend) d.spend = S.spend - (s2 ? s2.set.retSpend! : S.spend * 0.6);
  }
  const keys = (Object.keys(d) as (keyof typeof d)[]).filter((k) => d[k]! > 0);
  if (keys.length < 2) return;
  const sign = ahead ? -1 : 1;
  const setAt = (f: number) => {
    const set: OptSet = {};
    if (d.retire) set.retire = ret + sign * (ahead ? Math.floor(f * d.retire) : Math.ceil(f * d.retire));
    if (d.save) set.contrib = Math.max(0, mine + sign * (ahead ? Math.floor((f * d.save) / 25) : Math.ceil((f * d.save) / 25)) * 25);
    if (d.spend) set.retSpend = Math.floor((S.spend - sign * f * d.spend) / 500) * 500;
    if (set.retire === ret) delete set.retire;
    if (set.contrib === mine) delete set.contrib;
    if (set.retSpend === S.spend) delete set.retSpend;
    return set;
  };
  const pass = (f: number) => okT(sim(a, overFrom(a, setAt(f))));
  let lo = 0, hi = 1;
  if (ahead) {
    if (!pass(lo)) return;
    if (pass(1)) lo = 1;
    else for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (pass(m)) lo = m; else hi = m; }
    const set = setAt(lo);
    if (Object.keys(set).length >= 2) add("balance", set);
  } else {
    if (!pass(1)) return;
    for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (pass(m)) hi = m; else lo = m; }
    const set = setAt(hi);
    if (Object.keys(set).length >= 2) add("balance", set);
  }
}
/** The cheapest ways to close a gap, for the plan's to-do list. */
export function fixes(a: Answers, levers: Levers) {
  const O = options(a, levers);
  if (!O || O.ahead) return O ? {} : null;
  const out: { extra?: number; retire?: number; spend?: number } = {};
  O.list.forEach((o) => {
    if (o.id === "extra") out.extra = o.set.contrib! - (a.contrib || 0);
    if (o.id === "later") out.retire = o.set.retire;
    if (o.id === "less-spend") out.spend = o.set.retSpend;
  });
  return out;
}

/* ---------- drawing it down ----------
   Every withdrawal strategy the Drawdown Simulator offers, run on the
   plan's own numbers through the same history. */
export const STRATS = [
  { id: "fixed", name: "Fixed, rising with inflation", d: "The same spending every year, raised with prices. Steady and simple, but it never reacts to markets, so a bad start can drain it." },
  { id: "guardrails", name: "Guardrails (Guyton-Klinger)", d: "Steady spending that follows inflation, with a 10% cut when your withdrawal rate climbs 20% past where it started, and a 10% raise when it falls 20% below." },
  { id: "floorceil", name: "Floor and ceiling", d: "Aims at a set share of the portfolio each year, but never moves spending more than 10% up or down from last year." },
  { id: "yale", name: "Yale endowment rule", d: "70% of last year's spending, plus 30% of your starting rate applied to today's balance. Smooths the swings while still following the market." },
  { id: "pct", name: "Fixed percentage", d: "The same share of whatever the portfolio is worth each year. It can't run out, but spending rises and falls with every market move." },
  { id: "vpw", name: "Variable percentage (VPW)", d: "Spends down on purpose: each year's share rises as the years left shrink, like an annuity. Starts higher, varies the most, and ends near zero." },
];
export const stratName = (id: string | null | undefined) => (STRATS.find((q) => q.id === id) || STRATS[0]).name;
export interface StratResult {
  st: (typeof STRATS)[number]; H: PlHist | null; success: number; typical: number; lean: number;
  leanYear: number | null; leanAge: number | null; end: number; canFail: boolean;
}
/** Each approach on the plan's own numbers through the same history: what
    was actually lived on each year, after tax, in today's dollars. */
export function strats(a: Answers, S: Sim): StratResult[] {
  const fl = minSpend(a);
  if (S.strats && S.stratsFloor === fl) return S.strats;
  S.stratsFloor = fl;
  const med = (arr: number[]) => { const x = arr.slice().sort((p, q) => p - q); return x.length ? x[Math.floor(x.length / 2)] : 0; };
  S.strats = STRATS.map((st) => {
    const C = plPrep({ ...S.P, strategy: st.id, minSpend: fl, guardBand: 20, adjustPct: 10, floorPct: 10, ceilPct: 10, yaleWeight: 70,
      vpwRate: (S.mix * 5 + (100 - S.mix) * 1.9) / 100, vpwFV: 0 } as PlPlan);
    const H = st.id === "fixed" && !fl ? S.H : plHistory(C, S.T, { paths: true });
    let lean = Infinity, leanYear: number | null = null, leanAge: number | null = null;
    const typ: number[] = [];
    H.runs.forEach((run) => {
      const sp = Array.prototype.slice.call(run.livedPath || []) as number[];
      typ.push(med(sp));
      // Ties (every run that ran dry falls to the same Social Security)
      // name the youngest age it happened, the one that matters.
      sp.forEach((v, i) => {
        const age = Math.round(S.retire) + i;
        if (v < lean - 1 || (Math.abs(v - lean) <= 1 && age < leanAge!)) { lean = Math.min(lean, v); leanYear = run.startYear; leanAge = age; }
      });
    });
    // A minimum makes every flexible approach able to run dry.
    return { st, H, success: H.successRate, typical: med(typ), lean, leanYear, leanAge, end: H.medianEnd, canFail: fl > 0 || (st.id !== "pct" && st.id !== "vpw") };
  });
  return S.strats;
}

/** A list of years: "1929, 1937 and 1966", or the first five and a count. */
export function yearsList(list: number[]): string {
  if (list.length <= 6) return list.join(", ").replace(/, (\d+)$/, " and $1");
  return list.slice(0, 5).join(", ") + " and " + (list.length - 5) + " other years";
}

/* ---------- for trips into the tools ---------- */
/** The guide's projected savings at retirement, account by account. */
export function bridgeSplit(a: Answers) {
  const S = sim(a);
  if (!S) {
    const A = accts(a);
    return { total: a.saved || 0, trad: A.trad, roth: A.roth, brok: A.brok, basis: A.roth * 0.5, mix: 70 };
  }
  const P = S.P;
  return { total: P.fv, trad: P.trad, roth: P.roth, brok: P.brok, basis: P.rothBasis, mix: S.mix };
}
/** Retirement spending without the marketplace premium, when the guide has
    already added it: the bridge tool prices coverage itself. */
export function bridgeSpend(a: Answers): number {
  let v = a.retSpend || 0;
  if (pos(a.hcPrem) && (a.hcIncl === "yes" || a.hcAdded)) v = Math.max(0, v - a.hcPrem * 12);
  return v;
}
/** The backtest's stock share nearest each of the guide's investment mixes. */
export function mixFor(real: number | null | undefined): number {
  const i = RISKS.findIndex((r) => Math.abs(r.real - (real || 0.045)) < 1e-6);
  return [20, 40, 60, 80, 100][i < 0 ? 2 : i];
}
/** The Drawdown Simulator's options for a plan, for a trip there. The
    simulator doesn't work out tax, so the plan's typical yearly tax rides
    along with its spending. */
export function ddOpts(a: Answers, S: Sim) {
  const rate = ((S.spend + (S.taxYr || 0)) / Math.max(1, S.fv)) * 100;
  return { initialPct: rate, vpwRate: (S.mix * 5 + (100 - S.mix) * 1.9) / 100 };
}
