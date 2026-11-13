/* "If things go wrong": the hard events the plan is tested against, as
   changes to the Retirement tab's own Drawdown run (the same windows, the
   same strategy and settings that give the plan's chance of success). Each
   event is built from what the engine already takes: extra expenses and
   other income by year of retirement, and the spending path the strategy's
   spending is shaped by. Plain logic, no React and nothing from the plan
   itself (stress-plan.ts puts the plan through these), so the tests can
   check each input on its own. */

import { ddWindows, runDrawdown, HIST_START, type DdItem, type DdOpts, type DdPrep } from "@/lib/engine/typed-drawdown";

/** Social Security's combined trust funds (OASDI) run out in 2034, and the
    taxes still coming in then pay 83% of scheduled benefits: the 2026
    Social Security Trustees Report (released June 9, 2026). Kept current
    from each year's report (upkeep/items.json, "ss-trustees"). */
export const SS_CUT = { year: 2034, share: 0.83, report: 2026 } as const;

/** A partner's death: from then the household spends this share of what
    the two of them did. */
export const SURVIVOR_SPEND = 0.75;
/** The age of the older of you the partner's death is tested at. */
export const SURVIVOR_AGE = 75;
/** Long-term care unless set on Plan summary: per year in today's dollars,
    for how many years, from what age. */
export const CARE_DEFAULT = { amount: 100000, years: 3, age: 85 } as const;
/** The markets retirement is started into for "Retiring into a bad market",
    each January. */
export const BAD_YEARS = [1929, 1937, 1966, 1973, 2000, 2008] as const;
/** A test holds up when its chance of success is no more than this far
    below the plan's own. */
export const HOLDS_WITHIN = 0.1;

/** What the event's items are named with, so they're plain in a run's rows. */
const TAG = " (stress test)";

/** One retirement under the plan's strategy: a start's money lasted, and
    how it ended (in today's dollars), or the year it ran out (1-based). */
interface One { end: number; out: number | null }

/** A set of runs, as the Retirement tab counts its chance: how many of
    history's starts lasted, of how many; and the median market (the
    middle start, ranked from running out soonest to most left), with the
    age it ran out at, by the plan's ages (the first of you's). */
export interface RunSet { rate: number; ok: number; of: number; mid: { end: number; outAge: number | null } }

/** Every historical start, with `P` as the run's setup (a changed spending
    path goes in here; ddPrep would build its own). */
export function runSet(o: DdOpts, P: DdPrep): RunSet {
  const W = ddWindows(o), all: One[] = [];
  let ok = 0;
  for (const w of W) {
    const r = runDrawdown(o, w.seq, { lite: true }, P);
    if (!r.depleted) ok++;
    all.push({ end: r.endReal, out: r.depletedYear });
  }
  return { rate: W.length ? ok / W.length : 0, ok, of: W.length, mid: middle(all, o) };
}

function middle(all: One[], o: DdOpts): RunSet["mid"] {
  if (!all.length) return { end: 0, outAge: null };
  // Running out ranks lowest (the soonest first), then what's left.
  const ranked = [...all].sort((a, b) => (a.out != null || b.out != null ? (a.out ?? Infinity) - (b.out ?? Infinity) : a.end - b.end));
  const m = ranked[Math.floor(ranked.length / 2)];
  return { end: m.out != null ? 0 : m.end, outAge: m.out != null ? ageAt(o, m.out - 1) : null };
}
/** The first of you's age in a year of retirement (0 the first). */
const ageAt = (o: DdOpts, y: number) => (o.retireAge != null ? Math.round(o.retireAge + y) : y + 1);

/** Social Security as the run pays it: each of you's benefit a year and
    the year of retirement it starts (0 the first). A couple's benefits
    given as one figure from one start are split by `split` (each of you's
    benefit, in any unit). */
export function ssStreams(o: DdOpts, split: [number, number] = [1, 0]): { a: number; d: number }[] {
  const d1 = Number(o.ssDelayYears) || 0, d2 = Number(o.ssDelayYears2) || 0;
  if (o.ssAnnual2 > 0) return [{ a: o.ssAnnual, d: d1 }, { a: o.ssAnnual2, d: d2 }];
  const t = split[0] + split[1], s1 = t > 0 ? split[0] / t : 1;
  return [{ a: o.ssAnnual * s1, d: d1 }, { a: o.ssAnnual * (1 - s1), d: d1 }];
}
/** What the streams pay in a year of retirement. */
const paidAt = (S: { a: number; d: number }[], y: number) => S.reduce((t, s) => t + (s.a > 0 && y >= s.d ? s.a : 0), 0);

/** A year-by-year amount (today's dollars, rising with prices) as the
    run's items: each stretch at one amount is one item. */
export function stepItems(name: string, perYear: number[]): DdItem[] {
  const out: DdItem[] = [];
  for (let y = 0; y < perYear.length;) {
    const v = Math.round(perYear[y]);
    let n = 1;
    while (y + n < perYear.length && Math.round(perYear[y + n]) === v) n++;
    if (v > 0) out.push({ name: name + TAG, annual: v, inflate: true, startYear: y + 1, on: true, duration: y + n >= perYear.length ? { type: "forever" } : { type: "years", years: n } });
    y += n;
  }
  return out;
}

/** Social Security paid less from year `k` of retirement: `share` of each
    benefit. The run takes benefits off spending before savings pay the
    rest, and so does an extra expense, so what's no longer paid goes in
    as one: the same, year for year. */
export function ssCutItems(o: DdOpts, k: number, share: number, split?: [number, number]): DdItem[] {
  const S = ssStreams(o, split), cut = Math.max(0, 1 - share);
  return stepItems("Social Security paid less", Array.from({ length: o.years }, (_, y) => (y >= k ? paidAt(S, y) * cut : 0)));
}

/** A partner dies in year `k` of retirement (`dies`: 0 the first of you,
    1 the second): from then Social Security pays the larger of the two
    benefits started by then (the survivor benefit), and spending is
    SURVIVOR_SPEND of the couple's. The benefit no longer paid goes in as
    an extra expense (see ssCutItems); the spending, on the run's spending
    path (and its minimum), so every strategy works out its own spending as
    usual and then spends that share of it. */
export function survivorRun(o: DdOpts, P: DdPrep, k: number, split?: [number, number], spend = SURVIVOR_SPEND): { o: DdOpts; P: DdPrep; lost: number[] } {
  const S = ssStreams(o, split);
  const lost = Array.from({ length: o.years }, (_, y) => (y < k ? 0 : paidAt(S, y) - Math.max(0, ...S.map((s) => (s.a > 0 && y >= s.d ? s.a : 0)))));
  const o2: DdOpts = { ...o, expenseItems: [...o.expenseItems, ...stepItems("Social Security after a death", lost)] };
  const P2: DdPrep = { ...P, path: P.path.map((m, y) => (y >= k ? m * spend : m)), floor: P.floor.map((f, y) => (y >= k ? f * spend : f)) };
  return { o: o2, P: P2, lost };
}

/** Long-term care: `amount` a year in today's dollars for `years` years,
    from year `k` of retirement, on top of the strategy's spending. */
export function careItems(o: DdOpts, k: number, amount: number, years: number): DdItem[] {
  if (!(amount > 0) || !(years > 0) || k >= o.years) return [];
  return [{ name: "Long-term care" + TAG, annual: Math.round(amount), inflate: true, startYear: Math.max(0, k) + 1, on: true, duration: { type: "years", years: Math.round(years) } }];
}

/** A one-time sum in year `k` of retirement (life insurance paid out). */
export const lumpIn = (k: number, amount: number): DdItem => ({ name: "Life insurance" + TAG, annual: Math.round(amount), inflate: true, startYear: k + 1, on: true, duration: { type: "once" } });

/** The smallest one-time sum in year `k` that brings the run's chance
    back to `want`, found to within $10,000 (or 2% of it, for large sums)
    and rounded up to the next $10,000: a few runs, doubling to find a sum
    that's enough, then halving the gap. 0 when none is needed; null when
    even a very large sum isn't enough. */
export function coverFor(o: DdOpts, P: DdPrep, k: number, want: number, opts: { start?: number; most?: number } = {}): number | null {
  const at = (x: number) => runSet({ ...o, incomeItems: [...o.incomeItems, lumpIn(k, x)] }, P).rate >= want - 1e-9;
  if (at(0)) return 0;
  let lo = 0, hi = Math.max(50000, opts.start ?? 100000);
  const most = opts.most ?? 5e7;
  while (!at(hi)) { lo = hi; hi *= 2; if (hi > most) return null; }
  while (hi - lo > Math.max(10000, hi * 0.02)) { const mid = (lo + hi) / 2; if (at(mid)) hi = mid; else lo = mid; }
  return Math.ceil(hi / 10000) * 10000;
}

/** Retirement started each January in `years`, as far as the record holds
    the plan's length after it: lasted to the end (with what was left) or
    ran out at an age. */
export function badStarts(o: DdOpts, P: DdPrep, years: readonly number[] = BAD_YEARS): { year: number; end: number; outAge: number | null }[] {
  const W = ddWindows({ ...o, fromYear: HIST_START });
  return years.flatMap((year) => {
    const w = W.find((x) => x.year === year && x.month === 1);
    if (!w) return [];
    const r = runDrawdown(o, w.seq, { lite: true }, P);
    return [{ year, end: r.depleted ? 0 : r.endReal, outAge: r.depleted && r.depletedYear != null ? ageAt(o, r.depletedYear - 1) : null }];
  });
}

/** Whether a test holds up: its chance no more than HOLDS_WITHIN below the plan's. */
export const holds = (base: number, event: number) => event >= base - HOLDS_WITHIN - 1e-9;
