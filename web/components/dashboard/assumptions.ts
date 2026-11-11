/* How your assumptions compare: every guess about the future the plan
   makes (growth, inflation, raises, what the children and college cost,
   Social Security, how long the plan runs), each against its usual figure,
   and the plan as a whole on one scale from very conservative to very
   aggressive.

   The plan is run again with each figure set to its usual one, the rest
   as they are: the difference in savings at retirement is that figure's
   effect, so a figure that barely moves the plan barely moves the rating.
   Those differences are shared out to add up to the whole difference
   (the plan run with every figure at its usual one). Social Security and
   how long the plan runs don't change savings at retirement, so their
   effect is said as what it's worth then: the years it changes, each
   brought back to retirement.

   Facts (pay, balances, spending today) and choices (when you retire,
   what you'll spend) aren't rated: only the guesses. */

import { planIn, type Sim } from "@/tools/guide/calc";
import { atRetireScheduled, hasChanges, schedule } from "@/tools/guide/schedule";
import { plAtRetire } from "@/lib/engine/typed-plan";
import { CAPE_NOW } from "@/lib/engine/typed-drawdown";
import { parseNum } from "@/lib/format";
import { MID, STEP, atRetirement, bandOf, kidsRatio, scalePos, shareOut, stepsFrom, typicalRaise, type Band } from "./assume-bench";
import { ageOf, answers, couple, grossYear, nameOf, outsideUS, people, type Results } from "./model";
import { kidsOff, ownOn } from "./scenarios";
import type { Profile, Entry } from "./store";

export type RowId = "growth" | "inflation" | "raise" | "kids" | "tuition" | "college529" | "ss" | "endAge";
export type GroupId = "growth" | "life" | "retirement" | "college";
export const GROUP_NAMES: Record<GroupId, string> = { growth: "Growth", life: "Your life", retirement: "Retirement", college: "College" };

/** Each figure as a sentence names it: "mostly from your growth figure". */
export const SHORT: Record<RowId, string> = {
  growth: "your growth figure", inflation: "your inflation figure", raise: "your raises", kids: "what the children cost",
  tuition: "college prices", college529: "the college fund's growth", ss: "your Social Security share", endAge: "how long the plan runs",
};

export interface Row {
  id: RowId; group: GroupId; name: string;
  /** Your figure, and the usual one with the balanced range, in words. */
  yours: string; usual: string; range: string;
  /** Where the usual figure comes from, for its "?". */
  why: string;
  /** Steps from the usual figure (positive: aggressive), its band, and
      where it sits on the scale (0 to 1); the balanced range's ends too. */
  z: number; band: Band; pos: number;
  /** What it does to savings at retirement against the usual figure
      (positive: your figure adds), and whether that's savings themselves
      or what a change once retired is worth then. */
  dollars: number; worth: boolean;
  /** Where it's changed. */
  href: string; where: string;
}

export interface Rating {
  z: number; band: Band; pos: number;
  /** Savings at retirement as the plan has them, and with every figure at
      its usual one; the whole difference, retirement's worth included. */
  mine: number; usual: number; gap: number;
  rows: Row[];
  /** The figure that moves the plan most toward its band, when it leans. */
  lead: Row | null;
}

/** A rate as a percent to `d` places, trailing zeros dropped: 7.6%, 1.25%, 0%. */
const pct = (v: number, d = 1) => (Math.round(v * 10 ** (d + 2)) / 10 ** d).toFixed(d).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") + "%";
const n = (v: string) => (v.trim() === "" ? null : parseNum(v));

/** Savings at retirement alone, in today's dollars, as the plan works it
    out (the Calculator's own result when it has one): the plan's run up to
    retirement, without its run through history. */
function fvOf(a: ReturnType<typeof answers>): number | null {
  if (a.fvTo != null && a.fvTo > 0) return a.fvTo;
  const I = planIn(a);
  if (!I) return null;
  const sched = hasChanges(a) ? schedule(a, { retire: I.retire, monthly: I.monthly, stop: I.stopAge }) : null;
  return (sched ? atRetireScheduled(I, sched) : plAtRetire(I)).fv;
}
const fvFor = (pr: Profile, entries: Entry[]) => fvOf(answers(pr, entries));

/** The plan's growth as one steady rate: a returns change in the Calculator
    or the Calculator's own figures (fees, returns) change what savings earn,
    so the steady rate that reaches the same savings at retirement stands
    for them. Lump sums are left out of it (they aren't growth). */
function steadyGrowth(pr: Profile, core: Profile, entries: Entry[]): number {
  const own = ownOn(pr.scenarios) || Object.keys(pr.calcOwn ?? {}).length > 0;
  if (!own) return pr.assume.growth;
  const want = fvFor({ ...pr, scenarios: (pr.scenarios ?? []).filter((s) => s.kind !== "lump") }, entries);
  if (want == null) return pr.assume.growth;
  const at = (g: number) => fvFor({ ...core, assume: { ...core.assume, growth: g } }, entries) ?? 0;
  let lo = -0.05, hi = 0.3;
  if (at(lo) > want || at(hi) < want) return pr.assume.growth;
  for (let k = 0; k < 28; k++) { const mid = (lo + hi) / 2; if (at(mid) < want) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

/** Your children's costs as typed (blank for the typical ones). */
const kidCosts = (pr: Profile) => ({ early: n(pr.childCosts.early), school: n(pr.childCosts.school), teen: n(pr.childCosts.teen), later: n(pr.childCosts.later) == null ? null : n(pr.childCosts.later)! / 100 });
const kidCount = (pr: Profile) => pr.kidList.slice(0, pr.kids).filter((k) => k.by && (ageOf(k) ?? 99) < 18).length + pr.planned.count;

/** Each figure set to its usual one. */
const USUAL: Partial<Record<RowId, (p: Profile) => Profile>> = {
  growth: (p) => ({ ...p, assume: { ...p.assume, growth: MID.growth } }),
  inflation: (p) => ({ ...p, assume: { ...p.assume, inflation: MID.inflation } }),
  raise: (p) => ({ ...p, yearly: { ...p.yearly, raise: typicalRaises(p) } }),
  kids: (p) => ({ ...p, childCosts: { early: "", school: "", teen: "", later: "80" } }),
  tuition: (p) => (p.college.plan ? { ...p, college: { ...p.college, plan: { ...p.college.plan, infl: MID.tuition } } } : p),
  college529: (p) => (p.college.plan ? { ...p, college: { ...p.college, plan: { ...p.college.plan, ret: MID.college529 } } } : p),
};

/** Each of you's typical raise beyond inflation, from your age to your retirement. */
function typicalRaises(pr: Profile): [number, number] {
  const one = (i: 0 | 1) => { const p = i ? pr.p2 : pr.p1, age = ageOf(p); return age != null && p.retire != null && p.retire > age ? typicalRaise(age, p.retire) : 0.005; };
  return [one(0), couple(pr) ? one(1) : 0];
}

export function rateAssumptions(pr: Profile, entries: Entry[], R: Results): Rating | null {
  const S: Sim | null = R.S;
  if (!S || R.atRetire == null || R.gap) return null;
  const abroad = outsideUS(pr);
  // The plan without what the Calculator runs on its own (returns changes,
  // lump sums, its own figures), its growth one steady rate standing for them.
  const core0: Profile = { ...pr, scenarios: (pr.scenarios ?? []).filter((s) => s.kind !== "returns" && s.kind !== "lump"), calcOwn: undefined };
  const growth = steadyGrowth(pr, core0, entries);
  const core: Profile = { ...core0, assume: { ...core0.assume, growth } };
  const mine = fvFor(core, entries);
  if (mine == null || !(mine > 0)) return null;

  const rows: Row[] = [];
  const add = (r: Omit<Row, "band" | "pos" | "dollars" | "worth"> & { dollars?: number; worth?: boolean }) =>
    rows.push({ dollars: 0, worth: false, ...r, band: bandOf(r.z), pos: scalePos(r.z) });

  /* Growth */
  const inflation = pr.assume.inflation, own = growth !== pr.assume.growth;
  add({ id: "growth", group: "growth", name: "Growth, before inflation", yours: pct(growth) + " per year" + (own ? ", with your Calculator changes" : ""),
    usual: pct(MID.growth), range: pct(MID.growth - STEP.growth) + " to " + pct(MID.growth + STEP.growth),
    why: `What savings earn each year until you retire. Since 1926, US stocks have earned about 7% per year after inflation and bonds about 2%; stocks worldwide have earned about 5%. A mix of the two at about 4.5% after inflation (${pct(MID.growth)} at 3% inflation) is the usual figure. Stock prices are high today (a CAPE of ${CAPE_NOW}), which has usually meant lower returns in the decade after.`,
    z: stepsFrom(growth, MID.growth, STEP.growth), href: "/dashboard/profile#assumptions", where: "Profile" });
  add({ id: "inflation", group: "growth", name: "Inflation", yours: pct(inflation) + " per year",
    usual: pct(MID.inflation), range: pct(MID.inflation - STEP.inflation) + " to " + pct(MID.inflation + STEP.inflation),
    why: "How fast prices rise. US prices have risen about 3% per year on average since 1926; the Federal Reserve aims for 2%. Growth less inflation is what savings really gain, so with growth held where it is, lower inflation makes the plan look better.",
    z: stepsFrom(inflation, MID.inflation, STEP.inflation, false), href: "/dashboard/profile#assumptions", where: "Profile" });

  /* Your life */
  const usualRaise = typicalRaises(pr), two = couple(pr);
  const who = people(pr).map((p, i) => ({ i: i as 0 | 1, pay: grossYear(p) ?? 0, mine: pr.yearly.raise[i] ?? 0, usual: usualRaise[i] }));
  const payAll = who.reduce((s, w) => s + w.pay, 0);
  const weight = (w: (typeof who)[number]) => (payAll > 0 ? w.pay / payAll : 1 / who.length);
  const raiseZ = who.reduce((s, w) => s + weight(w) * stepsFrom(w.mine, w.usual, STEP.raise), 0);
  // Each of you by name, or once when you're the same.
  const both = (f: (w: (typeof who)[number]) => string) => (two && f(who[0]) !== f(who[1]) ? who.map((w) => `${nameOf(pr, w.i)} ${f(w)}`).join(", ") : f(who[0]));
  add({ id: "raise", group: "life", name: "Raises, beyond inflation", yours: both((w) => pct(w.mine, 2)) + " per year",
    usual: both((w) => "about " + pct(w.usual)), range: both((w) => pct(Math.max(0, w.usual - STEP.raise)) + " to " + pct(w.usual + STEP.raise)),
    why: "How fast pay grows beyond inflation. Pay usually climbs fastest early in a career and levels off in the 50s; the usual figure is the typical raise from your age to retirement, on average (pay by age from Census and Social Security earnings records, with the economy's own growth in pay on top).",
    z: raiseZ, href: "/dashboard/years#drivers", where: "Year by year" });
  const kids = kidCount(pr);
  if (kids > 0 && !kidsOff(pr.scenarios)) {
    const ratio = kidsRatio(kidCosts(pr), kids, pr.childcare, pr.careArea);
    add({ id: "kids", group: "life", name: "What the children cost", yours: Math.abs(ratio - 1) < 0.005 ? "The typical costs" : pct(ratio, 0) + " of the typical costs",
      usual: "The typical costs", range: pct(1 - STEP.kids, 0) + " to " + pct(1 + STEP.kids, 0) + " of typical",
      why: "What raising a child costs from birth to 18. The typical costs are what middle-income families spend on a child (the USDA's study, brought to today's prices), plus childcare where it's paid, with a second or later child costing 20% less. Today's spending already pays for the children you have, so what counts is how their costs change: lower costs here also mean less freed up for saving once they're grown.",
      z: stepsFrom(ratio, 1, STEP.kids, false), href: "/dashboard/profile#children", where: "Profile" });
  }

  /* College, when College Savings' figures are in the plan */
  const P = pr.college.help !== "none" ? pr.college.plan : undefined;
  if (P) {
    add({ id: "tuition", group: "college", name: "College prices rising", yours: P.infl + "% per year", usual: MID.tuition + "%",
      range: MID.tuition - STEP.tuition + "% to " + (MID.tuition + STEP.tuition) + "%",
      why: "How fast college prices rise, before inflation. Over the last 30 years they rose faster than prices in general; recent years have been slower. 4% per year is the usual planning figure.",
      z: stepsFrom(P.infl, MID.tuition, STEP.tuition, false), href: "/dashboard/profile#college", where: "Profile" });
    add({ id: "college529", group: "college", name: "College fund growth", yours: P.ret + "% per year", usual: MID.college529 + "%",
      range: MID.college529 - STEP.college529 + "% to " + (MID.college529 + STEP.college529) + "%",
      why: "What money saved for college earns, before inflation. A college fund usually moves from stocks toward bonds as college nears, so it earns less than retirement savings; 6% per year is the usual planning figure.",
      z: stepsFrom(P.ret, MID.college529, STEP.college529), href: "/dashboard/profile#college", where: "Profile" });
  }

  /* Each figure's effect on savings at retirement, shared out to add up. */
  const pre = rows.filter((r) => USUAL[r.id]);
  const usualAll = pre.reduce((p, r) => USUAL[r.id]!(p), core);
  const fvUsual = fvFor(usualAll, entries) ?? mine;
  const one = pre.map((r) => mine - (fvFor(USUAL[r.id]!(core), entries) ?? mine));
  shareOut(one, mine - fvUsual).forEach((d, i) => { pre[i].dollars = d; });
  // The children's costs lean the way they move the plan: for children you
  // have, today's spending already pays for them, so lower costs can mean
  // less saved once they've grown, not more.
  const kidRow = rows.find((r) => r.id === "kids");
  if (kidRow && Math.abs(kidRow.dollars) >= 500 && Math.sign(kidRow.dollars) !== Math.sign(kidRow.z)) {
    kidRow.z = -kidRow.z; kidRow.band = bandOf(kidRow.z); kidRow.pos = scalePos(kidRow.z);
  }

  /* Retirement: what each is worth at retirement. */
  const years = S.years, retire = S.retire;
  if (!abroad && R.ss != null && R.ss > 0) {
    const share = pr.ss.pct ?? 100, full = (R.ss * 12) / (share / 100);
    const from = Math.max(0, (R.claim1 ?? retire) - retire);
    add({ id: "ss", group: "retirement", name: "Social Security", yours: share + "% of the benefit", usual: MID.ssPct + "%",
      range: MID.ssPct - STEP.ssPct + "% to " + Math.min(100, MID.ssPct + STEP.ssPct) + "%",
      why: "The trust fund that pays Social Security is projected to run short in 2034. After that, about 80% of benefits could be paid unless Congress acts. Anywhere from that to the full benefit is balanced.",
      z: stepsFrom(share, MID.ssPct, STEP.ssPct), dollars: atRetirement((full * (share - MID.ssPct)) / 100, from, Math.max(0, years - from)), worth: true,
      href: "/dashboard/income#social-security", where: "Income" });
  }
  const endAge = R.endAges.length ? Math.min(...R.endAges) : null;
  if (endAge != null) {
    // What savings pay each year once retired: spending and its taxes, less Social Security.
    const draw = Math.max(0, S.spend + S.taxYr - (abroad ? 0 : S.ss.total));
    const d = MID.endAge - endAge;
    const dollars = d > 0 ? atRetirement(draw, years, d) : d < 0 ? -atRetirement(draw, years + d, -d) : 0;
    add({ id: "endAge", group: "retirement", name: "How long the plan runs", yours: "To age " + endAge + (two ? ", the younger of you" : ""),
      usual: "To age " + MID.endAge, range: "ages " + (MID.endAge - STEP.endAge) + " to " + (MID.endAge + STEP.endAge),
      why: "How long savings have to last. Of people who reach 65, about 1 in 4 live past 90 and about 1 in 10 past 95. Planning to 95 covers most lifespans; planning to a younger age makes the plan look better than it may turn out.",
      z: stepsFrom(endAge, MID.endAge, STEP.endAge, false), dollars, worth: true, href: "/dashboard/retirement#drawdown", where: "Retirement" });
  }

  const gap = (mine - fvUsual) + rows.filter((r) => r.worth).reduce((s, r) => s + r.dollars, 0);
  const base = Math.max(1, fvUsual);
  const z = gap / base / STEP.overall, band = bandOf(z);
  rows.sort((a, b) => Math.abs(b.dollars) - Math.abs(a.dollars));
  const lead = band === "bal" ? null : rows.find((r) => Math.sign(r.dollars) === Math.sign(gap) && Math.abs(r.dollars) > 0) ?? null;
  // Savings at retirement as the plan shows them; the usual figures' the
  // same difference from it, so lump sums and the like count in both.
  return { z, band, pos: scalePos(z), mine: R.atRetire, usual: R.atRetire - (mine - fvUsual), gap, rows, lead };
}
