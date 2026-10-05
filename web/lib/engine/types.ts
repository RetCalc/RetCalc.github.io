/* Shapes of what the engine returns, for the TypeScript screens that read
   them. The engine itself stays plain JavaScript (moved unchanged); these
   describe it and grow as each tool is ported. */

export interface MortgageInput {
  price: number; down: number; rate: number; term: number; taxPct: number; ins: number;
  pmiPct: number; hoa: number; maintPct: number; util: number;
  extraMonthly: number; extraOnce: number; extraOnceMonth: number; recast: boolean;
  refiOn?: boolean; refiRate?: number; refiTerm?: number; refiCost?: number;
}

export interface MortgageYear { year: number; interest: number; principal: number; paid: number; balance: number; pmi: number }

export interface MortgageResult {
  loan: number; pi: number; tax: number; ins: number; pmi: number; hoa: number; maint: number; util: number;
  total: number; years: MortgageYear[]; totalInterest: number; pmiPaid: number; ltv: number; n: number;
  payoffMonth: number; pmiEndMonth: number | null; recastPI: number | null; extraActive: boolean;
}

export interface RefiResult {
  now: MortgageResult; then: MortgageResult; monthlyDelta: number;
  breakEvenMonths: number | null; lifetimeDelta: number;
}

export interface DebtInput { desc: string; balance: number; apr: number; min: number }
export interface DebtDetail { desc: string; apr: number; min: number; bal: number; start: number; interest: number; paidMonth: number }
export interface DebtResult {
  months: { m: number; balance: number; interest: number; cleared: number }[];
  debts: DebtDetail[]; order: DebtDetail[]; totalInterest: number; monthsTotal: number; stalled: boolean;
  monthlyPool: number; baseMin: number; firstCleared: number; totalPaid: number;
}

export interface CollegeKid { yearsUntil: number; annualCost: number; collegeYrs: number }
export interface CollegeInput {
  yearsUntil: number; annualCost: number; tuitionInfl: number; investRet: number; saved: number; collegeYrs: number; kids: CollegeKid[];
}
export interface CollegeRow { year: number; balance: number; contribs: number; growth: number; projCost: number }
export interface CollegeResult {
  monthly: number; totalFuture: number; targetAtStart: number; savingsAtStart: number; shortfall: number; yearCosts: number[]; rows: CollegeRow[];
}
export interface CollegePlan {
  monthly: number;
  phases: { from: number; to: number; monthly: number }[];
  kids: { index: number; yearsUntil: number; start: number; yearCosts: number[]; total: number; targetAtStart: number }[];
  skipped: number; totalFuture: number; pvToday: number;
  rows: { year: number; balance: number; contribs: number; paid: number; growth: number; needed: number }[];
}
export interface RentBuyResult {
  years: { year: number; buyerNW: number; renterNW: number; homeVal: number; balance: number; monthBuy: number; monthRent: number }[];
  breakEven: number | null; loan: number; pi: number; initialInvest: number; monthlyBuy: number;
}

export interface BasicYear { year: number; start: number; contrib: number; growth: number; end: number }
export interface BasicResult { ppy: number; periods: number; years: BasicYear[]; fv: number; invested: number; growth: number; contribTotal: number }

export interface RothRow {
  i: number; age: number; widowed: boolean; rmd: number; conv: number; ordinary: number; magi: number; tax: number;
  irmaa: number; irmaaTier: number; marginal: number; trad: number; roth: number; brok: number; afterTax: number;
}
export interface RothResult {
  rows: RothRow[]; lifeTax: number; lifeTaxPV: number; lifeIrmaa: number; totalConv: number; peakRMD: number;
  endAfterTax: number; endTrad: number; endRoth: number; endBrok: number; rmdStart: number;
}
