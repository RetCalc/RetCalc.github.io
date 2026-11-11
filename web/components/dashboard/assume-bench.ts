/* How a plan's assumptions compare: each against a middle value and a
   step, and the whole plan on the same five-band scale. Pure figures, so
   they can be tested on their own; assumptions.ts runs the plan with them.

   Every middle value is the Dashboard's own default, so a plan left on
   the defaults sits in the middle. One step either side of the
   middle is still Balanced; past that a figure leans one way, and two
   steps out it's Very. A figure that makes the plan look better (more
   growth, less inflation, bigger raises, cheaper children) leans
   aggressive. */

import { CHILD_COST, earlyCost, type CareArea } from "@/tools/guide/schedule";

export type Band = "vcons" | "cons" | "bal" | "aggr" | "vaggr";
export const BAND_WORDS: Record<Band, string> = {
  vcons: "Very conservative", cons: "Conservative", bal: "Balanced", aggr: "Aggressive", vaggr: "Very aggressive",
};
export const BANDS: Band[] = ["vcons", "cons", "bal", "aggr", "vaggr"];

/** Steps from the middle as a band: within one step either side is
    Balanced, two or more is Very. Positive is aggressive. */
export function bandOf(z: number): Band {
  if (z >= 2) return "vaggr";
  if (z > 1) return "aggr";
  if (z <= -2) return "vcons";
  if (z < -1) return "cons";
  return "bal";
}

/** Where steps from the middle sit on the scale, 0 (far left) to 1 (far
    right): five equal segments, each band's middle at its segment's middle,
    the ends held a little in from the edges. */
export function scalePos(z: number): number {
  // Segments: [-3,-2) very conservative ... [2,3] very aggressive, but
  // Balanced spans -1..1 (two steps), so it's mapped piecewise.
  const c = Math.max(-2.8, Math.min(2.8, z));
  const seg = (a: number, b: number, lo: number) => lo + ((c - a) / (b - a)) * 0.2;
  if (c < -2) return seg(-3, -2, 0);
  if (c < -1) return seg(-2, -1, 0.2);
  if (c <= 1) return seg(-1, 1, 0.4);
  if (c < 2) return seg(1, 2, 0.6);
  return seg(2, 3, 0.8);
}

/** The balanced figures: the middle of each scale. */
export const MID = {
  /** Growth before inflation: 4.5% after 3% inflation, the usual. */
  growth: 1.045 * 1.03 - 1,
  inflation: 0.03,
  /** Share of Social Security expected, percent: between the full
      benefit and the roughly 80% payable if the trust fund runs short. */
  ssPct: 90,
  /** The plan runs to this age (the younger of you's). */
  endAge: 95,
  /** College Savings' default figures, percent. */
  tuition: 4, college529: 6,
};
/** One step from the middle. */
export const STEP = {
  /** 1.5 points after inflation, before inflation at 3%. */
  growth: 0.015 * 1.03,
  /** 0.6 points: 2.4% to 3.6% is balanced. The Fed's 2% is on a measure
      that runs a few tenths below consumer prices, so 2% here leans hopeful. */
  inflation: 0.006,
  raise: 0.0075,
  ssPct: 10,
  endAge: 3,
  /** Children's costs: 15% from the typical. */
  kids: 0.15,
  tuition: 1, college529: 1.25,
};

/** Raises beyond inflation typical at each age: pay climbs fastest early
    in a career and levels off in the 50s (age-earnings profiles from the
    Census and Social Security earnings records, with the economy's own
    growth in pay on top). Per year, after inflation. */
const RAISE_BY_AGE: [number, number][] = [[25, 0.04], [30, 0.035], [35, 0.0275], [40, 0.02], [45, 0.015], [50, 0.01], [55, 0.0075], [200, 0.005]];
export function raiseAt(age: number): number {
  for (const [under, r] of RAISE_BY_AGE) if (age < under) return r;
  return 0.005;
}
/** The typical raise beyond inflation, on average over the years from an
    age to retirement. */
export function typicalRaise(age: number, retire: number): number {
  const n = Math.max(1, Math.round(retire - age));
  let t = 0;
  for (let k = 0; k < n; k++) t += raiseAt(age + k);
  return t / n;
}

/** Steps from the middle, positive when the figure makes the plan look
    better. `higherIsBetter` false for costs and inflation. */
export const stepsFrom = (v: number, mid: number, step: number, higherIsBetter = true) => ((higherIsBetter ? 1 : -1) * (v - mid)) / step;

/** A child's costs from birth to 18, monthly figures added over the
    years: before school six years, 6 to 12 seven, 13 to 18 six. Blank
    figures are the typical ones. */
export function childYears(c: { early: number | null; school: number | null; teen: number | null }, childcare: boolean, area: CareArea): number {
  return 6 * (c.early ?? earlyCost(childcare, area)) + 7 * (c.school ?? CHILD_COST.school) + 6 * (c.teen ?? CHILD_COST.teen);
}
/** Your children's costs against the typical ones, as a share (1 is the
    same), counting a later child's share for each child after the first. */
export function kidsRatio(costs: { early: number | null; school: number | null; teen: number | null; later: number | null }, n: number, childcare: boolean, area: CareArea): number {
  if (n <= 0) return 1;
  const mine = childYears(costs, childcare, area), usual = childYears({ early: null, school: null, teen: null }, childcare, area);
  const later = costs.later ?? CHILD_COST.later;
  const all = (one: number, share: number) => one * (1 + share * (n - 1));
  return usual > 0 ? all(mine, later) / all(usual, CHILD_COST.later) : 1;
}

/** Each figure's effect, made to add up to the whole: run one at a time
    they overlap (returns compound with saving), so the difference between
    their sum and the whole is shared out by the size of each. */
export function shareOut(effects: number[], whole: number): number[] {
  const sum = effects.reduce((a, e) => a + e, 0), size = effects.reduce((a, e) => a + Math.abs(e), 0);
  if (!(size > 0)) return effects.map(() => 0);
  const rest = whole - sum;
  return effects.map((e) => e + (rest * Math.abs(e)) / size);
}

/** Today's dollars a year for `years` years, starting `from` years after
    retirement, as a sum at retirement: each year's worth brought back at
    2% a year after inflation, about what safe bonds pay. */
export function atRetirement(perYear: number, from: number, years: number): number {
  let t = 0;
  for (let k = 0; k < years; k++) t += perYear / Math.pow(1.02, Math.max(0, from + k));
  return t;
}
