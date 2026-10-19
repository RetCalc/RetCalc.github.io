/* The walkthrough's results, for the Summary screen and the report: the
   paycheck from gross pay down to each account, the spending by group, and
   the plan at retirement with its balance by age, account by account.
   Every figure comes from the tools' own code (paycheckRun, budgetGroups,
   advancedCompute, stagesCompute); the balance by account is the same run
   once per account, as Stages does for its split. No React. */
import { projectSeries } from "@/lib/engine/typed";
import type { Series, Stage } from "@/lib/engine/types";
import { parseNum } from "@/lib/format";
import type { Household } from "@/lib/household";
import { advancedCompute, advancedPlan } from "@/tools/advanced/model";
import { annualize, budgetCompute } from "@/tools/budget/model";
import { PC_LINES, PC_STEPS, rowRole, type PcStep } from "@/tools/budget/paycheck-math";
import { CHILD_SOURCE } from "@/tools/guide/schedule";
import { stageSplit, stagesCompute } from "@/tools/stages/model";
import { paycheckOf, planAges, toolOf } from "./flow";
import { coverStage, kidCostAt, kidList, kidStages, monthlyByAccount, stageKey, type KidStage, type Monthly } from "./kids";
import type { PlanState } from "./model";

export type Acct = "trad" | "roth" | "brok" | "hsa";
export const ACCT_NAMES: Record<Acct, string> = { trad: "Traditional", roth: "Roth", brok: "Brokerage", hsa: "HSA" };

export interface ClimbRow { age: number; year: number; trad: number; roth: number; brok: number; hsa: number; total: number }

export interface PlanSummary {
  age: number; retire: number; years: number;
  /** "check" or "month", and how many a year. */
  per: "check" | "month"; p: number;
  pay: {
    gross: number; fed: number; state: number; fica: number; taxes: number;
    /** Health premiums through work, and the pre-tax saving (401(k), HSA). */
    health: number; preSave: number;
    takeHome: number; spend: number; saved: number; left: number; match: number;
    stateName: string;
  };
  /** Each account line on the paycheck with money on it, per period. */
  lines: { id: PcStep; name: string; v: number; roth: boolean }[];
  /** Into each account a period (the match into traditional), and the
      emergency fund (cash, kept out of the plan). */
  inflow: Record<Acct, number> & { match: number; ef: number };
  spendYear: number;
  /** The spending the paycheck covers, by group, a year (premiums through
      work come out of pay before it, so they're not here). */
  groups: { group: string; yr: number }[];
  /** At retirement, today's dollars. */
  atRetire: { total: number; fv: number; byAcct: Record<Acct, number> | null; afterTax: number; withdrawal: number; taxRate: number };
  target: { solveFor: string; target: number };
  climb: ClimbRow[];
  milestones: { label: string; age: number }[];
  /** Each stage: its saving a month (today's dollars), the children's cost
      then and its change from today, and what each account gives for it. */
  stages: { name: string; from: number; to: number; monthly: number; kidCost: number; change: number; take: Monthly | null; short: number }[] | null;
  /** Today's saving a month, by account, that the stages cut from. */
  todayMonthly: Monthly;
  /** Every budget line with money on it, a year, by group in the Budget's order. */
  budgetLines: { group: string; desc: string; yr: number; freq: number }[];
  ef: { months: number; target: number };
  facts: { status: string; stateName: string; taxYear: string; freqName: string; twoIncomes: boolean };
  kids: { born: number; planned: boolean }[];
  kidSource: string;
  assumptions: { nominal: number; inflation: number; fees: number; growth: number; withdrawal: number; vol: number };
}

const real = (v: number, infl: number, year: number) => v / Math.pow(1 + infl, year);

/** The end of each year of a series run. */
const yearEnds = (S: Series) => {
  const out: number[] = [];
  for (const r of S.calRows) out[r.year - 1] = r.end;
  return out;
};

export function planSummary(p: PlanState, household: Household | null): PlanSummary | null {
  const pc = paycheckOf(p), ages = planAges(p);
  if (!pc || !ages || !p.tools.advanced) return null;
  const { pi, r } = pc, per = pi.two ? "month" : "check";
  const b = toolOf(p, "budget"), adv = toolOf(p, "advanced");
  const useStages = p.stagesOn && !!p.tools.stages;
  const lines = PC_STEPS.filter((s) => s !== "ef" || pi.efOn).map((id) => ({
    id, name: PC_LINES[id].name, v: pi.amounts[id],
    roth: (id === "match" && pi.roth.match) || (id === "k401max" && pi.roth.k401max) || (id === "rothIra" && pi.roth.rothIra),
  })).filter((l) => l.v > 0.004);

  // The plan: Stages when the walkthrough went on there, else Advanced.
  let climb: ClimbRow[] = [], fv = 0, total = 0, afterTax = 0, byAcct: Record<Acct, number> | null = null;
  let infl = 0, years = 0, taxRate = 0, withdrawal = 0;
  let assumptions: PlanSummary["assumptions"];
  let stages: PlanSummary["stages"] = null;
  if (useStages) {
    const st = toolOf(p, "stages"), V = stagesCompute(st, household), P = V.P, g = P.g;
    infl = g.inflation; years = V.R.totalYears; fv = V.R.fv; total = V.R.fvReal; afterTax = V.R.afterTax; taxRate = g.taxRate; withdrawal = g.withdrawal;
    if (P.B) byAcct = { trad: P.B.real.trad, roth: P.B.real.roth, brok: P.B.real.brok, hsa: P.B.real.hsa };
    // Each account's slice of every stage, as stagesPlan runs it.
    const a = g.acct;
    const run = (bal: number, share: (i: number) => number) =>
      yearEnds(projectSeries({ ...g, initial: bal }, P.eff.map((e, i) => ({ ...e, contrib: e.contrib * share(i) }) as Stage)));
    const mf = (i: number) => P.eff[i].mf || 1;
    const slices: Record<Acct, number[]> = a ? {
      trad: run(a.tradBal, (i) => (stageSplit(P.stages[i]).t + mf(i) - 1) / mf(i)),
      roth: run(a.rothBal, (i) => stageSplit(P.stages[i]).r / mf(i)),
      brok: run(a.brokBal, (i) => stageSplit(P.stages[i]).b / mf(i)),
      hsa: run(a.hsaBal, (i) => stageSplit(P.stages[i]).h / mf(i)),
    } : { trad: [], roth: [], brok: run(g.initial, () => 1), hsa: [] };
    climb = sliceRows(slices, a ? { trad: a.tradBal, roth: a.rothBal, brok: a.brokBal, hsa: a.hsaBal } : { trad: 0, roth: 0, brok: g.initial, hsa: 0 }, years, ages.age, infl);
    let at = ages.age;
    stages = P.stages.map((s, i) => {
      const from = at, to = at + s.years;
      at = to;
      const mine = P.eff[i].mine, perYr = { Weekly: 52, "Bi-Weekly": 26, Monthly: 12, Quarterly: 4, Annually: 1 }[s.period] ?? 12;
      const kids = p.kids ? kidList(p.kids, ages.age) : [];
      return { name: s.name || "Stage " + (i + 1), from, to, monthly: real((mine * perYr) / 12, i > 0 && s.adj ? infl : 0, from - ages.age),
        kidCost: Math.round(kidCostAt(kids, from)), change: 0, take: null as Monthly | null, short: 0 };
    });
    // The children's stages, as built: their cost and how each was covered.
    const ks = kidStages(p.kids, ages.age, ages.age + years), AP = advancedPlan(adv, household), today = monthlyByAccount(AP, AP.p.period);
    if (ks.length === stages.length) stages = stages.map((s, i) => {
      const c = coverStage(ks[i].change, today, p.cover[stageKey(ks[i])]);
      return { ...s, kidCost: ks[i].cost, change: ks[i].change, take: ks[i].change !== 0 ? c.take : null, short: c.short };
    });
    const s0 = P.stages[0];
    assumptions = { nominal: s0 ? s0.nominal : 0, inflation: g.inflation, fees: g.fees, growth: s0 ? s0.growth : 0, withdrawal: g.withdrawal, vol: s0?.vol ?? 0 };
  } else {
    const V = advancedCompute(adv, household), P = V.P, pl = P.p;
    infl = pl.inflation; years = pl.years; fv = V.R.fv; total = V.R.fvReal; afterTax = V.R.afterTax; taxRate = pl.taxRate; withdrawal = pl.withdrawal;
    if (P.B) byAcct = { trad: P.B.real.trad, roth: P.B.real.roth, brok: P.B.real.brok, hsa: P.B.real.hsa };
    const one = (bal: number, c: number) => yearEnds(projectSeries({ initial: bal, inflation: pl.inflation, withdrawal: pl.withdrawal, taxRate: pl.taxRate, fees: 0 },
      [{ years: pl.years, contrib: c, period: pl.period, growth: pl.growth, nominal: pl.nominal, vol: pl.vol, glide: pl.glide }]));
    const a = P.a, m = P.B?.match ?? 0;
    const slices: Record<Acct, number[]> = a
      ? { trad: one(a.tradBal, a.tradC + m), roth: one(a.rothBal, a.rothC), brok: one(a.brokBal, a.brokC), hsa: one(a.hsaBal, a.hsaC) }
      : { trad: [], roth: [], brok: one(pl.initial, pl.contrib), hsa: [] };
    climb = sliceRows(slices, a ? { trad: a.tradBal, roth: a.rothBal, brok: a.brokBal, hsa: a.hsaBal } : { trad: 0, roth: 0, brok: pl.initial, hsa: 0 }, years, ages.age, infl);
    assumptions = { nominal: pl.gross, inflation: pl.inflation, fees: pl.fees, growth: pl.growth, withdrawal: pl.withdrawal, vol: pl.vol };
  }
  const retireAge = ages.age + Math.round(years);
  const milestones: PlanSummary["milestones"] = [];
  for (const [v, label] of [[100e3, "$100K"], [250e3, "$250K"], [500e3, "$500K"], [1e6, "$1M"], [2e6, "$2M"]] as const) {
    const hit = climb.find((c) => c.total >= v);
    if (hit) milestones.push({ label, age: hit.age });
  }
  const kids = p.kids ? kidList(p.kids, ages.age).map((c) => ({ born: c.born, planned: c.planned })) : [];
  const g: Record<string, number> = {};
  for (const row of b.rows) if (rowRole(b, row) === "count" && annualize(row) > 0) g[row.group || "Custom"] = (g[row.group || "Custom"] || 0) + annualize(row);
  const groups = Object.entries(g).map(([group, yr]) => ({ group, yr })).sort((x, y) => y.yr - x.yr);
  const A = pi.amounts, R = pi.roth;
  const AP0 = advancedPlan(adv, household), todayMonthly = monthlyByAccount(AP0, AP0.p.period);
  const bc = budgetCompute(b), tax = toolOf(p, "tax");
  const budgetLines = b.rows.filter((row) => rowRole(b, row) !== "save" && annualize(row) > 0).map((row) => ({ group: row.group || "Custom", desc: row.desc, yr: annualize(row), freq: row.freq }));
  const FREQ: Record<number, string> = { 52: "Every week", 26: "Every two weeks", 24: "Twice a month", 12: "Monthly" };
  const inflow = {
    trad: (R.match ? 0 : A.match) + (R.k401max ? 0 : A.k401max) + (R.rothIra ? 0 : A.rothIra) + r.match,
    roth: (R.match ? A.match : 0) + (R.k401max ? A.k401max : 0) + (R.rothIra ? A.rothIra : 0),
    brok: A.brok, hsa: A.hsa, match: r.match, ef: pi.efOn ? A.ef : 0,
  };
  return {
    age: ages.age, retire: retireAge, years, per, p: pi.p, inflow,
    pay: {
      gross: r.check, fed: r.fed, state: r.state, fica: r.fica, taxes: r.taxes, health: r.health, preSave: r.k401 + r.hsa,
      takeHome: r.deposit, spend: r.spend, saved: r.saved, left: r.left, match: r.match, stateName: r.stateName,
    },
    lines, spendYear: bc.spentYr, groups, todayMonthly, budgetLines, ef: { months: bc.ef, target: bc.efTarget },
    facts: { status: pi.two ? "Married, two incomes" : pi.status === "m" ? "Married, filing jointly" : "Single", stateName: r.stateName, taxYear: tax.year,
      freqName: FREQ[pi.pays[0]] ?? "Every two weeks", twoIncomes: pi.two },
    atRetire: { total, fv, byAcct, afterTax, withdrawal, taxRate },
    target: { solveFor: adv.solveFor, target: parseNum(adv.target) },
    climb, milestones, stages, kids, kidSource: CHILD_SOURCE, assumptions,
  };
}

/** Each year's balance by account, in today's dollars, from age `age`. */
function sliceRows(s: Record<Acct, number[]>, start: Record<Acct, number>, years: number, age: number, infl: number): ClimbRow[] {
  const n = Math.ceil(years), rows: ClimbRow[] = [];
  const at = (k: Acct, y: number) => real(s[k][y - 1] ?? 0, infl, y);
  // Today: the balances as they stand.
  rows.push({ age, year: 0, ...start, total: start.trad + start.roth + start.brok + start.hsa });
  for (let y = 1; y <= n; y++) {
    const row = { age: age + y, year: y, trad: at("trad", y), roth: at("roth", y), brok: at("brok", y), hsa: at("hsa", y), total: 0 };
    row.total = row.trad + row.roth + row.brok + row.hsa;
    rows.push(row);
  }
  return rows;
}

export type { KidStage };
