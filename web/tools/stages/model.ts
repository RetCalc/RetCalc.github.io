/* The Stages calculator's inputs, and the parsing that turns them into a
   series of stages for the engine. The first stage's `contrib` and `period`
   are read by the Budget (lib/retirement-contribs.ts). From
   src/js/app/08-stages.js. */
import type { ToolDef } from "@/components/tools/ToolState";
import { finishAccounts, growthBlend, seniorsAt, targetRate, type AccountResult, type Accounts, type GrowthRates } from "@/lib/accounts";
import { PPY, finalStageSolve, projectSeries } from "@/lib/engine/typed";
import type { Plan, SeriesGlobals, Stage } from "@/lib/engine/types";
import { groupDigits, parseNum } from "@/lib/format";
import type { Household } from "@/lib/household";
import { pctField } from "@/tools/advanced/model";

/** One stage card, as typed. `sTrad` and `sRoth` split its contribution
    across accounts; `cT`/`cR`/`cB` are the split amounts as typed, kept only
    while one is being edited. */
export interface StageInputs {
  name?: string;
  years: string; contrib: string; period: string; growth: string; nominal: string; vol: string;
  adj: boolean;
  glideOn: boolean; glideEnd: string; glideYears: string;
  sTrad?: number; sRoth?: number; gRates?: GrowthRates | null;
  cT?: string; cR?: string; cB?: string;
}

/** A stage from numbers, as buildStages() showed one. */
export function stageFields(st: Omit<Stage, "glide"> & { glide?: { on: boolean; endRate?: number; years?: number }; sTrad?: number; sRoth?: number; gRates?: GrowthRates }): StageInputs {
  const glideOn = !!st.glide?.on;
  return {
    years: String(st.years), contrib: groupDigits(st.contrib, true), period: st.period,
    growth: pctField(st.growth), nominal: pctField(st.nominal), vol: pctField(st.vol ?? 0), adj: !!st.adj,
    glideOn, glideEnd: glideOn && st.glide?.endRate != null ? pctField(st.glide.endRate) : "",
    glideYears: glideOn && st.glide?.years ? String(st.glide.years) : "",
    ...(st.sTrad != null ? { sTrad: st.sTrad, sRoth: st.sRoth } : {}),
    ...(st.gRates ? { gRates: st.gRates } : {}),
  };
}

const DEFAULT_STAGES = [
  stageFields({ years: 10, contrib: 500, period: "Bi-Weekly", growth: 0.04, nominal: 0.085, vol: 0.17 }),
  stageFields({ years: 20, contrib: 1200, period: "Monthly", growth: 0.03, nominal: 0.085, vol: 0.09, adj: true }),
];

export const STAGE_ACCOUNT_FIELDS = {
  saTradBal: "", saRothBal: "", saBrokBal: "", saBrokBasis: "", saSalary: "", saMatchPct: "", saMatchCap: "", saStatus: "s", saState: "AL",
};

export const STAGES_DEFAULTS = {
  initial: groupDigits(10000, true), inflation: "3", withdrawal: "4", taxRate: "10", fees: "0",
  saOn: false, ...STAGE_ACCOUNT_FIELDS,
  stages: DEFAULT_STAGES,
  solveFor: "After-Tax Withdrawal", target: groupDigits(100000, true), histMix: "80", histMixEnd: "40",
};
export type StagesInputs = typeof STAGES_DEFAULTS;

export const STAGES_DEF: ToolDef<StagesInputs> = { id: "stages", label: "Stages", noun: "retirement scenario", defaults: STAGES_DEFAULTS };

/** Whether the stages differ from the ones the tool starts with. */
export function stagesLookEdited(list: StageInputs[]): boolean {
  if (list.length !== DEFAULT_STAGES.length) return true;
  const n = parseNum;
  return list.some((st, i) => {
    const d = DEFAULT_STAGES[i];
    return n(st.years) !== n(d.years) || n(st.contrib) !== n(d.contrib) || st.period !== d.period ||
      n(st.growth) !== n(d.growth) || n(st.nominal) !== n(d.nominal);
  });
}

/* ---- parsing ---- */

const rate = (s: string) => parseNum(s) / 100;

/** A stage in numbers: the engine's Stage plus its account split. */
export interface StageNum extends Stage {
  sTrad?: number; sRoth?: number; gRates?: GrowthRates | null;
}

/** Glide years held between 1 and the stage's length, as the field shows
    them: what was typed, unless the hold changed it. */
export function stageGlideYears(years: string, glideYears: string): string {
  const y = Math.max(1, Math.round(parseNum(glideYears)));
  const c = Math.min(Math.max(1, Math.round(parseNum(years))), y);
  return c !== y ? String(c) : glideYears;
}

export function readStage(st: StageInputs): StageNum {
  return {
    years: Math.min(100, parseNum(st.years)), contrib: parseNum(st.contrib), period: st.period,
    growth: rate(st.growth), nominal: rate(st.nominal), vol: rate(st.vol), adj: st.adj, name: st.name,
    glide: st.glideOn ? { on: true, endRate: rate(st.glideEnd), years: Math.max(1, Math.round(parseNum(st.glideYears))) } : { on: false },
    sTrad: st.sTrad, sRoth: st.sRoth, gRates: st.gRates,
  };
}

/* A stage with no split yet puts everything in traditional. Roth is capped
   at what's left after traditional; the brokerage takes the remainder. */
export function stageSplit(st: { sTrad?: number; sRoth?: number }) {
  const t = Math.max(0, Math.min(1, st.sTrad == null ? 1 : st.sTrad));
  const r = Math.max(0, Math.min(1 - t, st.sRoth == null ? 0 : st.sRoth));
  return { t, r, b: Math.max(0, 1 - t - r) };
}

export interface Globals extends SeriesGlobals {
  acct?: Accounts;
}

/* The same formula as Advanced: matchPct% of what goes into traditional and
   Roth, on contributions up to matchCap% of salary, worked out at the start
   of the stage as a multiple of your own contribution. */
function matchFactor(g: Globals, st: StageNum, mine: number, salary: number): number {
  const a = g.acct;
  if (!a || !(a.matchPct > 0) || !(salary > 0) || !(mine > 0)) return 1;
  const s = stageSplit(st), ppy = (PPY as Record<string, number>)[st.period];
  const eligible = Math.min(mine * (s.t + s.r), salary * (a.matchCap || 0) / 100 / ppy);
  return 1 + Math.max(0, eligible * a.matchPct / 100) / mine;
}

export interface EffStage extends StageNum { mf: number; mine: number; salary: number }

/* Fees come off every stage's return. A stage can also have its typed
   contribution restated in the dollars of its own start year ($3,000 for a
   stage beginning in year 5 is modeled as $3,000 x (1+inflation)^5), and
   any match multiplies it. */
export function effectiveStages(g: Globals, list: StageNum[]): EffStage[] {
  const fee = g.fees || 0, infl = g.inflation || 0;
  let start = 0, salary = g.acct ? g.acct.salary || 0 : 0;
  return list.map((st, i) => {
    const factor = st.adj && i > 0 ? Math.pow(1 + infl, start) : 1;
    const mine = st.contrib * factor;
    const mf = matchFactor(g, st, mine, salary);
    const out: EffStage = { ...st, contrib: mine * mf, mf, mine, salary, nominal: st.nominal - fee };
    // the salary a later stage is matched on has had this stage's raises
    salary *= Math.pow(1 + (st.growth || 0), st.years || 0);
    // the glide's end rate is stored as typed, so the fee comes off it here too
    if (out.glide?.on) out.glide = { ...out.glide, endRate: (out.glide.endRate ?? 0) - fee };
    start += st.years;
    return out;
  });
}

/* A stage with per-account growth runs on the blend of them, weighted by its
   split, at its own return net of fees. */
export function stageGrowthBlend(st: StageNum, fee: number, rates: GrowthRates): number {
  const e = {
    ...st, nominal: st.nominal - fee,
    glide: st.glide?.on ? { ...st.glide, endRate: (st.glide.endRate ?? 0) - fee } : st.glide,
  } as unknown as Plan;
  const s = stageSplit(st);
  return growthBlend(e, st.years, { t: s.t, r: s.r, b: s.b }, rates);
}

export function readStageAccounts(s: StagesInputs): Accounts {
  const n = parseNum;
  return {
    tradBal: n(s.saTradBal), rothBal: n(s.saRothBal), brokBal: n(s.saBrokBal),
    tradC: 0, rothC: 0, brokC: 0,
    brokBasis: s.saBrokBasis.trim() === "" ? null : n(s.saBrokBasis),
    salary: n(s.saSalary), matchPct: n(s.saMatchPct), matchCap: n(s.saMatchCap), status: s.saStatus, state: s.saState,
  };
}

export interface StagesPlan {
  g: Globals;
  stages: StageNum[];
  eff: EffStage[];
  B: AccountResult | null;
}

/** The run the inputs describe. Split by account type, the starting value is
    the accounts' total and the tax rate is what their first withdrawal works
    out to; each account's balance comes from running the series once per
    account, with that account's slice of every stage. */
export function stagesPlan(s: StagesInputs, household: Household | null): StagesPlan {
  const g: Globals = { initial: parseNum(s.initial), inflation: rate(s.inflation), withdrawal: rate(s.withdrawal),
    taxRate: rate(s.taxRate), fees: rate(s.fees), inflYears: "" };
  const stages = s.stages.map(readStage);
  if (!s.saOn) return { g, stages, eff: effectiveStages(g, stages), B: null };
  for (const st of stages) if (st.gRates) st.growth = stageGrowthBlend(st, g.fees, st.gRates);
  const a = readStageAccounts(s);
  g.initial = a.tradBal + a.rothBal + a.brokBal;
  g.acct = a;
  const eff = effectiveStages(g, stages);
  // of every dollar a stage puts in, 1/mf is yours (split three ways) and the rest is match
  const mfOf = (i: number) => eff[i].mf || 1;
  const gOf = (k: "t" | "r" | "b") => (i: number) => (stages[i].gRates ? stages[i].gRates![k] : eff[i].growth);
  const slice = (bal: number, share: (i: number) => number, grow?: (i: number) => number) =>
    projectSeries({ ...g, initial: bal }, eff.map((st, i) => ({ ...st, contrib: st.contrib * share(i), growth: grow ? grow(i) : st.growth })));
  const T = slice(a.tradBal, (i) => stageSplit(stages[i]).t / mfOf(i), gOf("t"));
  const Ro = slice(a.rothBal, (i) => stageSplit(stages[i]).r / mfOf(i), gOf("r"));
  const Br = slice(a.brokBal, (i) => stageSplit(stages[i]).b / mfOf(i), gOf("b"));
  const Mt = slice(0, (i) => (mfOf(i) - 1) / mfOf(i));
  const years = T.totalYears;
  const basis0 = a.brokBasis == null ? a.brokBal : a.brokBasis;
  const B = finishAccounts(a, { trad: T.fv + Mt.fv, roth: Ro.fv, brok: Br.fv }, basis0 + Br.contribTotal,
    Math.pow(1 + g.inflation, years), g.withdrawal, seniorsAt(a, years, household));
  B.matchTotal = Mt.contribTotal;
  B.rothIn = Ro.contribTotal;
  B.years = years;
  g.taxRate = B.effRate;
  return { g, stages, eff, B };
}

/** The tax rate an after-tax income target is figured at. */
export function stagesTargetRate(P: StagesPlan, solveFor: string, target: number): number {
  if (!P.g.acct || !P.B || solveFor !== "After-Tax Withdrawal") return P.g.taxRate;
  return targetRate(P.B, target, P.g.taxRate);
}

/** Everything the screen shows from the inputs: the projection, the
    portfolio the goal needs, the last stage's solve, and what fees cost. */
export function stagesCompute(s: StagesInputs, household: Household | null) {
  const P = stagesPlan(s, household);
  const R = projectSeries(P.g, P.eff);
  const target = parseNum(s.target);
  const rate = stagesTargetRate(P, s.solveFor, target);
  const portToday = s.solveFor === "After-Tax Withdrawal" ? target / (P.g.withdrawal * (1 - rate)) : target;
  const F = P.stages.length ? finalStageSolve(P.g, P.eff, portToday) : null;
  const feeCost = (P.g.fees || 0) > 0 ? projectSeries(P.g, effectiveStages({ ...P.g, fees: 0 }, P.stages)).fv - R.fv : 0;
  // The calculated rate stays in its (hidden) field after the split is
  // turned off, as it did on the old site.
  const saRate = P.B ? P.B.effRate : s.saTradBal !== "" ? stagesPlan({ ...s, saOn: true }, household).B!.effRate : null;
  return { P, R, F, portToday, rate, feeCost, saRate };
}
