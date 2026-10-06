/* The FIRE calculator's inputs and its search for the year the plan gets
   there. From src/js/app/35-fire.js and src/main/23-fire-inputs.html. */
import type { ToolDef } from "@/components/tools/ToolState";
import { PPY, fiComputeCoastCrossings, fiComputeCrossings, fiYearsFromCrossings, historicalRuns, project } from "@/lib/engine/typed";
import type { HistRuns } from "@/lib/engine/types";
import { groupDigits, parseNum } from "@/lib/format";

export const FIRE_DEFAULTS = {
  mode: "fire" as "fire" | "coast",
  curAge: "30", retireAge: "65", initial: groupDigits(10000, true), contrib: groupDigits(1000, true), period: "Monthly",
  growth: "0", nominal: "8.5", inflation: "3", solveFor: "withdrawal", target: groupDigits(40000, true), withdrawal: "4",
  /** The chart: a band of returns either side of yours, or every window since 1926. */
  chart: "band" as "band" | "hist", band: "2", histMix: "80", successRate: "50",
};
export type FireInputs = typeof FIRE_DEFAULTS;

export const FIRE_DEF: ToolDef<FireInputs> = { id: "fire", label: "FIRE Calculator", noun: "FIRE plan", defaults: FIRE_DEFAULTS };

/* As the old site read them: a blank or 0 field takes its default. */
export function fireInput(s: FireInputs) {
  const n = parseNum;
  const wr = Math.max(0, n(s.withdrawal) || 4) / 100;
  const targetAmt = n(s.target) || 0;
  return {
    mode: s.mode,
    curAge: Math.max(18, Math.min(70, n(s.curAge) || 30)),
    retireAge: Math.max(40, Math.min(100, n(s.retireAge) || 65)),
    initial: Math.max(0, n(s.initial) || 0), contrib: Math.max(0, n(s.contrib) || 0), period: s.period || "Monthly",
    growth: (n(s.growth) || 0) / 100, nominal: Math.max(0, n(s.nominal) || 8.5) / 100, inflation: Math.max(0, n(s.inflation) || 3) / 100,
    target: s.solveFor === "withdrawal" ? (wr > 0 ? targetAmt / wr : 0) : targetAmt,
    withdrawal: wr, solveFor: s.solveFor, targetAmt,
    band: Math.max(0, n(s.band) || 2) / 100,
    histMix: Math.max(0, Math.min(1, (n(s.histMix) || 80) / 100)),
    successRate: parseInt(s.successRate) || 50,
  };
}
export type FirePlan = ReturnType<typeof fireInput>;

/** When the plan reaches its target (FIRE), or could stop contributing and
    still reach it by the retirement age (Coast FIRE): the year, to a
    fraction, and the portfolio then. null when it never does by 100. */
export function fireSolve(p: FirePlan) {
  const realRate = (1 + p.nominal) / (1 + p.inflation) - 1;
  const maxYears = Math.max(5, Math.min(100 - p.curAge, 80));
  const pp = project({ initial: p.initial, contrib: p.contrib, period: p.period, growth: p.growth, nominal: p.nominal,
    inflation: p.inflation, years: maxYears, withdrawal: 0, taxRate: 0 });
  const coastNeed = (yearsLeft: number) => (realRate > -1 ? p.target / Math.pow(1 + realRate, yearsLeft) : p.target);

  let fireYear: number | null = null, real = 0, nominal = 0;
  if (p.mode === "fire" && p.initial >= p.target) {
    fireYear = 0; real = p.initial; nominal = p.initial;
  } else if (p.mode === "coast" && p.retireAge > p.curAge && p.initial >= coastNeed(p.retireAge - p.curAge)) {
    fireYear = 0; real = p.initial; nominal = p.initial;
  }
  if (fireYear === null) {
    let prevReal = p.initial, prevCn = coastNeed(p.retireAge - p.curAge);
    for (const yr of pp.years) {
      const realBal = (yr.end || 0) / Math.pow(1 + p.inflation, yr.year);
      if (p.mode === "fire") {
        if (realBal >= p.target) {
          const span = realBal - prevReal, frac = span > 0 ? (p.target - prevReal) / span : 1;
          fireYear = yr.year - 1 + Math.max(0, Math.min(1, frac)); real = realBal; nominal = yr.end || 0;
          break;
        }
        prevReal = realBal;
      } else {
        const yearsLeft = p.retireAge - p.curAge - yr.year;
        if (yearsLeft <= 0) {
          if (realBal >= p.target) { fireYear = yr.year; real = realBal; nominal = yr.end || 0; }
          break;
        }
        const cn = coastNeed(yearsLeft);
        if (realBal >= cn) {
          const prevDiff = prevReal - prevCn, currDiff = realBal - cn;
          const frac = currDiff - prevDiff > 0 ? -prevDiff / (currDiff - prevDiff) : 1;
          fireYear = yr.year - 1 + Math.max(0, Math.min(1, frac)); real = realBal; nominal = yr.end || 0;
          break;
        }
        prevReal = realBal; prevCn = cn;
      }
    }
  }
  // Contributions to the FIRE year, in future dollars.
  let contribs = 0;
  if (fireYear !== null && fireYear > 0)
    for (let j = 0; j < fireYear; j++) contribs += p.contrib * ((PPY as Record<string, number>)[p.period] || 12) * Math.pow(1 + p.growth, j);
  return { realRate, maxYears, pp, fireYear, real, nominal, contribs };
}

/** Everything the calculator shows from its inputs: the plan, its solve,
    with the history chart the year the chosen share of windows since 1926
    gets there (cr is null when history is too short for the horizon), the
    year the chart marks, the gains to the FIRE year, and for Coast FIRE
    what saving on to retirement would reach and how far that is above
    coasting. */
export function fireCompute(s: FireInputs) {
  const p = fireInput(s);
  const S = p.target > 0 ? fireSolve(p) : null;
  let cr: { crossings: number[]; total: number } | null = null, histYear: number | null = null;
  if (S && s.chart === "hist") {
    cr = p.mode === "coast" ? fiComputeCoastCrossings(p) : fiComputeCrossings(p, S.maxYears);
    if (cr) histYear = fiYearsFromCrossings(cr.crossings, cr.total, p.successRate);
  }
  const displayYear = histYear !== null && histYear >= 0 ? histYear : S?.fireYear ?? null;
  const gains = S ? Math.max(0, S.nominal - p.initial - S.contribs) : 0;
  let keep: number | null = null, coastGap: number | null = null;
  if (S && p.mode === "coast" && S.fireYear !== null) {
    const retYears = p.retireAge - p.curAge;
    const full = project({ initial: p.initial, contrib: p.contrib, period: p.period, growth: p.growth, nominal: p.nominal, inflation: p.inflation, years: retYears, withdrawal: 0, taxRate: 0 });
    keep = ((full.years[full.years.length - 1] || { end: 0 }).end || 0) / Math.pow(1 + p.inflation, retYears);
    coastGap = Math.max(0, keep - S.real * Math.pow(1 + S.realRate, retYears - S.fireYear));
  }
  return { p, S, cr, histYear, displayYear, gains, keep, coastGap };
}

export type FirePt = { year: number; base: number; hi: number; lo: number; p25?: number; p75?: number };

/* The rate band: your return, and the band's width above and below it, in
   today's dollars. Coast FIRE stops contributing at the coast year. */
export function fireBandPoints(p: FirePlan, displayYear: number | null, maxYears: number) {
  const isCoast = p.mode === "coast";
  const retYrs = isCoast ? Math.max(1, p.retireAge - p.curAge) : maxYears;
  const rates = [p.nominal, p.nominal + p.band, Math.max(0.001, p.nominal - p.band)];
  const run = (nominal: number, initial: number, contrib: number, years: number) =>
    project({ initial, contrib, period: p.period, growth: p.growth, nominal, inflation: p.inflation, years, withdrawal: 0, taxRate: 0 });
  const real = (end: number | undefined, year: number) => (end || 0) / Math.pow(1 + p.inflation, year);
  const pts: FirePt[] = [{ year: 0, base: p.initial, hi: p.initial, lo: p.initial }];
  let maxX = maxYears;
  if (isCoast && displayYear !== null && displayYear > 0 && displayYear < retYrs) {
    const coastYrs = Math.round(displayYear);
    const [b, h, l] = rates.map((r) => run(r, p.initial, p.contrib, coastYrs));
    b.years.forEach((y, i) => pts.push({ year: y.year, base: real(y.end, y.year), hi: real((h.years[i] || y).end, y.year), lo: real((l.years[i] || y).end, y.year) }));
    const rest = retYrs - coastYrs;
    if (rest > 0) {
      // Each line coasts on from its own balance, at its own rate.
      const [b2, h2, l2] = [run(rates[0], b.fv, 0, rest), run(rates[1], h.fv, 0, rest), run(rates[2], l.fv, 0, rest)];
      b2.years.forEach((y, i) => pts.push({ year: coastYrs + y.year, base: real(y.end, coastYrs + y.year),
        hi: real((h2.years[i] || y).end, coastYrs + y.year), lo: real((l2.years[i] || y).end, coastYrs + y.year) }));
    }
    maxX = retYrs;
  } else {
    const years = p.mode === "fire" && displayYear !== null && displayYear > 0 ? displayYear : isCoast ? retYrs : maxYears;
    const [b, h, l] = rates.map((r) => run(r, p.initial, p.contrib, years));
    b.years.forEach((y, i) => pts.push({ year: y.year, base: real(y.end, y.year), hi: real((h.years[i] || y).end, y.year), lo: real((l.years[i] || y).end, y.year) }));
    if (b.years.length) maxX = b.years[b.years.length - 1].year;
  }
  return { pts, maxX };
}

/* Every rolling window since 1926: to the FIRE year, or to retirement with
   contributions stopping at the coast year. */
export function fireHistRuns(p: FirePlan, displayYear: number | null, maxYears: number): HistRuns {
  const retYrs = p.mode === "coast" ? Math.max(1, p.retireAge - p.curAge) : maxYears;
  const st = (years: number, contrib = p.contrib) => ({ years, contrib, period: contrib ? p.period : "Monthly", growth: contrib ? p.growth : 0, mix: p.histMix });
  const stages = p.mode === "coast"
    ? displayYear !== null && displayYear > 0 && displayYear < retYrs ? [st(displayYear), st(retYrs - displayYear, 0)] : [st(retYrs)]
    : [st(displayYear !== null && displayYear > 0 ? displayYear : maxYears)];
  return historicalRuns({ initial: p.initial, fees: 0 }, stages);
}
