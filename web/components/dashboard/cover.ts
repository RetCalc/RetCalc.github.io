/* Where the children's costs (and college's) come out of saving. A stage's
   amounts typed in "How will you cover it?" stand, account by account; the
   rest comes out in the dashboard's order, which keeps the most valuable
   saving longest: the brokerage, the 401(k) beyond the match, the IRA,
   the HSA, and the 401(k) up to the match last. A cut from pre-tax saving
   is taxed as pay again, so it's cut far enough to free what's needed.
   What saving can't cover comes out of spending. From these, the plan's
   saving year by year, account by account (Answers.yearly), so every tab
   follows the same choices. No React. */

import type { PcInput } from "@/tools/budget/paycheck-math";
import { paycheckFreed, kidStages, stageKey, type Cover, type Freed, type Monthly } from "@/tools/plan/kids";
import { COVER_ORDER, type CoverLine } from "@/tools/plan/model";
import { childCost, children } from "@/tools/guide/schedule";
import type { Answers, YearSaving } from "@/tools/guide/store";
import { growthLines, type Flow } from "./flows";
import { yearChange } from "./scenarios";
import type { Profile } from "./store";

type Line = "brok" | "k401max" | "rothIra" | "hsa" | "match";
/** The order saving is given up in when nothing's typed. */
export const DASH_ORDER: readonly Line[] = ["brok", "k401max", "rothIra", "hsa", "match"];
export const DASH_ORDER_TEXT = "the brokerage first, then the 401(k) beyond the match, the IRA and the HSA, and the 401(k) up to the match last";

/** Which account a paycheck line is, by how it's taxed. */
const kindOf = (pi: PcInput, l: Line): CoverLine => (l === "brok" ? "brok" : l === "hsa" ? "hsa" : pi.roth[l] ? "roth" : "trad");

/** Each line a month, from the paycheck's amounts (or ones given). */
const linesOf = (pi: PcInput, a = pi.amounts): Record<Line, number> =>
  Object.fromEntries(DASH_ORDER.map((l) => [l, Math.max(0, a[l]) * (pi.p / 12)])) as Record<Line, number>;

/** Saving a month by account, from its lines. */
export function byKind(pi: PcInput, lines: Record<Line, number>): Monthly {
  const m: Monthly = { brok: 0, roth: 0, trad: 0, hsa: 0 };
  for (const l of DASH_ORDER) m[kindOf(pi, l)] += lines[l];
  return m;
}

const NONE = (): Monthly => ({ brok: 0, roth: 0, trad: 0, hsa: 0 });

/** coverStage (tools/plan/kids.ts) in the dashboard's order: the typed
    amounts first, then line by line, each cut by the fewest whole dollars
    that free the rest. Costs lower than today add to the brokerage. */
export function coverDash(change: number, pi: PcInput, typed: Partial<Monthly> = {}, lines = linesOf(pi), F: Freed = freedFor(pi, lines)): Cover {
  const need = Math.round(change), today = byKind(pi, lines);
  const take = NONE();
  const done = (): Cover => {
    const f = F(take), sum = COVER_ORDER.reduce((s, k) => s + take[k], 0);
    const freedBy = NONE();
    let left = need;
    for (const k of COVER_ORDER) {
      if (take[k] <= 0) { freedBy[k] = take[k]; continue; }
      const own = Math.round(F({ ...NONE(), [k]: take[k] }).freed);
      freedBy[k] = need > 0 ? Math.max(0, Math.min(own, left)) : own;
      left -= freedBy[k];
    }
    const short = need > 0 ? Math.max(0, Math.ceil(need - f.freed - 0.005)) : 0;
    return { take, freed: f.freed, freedBy, short, matchLost: f.matchLost, taxUp: Math.max(0, sum - f.freed) };
  };
  if (need <= 0) {
    take.brok = need;
    return done();
  }
  for (const k of COVER_ORDER) if (typed[k] != null) take[k] = Math.max(0, Math.min(Math.floor(today[k] + 0.005), Math.round(typed[k]!)));
  // How much of each account the lines before this one have already offered.
  const offered = NONE();
  for (const l of DASH_ORDER) {
    const k = kindOf(pi, l);
    if (typed[k] != null) continue;
    const upTo = offered[k] + lines[l];
    offered[k] = upTo;
    if (F(take).freed >= need - 0.005) break;
    const from = take[k];
    take[k] = upTo;
    if (F(take).freed <= need) continue;
    let lo = from, hi = Math.ceil(upTo);
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      take[k] = mid;
      if (F(take).freed >= need - 0.005) hi = mid; else lo = mid;
    }
    take[k] = Math.min(hi, upTo);
  }
  return done();
}

/** What cuts free, on a paycheck with these lines a month: the paycheck's
    own taxes, each account's cut taken from its lines with the match last. */
export function freedFor(pi: PcInput, lines: Record<Line, number>): Freed {
  const per = (v: number) => (v * 12) / pi.p;
  const amounts = { ...pi.amounts, ...Object.fromEntries(DASH_ORDER.map((l) => [l, per(lines[l])])) };
  return paycheckFreed({ ...pi, amounts });
}

/** The plan's saving year by year from now to retirement, account by
    account: each line grown to its limit, less what the children cost
    beyond today (and college, unless it's saved for ahead), taken as the
    profile's "How will you cover it?" says, then in the dashboard's order. */
export function yearlySaving(pr: Profile, F: Flow, a: Answers, opts: { college: number[] } = { college: [] }): { rows: YearSaving[]; base: number[] } {
  // Worked out once for each profile: every tab asks for it.
  const key = JSON.stringify([pr, a.age, a.retire, opts.college]), hit = CACHE.get(key);
  if (hit) return hit;
  const out = yearlyRun(pr, F, a, opts);
  if (CACHE.size > 16) CACHE.delete(CACHE.keys().next().value!);
  CACHE.set(key, out);
  return out;
}
const CACHE = new Map<string, { rows: YearSaving[]; base: number[] }>();

function yearlyRun(pr: Profile, F: Flow, a: Answers, opts: { college: number[] }): { rows: YearSaving[]; base: number[] } {
  const age = Math.round(a.age ?? 0), end = Math.round(a.retire ?? 0), pi = F.pi;
  if (!(end > age)) return { rows: [], base: [] };
  const L = growthLines(pr, F), kids = children(a), scen = pr.scenarios ?? [];
  const costNow = kids.filter((c) => !c.planned).reduce((s, c) => s + childCost(c, age), 0);
  const segs = kidStages(kidsOf(a), age, end), cover = pr.kidCover ?? {};
  const m0 = L.find((l) => l.id === "match")!;
  const rows: YearSaving[] = [], base: number[] = [];
  for (let t = age; t < end; t++) {
    const k = t - age;
    const lines = Object.fromEntries(DASH_ORDER.map((id) => {
      const l = L.find((x) => x.id === id)!;
      const cap = l.capAt(k);
      return [id, Math.min(l.amount * Math.pow(1 + l.growth, k), isFinite(cap) ? Math.max(cap, l.amount) : Infinity)];
    })) as Record<Line, number>;
    const employer = F.match * (m0.amount > 0 ? lines.match / m0.amount : 1);
    // The Calculator's scenarios this year: saving given up (covered like
    // the children's costs, from the accounts they name first), and saving
    // or a lump sum added to an account.
    const own = byKind(pi, lines), Y = yearChange(scen, t, end, own.brok + own.roth + own.trad + own.hsa);
    const need = kids.reduce((s, c) => s + childCost(c, t), 0) - costNow + (opts.college[k] ?? 0) + Y.cut;
    const seg = segs.find((s) => s.from <= t && t < s.to);
    const typedKids = seg ? cover[stageKey(seg)] : undefined;
    const typed = Y.cut > 0 ? Object.fromEntries(COVER_ORDER.filter((a) => typedKids?.[a] != null || Y.typed[a] != null).map((a) => [a, (typedKids?.[a] ?? 0) + (Y.typed[a] ?? 0)])) as Partial<Monthly> : typedKids;
    const c = Math.abs(need) < 0.5 ? null : coverDash(need, pi, typed, lines);
    const left = own;
    if (c) for (const kk of COVER_ORDER) left[kk] = Math.max(0, left[kk] - c.take[kk]);
    for (const kk of COVER_ORDER) left[kk] += Y.add[kk];
    const emp = Math.max(0, employer - (c?.matchLost ?? 0));
    // The employer's money goes in as the match line is taxed.
    const empRoth = pi.roth.match;
    rows.push({ t: left.trad + (empRoth ? 0 : emp), r: left.roth + left.hsa + (empRoth ? emp : 0), b: left.brok, short: c?.short ?? 0 });
    base.push(Object.values(lines).reduce((s, v) => s + v, 0) + employer);
  }
  return { rows, base };
}

/** The children as kidStages takes them, from the answers. */
function kidsOf(a: Answers) {
  return {
    now: a.kidsNow ?? [], planned: a.kidsPlanned ?? 0, firstIn: a.firstIn ?? 2, spacing: a.spacing ?? 3, childcare: a.childcare !== false,
    early: a.childEarly != null ? String(a.childEarly) : "", school: a.childSchool != null ? String(a.childSchool) : "", teen: a.childTeen != null ? String(a.childTeen) : "",
    area: a.careArea ?? "suburb", ...(a.childLater != null ? { later: String(a.childLater * 100) } : {}), gaps: a.kidGaps ?? null,
  };
}

/** "How will you cover it?" in the dashboard: today's saving by account,
    and each stage's cover in the dashboard's order. */
export function coverScope(F: Flow) {
  const lines = linesOf(F.pi), Fr = freedFor(F.pi, lines);
  return { today: byKind(F.pi, lines), fn: (change: number, typed?: Partial<Monthly>) => coverDash(change, F.pi, typed, lines, Fr), order: DASH_ORDER_TEXT };
}

/** A cover's stages moved by `d` years: the Calculator counts them from
    year 0, the profile by your age. */
export function shiftCover(c: Record<string, Partial<Monthly>>, d: number): Record<string, Partial<Monthly>> {
  return Object.fromEntries(Object.entries(c).map(([k, v]) => {
    const [a, b] = k.split("-").map(Number);
    return [`${a + d}-${b + d}`, v];
  }));
}
