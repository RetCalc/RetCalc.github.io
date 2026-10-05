/* The FIRE calculator's inputs and its search for the year the plan gets
   there. From src/js/app/35-fire.js and src/main/23-fire-inputs.html. */
import type { ToolDef } from "@/components/tools/ToolState";
import { PPY, project } from "@/lib/engine/typed";
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
