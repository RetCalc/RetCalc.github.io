/* Where the children's costs (and college's) come out of saving. A stage's
   amounts typed in "How will you cover it?" stand, account by account; the
   rest comes out in the dashboard's order, which keeps the most valuable
   saving longest: the brokerage, the 401(k) beyond the match, the IRA,
   the HSA, and the 401(k) up to the match last. A cut from pre-tax saving
   is taxed as pay again, so it's cut far enough to free what's needed.
   What saving can't cover comes out of spending.

   Year by year to retirement, pay leads: each of you's pay grows by your
   raise (and changes as a pay change says), the paycheck's own calculator
   figures the taxes on it, and saving follows take-home pay, as the
   profile's "of each raise, how much is saved" says (the same share as now
   unless set). The children's costs, college and the changes come out of
   that saving as above, and what's spent is what's left. From these, the
   plan's saving year by year, account by account (Answers.yearly), so
   every tab follows the same choices. No React. */

import { paycheckRun, pcCap, type PcInput } from "@/tools/budget/paycheck-math";
import { paycheckFreed, kidStages, stageKey, type Cover, type Freed, type Monthly } from "@/tools/plan/kids";
import { COVER_ORDER, type CoverLine } from "@/tools/plan/model";
import { childCost, children } from "@/tools/guide/schedule";
import type { Answers, YearSaving } from "@/tools/guide/store";
import type { Flow } from "./flows";
import { payAt, yearChange } from "./scenarios";
import { OUTSIDE_US, type Profile } from "./store";

type Line = "brok" | "k401max" | "rothIra" | "hsa" | "match";
/** The order saving is given up in when nothing's typed. */
export const DASH_ORDER: readonly Line[] = ["brok", "k401max", "rothIra", "hsa", "match"];
export const DASH_ORDER_TEXT = "the brokerage first, then the 401(k) beyond the match, the IRA and the HSA, and the 401(k) up to the match last";

/** Which account a paycheck line is, by how it's taxed. */
const kindOf = (pi: PcInput, l: Line): CoverLine => (l === "brok" ? "brok" : l === "hsa" ? "hsa" : pi.roth[l] ? "roth" : "trad");

/** Each line a month, from the paycheck's amounts (or ones given). */
export const linesOf = (pi: PcInput, a = pi.amounts): Record<Line, number> =>
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

/** A year from now to retirement, as the Year by year tab shows it: a
    month, in today's dollars. */
export interface CashYear {
  /** Years from now, your age then, and the calendar year. */
  k: number; age: number; year: number;
  /** Each of you's pay before taxes (0 once stopped), and other income. */
  pay: [number, number]; other: number; income: number;
  /** Taxes on pay, and what's spent: everything not taxed or saved. */
  taxes: number; spending: number;
  /** Your own saving by account (after the children and the changes), the
      employer's match, and the emergency fund line. */
  saved: Monthly; match: number; ef: number;
  /** What the children cost beyond today, college, what the changes take
      from saving (negative when they add), and what saving can't cover. */
  kids: number; college: number; change: number; short: number;
  /** The changes at work that year (their ids), and who's working. */
  tags: string[]; works: [boolean, boolean];
}

/** The plan's saving year by year from now to retirement, account by
    account, and each year in full (`years`). */
export function yearlySaving(pr: Profile, F: Flow, a: Answers, opts: { college: number[] } = { college: [] }): YearsOut {
  // Worked out once for each profile: every tab asks for it.
  const key = JSON.stringify([pr, a.age, a.retire, opts.college]), hit = CACHE.get(key);
  if (hit) return hit;
  const out = yearlyRun(pr, F, a, opts);
  if (CACHE.size > 16) CACHE.delete(CACHE.keys().next().value!);
  CACHE.set(key, out);
  return out;
}
type YearsOut = { rows: YearSaving[]; base: number[]; years: CashYear[] };
const CACHE = new Map<string, YearsOut>();

const shift = (x: number | null, k: number) => (x == null ? null : x + k);
const total = (m: Record<string, number>) => Object.values(m).reduce((s, v) => s + v, 0);

function yearlyRun(pr: Profile, F: Flow, a: Answers, opts: { college: number[] }): YearsOut {
  const age = Math.round(a.age ?? 0), end = Math.round(a.retire ?? 0), pi = F.pi;
  if (!(end > age)) return { rows: [], base: [], years: [] };
  const kids = children(a), scen = pr.scenarios ?? [];
  const costNow = kids.filter((c) => !c.planned).reduce((s, c) => s + childCost(c, age), 0);
  const segs = kidStages(kidsOf(a), age, end), cover = pr.kidCover ?? {};
  const abroad = pr.state === OUTSIDE_US, Yr = pr.yearly ?? { raise: [0, 0], keep: null };
  const other = pr.other.reduce((s, o) => s + (o.amount ?? 0), 0), ef = F.ef;
  // Today's saving by line, and what it's a share of: take-home pay.
  const L0 = linesOf(pi), S0 = total(L0);
  const amountsOf = (pk: PcInput, lines: Record<Line, number>) => ({ ...pk.amounts, ...Object.fromEntries(DASH_ORDER.map((l) => [l, (lines[l] * 12) / pk.p])) });
  const taxOf = (pk: PcInput, lines: Record<Line, number>) => {
    const run = paycheckRun(pk, amountsOf(pk, lines));
    return { run, tax: abroad ? 0 : (run.taxes * pk.p) / 12 };
  };
  const A0 = (pi.gross + pi.gross2) / 12 + other - taxOf(pi, L0).tax;
  /* Saving of `S` a month on lines: today's lines in proportion; over a
     limit, the rest goes to the next line already in use (in the
     paycheck's order), and the brokerage last. With the two of you as
     today, no line is held below what goes into it now. */
  const alloc = (S: number, pk: PcInput): Record<Line, number> => {
    const r = S0 > 0 ? S / S0 : 0;
    const out = Object.fromEntries(DASH_ORDER.map((l) => [l, L0[l] * r])) as Record<Line, number>;
    if (S0 <= 0) { out.brok = S; return out; }
    const same = pk.two === pi.two;
    const capOf = (l: Line) => { const c = (pcCap(pk, l, amountsOf(pk, out)) * pk.p) / 12; return isFinite(c) ? Math.max(c, same ? L0[l] : 0) : Infinity; };
    let over = 0;
    for (const l of DASH_ORDER) { const c = capOf(l); if (out[l] > c) { over += out[l] - c; out[l] = c; } }
    const order = [...pk.order.filter((x): x is Line => x !== "ef" && x !== "brok" && L0[x as Line] > 0), "brok" as const];
    for (const l of order) {
      if (over <= 0.005) break;
      const m = Math.min(Math.max(0, capOf(l) - out[l]), over);
      out[l] += m; over -= m;
    }
    return out;
  };
  // When your partner stops work, if before you: the calendar year.
  const r2 = pr.who === "couple" && pr.p2.by != null && pr.p2.retire != null ? pr.p2.by + pr.p2.retire : null;
  const year0 = new Date().getFullYear();
  const rows: YearSaving[] = [], base: number[] = [], years: CashYear[] = [];
  for (let t = age; t < end; t++) {
    const k = t - age, year = year0 + k;
    const works: [boolean, boolean] = [true, pi.gross2 > 0 && (r2 == null || year < r2)];
    const P1 = payAt(scen, 0, t, end, pi.gross * Math.pow(1 + Yr.raise[0], k), Yr.raise[0]);
    const P2 = works[1] ? payAt(scen, 1, t, end, pi.gross2 * Math.pow(1 + Yr.raise[1], k), Yr.raise[1]) : { pay: 0, tags: [] };
    const pk: PcInput = { ...pi, gross: P1.pay, gross2: P2.pay, ...(pi.two && !works[1] ? { two: false } : {}), ...(pi.ages ? { ages: [shift(pi.ages[0], k), shift(pi.ages[1], k)] } : {}) };
    // Saving follows take-home pay, which its own pre-tax part lowers the
    // taxes on: worked out until the two agree.
    const inc = (P1.pay + P2.pay) / 12 + other;
    let S = S0, lines = L0, tx = taxOf(pk, lines);
    for (let it = 0; it < 8; it++) {
      const A = inc - tx.tax;
      const next = Math.max(0, Yr.keep == null ? (A0 > 0 ? (S0 * A) / A0 : S0) : S0 + Yr.keep * (A - A0));
      if (Math.abs(next - S) < 0.01) break;
      S = next; lines = alloc(S, pk); tx = taxOf(pk, lines);
    }
    const match = (tx.run.match * pk.p) / 12;
    // The Calculator's scenarios this year: saving given up (covered like
    // the children's costs, from the accounts they name first), and saving
    // added to an account.
    const own = byKind(pk, lines), Y = yearChange(scen, t, end, own.brok + own.roth + own.trad + own.hsa);
    const kidsCost = kids.reduce((s, c) => s + childCost(c, t), 0) - costNow, college = opts.college[k] ?? 0;
    const need = kidsCost + college + Y.cut;
    const seg = segs.find((s) => s.from <= t && t < s.to);
    const typedKids = seg ? cover[stageKey(seg)] : undefined;
    const typed = Y.cut > 0 ? Object.fromEntries(COVER_ORDER.filter((a) => typedKids?.[a] != null || Y.typed[a] != null).map((a) => [a, (typedKids?.[a] ?? 0) + (Y.typed[a] ?? 0)])) as Partial<Monthly> : typedKids;
    const c = Math.abs(need) < 0.5 ? null : coverDash(need, pk, typed, lines);
    const left = own;
    if (c) for (const kk of COVER_ORDER) left[kk] = Math.max(0, left[kk] - c.take[kk]);
    for (const kk of COVER_ORDER) left[kk] += Y.add[kk];
    const emp = Math.max(0, match - (c?.matchLost ?? 0));
    // The employer's money goes in as the match line is taxed.
    const empRoth = pk.roth.match;
    rows.push({ t: left.trad + (empRoth ? 0 : emp), r: left.roth + left.hsa + (empRoth ? emp : 0), b: left.brok, short: c?.short ?? 0 });
    base.push(total(lines) + match);
    const taxes = tx.tax + (abroad ? 0 : c?.taxUp ?? 0), saved = total(left);
    years.push({ k, age: t, year, pay: [P1.pay / 12, P2.pay / 12], other, income: inc, taxes, spending: inc - taxes - saved - ef,
      saved: { ...left }, match: emp, ef, kids: kidsCost, college, change: Y.cut - total(Y.add), short: c?.short ?? 0, tags: [...P1.tags, ...P2.tags, ...Y.tags], works });
  }
  return { rows, base, years };
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
