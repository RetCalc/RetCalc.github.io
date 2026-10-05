/* The engine's functions with the types the screens read them by. The
   engine is plain JavaScript moved unchanged, and its JSDoc says only
   "Object" for most results, so the shapes (types.ts) are attached here, once,
   instead of in each tool. Screens import calculations from here. */
import * as E from "./index.js";
import type {
  BasicResult, CollegeInput, CollegePlan, CollegeResult, DebtInput, DebtResult, MortgageInput, MortgageResult, RefiResult, RentBuyResult,
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

export const projectBasic = typed<(p: { years: number; real: number; initial: number; contrib: number; period: string; withdrawal: number }) => BasicResult>(E.projectBasic);

export const ssTaxable = typed<(ss: number, otherAgi: number, st: string) => { taxable: number }>(E.ssTaxable);
export const hcFPL = typed<(size: number) => number>(E.hcFPL);
export const hcGrossPremium = typed<(state: string, age: number, manual: number) => number>(E.hcGrossPremium);
export const hcCalcACA = typed<(income: number, gross: number, pctFPL: number, enhanced: boolean) => { credit: number; net: number; eligible: boolean; pct: number }>(E.hcCalcACA);

export const { HC_AGE40_MULT, HC_STATE_PREMIUM_40, IRMAA, BASIC_BAND, BASIC_DEFAULTS, BASIC_INFL, DEFAULTS, RISK_LEVELS, DEBT_CAP, MORT_RATE_30, PMI_DEFAULT, PPY, STATES, FED_STD, NIIT, computeTax, computeRetireTax } = E;
