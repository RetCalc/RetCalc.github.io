/* The engine's functions with the types the screens read them by. The
   engine is plain JavaScript moved unchanged, and its JSDoc says only
   "Object" for most results, so the shapes (types.ts) are attached here, once,
   instead of in each tool. Screens import calculations from here, and the
   Early Retirement Bridge's from typed-bridge.ts. */
import * as E from "./core.js";
import type {
  Coast, FinalStageSolve, FvFactors, GoalSolve, MCResult, Plan, RetireTax, SeriesGlobals, Series, SolveYears, Stage,
  BasicResult, HistRuns, Projection, RothResult, CollegeInput, CollegePlan, CollegeResult, DebtInput, DebtResult, MortgageInput, MortgageResult, RefiResult, RentBuyResult, BtInput, BtResult,
} from "./types";

const typed = <F>(f: unknown) => f as F;

export const mortgage = typed<(m: MortgageInput) => MortgageResult>(E.mortgage);
export const refiCompare = typed<(m: MortgageInput, r: { rate?: number; term?: number; cost?: number }) => RefiResult>(E.refiCompare);
export const debtRun = typed<(l: DebtInput[], extra: number, mode: string) => DebtResult | null>(E.debtRun);
export const debtUnderwater = typed<(l: DebtInput[]) => DebtInput[]>(E.debtUnderwater);
export const debtDate = typed<(monthsOut: number) => string>(E.debtDate);
export const debtDur = typed<(months: number) => string>(E.debtDur);
export const collegeSavingsCalc = typed<(i: CollegeInput) => CollegeResult>(E.collegeSavingsCalc);
export const collegePlanCalc = typed<(i: CollegeInput) => CollegePlan | null>(E.collegePlanCalc);
export const rentBuyCalc = typed<(i: Record<string, number | string>) => RentBuyResult>(E.rentBuyCalc);
export const bracketRoom = typed<(taxable: number, status: string) => { nextRate: number; room: number } | null>(E.bracketRoom);

export const backtest = typed<(o: BtInput) => BtResult>(E.backtest);
export const HIST_YEARS = (E.HIST_STOCK as number[]).length;

export const projectBasic = typed<(p: { years: number; real: number; initial: number; contrib: number; period: string; withdrawal: number }) => BasicResult>(E.projectBasic);

export const ssTaxable = typed<(ss: number, otherAgi: number, st: string) => { taxable: number }>(E.ssTaxable);
export const hcFPL = typed<(size: number) => number>(E.hcFPL);
export const hcGrossPremium = typed<(state: string, age: number, manual: number) => number>(E.hcGrossPremium);
export const hcCalcACA = typed<(income: number, gross: number, pctFPL: number, enhanced: boolean) => { credit: number; net: number; eligible: boolean; pct: number }>(E.hcCalcACA);

export const runRoth = typed<(inp: object, doConvert: boolean) => RothResult>(E.runRoth);

export const project = typed<(p: object) => Projection>(E.project);
export const fvFactors = typed<(p: Plan, years?: number) => FvFactors>(E.fvFactors);
export const goalSolve = typed<(p: Plan, solveFor: string, target: number) => GoalSolve>(E.goalSolve);
export const solveYears = typed<(p: Plan, portToday: number, capYears?: number) => SolveYears>(E.solveYears);
export const coastFire = typed<(p: Plan, targetFuture: number) => Coast>(E.coastFire);
export const projectSeries = typed<(g: SeriesGlobals, stages: Stage[]) => Series>(E.projectSeries);
export const finalStageSolve = typed<(g: SeriesGlobals, stages: Stage[], portToday: number) => FinalStageSolve | null>(E.finalStageSolve);
export const monteCarlo = typed<(g: { initial: number; inflation: number }, stages: Stage[], trials: number, seed: number) => MCResult>(E.monteCarlo);
export const retireTax = typed<(inp: object) => RetireTax>(E.computeRetireTax);
export const historicalRuns = typed<(g: { initial: number; fees: number }, stages: object[]) => HistRuns>(E.historicalRuns);
export const fiComputeCrossings = typed<(p: object, maxYears: number) => { crossings: number[]; total: number } | null>(E.fiComputeCrossings);
export const fiComputeCoastCrossings = typed<(p: object) => { crossings: number[]; total: number } | null>(E.fiComputeCoastCrossings);
export const fiYearsFromCrossings = typed<(crossings: number[], total: number, pct: number) => number | null>(E.fiYearsFromCrossings);


export const { HC_AGE40_MULT, HC_STATE_PREMIUM_40, IRMAA, BASIC_BAND, BASIC_DEFAULTS, BASIC_INFL, DEFAULTS, RISK_LEVELS, DEBT_CAP, MORT_RATE_30, PMI_DEFAULT, PPY, STATES, FED_STD, NIIT, computeTax, computeRetireTax, HIST_START, LTCG_2026 } = E;
