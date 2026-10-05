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

export interface HistBand { year: number; p10: number; p25: number; p50: number; p75: number; p90: number }
export interface HistWindow { start: number; startMonth?: number; final: number }
export interface HistRuns {
  bands: HistBand[]; traces?: (number | null)[][]; count: number; totalYears: number; first: number; last: number;
  span: number; tooLong?: boolean; finals: number[]; median: number; worst: HistWindow; best: HistWindow;
}
export interface ProjectYear { year: number; start: number; contrib: number; growth: number; end: number }
export interface Projection {
  years: ProjectYear[]; fv: number; fvReal: number; ppy: number; periods: number; periodicRate: number;
  invested: number; growth: number; contribTotal: number; lastContrib: number; lastContribReal: number;
  inflYears: number; wd: number; wdReal: number; afterTax: number; afterTaxMo: number; realReturn: number;
}

/* ---- the Advanced and Stages calculators (math.js) ---- */
export interface Glide { on: boolean; endRate?: number; endRateGross?: number; years?: number; endMix?: number }
/** One plan, or one stage, in the engine's terms: rates as decimals. */
export interface Plan {
  initial: number; contrib: number; period: string; growth: number; nominal: number; inflation: number;
  years: number; withdrawal: number; taxRate: number; vol: number; fees: number; gross: number;
  glide: Glide; inflYears?: number | "";
}
export interface FvFactors { ppy: number; n: number; initFactor: number; annuity: number; periodicRate: number }
export interface GoalSolve {
  ppy: number; portToday: number; pays: number; portFuture: number; initGrows: number;
  annuity: number; perPeriod: number; perYear: number; change: number;
}
export interface SolveYears { reached: boolean; years: number }
export interface Coast { state: "already" | "reachable" | "never"; years: number; balance: number }
export interface MCBand { year: number; p10: number; p25: number; p50: number; p75: number; p90: number }
export interface MCResult { bands: MCBand[]; finals: number[]; trials: number; median: number; totalYears: number }
export interface Stage {
  years: number; contrib: number; period: string; growth: number; nominal: number; vol?: number;
  mix?: number; glide?: Glide; adj?: boolean; name?: string;
}
export interface SeriesGlobals { initial: number; inflation: number; withdrawal: number; taxRate: number; fees: number; inflYears?: number | "" }
export interface SeriesRow { stage: number; endYear: number; start: number; contrib: number; growth: number; end: number }
export interface SeriesCalRow { year: number; stageFrom: number; stage: number; start: number; contrib: number; growth: number; end: number; t: number }
export interface SeriesSummary { stage: number; years: number; endYear: number; start: number; contrib: number; growth: number; end: number; nominal: number }
export interface Series {
  rows: SeriesRow[]; calRows: SeriesCalRow[]; summary: SeriesSummary[]; chartRows: { year: number; stage: number; end: number }[];
  totalYears: number; inflYears: number; fv: number; invested: number; contribTotal: number; lastContrib: number;
  lastPeriod: string | null; lastContribReal: number; growth: number; fvReal: number; wd: number; wdReal: number;
  afterTax: number; afterTaxMo: number;
}
export interface FinalStageSolve {
  startBal: number; priorYears: number; totalYears: number; targetFuture: number; grown: number;
  perPeriod: number; perYear: number; change: number; stageYears: number | null; totalIfStretched: number | null; reached: boolean;
}
export interface TaxBucket { label: string; withdrawn: number; taxable: number; federal: number; state: number; tax: number; eff: number }
export interface RetireTax { total: number; buckets: TaxBucket[]; [k: string]: unknown }

/* ---- the Early Retirement Bridge (bridge.js) ---- */
export interface BrInput {
  status: "m" | "s"; state: string; age: number; spend: number;
  trad: number; k401: number; roth: number; rothBasis: number; brok: number; basisPct: number; g457: number;
  stock: number; work: number; workUntil: number; aca: boolean; household: number; premium: number;
  seppMethod: "amort" | "rmd"; seppRate: number; fill: string;
}
export interface BrMix { r: ArrayLike<number>; pi: ArrayLike<number>; n: number; real: number; infl: number }
export interface BrCtx extends BrInput {
  mix: BrMix; real: number; infl: number; adults: number; fpl: number; nB: number;
  r55Age: number; r55: boolean; stateCA: boolean;
}
/** A market to run through: returns and inflation from `off`, for `len` years. */
export interface BrSeq { r: ArrayLike<number>; pi: ArrayLike<number>; off: number; len: number }
export interface BrEnd { trad: number; ira: number; sepp: number; g457: number; roth: number; rothIn: number; brok: number; bBasis: number; total: number }
export interface BrDraws { brok: number; rothBasis: number; rung: number; r55: number; early: number }
export interface BrRow {
  age: number; W: number; sp: number; F: number; C: number; d: BrDraws;
  tax: number; pen: number; health: number; hk: string; fplPct: number | null; fica: number;
  magi: number; ord: number; gain: number; short: number; surplus: number; end: BrEnd;
}
export interface BrRun {
  ok: boolean; cost: number; tax: number; pen: number; health: number; conv: number;
  medicaid: number; cliff: number; gap: number; short: number | null; firstPen: number | null;
  rows: BrRow[] | null; path: Float64Array; end: BrEnd; start?: number;
}
export interface BrTest { hold: number; of: number; runs: BrRun[] }
export interface BrPlan {
  key: string; name: string; phrase: string; desc?: string; off?: string; penaltyPlanned?: boolean;
}
export interface BrMC { r: ArrayLike<number>; pi: ArrayLike<number>; N: number }
