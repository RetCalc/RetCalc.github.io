/* The walkthrough's children: what they cost each year from now to
   retirement, the stages that come from that, and how each stage pays for
   them out of the saving. The costs are the Guide's (children(), childCost()
   and the stage words in tools/guide/schedule.ts); only the split across
   accounts is the walkthrough's own. No React. */
import { PER_YEAR } from "@/lib/engine/typed";
import { groupDigits, parseNum } from "@/lib/format";
import type { AdvancedInputs, AdvancedPlan } from "@/tools/advanced/model";
import { stagesFromAdvanced } from "@/tools/advanced/toStages";
import { CHILD_COST, MAX_KIDS, childCost, children, earlyCost, labelAt, type Child } from "@/tools/guide/schedule";
import type { Answers } from "@/tools/guide/store";
import { paycheckRun, type PcInput, type PcStep } from "@/tools/budget/paycheck-math";
import { stageFields, type StageInputs, type StagesInputs } from "@/tools/stages/model";
import { COVER_ORDER, type CoverLine, type PlanKids } from "./model";

const pos = (v: number) => isFinite(v) && v > 0;

/** The answers as the Guide keeps them, for its child functions. */
function asAnswers(k: PlanKids, age: number): Answers {
  const early = parseNum(k.early), school = parseNum(k.school), teen = parseNum(k.teen ?? "");
  return {
    age, kidsNow: k.now.slice(0, MAX_KIDS), kidsPlanned: k.planned, firstIn: k.firstIn, spacing: k.spacing, childcare: k.childcare,
    childEarly: pos(early) ? early : null, childSchool: pos(school) ? school : null, childTeen: pos(teen) ? teen : null,
    careArea: k.area ?? "suburb", kidGaps: k.gaps ?? null, events: [],
  } as unknown as Answers;
}

/** Every child, by your age at their birth, in birth order. */
export function kidList(k: PlanKids, age: number): Child[] {
  return children(asAnswers(k, age));
}

/** The default monthly cost of a child before school, and at school. */
export const kidDefaults = (k: PlanKids) => ({ early: earlyCost(k.childcare, k.area ?? "suburb"), school: CHILD_COST.school, teen: CHILD_COST.teen });

/** What the children cost a month at your age `t`, in today's dollars. */
export const kidCostAt = (kids: Child[], t: number) => kids.reduce((s, c) => s + childCost(c, t), 0);

export interface KidStage {
  /** Your ages: from, and up to (not including). */
  from: number; to: number;
  label: string;
  /** The children's cost a month then, and how much more than today (less
      when negative): today's are already in the budget. Today's dollars. */
  cost: number; change: number;
}

/** The stages from now to retirement: a new one wherever the children's
    cost changes, with the Guide's words for each. With no children, one. */
export function kidStages(k: PlanKids | null, age: number, retire: number): KidStage[] {
  const a = Math.round(age), end = Math.round(retire);
  if (!(end > a)) return [];
  const kids = k ? kidList(k, a) : [];
  if (!kids.length) return [{ from: a, to: end, label: "Saving", cost: 0, change: 0 }];
  const A = asAnswers(k!, a), now = kidCostAt(kids, a);
  const out: KidStage[] = [];
  for (let t = a; t < end; t++) {
    const cost = Math.round(kidCostAt(kids, t)), label = labelAt(A, kids, t, []), last = out[out.length - 1];
    if (last && last.cost === cost && last.label === label) last.to = t + 1;
    else out.push({ from: t, to: t + 1, label, cost, change: Math.round(cost - now) });
  }
  // Neighbours that cost the same are one stage, under the first one's words.
  const merged: KidStage[] = [];
  for (const s of out) {
    const last = merged[merged.length - 1];
    if (last && last.cost === s.cost) last.to = s.to;
    else merged.push({ ...s });
  }
  return merged;
}

export const stageKey = (s: { from: number; to: number }) => s.from + "-" + s.to;

/** Today's saving a month, by account. */
export type Monthly = Record<CoverLine, number>;

/** What Advanced puts in a month, by account (your own money; the match is
    worked out from it). Without the split, all of it as traditional. */
export function monthlyByAccount(P: AdvancedPlan, period: string): Monthly {
  const ppy = PER_YEAR[period] ?? 12, mo = (v: number) => (v * ppy) / 12;
  if (!P.a) return { brok: 0, roth: 0, trad: mo(P.p.contrib), hsa: 0 };
  return { brok: mo(P.a.brokC), roth: mo(P.a.rothC), trad: mo(P.a.tradC), hsa: mo(P.a.hsaC) };
}

/** What cutting a month's saving from each account frees in take-home
    pay, and what it costs in employer match, both a month. */
export type Freed = (take: Monthly) => { freed: number; matchLost: number };

/** Cuts free their full amount (no paycheck to work the taxes out on). */
export const ONE_FOR_ONE: Freed = (t) => ({ freed: COVER_ORDER.reduce((s, k) => s + t[k], 0), matchLost: 0 });

/** The paycheck's own taxes behind each cut. Money kept out of a traditional
    401(k), traditional IRA or HSA is taxed as pay again (the HSA through
    payroll skips Social Security and Medicare too), so cutting a dollar
    from one frees less than a dollar; brokerage and Roth free it all. Each
    account's cut comes off the paycheck lines it's made of (traditional:
    beyond the match, then the IRA, then the match line), and the paycheck
    is run again. */
export function paycheckFreed(pi: PcInput): Freed {
  const base = paycheckRun(pi), mo = pi.p / 12, per = (v: number) => (Math.max(0, v) * 12) / pi.p, R = pi.roth;
  const TRAD: PcStep[] = (["k401max", "rothIra", "match"] as const).filter((k) => !R[k]);
  const ROTH: PcStep[] = (["rothIra", "k401max", "match"] as const).filter((k) => R[k]);
  return (take) => {
    const a = { ...pi.amounts };
    const cut = (lines: PcStep[], v: number) => { for (const k of lines) { const c = Math.min(a[k], v); a[k] -= c; v -= c; } };
    cut(TRAD, per(take.trad)); cut(ROTH, per(take.roth)); cut(["brok"], per(take.brok)); cut(["hsa"], per(take.hsa));
    const r = paycheckRun(pi, a);
    return { freed: COVER_ORDER.reduce((s, k) => s + take[k], 0) - (r.taxes - base.taxes) * mo, matchLost: Math.max(0, (base.match - r.match) * mo) };
  };
}

export interface Cover {
  /** A month cut from each account, in whole dollars (negative: added,
      when the children cost less than today). */
  take: Monthly;
  /** The take-home pay that frees, after the tax it brings back. */
  freed: number;
  /** What each account's cut frees, in whole dollars, adding up exactly to
      what the stage needs (the last cut covers the rest to the dollar). */
  freedBy: Monthly;
  /** What saving can't cover, in whole dollars: it comes out of spending. */
  short: number;
  /** Employer match given up, and the extra tax on the cuts, a month. */
  matchLost: number; taxUp: number;
}

/** How a stage pays for `change` more a month than today, in whole dollars:
    the amounts typed for an account stand; the rest comes out of the others
    in COVER_ORDER, each cut by the fewest whole dollars that free the rest
    in take-home pay (a pre-tax cut frees less than itself), and as far as
    each goes. Costs lower than today add to the brokerage unless typed
    otherwise. */
export function coverStage(change: number, today: Monthly, typed: Partial<Monthly> = {}, F: Freed = ONE_FOR_ONE): Cover {
  const need = Math.round(change);
  const take: Monthly = { brok: 0, roth: 0, trad: 0, hsa: 0 };
  const cap = (k: CoverLine) => Math.max(0, Math.floor(today[k] + 0.005));
  const done = (): Cover => {
    const f = F(take), sum = COVER_ORDER.reduce((s, k) => s + take[k], 0);
    const freedBy = { brok: 0, roth: 0, trad: 0, hsa: 0 } as Monthly;
    let left = need;
    for (const k of COVER_ORDER) {
      if (take[k] <= 0) { freedBy[k] = take[k]; continue; }
      const own = Math.round(F({ brok: 0, roth: 0, trad: 0, hsa: 0, [k]: take[k] }).freed);
      freedBy[k] = need > 0 ? Math.max(0, Math.min(own, left)) : own;
      left -= freedBy[k];
    }
    const short = need > 0 ? Math.max(0, Math.ceil(need - f.freed - 0.005)) : 0;
    return { take, freed: f.freed, freedBy, short, matchLost: f.matchLost, taxUp: Math.max(0, sum - f.freed) };
  };
  if (need <= 0) {
    for (const k of COVER_ORDER) if (typed[k] != null) take[k] = Math.round(Math.min(today[k], typed[k]!));
    const set = COVER_ORDER.reduce((s, k) => s + take[k], 0);
    if (typed.brok == null) take.brok = need - (set - take.brok);
    return done();
  }
  for (const k of COVER_ORDER) if (typed[k] != null) take[k] = Math.max(0, Math.min(cap(k), Math.round(typed[k]!)));
  for (const k of COVER_ORDER) {
    if (typed[k] != null || F(take).freed >= need - 0.005) continue;
    // All of it (to the cent, so nothing is left behind), or the fewest
    // whole dollars that free the rest.
    take[k] = Math.max(0, today[k]);
    if (F(take).freed <= need) continue;
    let lo = 0, hi = Math.ceil(today[k]);
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      take[k] = mid;
      if (F(take).freed >= need - 0.005) hi = mid; else lo = mid;
    }
    take[k] = Math.min(hi, today[k]);
  }
  return done();
}

const cents = (v: number) => Math.round(v * 100) / 100;

/** Stages built from the plan in Advanced and the children: the accounts,
    rates and target as Advanced has them (stagesFromAdvanced), and one stage
    for each KidStage, saving today's amounts less what that stage's
    children take, in today's dollars (each later stage restated at its
    start, Stages' "adjust for inflation"). A glide stays on the last. */
export function stagesFromKids(P: AdvancedPlan, adv: AdvancedInputs, cur: StagesInputs, segs: KidStage[],
  cover: Record<string, Partial<Monthly>>, F: Freed = ONE_FOR_ONE): StagesInputs {
  const { next } = stagesFromAdvanced(P, adv, cur, null);
  const p = P.p, period = p.period, ppy = PER_YEAR[period] ?? 12, today = monthlyByAccount(P, period);
  const stages: StageInputs[] = segs.map((seg, i) => {
    const { take } = coverStage(seg.change, today, cover[stageKey(seg)], F);
    const m = Object.fromEntries((Object.keys(today) as CoverLine[]).map((k) => [k, Math.max(0, today[k] - take[k])])) as Monthly;
    const total = m.brok + m.roth + m.trad + m.hsa, per = (v: number) => (v * 12) / ppy;
    const last = i === segs.length - 1, years = seg.to - seg.from;
    const st = stageFields({
      years, contrib: cents(per(total)), period, growth: p.growth, nominal: p.gross, vol: p.vol, adj: i > 0,
      ...(P.a ? (total > 0 ? { sTrad: m.trad / total, sRoth: m.roth / total, ...(m.hsa > 0 ? { sHsa: m.hsa / total } : {}) } : { sTrad: 1, sRoth: 0 }) : {}),
      ...(P.a?.gRates ? { gRates: { ...P.a.gRates } } : {}),
      glide: last && p.glide.on ? { on: true, endRate: p.glide.endRate! + p.fees, years: Math.max(1, Math.min(years, p.glide.years!)) } : { on: false },
    });
    return { ...st, contrib: groupDigits(cents(per(total)), true), name: seg.label };
  });
  return { ...next, stages };
}
