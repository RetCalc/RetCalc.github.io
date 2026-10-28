/* Changes ahead on the Advanced calculator: the inputs above are where the
   plan starts, and each change you see coming (saving more or less, a lump
   sum, a different return, children) moves it from there. They're turned
   into stages for the Stages engine: one wherever what's going on
   changes, so with no changes on, the plan is Advanced's own, to the cent.

   A change's ages are kept as years from now (`from` 5 is five years in),
   so typing your age only relabels them. Amounts are in today's dollars:
   a later stage's saving is restated in the dollars of its own start, as
   Stages' "adjust for inflation" does. No React. */

import { PER_YEAR } from "@/lib/engine/typed";
import { glideAnnualRate } from "@/lib/engine/math";
import type { Household } from "@/lib/household";
import { parseNum } from "@/lib/format";
import { COVER_ORDER, type CoverLine, type PlanKids } from "@/tools/plan/model";
import { coverStage, kidStages, stageKey, type Monthly } from "@/tools/plan/kids";
import { KID_BASE } from "@/tools/stages/kids";
import { STAGES_DEFAULTS, stagesCompute, type StageInputs, type StagesInputs } from "@/tools/stages/model";
import { CHILDREN_ID, lumpAccount, nominalAt, scenarioName, yearChange, type Scenario } from "@/components/dashboard/scenarios";
import { advancedPlan, glideYearsFor, type AdvancedInputs } from "./model";
import { stagesFromAdvanced } from "./toStages";

/** The changes the plan runs on: the ones switched on, the children's
    row only while there are children. */
export function liveChanges(s: AdvancedInputs): Scenario[] {
  return (s.changes ?? []).filter((c) => c.on && (c.kind !== "children" || !!s.kids));
}
/** Whether any change is on: then the plan runs as stages. */
export const changesOn = (s: AdvancedInputs) => liveChanges(s).length > 0;

/** One stage as the list under "The stages behind this" shows it: where it
    runs (years from now), what's saved a month by account in today's
    dollars at its start (your own, before any match), how much that rises
    each year after inflation, its return, a lump sum on its first day,
    and what's going on. */
export interface ShownStage {
  from: number; to: number; monthly: Monthly; rises: number; nominal: number;
  lump: { amount: number; to: "t" | "r" | "b" | "h" } | null; names: string[];
  /** The children cost more than is saved then, by so much a month. */
  short: number;
}

export interface Compiled {
  /** The Stages tool's inputs: Advanced's figures and the stages. */
  inputs: StagesInputs;
  /** For each stage inside a glide that had to be split year by year, how
      far through the glide it is (0 to 1): historical mode's mix follows. */
  glideAt: (number | null)[];
  /** Where saving cuts take more than is saved: the first year, and the
      most they fall short by a month. */
  cutShort: { from: number; most: number } | null;
  shown: ShownStage[];
  /** Where each change starts, in years from now. */
  starts: { id: string; year: number }[];
}

const ZERO = (): Monthly => ({ brok: 0, roth: 0, trad: 0, hsa: 0 });
const sum = (m: Monthly) => m.brok + m.roth + m.trad + m.hsa;

/** A cut in saving taken from `m` to the cent: the amounts named for an
    account first, then the rest in COVER_ORDER, each as far as it goes. */
function cutFrom(m: Monthly, cut: number, typed: Partial<Monthly>): number {
  let left = cut;
  for (const k of COVER_ORDER) if (typed[k] != null) { const c = Math.min(m[k], typed[k]!, left); m[k] -= c; left -= c; }
  for (const k of COVER_ORDER) { if (left <= 0) break; const c = Math.min(m[k], left); m[k] -= c; left -= c; }
  return Math.max(0, left);
}

/** A slice of the plan with one thing going on: the saving at its start,
    its return and what's at work. */
interface Slice { a: number; b: number; monthly: Monthly; nominal: number; tags: string[]; kid: string; lump: ShownStage["lump"]; short: number; lumpIds: string[]; cutShort: number }

/** The plan's stages under the changes, with the inputs in `s`. */
export function compileChanges(s: AdvancedInputs, household: Household | null): Compiled {
  const P = advancedPlan(s, household), p = P.p, a = P.a;
  const { next } = stagesFromAdvanced(P, s, { ...STAGES_DEFAULTS, histMix: s.histMix, histMixEnd: s.histMixEnd }, null);
  const st0 = next.stages[0];
  const T = p.years, infl = p.inflation, ppy = PER_YEAR[p.period] ?? 12;
  const list = liveChanges(s);
  const kidsOn = list.some((c) => c.kind === "children") && !!s.kids;
  const changes = list.filter((c) => c.kind !== "children");

  // Today's saving a month by account, your own: one pot (counted as
  // brokerage) without the split.
  const mo = (v: number) => (v * ppy) / 12;
  const today: Monthly = a ? { brok: mo(a.brokC), roth: mo(a.rothC), trad: mo(a.tradC), hsa: mo(a.hsaC) } : { ...ZERO(), brok: mo(p.contrib) };
  // Contributions rise at the plan's rate: with rates by account, their
  // blend, as Advanced runs the plan.
  const rateOf = (k: CoverLine) => (void k, p.growth);

  // Where something can change: every whole year, the end, and where the children's costs change.
  const kidSegs = kidsOn ? kidStages(s.kids, KID_BASE, KID_BASE + Math.max(1, Math.round(T))).map((x) => ({ ...x, from: x.from - KID_BASE, to: x.to - KID_BASE })) : [];
  const cuts = new Set<number>([0, T]);
  for (let k = 1; k < T; k++) cuts.add(k);
  for (const x of kidSegs) if (x.from > 0 && x.from < T) cuts.add(x.from);
  const edges = [...cuts].sort((x, y) => x - y);

  const slices: Slice[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const at = edges[i], yr = Math.floor(at), real = Math.pow(1 + infl, at);
    // Saving then, as a month in today's dollars.
    const m: Monthly = ZERO();
    for (const k of COVER_ORDER) m[k] = (today[k] * Math.pow(1 + rateOf(k), yr)) / real;
    const own = sum(m);
    // The children first: what they cost beyond today comes out as "How will you cover this?" says.
    let short = 0, kid = "";
    const seg = kidSegs.find((x) => at >= x.from && at < x.to);
    if (seg) {
      kid = seg.change !== 0 ? seg.label : "";
      const c = coverStage(seg.change, m, a ? (s.kidCover ?? {})[stageKey({ from: seg.from + KID_BASE, to: seg.to + KID_BASE })] : undefined);
      for (const k of COVER_ORDER) m[k] = Math.max(0, m[k] - c.take[k]);
      short = c.short;
    }
    // Then the saving changes, on your own saving before the children.
    const Y = yearChange(changes, yr, Math.ceil(T), own);
    // A cut can't take saving below nothing: what it can't take is said, not run.
    const cutShort = Y.cut > 0 ? cutFrom(m, Y.cut, a ? Y.typed : {}) : 0;
    for (const k of COVER_ORDER) m[k] += a ? Y.add[k] : (k === "brok" ? sum(Y.add) : 0);
    const N = nominalAt(changes, yr, p.gross);
    const L = Number.isInteger(at) ? changes.filter((c) => c.kind === "lump" && c.from === at && c.amount !== 0) : [];
    const lump = L.length ? { amount: L.reduce((t, c) => t + c.amount, 0), to: a ? lumpAccount(L[0]) : ("b" as const) } : null;
    slices.push({ a: at, b: edges[i + 1], monthly: m, nominal: N.nominal, tags: [...Y.tags, ...N.tags], kid, lump, short, lumpIds: L.map((c) => c.id), cutShort });
  }

  // Slices run together while nothing new happens and each account's saving
  // keeps rising at its own rate, after inflation: one stage, exact.
  const ratio = (k: CoverLine) => (1 + rateOf(k)) / (1 + infl);
  const keyOf = (x: Slice) => x.nominal.toFixed(8) + "|" + x.tags.join(",") + "|" + x.kid;
  const groups: { from: number; to: number; first: Slice }[] = [];
  for (const x of slices) {
    const g = groups[groups.length - 1];
    const fits = g && !x.lump && keyOf(g.first) === keyOf(x) && Number.isInteger(x.a) && Number.isInteger(g.first.a)
      && COVER_ORDER.every((k) => Math.abs(x.monthly[k] - g.first.monthly[k] * Math.pow(ratio(k), x.a - g.first.a)) < 0.005);
    if (fits) g.to = x.b;
    else groups.push({ from: x.a, to: x.b, first: x });
  }

  // The list shows a stage wherever what's going on changes (the math
  // above may run it year by year); its rise is its first year's.
  const nameOf = (id: string) => { const c = list.find((x) => x.id === id); return c ? scenarioName(c) : ""; };
  const namesOf = (x: Slice) => [...(x.kid ? [x.kid] : []), ...[...new Set([...x.tags, ...x.lumpIds])].filter((id) => id !== CHILDREN_ID).map(nameOf).filter(Boolean)];
  const shownGroups: { from: number; to: number; first: Slice; second?: Slice }[] = [];
  for (const x of slices) {
    const g = shownGroups[shownGroups.length - 1];
    if (g && !x.lump && keyOf(g.first) === keyOf(x)) { g.to = x.b; if (!g.second && Number.isInteger(x.a) && x.a === g.first.a + 1) g.second = x; }
    else shownGroups.push({ from: x.a, to: x.b, first: x });
  }
  const shown: ShownStage[] = shownGroups.map((g) => {
    const t0 = sum(g.first.monthly), t1 = g.second ? sum(g.second.monthly) : t0;
    return { from: g.from, to: g.to, monthly: g.first.monthly, rises: t0 > 0 ? t1 / t0 - 1 : 0, nominal: g.first.nominal, lump: g.first.lump, names: namesOf(g.first), short: g.first.short };
  });

  // A stage from a group (or one year of one, inside a glide that has to be split).
  const stageOf = (from: number, to: number, x: Slice, nominal: number, glide?: { endRate: number; years: number }): StageInputs => {
    const total = sum(x.monthly), per = (v: number) => (v * 12) / ppy;
    const split = !a ? {} : total > 0 ? { sTrad: x.monthly.trad / total, sRoth: x.monthly.roth / total, ...(x.monthly.hsa > 0 ? { sHsa: x.monthly.hsa / total } : {}) } : { sTrad: st0.sTrad, sRoth: st0.sRoth, ...(st0.sHsa ? { sHsa: st0.sHsa } : {}) };
    const out: StageInputs = {
      ...st0, years: String(Math.round((to - from) * 1e6) / 1e6), contrib: String(+per(total).toFixed(8)),
      nominal: String(+(nominal * 100).toFixed(6)), adj: from > 0,
      glideOn: !!glide, glideEnd: glide ? String(+(glide.endRate * 100).toFixed(6)) : "", glideYears: glide ? String(glide.years) : "",
      ...split,
    };
    // Rates by account run as Advanced runs them: the whole contribution, and
    // the match, rising at their blend (a stage's own blend would differ).
    delete out.gRates; out.growth = String(+(p.growth * 100).toFixed(8));
    delete out.lump; delete out.lumpTo;
    if (x.lump && from === x.a) Object.assign(out, { lump: Math.round(x.lump.amount), lumpTo: x.lump.to });
    return out;
  };

  // The glide eases the return over the plan's final years. When the last
  // stage covers them all it glides itself; otherwise every year inside
  // them is its own stage at that year's rate.
  const glide = p.glide.on ? { endRate: p.glide.endRateGross ?? (p.glide.endRate ?? 0) + p.fees, years: p.glide.years ?? 1 } : null;
  const gStart = glide ? T - glide.years : T;
  const stages: StageInputs[] = [], glideAt: (number | null)[] = [];
  groups.forEach((g, gi) => {
    const last = gi === groups.length - 1;
    if (!glide || g.to <= gStart) { stages.push(stageOf(g.from, g.to, g.first, g.first.nominal)); glideAt.push(null); return; }
    if (last && g.from <= gStart) {
      // The glide's years are counted within this stage.
      stages.push(stageOf(g.from, g.to, g.first, g.first.nominal, { endRate: glide.endRate, years: Math.min(glide.years, Math.max(1, Math.round(g.to - g.from))) }));
      glideAt.push(null);
      return;
    }
    // Split at the glide's start, then year by year at the glide's rate.
    let at = g.from;
    if (at < gStart) { stages.push(stageOf(at, gStart, g.first, g.first.nominal)); glideAt.push(null); at = gStart; }
    for (const x of slices.filter((y) => y.a >= at && y.a < g.to)) {
      const yearNo = Math.floor(x.a) + 1;
      stages.push(stageOf(x.a, x.b, x, glideAnnualRate(yearNo, T, glide.years, x.nominal, glide.endRate)));
      glideAt.push(glideAnnualRate(yearNo, T, glide.years, 0, 1));
    }
  });

  const starts = list.filter((c) => c.kind !== "children").map((c) => ({ id: c.id, year: c.from }))
    .concat(kidsOn && kidSegs.length ? [{ id: CHILDREN_ID, year: kidSegs.find((x) => x.change !== 0)?.from ?? 0 }] : []);
  const firstShort = slices.find((x) => x.cutShort > 0.5);
  const cutShort = firstShort ? { from: firstShort.a, most: Math.max(...slices.map((x) => x.cutShort)) } : null;
  return { inputs: { ...next, stages, kids: null, kidCover: {} }, shown, starts, glideAt, cutShort };
}

/** The plan's results under the changes: the Stages engine's. */
export function changesCompute(s: AdvancedInputs, household: Household | null) {
  const C = compileChanges(s, household);
  return { C, V: stagesCompute(C.inputs, household) };
}

/** A lump sum taken out of more than its account holds that day: the
    year, what's there then and what's asked for, today's dollars. */
export interface LumpShort { from: number; have: number; need: number; acct: "t" | "r" | "b" | "h" | null }
export function lumpShorts(C: Compiled, V: ReturnType<typeof stagesCompute>): LumpShort[] {
  const out: LumpShort[] = [], infl = V.P.g.inflation;
  let start = 0;
  C.inputs.stages.forEach((st, i) => {
    const lump = st.lump ?? 0;
    if (lump < 0) {
      const series = V.P.slices && st.lumpTo ? V.P.slices[st.lumpTo] : null;
      const at = (series ?? V.R).summary[i]?.start ?? 0, real = at / Math.pow(1 + infl, start);
      if (-lump > real + 0.5) out.push({ from: start, have: Math.max(0, real), need: -lump, acct: series ? st.lumpTo! : null });
    }
    start += parseNum(st.years);
  });
  return out;
}

/* ---------- the answers: when you could stop saving, when you could retire ---------- */

/** The one change "Stop saving" adds, replaced each time it's used again. */
export const COAST_ID = "coast";
export const coastChange = (from: number, base: Partial<Scenario> = {}): Scenario => ({
  id: COAST_ID, kind: "saving", name: "Stop saving", on: true, from, until: 0, mode: "pct", amount: -100, ramp: 0, acct: "auto", nominal: 0, ...base,
});

/** Savings at the end in today's dollars, and the portfolio the goal needs. */
function reach(s: AdvancedInputs, household: Household | null): { fv: number; need: number } {
  const { V } = changesCompute(s, household);
  return { fv: V.R.fvReal, need: V.portToday };
}

const withChange = (s: AdvancedInputs, c: Scenario): AdvancedInputs => {
  const list = s.changes ?? [], i = list.findIndex((x) => x.id === c.id);
  return { ...s, changes: i >= 0 ? list.map((x, j) => (j === i ? c : x)) : [...list, c] };
};
const withoutChange = (s: AdvancedInputs, id: string): AdvancedInputs => ({ ...s, changes: (s.changes ?? []).filter((x) => x.id !== id) });

/** When you could stop saving outright (the match included) and still reach
    the goal by the end, with the changes on as they are (the stop-saving
    change itself left out). `at` is years from now, null when saving has
    to go on to the end. `keep` is savings at the end saving as you are,
    `stop` with saving stopped at `at`, `need` the portfolio the goal needs
    then. Today's dollars. */
export interface CoastAnswer { at: number | null; need: number; keep: number; stop: number | null }
export function coastAnswer(s: AdvancedInputs, household: Household | null, run: (s: AdvancedInputs) => { fv: number; need: number } = (x) => reach(x, household)): CoastAnswer | null {
  const base = withoutChange(s, COAST_ID), now = run(base);
  if (!(now.need > 0) || !isFinite(now.fv)) return null;
  const end = Math.max(1, Math.ceil(parseNum(s.years)));
  const short: CoastAnswer = { at: null, need: now.need, keep: now.fv, stop: null };
  if (now.fv < now.need) return short;
  const tried = new Map<number, { fv: number; need: number }>();
  const at = (y: number) => { if (!tried.has(y)) tried.set(y, run(withChange(base, coastChange(y)))); return tried.get(y)!; };
  const ok = (y: number) => at(y).fv >= at(y).need;
  const found = (y: number): CoastAnswer => ({ at: y, need: at(y).need, keep: now.fv, stop: at(y).fv });
  if (ok(0)) return found(0);
  let lo = 0, hi = end;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ok(mid)) hi = mid; else lo = mid; }
  return hi >= end ? short : found(hi);
}

/** The fewest whole years that reach the goal, with everything else as it
    is (a change running to the end runs to then), up to 100. `years` is
    null when 100 years don't. */
export interface RetireAnswer { years: number | null; need: number; fv: number }
export function retireAnswer(s: AdvancedInputs, household: Household | null, run: (s: AdvancedInputs) => { fv: number; need: number } = (x) => reach(x, household)): RetireAnswer | null {
  const at = (y: number) => run(yearsTo(s, y));
  const now = Math.max(1, Math.round(parseNum(s.years)));
  const cur = at(now);
  if (!(cur.need > 0)) return null;
  const tried = new Map<number, { fv: number; need: number }>([[now, cur]]);
  const get = (y: number) => { if (!tried.has(y)) tried.set(y, at(y)); return tried.get(y)!; };
  const ok = (y: number) => get(y).fv >= get(y).need;
  let lo: number, hi: number;
  if (ok(now)) { lo = 0; hi = now; }
  else {
    if (!ok(100)) return { years: null, need: get(100).need, fv: get(100).fv };
    lo = now; hi = 100;
  }
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ok(mid)) hi = mid; else lo = mid; }
  return { years: hi, need: get(hi).need, fv: get(hi).fv };
}

/** The inputs with the plan running `years`, the glide held inside it. */
export function yearsTo(s: AdvancedInputs, years: number): AdvancedInputs {
  const next = { ...s, years: String(years) };
  return next.glideOn ? { ...next, glideYears: glideYearsFor(next.years, next.glideYears) } : next;
}

export { withChange, withoutChange };
export type { PlanKids };
