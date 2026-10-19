/* The walkthrough's children: what they cost each year from now to
   retirement, the stages that come from that, and how each stage pays for
   them out of the saving. The costs are the Guide's (children(), childCost()
   and the stage words in tools/guide/schedule.ts); only the split across
   accounts is the walkthrough's own. No React. */
import { PER_YEAR } from "@/lib/engine/typed";
import { groupDigits, parseNum } from "@/lib/format";
import type { AdvancedInputs, AdvancedPlan } from "@/tools/advanced/model";
import { stagesFromAdvanced } from "@/tools/advanced/toStages";
import { CHILD_COST, childCost, children, labelAt, type Child } from "@/tools/guide/schedule";
import type { Answers } from "@/tools/guide/store";
import { stageFields, type StageInputs, type StagesInputs } from "@/tools/stages/model";
import { COVER_ORDER, type CoverLine, type PlanKids } from "./model";

const pos = (v: number) => isFinite(v) && v > 0;

/** The answers as the Guide keeps them, for its child functions. */
function asAnswers(k: PlanKids, age: number): Answers {
  const early = parseNum(k.early), school = parseNum(k.school);
  return {
    age, kidsNow: k.now, kidsPlanned: k.planned, firstIn: k.firstIn, spacing: k.spacing, childcare: k.childcare,
    childEarly: pos(early) ? early : null, childSchool: pos(school) ? school : null, events: [],
  } as unknown as Answers;
}

/** Every child, by your age at their birth, in birth order. */
export function kidList(k: PlanKids, age: number): Child[] {
  return children(asAnswers(k, age));
}

/** The default monthly cost of a child before school, and at school. */
export const kidDefaults = (k: PlanKids) => ({ early: k.childcare ? CHILD_COST.care : CHILD_COST.noCare, school: CHILD_COST.school });

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

export interface Cover {
  /** A month taken from each account (negative: added, when the children
      cost less than today). */
  take: Monthly;
  /** What the saving can't cover: it comes out of spending. */
  short: number;
}

/** How a stage pays for `change` more a month than today: the amounts
    typed for an account stand; the rest comes out of the others in
    COVER_ORDER, as far as each goes. Costs lower than today add to the
    brokerage unless typed otherwise. */
export function coverStage(change: number, today: Monthly, typed: Partial<Monthly> = {}): Cover {
  const take: Monthly = { brok: 0, roth: 0, trad: 0, hsa: 0 };
  if (change <= 0) {
    for (const k of COVER_ORDER) if (typed[k] != null) take[k] = Math.max(-1e9, Math.min(today[k], typed[k]!));
    const set = COVER_ORDER.reduce((s, k) => s + take[k], 0);
    if (typed.brok == null) take.brok = change - (set - take.brok);
    return { take, short: 0 };
  }
  let left = change;
  for (const k of COVER_ORDER) if (typed[k] != null) { take[k] = Math.max(0, Math.min(today[k], typed[k]!)); left -= take[k]; }
  for (const k of COVER_ORDER) {
    if (typed[k] != null || left <= 0) continue;
    take[k] = Math.min(today[k], left);
    left -= take[k];
  }
  return { take, short: Math.max(0, Math.round(left * 100) / 100) };
}

const cents = (v: number) => Math.round(v * 100) / 100;

/** Stages built from the plan in Advanced and the children: the accounts,
    rates and target as Advanced has them (stagesFromAdvanced), and one stage
    for each KidStage, saving today's amounts less what that stage's
    children take, in today's dollars (each later stage restated at its
    start, Stages' "adjust for inflation"). A glide stays on the last. */
export function stagesFromKids(P: AdvancedPlan, adv: AdvancedInputs, cur: StagesInputs, segs: KidStage[],
  cover: Record<string, Partial<Monthly>>): StagesInputs {
  const { next } = stagesFromAdvanced(P, adv, cur, null);
  const p = P.p, period = p.period, ppy = PER_YEAR[period] ?? 12, today = monthlyByAccount(P, period);
  const stages: StageInputs[] = segs.map((seg, i) => {
    const { take } = coverStage(seg.change, today, cover[stageKey(seg)]);
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
