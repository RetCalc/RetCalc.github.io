/* Where the children's costs (and college's) come out of saving: as the
   profile's rule says ("How will you cover it?"), worked out each year on
   that year's saving. Unset, in the dashboard's order, which keeps the most
   valuable saving longest: the brokerage, the 401(k) beyond the match, the
   IRA, the HSA, and the 401(k) up to the match last; in an order of
   accounts, or in proportion to each one's saving, the 401(k) up to the
   match still last. A cut from pre-tax saving
   is taxed as pay again, so it's cut far enough to free what's needed.
   What saving can't cover comes out of spending.

   Year by year to retirement, pay leads: each of you's pay grows by your
   raise (and changes as a pay change says), the paycheck's own calculator
   figures the taxes on it, and saving follows take-home pay, as the
   profile's "of each raise, how much is saved" says (the same share as now
   unless set). When pay changes other than by a raise (a pay change, or
   your partner stopping work), what you spend carries on and saving takes
   the difference, each account within the limits that pay allows; the
   raises after are saved from there. The children's costs, college and the changes come out of
   that saving as above, and what's spent is what's left. From these, the
   plan's saving year by year, account by account (Answers.yearly), so
   every tab follows the same choices. No React. */

import { paycheckRun, pcCap, type PcInput } from "@/tools/budget/paycheck-math";
import { paycheckFreed, shareOut, type Cover, type Freed, type Monthly } from "@/tools/plan/kids";
import { COVER_ORDER, type CoverLine, type CoverRule } from "@/tools/plan/model";
import { childCost, children } from "@/tools/guide/schedule";
import type { Answers, YearSaving } from "@/tools/guide/store";
import type { Flow } from "./flows";
import { payAt, saveLessAt, yearChange } from "./scenarios";
import { OUTSIDE_US, type Profile, type YearEdit } from "./store";

type Line = "brok" | "k401max" | "rothIra" | "hsa" | "match";
/** The order saving is given up in when nothing's typed. */
export const DASH_ORDER: readonly Line[] = ["brok", "k401max", "rothIra", "hsa", "match"];

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

/** The lines in the order a rule takes them: unset, the dashboard's own;
    with an order, its accounts in turn (each one's lines in the
    dashboard's order), and the 401(k) up to the match always last. */
export function linesInOrder(pi: PcInput, rule: CoverRule | null | undefined): Line[] {
  const order = rule?.order;
  if (!order) return [...DASH_ORDER];
  const rank = (l: Line) => (l === "match" ? order.length : order.indexOf(kindOf(pi, l)));
  return [...DASH_ORDER].sort((x, y) => rank(x) - rank(y));
}

/** The accounts in the order the dashboard takes them when nothing's set:
    each account where its first line comes, the match left out. */
export function dashKindOrder(pi: PcInput): CoverLine[] {
  const out: CoverLine[] = [];
  for (const l of DASH_ORDER) { const k = kindOf(pi, l); if (l !== "match" && !out.includes(k)) out.push(k); }
  return [...out, ...COVER_ORDER.filter((k) => !out.includes(k))];
}

/** coverStage (tools/plan/kids.ts) on the dashboard's lines: the typed
    amounts first, then as the rule says, each cut by the fewest whole
    dollars that free the rest; the 401(k) up to the match last either way.
    Costs lower than today add to the brokerage. */
export function coverDash(change: number, pi: PcInput, typed: Partial<Monthly> = {}, lines = linesOf(pi), F: Freed = freedFor(pi, lines), rule: CoverRule | null = null): Cover {
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
  const covered = () => F(take).freed >= need - 0.005;
  // A line's account given up to `upTo`, by the fewest whole dollars that
  // free the rest.
  const upTo = (k: CoverLine, to: number) => {
    const from = take[k];
    take[k] = to;
    if (F(take).freed <= need) return;
    let lo = from, hi = Math.ceil(to);
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      take[k] = mid;
      if (covered()) hi = mid; else lo = mid;
    }
    take[k] = Math.min(hi, to);
  };
  if (rule?.by === "share") {
    // Every account by the same share of its saving beyond the match line;
    // that line only once the rest is all given up.
    const free = COVER_ORDER.filter((k) => typed[k] == null), m = kindOf(pi, "match");
    const beyond = { ...today, [m]: today[m] - lines.match };
    shareOut(take, free, beyond, covered);
    if (!covered() && typed[m] == null && lines.match > 0) upTo(m, today[m]);
    return done();
  }
  // How much of each account the lines before this one have already offered.
  const offered = NONE();
  for (const l of linesInOrder(pi, rule)) {
    const k = kindOf(pi, l);
    if (typed[k] != null) continue;
    offered[k] += lines[l];
    if (covered()) break;
    upTo(k, offered[k]);
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
  /** Debts paid off that year, by name, and what paying them (and the
      mortgage) off has freed for saving by then, a month. */
  paidOff: string[]; freed: number;
  /** The figures typed into the table for this year. */
  edits: YearEdit[];
}

/** The plan's saving year by year from now to retirement, account by
    account, and each year in full (`years`). */
export function yearlySaving(pr: Profile, F: Flow, a: Answers, opts: { college: number[] } = { college: [] }): YearsOut {
  // Worked out once for each profile: every tab asks for it.
  const key = JSON.stringify([pr, a.age, a.retire, opts.college, a.debtFreed, a.paidOff]), hit = CACHE.get(key);
  if (hit) return hit;
  const out = yearlyRun(pr, F, a, opts);
  if (CACHE.size > 16) CACHE.delete(CACHE.keys().next().value!);
  CACHE.set(key, out);
  return out;
}
/** `pre`: each year's paycheck and saving by line before the children's
    costs, college and the changes come out ("How will you cover it?"
    works each stage out on its first year's). */
type YearsOut = { rows: YearSaving[]; base: number[]; years: CashYear[]; pre: { pk: PcInput; lines: Record<Line, number> }[] };
const CACHE = new Map<string, YearsOut>();

const shift = (x: number | null, k: number) => (x == null ? null : x + k);
const total = (m: Record<string, number>) => Object.values(m).reduce((s, v) => s + v, 0);

function yearlyRun(pr: Profile, F: Flow, a: Answers, opts: { college: number[] }): YearsOut {
  const age = Math.round(a.age ?? 0), end = Math.round(a.retire ?? 0), pi = F.pi;
  if (!(end > age)) return { rows: [], base: [], years: [], pre: [] };
  const kids = children(a), scen = pr.scenarios ?? [];
  const costNow = kids.filter((c) => !c.planned).reduce((s, c) => s + childCost(c, age), 0);
  const rule = pr.coverRule ?? null;
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
     paycheck's order), and the brokerage last. With pay on its raises
     alone, no line is held below what goes into it now. `changed`: pay
     is off its raises (a pay change, or your partner stopped work). */
  const alloc = (S0in: number, pk: PcInput, changed: boolean, fr = 0): Record<Line, number> => {
    // `fr` of it is what paid-off debts free: added on top in the
    // paycheck's order, as more to save goes.
    const add = Math.min(Math.max(0, fr), S0in), S = S0in - add;
    // With pay changed, today's lines as far as the limits on that pay go,
    // before anything is cut or added; otherwise in proportion.
    const same = !changed, r = S0 > 0 ? S / S0 : 0;
    const out = Object.fromEntries(DASH_ORDER.map((l) => [l, L0[l] * (same ? r : 1)])) as Record<Line, number>;
    if (S0 <= 0) { out.brok = S + add; return out; }
    // Not held below today, with the two of you as today: a line already
    // over its limit stays as it is. The 401(k) beyond the match shares the
    // limit with the line up to it, so as that one grows with pay, this one
    // gives way: together they stay at today's 401(k) or the limit.
    const floorOf = (l: Line) => (!same ? 0 : l === "k401max" ? Math.max(0, L0.match + L0.k401max - out.match) : L0[l]);
    const capOf = (l: Line) => { const c = (pcCap(pk, l, amountsOf(pk, out)) * pk.p) / 12; return isFinite(c) ? Math.max(c, floorOf(l)) : Infinity; };
    let over = 0;
    // (The match line first with pay changed: the 401(k) beyond it gets
    // the room it leaves under each one's limit.)
    for (const l of same ? DASH_ORDER : (["match", ...DASH_ORDER.filter((x) => x !== "match")] as Line[])) {
      const c = capOf(l);
      if (out[l] > c) { over += same ? out[l] - c : 0; out[l] = c; }
    }
    if (!same) {
      // Less than that: cut in the dashboard's order (the brokerage first,
      // the 401(k) up to the match last), so the accounts worth most are
      // kept longest. More: the rest goes on as below.
      let cut = total(out) - S;
      for (const l of DASH_ORDER) { if (cut <= 0.005) break; const m = Math.min(out[l], cut); out[l] -= m; cut -= m; }
      over = Math.max(0, -cut);
    }
    over += add;
    const order = [...pk.order.filter((x): x is Line => x !== "ef" && x !== "brok" && L0[x as Line] > 0), "brok" as const];
    for (const l of order) {
      if (over <= 0.005) break;
      const m = Math.min(Math.max(0, capOf(l) - out[l]), over);
      out[l] += m; over -= m;
    }
    // The match line may have filled up above: the 401(k) beyond it gives
    // way, and what it gives goes to the brokerage.
    const ex = out.k401max - capOf("k401max");
    if (ex > 0.005) { out.k401max -= ex; out.brok += ex; }
    return out;
  };
  /* Figures typed into the table: pay set from a year on (raises carry on
     from it) or for that year only; spending set the same way, its
     difference from the plan's carried on from its year. */
  const edits = Yr.edits ?? [];
  const typedPay = (w: "pay0" | "pay1", year: number, raise: number): number | null => {
    const E = edits.filter((e) => e.what === w);
    const once = E.find((e) => e.once && e.year === year);
    if (once) return once.amount;
    const from = E.filter((e) => !e.once && e.year <= year).sort((x, y) => y.year - x.year)[0];
    return from ? from.amount * Math.pow(1 + raise, year - from.year) : null;
  };
  let spendShift = 0;
  // When your partner stops work, if before you: the calendar year.
  const r2 = pr.who === "couple" && pr.p2.by != null && pr.p2.retire != null ? pr.p2.by + pr.p2.retire : null;
  const year0 = new Date().getFullYear();
  const rows: YearSaving[] = [], base: number[] = [], years: CashYear[] = [], pre: YearsOut["pre"] = [];
  // Saving follows take-home pay, which its own pre-tax part lowers the
  // taxes on: worked out until the two agree. `want` is the saving a
  // take-home pay calls for; below nothing (`raw`), nothing is saved.
  const solve = (pk: PcInput, inc: number, want: (A: number) => number, changed: boolean, fr: number) => {
    let S = S0, lines = alloc(S, pk, changed, fr), tx = taxOf(pk, lines), raw = S;
    for (let it = 0; it < 20; it++) {
      raw = want(inc - tx.tax);
      const next = Math.max(0, raw);
      if (Math.abs(next - S) < 0.01) break;
      S = next; lines = alloc(S, pk, changed, fr); tx = taxOf(pk, lines);
    }
    return { S, raw, lines, tx };
  };
  // What's saved of the raises, from a starting take-home pay and saving:
  // today's, until pay changes other than by its raises. The saving can
  // run below nothing here (what's spent is held up by it), so spending
  // comes back once pay does.
  let bA = A0, bS = S0;
  const byRaise = (A: number) => (Yr.keep == null ? (bA > 0 ? (bS * A) / bA : bS) : bS + Yr.keep * (A - bA));
  // The paycheck on each of your pay. One of you at no pay is as good as
  // stopped: only the other's 401(k) is left, and two self-only HSAs
  // become one family plan. The IRAs carry on (a spousal IRA counts on
  // the earner's pay), and each limit goes no further than the pay under it.
  const pkOf = (g1: number, g2: number, k: number): PcInput => {
    const out = pi.two && g2 <= 0.5;
    return { ...pi, gross: g1, gross2: out ? 0 : g2, ...(out ? { two: false, ...(pi.hsa === "self2" ? { hsa: "family" as const } : {}) } : {}),
      ...(pi.ages ? { ages: [shift(pi.ages[0], k), shift(pi.ages[1], k)] as [number | null, number | null] } : {}) };
  };
  // Last year's pay, as it was and on its raises alone (today's to start).
  let prevPay: [number, number] = [pi.gross, pi.gross2], prevPath: [number, number] = [pi.gross, pi.gross2];
  for (let t = age; t < end; t++) {
    const k = t - age, year = year0 + k;
    const works: [boolean, boolean] = [true, pi.gross2 > 0 && (r2 == null || year < r2)];
    // Each of you's pay on its raises (and as typed into the table), then
    // as the pay changes and stopping work leave it.
    const path: [number, number] = [typedPay("pay0", year, Yr.raise[0]) ?? pi.gross * Math.pow(1 + Yr.raise[0], k), typedPay("pay1", year, Yr.raise[1]) ?? pi.gross2 * Math.pow(1 + Yr.raise[1], k)];
    const P1 = payAt(scen, 0, t, end, path[0], Yr.raise[0]);
    const P2 = works[1] ? payAt(scen, 1, t, end, path[1], Yr.raise[1]) : { pay: 0, tags: [] };
    const pk = pkOf(P1.pay, P2.pay, k), inc = (P1.pay + P2.pay) / 12 + other;
    const changed = Math.abs(P1.pay - path[0]) > 0.5 || (pi.two && Math.abs(P2.pay - path[1]) > 0.5);
    // Pay this year had it only had its raises since last year.
    const was = [0, 1].map((i) => (prevPath[i] > 0 ? (prevPay[i] * path[i]) / prevPath[i] : prevPay[i])) as [number, number];
    // What paid-off debts free this year (and fixed payments shrinking in
    // today's dollars): saved on top, as the plan's other saving is.
    const fr = Math.max(0, a.debtFreed?.[k] ?? 0), byRaiseFr = (A: number) => byRaise(A) + fr;
    let lines: Record<Line, number>, tx: ReturnType<typeof taxOf>;
    if (Math.abs(P1.pay - was[0]) > 0.5 || Math.abs(P2.pay - was[1]) > 0.5) {
      // Pay changed other than by a raise (a pay change starts, steps or
      // ends, or your partner stops work): what you'd have spent carries
      // on, and saving takes the difference (down to nothing, past which
      // spending has to give). Raises from then on are saved from there.
      // Read as a raise in reverse, a cut would come out of spending by
      // the share of each raise you spend.
      const pkW = pkOf(was[0], was[1], k), incW = (was[0] + was[1]) / 12 + other;
      const h = solve(pkW, incW, byRaiseFr, true, fr), spend = incW - h.tx.tax - h.raw;
      const r = solve(pk, inc, (A) => A - spend, changed, fr);
      ({ lines, tx } = r);
      bA = inc - tx.tax; bS = r.raw - fr;
    } else ({ lines, tx } = solve(pk, inc, byRaiseFr, changed, fr));
    prevPay = [P1.pay, P2.pay]; prevPath = path;
    // Save less: what goes in is held to its ceiling, taken from the
    // account it names first, then in the dashboard's order, the match last.
    const SL = saveLessAt(scen, t, end, total(lines), lines.match);
    if (SL.target != null && SL.target < total(lines) - 0.005) {
      let cut = total(lines) - SL.target;
      const first = SL.acct === "auto" ? [] : DASH_ORDER.filter((l) => kindOf(pk, l) === SL.acct);
      for (const l of [...first, ...DASH_ORDER.filter((l) => !first.includes(l))]) {
        const m = Math.min(lines[l], cut);
        lines = { ...lines, [l]: lines[l] - m }; cut -= m;
        if (cut <= 0.005) break;
      }
      tx = taxOf(pk, lines);
    }
    const match = (tx.run.match * pk.p) / 12;
    pre.push({ pk, lines });
    // The Calculator's scenarios this year: saving given up (covered like
    // the children's costs, from the accounts they name first), and saving
    // added to an account.
    const own = byKind(pk, lines), Y = yearChange(scen, t, end, own.brok + own.roth + own.trad + own.hsa, { lines: true });
    const kidsCost = kids.reduce((s, c) => s + childCost(c, t), 0) - costNow, college = opts.college[k] ?? 0;
    const need = kidsCost + college + Y.cut;
    // What a Save less change names an account for stands; the rest as the rule says.
    const typed = Y.cut > 0 ? Y.typed : {};
    const coverFor = (n: number) => (Math.abs(n) < 0.5 ? null : coverDash(n, pk, typed, lines, undefined, rule));
    const keptOf = (cv: ReturnType<typeof coverFor>) => {
      const m = { ...own };
      if (cv) for (const kk of COVER_ORDER) m[kk] = Math.max(0, m[kk] - cv.take[kk]);
      if (!SL.stop) for (const kk of COVER_ORDER) m[kk] += Y.add[kk];
      return m;
    };
    let c = coverFor(need);
    // Spending typed for this year (or carried on from an earlier one): the
    // difference from what the plan would spend comes out of saving, or
    // goes into it.
    const spendOnce = edits.find((e) => e.what === "spend" && e.once && e.year === year);
    const spendFrom = edits.find((e) => e.what === "spend" && !e.once && (e.year === year || (k === 0 && e.year < year)));
    if (spendOnce || spendFrom) {
      const pre = inc - (tx.tax + (abroad ? 0 : c?.taxUp ?? 0)) - total(keptOf(c)) - ef;
      if (spendFrom) spendShift = spendFrom.amount / 12 - pre;
      const shift = spendOnce ? spendOnce.amount / 12 - pre : spendShift;
      if (Math.abs(shift) >= 0.5) c = coverFor(need + shift);
    } else if (Math.abs(spendShift) >= 0.5) c = coverFor(need + spendShift);
    const left = keptOf(c);
    const emp = Math.max(0, match - (c?.matchLost ?? 0));
    // The employer's money goes in as the match line is taxed.
    const empRoth = pk.roth.match;
    rows.push({ t: left.trad + (empRoth ? 0 : emp), r: left.roth + left.hsa + (empRoth ? emp : 0), b: left.brok, short: c?.short ?? 0 });
    base.push(total(lines) + match);
    const taxes = tx.tax + (abroad ? 0 : c?.taxUp ?? 0), saved = total(left);
    years.push({ k, age: t, year, pay: [P1.pay / 12, P2.pay / 12], other, income: inc, taxes, spending: inc - taxes - saved - ef,
      saved: { ...left }, match: emp, ef, kids: kidsCost, college, change: Y.cut - total(Y.add), short: c?.short ?? 0, tags: [...P1.tags, ...P2.tags, ...Y.tags], works,
      paidOff: (a.paidOff ?? []).filter((x) => x.k === k).map((x) => x.name), freed: fr,
      edits: edits.filter((e) => e.year === year && (e.what !== "pay1" || works[1])) });
  }
  return { rows, base, years, pre };
}

/** "How will you cover it?" in the dashboard: today's saving by account,
    the order nothing set means, and each stage worked out on its first
    year's saving (by your age), as the plan runs it. */
export function coverScope(pr: Profile, F: Flow, a: Answers) {
  const Y = yearlySaving(pr, F, a), age = Math.round(a.age ?? 0);
  const today = byKind(F.pi, linesOf(F.pi));
  const at = (from: number) => Y.pre[Math.max(0, Math.min(Y.pre.length - 1, Math.round(from) - age))];
  return {
    today, usual: dashKindOrder(F.pi), freesLess: true, matchLast: true,
    stage: (from: number, change: number, rule: CoverRule | null) => {
      const y = at(from);
      if (!y) return { room: today, cover: coverDash(change, F.pi, {}, undefined, undefined, rule) };
      return { room: byKind(y.pk, y.lines), cover: coverDash(change, y.pk, {}, y.lines, freedFor(y.pk, y.lines), rule) };
    },
  };
}
