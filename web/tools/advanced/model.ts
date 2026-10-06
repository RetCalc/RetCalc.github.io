/* The Advanced calculator's inputs, and the parsing that turns them into a
   plan for the engine. `contrib` and `period` are read by the Budget
   (lib/retirement-contribs.ts). From readInputs() and writeInputs() in
   src/js/app/01-inputs.js and the account fields in 02-accounts-advanced.js. */
import type { ToolDef } from "@/components/tools/ToolState";
import { accountBreakdown, growthBlend, seniorsAt, targetRate, type AccountResult, type Accounts, type GrowthRates } from "@/lib/accounts";
import { DEFAULTS, coastFire, goalSolve, project, solveYears } from "@/lib/engine/typed";
import type { Plan } from "@/lib/engine/types";
import { groupDigits, parseNum, pctStr } from "@/lib/format";
import type { Household } from "@/lib/household";

/** A plan in the engine's own terms: rates as decimals, dollars as numbers. */
export interface PlainPlan {
  initial: number; contrib: number; period: string; growth: number; nominal: number; inflation: number;
  years: number; withdrawal: number; taxRate: number; vol?: number; fees?: number; gross?: number;
}

/* A rate as the field shows it: 8.5 for 0.085, without float noise. */
export const pctField = (v: number) => String(+(v * 100).toFixed(6));

/** The fields for a plan, as writeInputs() filled them; accounts and glide off. */
export function advancedFields(p: PlainPlan) {
  return {
    initial: groupDigits(p.initial, true), contrib: groupDigits(p.contrib), period: p.period,
    growth: pctField(p.growth), nominal: pctField(p.gross ?? p.nominal), inflation: pctField(p.inflation), years: String(p.years),
    withdrawal: pctField(p.withdrawal), taxRate: pctField(p.taxRate), vol: pctField(p.vol ?? 0.15), fees: pctField(p.fees ?? 0),
    glideOn: false, glideEnd: "", glideYears: "", acOn: false, gRates: null as GrowthRates | null,
  };
}

/** The account fields, blank until the split is first turned on (which
    fills them in, the state included; until then it sits on the list's
    first entry, as on the old site). */
export const ACCOUNT_FIELDS = {
  tradBal: "", tradC: "", rothBal: "", rothC: "", brokBal: "", brokC: "", brokBasis: "",
  salary: "", matchPct: "", matchCap: "", acStatus: "s", acState: "AL",
};

export const ADVANCED_DEFAULTS = {
  ...advancedFields(DEFAULTS as PlainPlan),
  ...ACCOUNT_FIELDS,
  solveFor: "After-Tax Withdrawal", target: groupDigits(100000), histMix: "80", histMixEnd: "40",
};
export type AdvancedInputs = typeof ADVANCED_DEFAULTS;

export const ADVANCED_DEF: ToolDef<AdvancedInputs> = { id: "advanced", label: "Advanced", noun: "retirement scenario", defaults: ADVANCED_DEFAULTS };

const n = (s: string) => parseNum(s);
const rate = (s: string) => parseNum(s) / 100;

/** The account fields as numbers. */
export function readAccounts(s: typeof ACCOUNT_FIELDS & { gRates: GrowthRates | null }): Accounts {
  return {
    tradBal: n(s.tradBal), tradC: n(s.tradC), rothBal: n(s.rothBal), rothC: n(s.rothC), brokBal: n(s.brokBal), brokC: n(s.brokC),
    brokBasis: s.brokBasis.trim() === "" ? null : n(s.brokBasis),
    salary: n(s.salary), matchPct: n(s.matchPct), matchCap: n(s.matchCap),
    status: s.acStatus, state: s.acState, gRates: s.gRates ?? undefined,
  };
}

/** Glide years held between 1 and the plan's length, as the field shows them. */
export function glideYearsFor(years: string, glideYears: string): string {
  const total = Math.max(1, Math.round(n(years)));
  const y = Math.round(n(glideYears));
  const c = Math.min(total, Math.max(1, y || 1));
  return c !== y ? String(c) : glideYears;
}

/** What a glide does, in words: "Holds 8.5% through year 25, then eases
    down to 5.5% by year 30." Stages adds " of this stage". */
export function glideNote(start: number, end: number, years: number, glideYears: number, of = ""): string {
  const total = Math.max(1, Math.round(years));
  const gy = Math.min(total, Math.max(1, Math.round(glideYears) || 1));
  return "Holds " + pctStr(start, 1) + " through year " + (Math.max(1, total - gy + 1) - 1) + of +
    ", then eases down to " + pctStr(end, 1) + " by year " + total + ".";
}

export interface AdvancedPlan {
  p: Plan;
  /** With the split on: the accounts, and each one at retirement. */
  a: Accounts | null;
  B: AccountResult | null;
}

/** The plan the inputs describe. Split by account type, the starting value
    and contribution are the accounts' totals (plus any match), and the tax
    rate is the one the accounts' first withdrawal works out to. */
export function advancedPlan(s: AdvancedInputs, household: Household | null): AdvancedPlan {
  const years = Math.min(100, n(s.years));
  const p: Plan = {
    initial: n(s.initial), contrib: n(s.contrib), period: s.period,
    growth: rate(s.growth), nominal: rate(s.nominal) - rate(s.fees), inflation: rate(s.inflation),
    years, withdrawal: rate(s.withdrawal), taxRate: rate(s.taxRate), vol: rate(s.vol),
    fees: rate(s.fees), gross: rate(s.nominal),
    glide: s.glideOn ? {
      on: true, endRate: rate(s.glideEnd) - rate(s.fees), endRateGross: rate(s.glideEnd),
      years: Math.min(years, Math.max(1, Math.round(n(s.glideYears)))),
    } : { on: false },
  };
  if (!s.acOn) return { p, a: null, B: null };
  const a = readAccounts(s);
  if (a.gRates) p.growth = growthBlend(p, p.years, { t: a.tradC, r: a.rothC, b: a.brokC }, a.gRates);
  const B = accountBreakdown(p, a, seniorsAt(a, p.years, household));
  p.initial = a.tradBal + a.rothBal + a.brokBal;
  p.contrib = a.tradC + a.rothC + a.brokC + (B.match ?? 0);
  p.taxRate = B.effRate;
  return { p, a, B };
}

/** The plan the goal solve works on: an after-tax income target is taxed at
    the rate that income itself would pay. */
export function solvePlan(P: AdvancedPlan, solveFor: string, target: number): Plan {
  if (!P.B || solveFor !== "After-Tax Withdrawal") return P.p;
  return { ...P.p, taxRate: targetRate(P.B, target, P.p.taxRate) };
}

/** Everything the screen shows from the inputs: the projection, the goal
    solve, Coast FIRE, the years to the goal, and what fees cost. */
export function advancedCompute(s: AdvancedInputs, household: Household | null) {
  const P: AdvancedPlan = advancedPlan(s, household);
  const p = P.p;
  const R = project(p);
  const target = parseNum(s.target);
  const S = goalSolve(solvePlan(P, s.solveFor, target), s.solveFor, target);
  const C = coastFire(p, S.portFuture);
  const Y = solveYears(p, S.portToday);
  const feeCost = p.fees > 0 ? project({ ...p, nominal: p.gross }).fv - R.fv : 0;
  return { P, p, R, S, C, Y, feeCost };
}
