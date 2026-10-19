/* How the walkthrough's steps feed each other, apart from its screens so it
   can be tested. Each later step is filled in from the one before only
   when what it's built on changed (PlanState.from), so what's typed into a
   step stays put while the steps before it don't move.

   - Paycheck, from Taxes: the pay, filing status, state and schedule; the
     first time, also today's pre-tax saving as its 401(k), HSA and IRA
     lines and premiums.
   - Taxes, from Paycheck (leaving it): the pay and pre-tax money by kind,
     so Taxes shows the taxes on the paycheck as now planned.
   - Your plan (Advanced), from Paycheck: the saving by account type, the
     match, and the years from your ages; the first time, your spending as
     the target.
   - Life stages, from Advanced and the children (kids.ts). */
import type { ToolInputs } from "@/components/tools/ToolState";
import { dollarsField, groupDigits, parseNum } from "@/lib/format";
import type { Household } from "@/lib/household";
import { ADVANCED_DEFAULTS, advancedPlan, glideYearsFor, type AdvancedInputs } from "@/tools/advanced/model";
import { BUDGET_DEFAULTS, budgetCompute, type BudgetInputs } from "@/tools/budget/model";
import { paycheckInput, paycheckRun, type PcInput, type PcRun } from "@/tools/budget/paycheck-math";
import { intoAdvanced, paycheckCopy, taxFromPaycheck } from "@/tools/budget/to-calculator";
import { STAGES_DEFAULTS, type StagesInputs } from "@/tools/stages/model";
import { TAX_DEFAULTS, itemized, preBuckets, runTax, taxInput, type TaxInputs } from "@/tools/tax/model";
import { ONE_FOR_ONE, kidStages, paycheckFreed, stagesFromKids, type Freed } from "./kids";
import type { PlanState, PlanTool } from "./model";

const DEFAULTS = { tax: TAX_DEFAULTS, budget: BUDGET_DEFAULTS, advanced: ADVANCED_DEFAULTS, stages: STAGES_DEFAULTS } as const;
type Inputs = { tax: TaxInputs; budget: BudgetInputs; advanced: AdvancedInputs; stages: StagesInputs };

/** A tool's inputs in the plan, over its defaults. */
export function toolOf<K extends PlanTool>(p: PlanState, id: K): Inputs[K] {
  return { ...DEFAULTS[id], ...(p.tools[id] ?? {}) } as Inputs[K];
}
const withTool = <K extends PlanTool>(p: PlanState, id: K, v: Inputs[K]): PlanState => ({ ...p, tools: { ...p.tools, [id]: v as unknown as ToolInputs } });

/** Your age, retirement age and the years between, when both make sense. */
export function planAges(p: PlanState): { age: number; retire: number; years: number } | null {
  const age = Math.round(parseNum(p.age)), retire = Math.round(parseNum(p.retire));
  if (!(age >= 15 && age < 100 && retire > age && retire <= 100)) return null;
  return { age, retire, years: retire - age };
}

const money = (v: number) => groupDigits(String(Math.round(v * 100) / 100), true);

/* ---- Taxes → Paycheck ---- */
const taxFacts = (t: TaxInputs, freq: string) => JSON.stringify([t.gross, t.status === "m" ? t.gross2 : "", t.status, t.state, freq]);

/** The Paycheck tab filled in from Taxes, when Taxes changed since. */
export function seedPaycheck(p: PlanState): PlanState {
  const tax = toolOf(p, "tax"), b = toolOf(p, "budget"), fp = taxFacts(tax, p.freq);
  const first = !p.from.paycheck;
  if (!first && p.from.paycheck === fp) return p;
  const gross = parseNum(tax.gross), gross2 = tax.status === "m" ? parseNum(tax.gross2) : 0, two = gross2 > 0;
  let next: BudgetInputs = {
    ...b, pcGross: dollarsField(gross), pcGross2: two ? dollarsField(gross2) : "", pcStatus: tax.status !== "m" ? "s" : two ? "m2" : "m",
    pcState: tax.state, pcFreq: p.freq, pcFreq2: p.freq,
    // Two incomes start with an HSA each, as switching to them does.
    ...(two && b.pcStatus !== "m2" ? { pcHsaFamily: false, pcHsaBoth: true } : {}),
  };
  if (first) {
    // Today's pre-tax saving as the starting lines: a year of each kind,
    // per check (or per month with two incomes). The 401(k) fills the
    // match line first, up to the match, and the rest goes beyond it.
    const pays = +p.freq || 26, per = two ? 12 : pays;
    const [y, s] = itemized(tax) ? preBuckets(tax) : [{ k401: parseNum(tax.pre) }, {}];
    const both = (k: string) => ((y[k] || 0) + (two ? s[k] || 0 : 0)) / per;
    const k401 = both("k401"), cap = ((parseNum(b.pcMatchUpTo) / 100) * gross + (two ? (parseNum(b.pcMatchUpTo2) / 100) * gross2 : 0)) / per;
    const match = Math.min(k401, cap), ira = both("ira");
    next = {
      ...next, pcMatch: money(match), pcK401max: money(k401 - match), pcHsa: money(both("hsa")), pcRothIra: money(ira),
      ...(ira > 0 ? { pcIraRoth: false } : {}),
      // Premiums per check, on each one's own schedule.
      ...((y.health || 0) > 0 ? { pcHealth: money((y.health || 0) / pays) } : {}),
      ...(two && (s.health || 0) > 0 ? { pcHealth2: money((s.health || 0) / pays) } : {}),
    };
  }
  return { ...withTool(p, "budget", next), from: { ...p.from, paycheck: fp } };
}

/** The paycheck as planned, once there's pay on it. */
export function paycheckOf(p: PlanState): { pi: PcInput; r: PcRun } | null {
  const b = toolOf(p, "budget");
  if (!(parseNum(b.pcGross) > 0)) return null;
  const pi = paycheckInput(b, toolOf(p, "tax").state);
  return { pi, r: paycheckRun(pi) };
}

/* ---- Paycheck → Taxes ---- */
/** Taxes as the paycheck now has them (leaving the Paycheck step). */
export function taxesFromPaycheck(p: PlanState): PlanState {
  const pc = paycheckOf(p);
  if (!pc) return p;
  const tax = taxFromPaycheck(toolOf(p, "tax"), pc.pi, pc.r);
  return { ...withTool(p, "tax", tax), from: { ...p.from, paycheck: taxFacts(tax, p.freq) } };
}

/* ---- Paycheck → Your plan ---- */
/** Advanced filled in from the paycheck, when the paycheck changed since. */
export function seedAdvanced(p: PlanState, household: Household | null): PlanState {
  const pc = paycheckOf(p);
  if (!pc) return p;
  // Taxes in retirement are figured on your filing status and state as
  // you gave them (Taxes, then the paycheck), never the household profile's.
  const c = paycheckCopy(pc.pi), ages = planAges(p), fact = { status: pc.pi.status, state: pc.pi.state };
  const fp = JSON.stringify([c, ages?.years ?? null, fact]);
  const first = !p.tools.advanced;
  if (!first && p.from.advanced === fp) return p;
  let adv = toolOf(p, "advanced");
  // The first time: balances from the household's savings (all as
  // traditional, as Advanced's own switch starts), else nothing yet.
  if (first) adv = { ...adv, initial: dollarsField(household?.saved ?? 0) };
  adv = { ...intoAdvanced(adv, c, fact), acStatus: fact.status, acState: fact.state };
  if (ages) adv = { ...adv, years: String(ages.years), ...(adv.glideOn ? { glideYears: glideYearsFor(String(ages.years), adv.glideYears) } : {}) };
  if (first) {
    const spend = budgetCompute(toolOf(p, "budget")).spentYr;
    if (spend > 0) adv = { ...adv, solveFor: "After-Tax Withdrawal", target: dollarsField(Math.round(spend)) };
  }
  return { ...withTool(p, "advanced", adv), from: { ...p.from, advanced: fp } };
}

/** What each cut frees after tax, on the paycheck as planned. */
export function freedOf(p: PlanState): Freed {
  const pc = paycheckOf(p);
  return pc ? paycheckFreed(pc.pi) : ONE_FOR_ONE;
}

/* ---- Your plan + children → Life stages ---- */
/** The stages from Advanced and the children, when either changed since. */
export function seedStages(p: PlanState, household: Household | null): PlanState {
  const ages = planAges(p);
  if (!p.stagesOn || !ages || !p.tools.advanced) return p;
  const adv = toolOf(p, "advanced"), years = Math.max(1, Math.round(parseNum(adv.years)));
  const fp = JSON.stringify([adv, p.kids, p.cover, ages.age, p.tools.budget ?? null, p.tools.tax?.state ?? null]);
  if (p.tools.stages && p.from.stages === fp) return p;
  const segs = kidStages(p.kids, ages.age, ages.age + years);
  const stages = stagesFromKids(advancedPlan(adv, household), adv, toolOf(p, "stages"), segs, p.cover, freedOf(p));
  return { ...withTool(p, "stages", stages), from: { ...p.from, stages: fp } };
}

/* ---- the running figures under the step rail ---- */
export interface Strip {
  /** "check" or "month" (two incomes plan by the month). */
  per: "check" | "month";
  /** Periods a year. */
  p: number;
  gross: number; taxes: number; takeHome: number; spend: number; saved: number; left: number;
  /** Whether the saving and what's left are planned yet (the Paycheck step).
      Spending is what the deposit pays for (premiums through work come out
      before it). */
  planned: boolean;
}

/** Each figure per period: from the paycheck once it's planned, before
    that from Taxes and the Budget. */
export function strip(p: PlanState): Strip | null {
  const pc = paycheckOf(p);
  if (pc) {
    const { pi, r } = pc;
    // Take-home is what lands in the bank, as on the Paycheck tab.
    return { per: pi.two ? "month" : "check", p: pi.p, gross: r.check, taxes: r.taxes, takeHome: r.deposit, spend: r.spend, saved: r.saved, left: r.left, planned: true };
  }
  const tax = toolOf(p, "tax");
  if (!(parseNum(tax.gross) > 0)) return null;
  const R = runTax(taxInput(tax)), n = +p.freq || 26, spend = budgetCompute(toolOf(p, "budget")).spentYr / n;
  const takeHome = (R.gross - R.total - R.pre) / n;
  return { per: "check", p: n, gross: R.gross / n, taxes: R.total / n, takeHome, spend, saved: R.pre / n, left: takeHome - spend, planned: false };
}
