/* Changes ahead (doc 3, "Changes ahead: events and the schedule", section 3
   items 2b and 13): saving that changes over time. The card keeps events,
   children and the other changes; the saving schedule, the household by
   age and the college years are worked out from them every time and never
   kept. The balance at retirement is linear in each stage's saving, so a
   schedule needs no change to the engine: each stage is worth its saving
   times the growth of a dollar a month over its years (doc 3, 2b), and
   the plan the engine tests is built from those sums account by account.
   No React and no import of calc.ts, so the worker bundles it as it is. */

import { BASIC_INFL } from "@/lib/engine/typed";
import { plAtRetire } from "@/lib/engine/typed-plan";
import type { PlPlan, PlToday } from "@/lib/engine/types";
import type { Answers, ChangeEvent, SourceKind } from "./store";

const ok = (v: unknown): v is number => typeof v === "number" && isFinite(v);
const pos = (v: unknown): v is number => ok(v) && v > 0;
const INFL = BASIC_INFL as number;

/* ---------- children (doc 3, section 3, item 13; decision D11) ---------- */
/** The default monthly cost of a child, by age band, in today's dollars. */
export const CHILD_COST = { care: 2500, noCare: 1300, school: 1500, later: 0.8 };
export const CHILD_SOURCE = "The USDA's last study of what children cost (2015 data, about $17,000 a year per child today) and national childcare averages, which vary two- to threefold by state";

export interface Child { born: number; childcare: boolean; early: number; school: number; n: number; planned: boolean; id: string }
/** Every child: those you have (their ages today), those planned (the first
    in about N years, then every `spacing` years), and any added one by one.
    Ages are yours; `n` is the birth order, for the second-child step-down. */
export function children(a: Answers): Child[] {
  if (!ok(a.age)) return [];
  const care = a.childcare !== false, early = pos(a.childEarly) ? a.childEarly : null, school = pos(a.childSchool) ? a.childSchool : null;
  const out: Omit<Child, "n">[] = [];
  (a.kidsNow || []).forEach((k, i) => { if (ok(k) && k >= 0 && k < 30) out.push({ id: "now" + i, born: a.age! - k, childcare: care, early: early ?? 0, school: school ?? 0, planned: false }); });
  const n = pos(a.kidsPlanned) ? Math.min(6, Math.round(a.kidsPlanned)) : 0, first = ok(a.firstIn) ? Math.max(0, a.firstIn) : 2, gap = pos(a.spacing) ? a.spacing : 3;
  for (let i = 0; i < n; i++) out.push({ id: "plan" + i, born: a.age! + first + i * gap, childcare: care, early: early ?? 0, school: school ?? 0, planned: true });
  for (const e of a.events || []) if (e.kind === "child") out.push({ id: e.id, born: e.born, childcare: e.childcare, early: e.earlyCost ?? 0, school: e.schoolCost ?? 0, planned: e.born > a.age! });
  return out.sort((x, y) => x.born - y.born).map((c, i) => ({ ...c, n: i }));
}
/** What a child costs a month at your age `t`: the band's cost (or the
    override), less 20% for a second or later child; nothing before birth or
    from 19, when college is its own line. */
export function childCost(c: Child, t: number): number {
  const k = t - c.born;
  if (k < 0 || k >= 19) return 0;
  const band = k < 6 ? (c.early || (c.childcare ? CHILD_COST.care : CHILD_COST.noCare)) : c.school || CHILD_COST.school;
  return band * (c.n > 0 ? CHILD_COST.later : 1);
}

/* ---------- the schedule ---------- */
export interface Stage {
  from: number; to: number;
  /** A month, in today's dollars. */
  monthly: number;
  label: string;
  src: SourceKind;
  /** The costs ahead come to more than the saving: it reads $0. */
  floored?: boolean;
}
export interface SchedOpts {
  /** A different retirement age (Adjust your plan). */
  retire?: number;
  /** Today's saving, a month: the plan's own, or a lever's. */
  monthly: number;
  /** Saving stops here (a coast plan). */
  stop?: number | null;
}

/** Whether the answers describe saving that changes. */
export const hasChanges = (a: Answers) => children(a).length > 0 || (a.events || []).some((e) => e.kind !== "child");

const ageWord = (n: number) => (n === 1 ? "one child" : n === 2 ? "two children" : n + " children");
/** What's going on at age `t`, in a stage's words. */
function labelAt(a: Answers, kids: Child[], t: number, ev: ChangeEvent[]): string {
  const born = kids.filter((c) => c.born <= t), home = born.filter((c) => t - c.born < 19);
  let s: string;
  if (!kids.length) s = "";
  else if (!born.length) s = "Before children";
  else if (!home.length) s = "Empty nest";
  else {
    const care = home.filter((c) => t - c.born < 6 && c.childcare);
    s = home.length === 1 ? (care.length ? "A child in childcare" : t - home[0].born < 6 ? "A young child" : "A child at school")
      : care.length ? ageWord(home.length).replace(/^./, (x) => x.toUpperCase()) + ", " + (care.length === 1 ? "one in childcare" : "both in childcare")
        : home.every((c) => t - c.born >= 6) ? "School years" : ageWord(home.length).replace(/^./, (x) => x.toUpperCase());
  }
  // Part-time years and a spouse's pause set the saving outright, so they
  // lead; a raise or a freed payment only matters outside them.
  const set = ev.filter((e) => (e.kind === "parttime" || e.kind === "pause") && t >= e.from && t < e.to).map((e) => (e.kind === "parttime" ? "part-time years" : "a spouse at home"));
  const on: string[] = [...set];
  for (const e of ev) {
    if (!set.length && e.kind === "raise" && t >= e.at) on.push("after the raise");
    if (!set.length && e.kind === "payoff" && t >= e.at) on.push("payment freed");
    if (e.kind === "custom" && t >= e.from && (e.to == null || t < e.to) && e.label) on.push(e.label);
  }
  const all = (set.length ? [...on, s] : [s, ...on]).filter(Boolean).join(", ");
  return all ? all.charAt(0).toUpperCase() + all.slice(1) : "Saving";
}

/** The saving schedule: today's saving at each whole year of age from now to
    retirement, less what the children cost then beyond what they cost now,
    plus raises and freed payments, part-time years and a spouse's pause at
    what's saved then, and any hand edits; floored at $0. Stages start and
    end where any of that changes, and equal neighbours merge. */
export function schedule(a: Answers, o: SchedOpts): Stage[] {
  if (!ok(a.age) || !ok(a.retire ?? o.retire)) return [];
  const age = Math.round(a.age), end = Math.round(o.retire ?? a.retire!);
  if (!(end > age)) return [];
  const kids = children(a), ev = (a.events || []).filter((e) => e.kind !== "child");
  // Today's saving already pays for the children you have; planned ones come off it.
  const costNow = kids.filter((c) => !c.planned).reduce((s, c) => s + childCost(c, age), 0);
  const years: { t: number; v: number; label: string; src: SourceKind; floored: boolean }[] = [];
  for (let t = age; t < end; t++) {
    let v = o.monthly - (kids.reduce((s, c) => s + childCost(c, t), 0) - costNow), src: SourceKind = "entered";
    if (kids.some((c) => childCost(c, t) !== childCost(c, age) && !(c.early && c.school))) src = "estimated";
    for (const e of ev) {
      if (e.kind === "raise" && t >= e.at) v += e.extra;
      if (e.kind === "payoff" && t >= e.at) v += e.freed;
    }
    for (const e of ev) if ((e.kind === "parttime" || e.kind === "pause") && t >= e.from && t < e.to) { v = e.saving; src = "entered"; }
    for (const e of ev) if (e.kind === "custom" && t >= e.from && (e.to == null || t < e.to)) { v += e.delta; src = "entered"; }
    if (o.stop != null && t >= o.stop) { v = 0; src = "entered"; }
    const floored = v < 0;
    years.push({ t, v: Math.max(0, Math.round(v)), label: labelAt(a, kids, t, ev), src, floored });
  }
  const out: Stage[] = [];
  for (const y of years) {
    const last = out[out.length - 1];
    if (last && last.monthly === y.v && last.label === y.label) { last.to = y.t + 1; if (y.floored) last.floored = true; if (y.src === "estimated") last.src = "estimated"; }
    else out.push({ from: y.t, to: y.t + 1, monthly: y.v, label: y.label, src: y.src, ...(y.floored ? { floored: true } : {}) });
  }
  // Neighbours with the same saving merge even when their words differ.
  const merged: Stage[] = [];
  for (const s of out) {
    const last = merged[merged.length - 1];
    if (last && last.monthly === s.monthly) { last.to = s.to; last.floored = last.floored || s.floored; if (s.src === "estimated") last.src = "estimated"; }
    else merged.push({ ...s });
  }
  return merged;
}

/** Household size at each of your ages up to 65: adults, plus each child
    from birth until 19, or 23 while the College card has them in college. */
export function householdByAge(a: Answers, to = 65): { age: number; n: number }[] {
  if (!ok(a.age)) return [];
  const adults = a.status === "m" ? 2 : 1, kids = children(a), until = a.college === "yes" ? 23 : 19, out: { age: number; n: number }[] = [];
  for (let t = Math.round(a.age); t < to; t++) out.push({ age: t, n: adults + kids.filter((c) => t >= c.born && t - c.born < until).length });
  return out;
}
/** The household the plan prices health insurance for before 65 (D12): the
    size in the first year of retirement, when it's before 65. */
export function householdAtRetire(a: Answers, retire: number): number {
  const adults = a.status === "m" ? 2 : 1;
  if (!(retire < 65)) return adults;
  const h = householdByAge(a, 66).find((x) => x.age === Math.round(retire));
  return h ? h.n : adults;
}
/** Each child's college years, 18 to 22, at your ages. */
export function collegeWindows(a: Answers) {
  return children(a).map((c, i) => ({ child: i, from: c.born + 18, to: c.born + 22 }));
}

/* ---------- the value of a schedule (doc 3, 2b) ---------- */
/** B(t): what a dollar a month, saved for the first `t` years and rising
    with inflation, is worth at retirement; with its balance by year. */
function dollarMonth(age: number, retire: number, real: number, t: number) {
  const P = plAtRetire({ status: "s", age, retire, stopAge: Math.min(retire, age + t) >= retire ? null : age + t, real, infl: INFL,
    trad: 0, roth: 0, brok: 0, saveTrad: 1, saveRoth: 0, saveBrok: 0 } as PlToday) as unknown as { fv: number; path: number[] };
  return t <= 0 ? { fv: 0, path: P.path.map(() => 0) } : P;
}
/** Each stage's worth at retirement, and the whole: the starting balance
    grown, plus each stage's saving times B(end) − B(start). */
export function scheduleValue(age: number, retire: number, real: number, initial: number, stages: Pick<Stage, "from" | "to" | "monthly">[]) {
  const A = plAtRetire({ status: "s", age, retire, stopAge: null, real, infl: INFL, trad: 1, roth: 0, brok: 0, saveTrad: 0, saveRoth: 0, saveBrok: 0 } as PlToday).fv;
  const each = stages.map((s) => s.monthly * (dollarMonth(age, retire, real, s.to - age).fv - dollarMonth(age, retire, real, s.from - age).fv));
  return { A, each, total: initial * A + each.reduce((x, y) => x + y, 0) };
}

/** The plan at retirement from a schedule: plAtRetire's own figures for the
    balances held today, plus each stage's saving, split across accounts by
    today's shares, with the Roth and brokerage basis run stage by stage
    and the balance year by year built the same way. A one-stage schedule
    gives plAtRetire's plan exactly. */
export function atRetireScheduled(I: PlToday, stages: Pick<Stage, "from" | "to" | "monthly">[]): PlPlan {
  const base = plAtRetire({ ...I, saveTrad: 0, saveRoth: 0, saveBrok: 0 }) as PlPlan & { path: number[]; grow: unknown };
  const mo = I.saveTrad + I.saveRoth + I.saveBrok, share = mo > 0 ? { t: I.saveTrad / mo, r: I.saveRoth / mo, b: I.saveBrok / mo } : { t: 1, r: 0, b: 0 };
  const age = I.age, retire = Math.max(age, I.retire), yrs = retire - age, infl = I.infl == null ? 0.03 : I.infl;
  let sum = 0, path = base.path.slice(), inR = 0, inB = 0;
  for (const s of stages) {
    const hi = dollarMonth(age, retire, I.real, s.to - age), lo = dollarMonth(age, retire, I.real, s.from - age), v = s.monthly * (hi.fv - lo.fv);
    sum += v;
    path = path.map((p, i) => p + s.monthly * ((hi.path[i] ?? hi.fv) - (lo.path[i] ?? lo.fv)));
    // Dollars in, which inflation erodes by retirement (plAtRetire's inYrs).
    for (let k = Math.round(s.from - age); k < Math.round(s.to - age); k++) { const w = (s.monthly * 12) / Math.pow(1 + infl, yrs - k - 0.5); inR += w * share.r; inB += w * share.b; }
  }
  const P = { ...base } as PlPlan & { path: number[] };
  P.trad = base.trad + sum * share.t;
  P.roth = base.roth + sum * share.r;
  P.brok = base.brok + sum * share.b;
  // Today's bases, eroded by inflation to retirement, as plAtRetire has them.
  const dfl = Math.pow(1 + infl, yrs);
  const bb0 = I.brokBasis == null ? I.brok || 0 : I.brokBasis, rb0 = I.rothBasis == null ? (I.roth || 0) * 0.5 : I.rothBasis;
  P.rothBasis = Math.min(P.roth, rb0 / dfl + inR);
  P.brokBasis = Math.min(P.brok, bb0 / dfl + inB);
  P.path = path;
  P.fv = P.trad + P.roth + P.brok;
  return P;
}
