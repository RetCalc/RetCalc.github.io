/* The Drawdown Simulator's engine (drawdown.js, in core.js), with the shapes
   its screens read. Like typed.ts, the code is the engine's own, unchanged;
   this only names what comes back. */
import * as E from "./core.js";

const typed = <F>(f: unknown) => f as F;

/** The engine's options for one plan (ddOptsFromState). */
/** An income or expense the plan adds: an amount a year, from a year of
    retirement, once, for some years or for good. */
export interface DdItem {
  name: string; annual: number; inflate: boolean; startYear: number; on?: boolean;
  duration: { type: "once" | "forever" } | { type: "years"; years: number };
}
export interface DdOpts {
  initial: number; years: number; stockPct: number; svPct: number; cashPct: number; stockPctEnd: number | null;
  rebal: string; rebalN: number; rebalBand: number; fee: number; strategy: string; initialPct: number;
  guardBand: number; adjustPct: number; guardBandLo: number; raisePct: number; gkFinalYears: number;
  floorPct: number; ceilPct: number; yaleWeight: number; yaleRate: number; spendFloor: number; spendCeil: number;
  vpwRate: number; vpwFV: number; skipRaise: boolean; vgCeil: number; vgFloor: number;
  kitThresh: number; kitRaise: number; kitGap: number; clyFloor: number; hebWeight: number; hebRate: number;
  sensExtra: number; rgTarget: number; rgLo: number; rgHi: number; capeA: number; capeB: number;
  path: string; pathEase: number; pathStages: { start: number; level?: number; name?: string }[];
  gShare: number; gType: string; gYield: number; gPayout: number; gInflate: boolean;
  mcBlock: number; mcOwn: boolean; mcRet: Record<"stock" | "sv" | "bond" | "cash" | "infl", number>;
  ssAnnual: number; ssAnnual2: number; incomeItems: DdItem[]; expenseItems: DdItem[];
  ssAnnualTotal: number; legacyGoal: number; comfort: number; retireAge: number | null; fromYear: number; monthly: boolean;
  [k: string]: unknown;
}
/** A plan's setup worked out once: year one's spending, the spending path,
    the minimum by year and guaranteed income. */
export interface DdPrep {
  initial: number; first: number; path: number[]; floor: number[];
  G: { share: number; income: number; real: boolean; rate: number };
  [k: string]: unknown;
}
export interface DdRow {
  year: number; start: number; withdrawal: number; realWithdrawal: number; end: number; realEnd: number; ret: number;
  ss: number; spend: number; realSpend: number; realReg: number; guaranteed: number; customIncome: number; cape: number;
}
export interface DdRun {
  rows: DdRow[]; depleted: boolean; depletedYear: number | null; endReal: number; medRealSpend: number; minRealSpend: number;
}
export interface DdDecade { years: number; port: number; stock: number; bond: number; infl: number }
export interface DdHistRun extends DdRun {
  startIdx: number; startYear: number; startMonth: number; avgStock: number; avgBond: number; avgInfl: number;
  cape0: number; dec1: DdDecade; full: DdDecade;
}
export interface DdHist {
  first: number; monthly: boolean; runs: DdHistRun[]; total: number; survived: number; successRate: number;
  medianEnd: number; worstEnd: number; bestEnd: number; failYears: number[]; failCount: number; firstFail: DdHistRun | null; prep: DdPrep;
}
export interface DdScore {
  n: number; years: number; below: number; dipped: number; longest: number; longRun: DdHistRun | null;
  low: number; lowRun: DdHistRun | null; lowRatio: number; cutsAvg: number; maxCut: number;
  volatile: number; large: number; small: number; bigEnd: number; smallEnd: number; lifeMed: number; firstMed: number;
  comfort: number | number[];
}
export interface DdBand { year: number; p10: number; p25: number; p50: number; p75: number; p90: number }
export interface DdMC {
  trials: number; survived: number; successRate: number; medianEnd: number; p10End: number; bands: DdBand[]; legacy: number;
  med: DdRun; sc: DdScore; bal: Float64Array; spend: Float64Array; years: number; n: number;
  sens: { rate: number; median: number }[] | null; ss: { rate: number; median: number }[] | null;
}
export interface DdShowItem {
  id: string; dial: number | null; floor: number; met: boolean; share: number; capped: boolean; tuned: boolean;
  first: number; life: number; low: number; lowStart: { year: number; month: number } | null; cuts: number; end: number;
}
export interface DdShow { spots: number[]; list: DdShowItem[] }
export interface DdSafeStart { year: number; month: number; rate: number | null; capped?: boolean; cape: number }
export interface DdSafe {
  safe: DdSafeStart[];
  dial: { v: number | null; met: boolean; capped: boolean; share?: number } | null;
  port: { portfolio: number | null; capped?: boolean } | null;
}
export interface DdHeat { rows: number[]; cols: number[]; grid: (number | null)[][]; axis: string; cur: number }
export interface DdWindow { year: number; month: number; seq: unknown[] }
export interface DdTarget { crit: "comfort" | "lasts"; conf: number; comfort: number | number[] }
export interface DdStrat {
  family: string; limits?: boolean; path?: boolean; spendsDown?: boolean;
  dial?: { key: string; lo: number; hi: number };
}
export interface DdEra { year: number; from: number; to: number; title: string; note: string }
export interface DdStudy { id: string; setup: Record<string, unknown>; find: () => Record<string, unknown> }

export const ddOptsFromState = typed<(d: Record<string, unknown>) => DdOpts>(E.ddOptsFromState);
export const ddPrep = typed<(o: DdOpts) => DdPrep>(E.ddPrep);
export const historicalBacktest = typed<(o: DdOpts) => DdHist>(E.historicalBacktest);
export const runDrawdown = typed<(o: DdOpts, seq: unknown[], ctl?: { lite?: boolean } | null, P?: DdPrep) => DdRun>(E.runDrawdown);
export const ddScorecard = typed<(runs: DdRun[], o: DdOpts, comfort: number | number[], path: number[]) => DdScore>(E.ddScorecard);
export const ddComfort = typed<(o: DdOpts, P?: DdPrep) => number | number[]>(E.ddComfort);
export const ddLineAt = typed<(c: number | number[], y: number) => number>(E.ddLineAt);
export const ddWindows = typed<(o: DdOpts) => DdWindow[]>(E.ddWindows);
export const ddWithDial = typed<(o: DdOpts, v: number) => DdOpts>(E.ddWithDial);
export const ddForTarget = typed<(o: DdOpts, T: DdTarget) => DdOpts>(E.ddForTarget);
export const ddQuick = typed<(o: DdOpts) => { successRate: number; medianEnd: number }>(E.ddQuick);
export const ddMCHistory = typed<() => Record<"stock" | "sv" | "bond" | "cash" | "infl", number>>(E.ddMCHistory);
export const ddRmdDivisor = typed<(age: number) => number>(E.ddRmdDivisor);
export const ddGuaranteed = typed<(o: DdOpts) => DdPrep["G"]>(E.ddGuaranteed);
export const ddEraFor = typed<(year: number) => DdEra | null>(E.ddEraFor);
export const ddStudy = typed<(id: string) => DdStudy | null>(E.ddStudy);
export const ddStagesFromRates = typed<(stages: unknown[], rate: number) => { start: number; level: number }[]>(E.ddStagesFromRates);
export const DD_LANDING = E.DD_LANDING as Record<string, Record<string, unknown>>;
export const ddJob = typed<(job: string, args: unknown) => unknown>(E.ddJob);
export const ssEstimate = typed<(income: number, years: number, claim: number) => { monthly: number; pia: number }>(E.ssEstimate);
export const ssDrawdownStreams = typed<(inc: number, claim: number, inc2: number, claim2: number, couple: boolean, retireAge: number | null, delay: number) =>
  { own1: number; top1: number; own2: number; top2: number; annual: number; delay: number; annual2: number; delay2: number; annual3: number; delay3: number }>(E.ssDrawdownStreams);

export const DD_STRAT = E.DD_STRAT as Record<string, DdStrat>;
export const DD_ORDER = E.DD_ORDER as string[];
export const DD_ERAS = E.DD_ERAS as DdEra[];
export const DD_RESEARCH = E.DD_RESEARCH as DdStudy[];
export const HIST_M_CAPE = E.HIST_M_CAPE as number[];
export const HIST_STOCK = E.HIST_STOCK as number[];
export const { CAPE_NOW, CAPE_NOW_ASOF, HIST_START } = E as unknown as { CAPE_NOW: number; CAPE_NOW_ASOF: string; HIST_START: number };
