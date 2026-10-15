/* The Budget tool's Paycheck tab: one paycheck from gross pay through the
   taxes and the budget to what's left, and where that goes. Kept apart from
   the screen so it can be tested and baselined.

   The facts (pay, schedule, filing status, state, health premiums through
   work, the 401(k) match, HSA coverage) are inputs; the decisions are the
   amounts on six lines, in an order the person sets. Pre-tax lines run
   through the Income Tax engine (computeTax with deductions by kind), so
   every change reruns the taxes. All amounts here are per paycheck. */
import { computeTax, yearData } from "@/lib/engine/typed";
import { parseNum } from "@/lib/format";
import { PRESET_DESCS, annualize, type BudgetInputs, type BudgetRow } from "./model";

/** The lines, in their default order. */
export const PC_STEPS = ["match", "hsa", "ef", "rothIra", "k401max", "brok"] as const;
export type PcStep = (typeof PC_STEPS)[number];
export type PcAmounts = Record<PcStep, number>;
export const PC_ZERO: PcAmounts = { match: 0, hsa: 0, ef: 0, rothIra: 0, k401max: 0, brok: 0 };

/** Each line's name, and whether it's pre-tax (always) or a 401(k) line
    (pre-tax unless switched to Roth). */
export const PC_LINES: Record<PcStep, { name: string; pre?: boolean; k401?: boolean }> = {
  match: { name: "401(k) up to the match", k401: true },
  hsa: { name: "HSA", pre: true },
  ef: { name: "Emergency fund" },
  rothIra: { name: "Roth IRA" },
  k401max: { name: "401(k) beyond the match", k401: true },
  brok: { name: "Taxable brokerage" },
};

const AMT_KEY: Record<PcStep, keyof BudgetInputs> = {
  match: "pcMatch", hsa: "pcHsa", ef: "pcEf", rothIra: "pcRothIra", k401max: "pcK401max", brok: "pcBrok",
};
export const pcAmountKey = (s: PcStep) => AMT_KEY[s] as "pcMatch";

/** The Budget rows the tab plans itself, left out of its spending: the
    saving rows (this tab is where the saving goes). College savings stays
    in: nothing here plans it. */
const PLANNED_HERE = ["Savings & investments", "Retirement contribution"];
const HEALTH_SLOT = PRESET_DESCS.indexOf("Health insurance");

/** How a Budget row comes across: counted, left out (this tab plans it), or
    moved (the health premiums field holds it). */
export function rowRole(b: BudgetInputs, r: BudgetRow, i: number): "count" | "save" | "work" {
  if (PLANNED_HERE.includes(r.desc)) return "save";
  if (healthThroughWork(b) && !r.custom && i === HEALTH_SLOT) return "work";
  return "count";
}

export interface PcInput {
  gross: number;
  /** Paychecks a year. */
  p: number;
  status: "s" | "m";
  state: string;
  /** Per check. */
  health: number;
  matchRate: number;
  matchUpTo: number;
  hsaFamily: boolean;
  efCap: number;
  roth: { match: boolean; k401max: boolean };
  /** The budget's spending a year, after what this tab plans or moves. */
  spendYear: number;
  order: PcStep[];
  amounts: PcAmounts;
}

/** Whether health premiums come out of the paycheck: unless they're set
    to 0, which keeps the Budget's Health insurance row as an expense. */
export const healthThroughWork = (b: BudgetInputs) => b.pcHealth.trim() === "" || parseNum(b.pcHealth) > 0;

/** The Budget's Health insurance row as a monthly figure (0 when blank). */
export function healthRowMonthly(b: BudgetInputs): number {
  const r = b.rows[HEALTH_SLOT];
  return r && !r.custom ? annualize(r) / 12 : 0;
}

/** The order as stored, with anything missing put back at the end. */
export function pcOrder(raw: string): PcStep[] {
  const seen = raw.split(",").filter((x): x is PcStep => (PC_STEPS as readonly string[]).includes(x));
  const uniq = seen.filter((x, i) => seen.indexOf(x) === i);
  return [...uniq, ...PC_STEPS.filter((x) => !uniq.includes(x))];
}

/** The tab's inputs as numbers. `taxState` is the Income Tax tool's state,
    used while the tab has none of its own. */
export function paycheckInput(b: BudgetInputs, taxState: string): PcInput {
  const p = [52, 26, 24, 12].includes(+b.pcFreq) ? +b.pcFreq : 26;
  const spendYear = b.rows.reduce((a, r, i) => a + (rowRole(b, r, i) === "count" ? annualize(r) : 0), 0);
  const health = b.pcHealth.trim() === "" ? (healthRowMonthly(b) * 12) / p : parseNum(b.pcHealth);
  const amounts = Object.fromEntries(PC_STEPS.map((s) => [s, Math.max(0, parseNum(b[pcAmountKey(s)]))])) as PcAmounts;
  return {
    gross: Math.max(0, parseNum(b.pcGross)), p, status: b.pcStatus === "m" ? "m" : "s", state: b.pcState || taxState,
    health: Math.max(0, health), matchRate: Math.max(0, parseNum(b.pcMatchRate)), matchUpTo: Math.max(0, parseNum(b.pcMatchUpTo)),
    hsaFamily: !!b.pcHsaFamily, efCap: Math.max(0, parseNum(b.pcEfCap)),
    roth: { match: !!b.pcMatchRoth, k401max: !!b.pcK401maxRoth }, spendYear, order: pcOrder(b.pcOrder), amounts,
  };
}

const limits = () => yearData().limits;

/** Where Fill stops a line, per check (Infinity for brokerage). The second
    401(k) line shares the yearly limit with the first. */
export function pcCap(pi: PcInput, s: PcStep, a: PcAmounts): number {
  const L = limits();
  switch (s) {
    case "match": return Math.min((pi.matchUpTo / 100) * pi.gross, L.k401.base) / pi.p;
    case "hsa": return (pi.hsaFamily ? L.hsa.family : L.hsa.self) / pi.p;
    case "ef": return pi.efCap;
    case "rothIra": return L.ira.base / pi.p;
    case "k401max": return Math.max(0, L.k401.base / pi.p - a.match);
    case "brok": return Infinity;
  }
}

/** Whether a line has a limit of its own to warn against (the emergency
    fund's is only where Fill stops). */
export const pcHasLimit = (s: PcStep) => s !== "ef" && s !== "brok";

export interface PcRun {
  check: number;
  /** Per check. */
  k401: number; roth401: number; hsa: number; health: number;
  fed: number; state: number; fica: number; taxes: number;
  deposit: number; spend: number; toAssign: number; ef: number; rothIra: number; brok: number;
  /** Unassigned: negative when more is assigned than the deposit covers. */
  left: number;
  saved: number;
  /** The employer's match, per check. */
  match: number;
  stateName: string;
  /** Pre-tax money the state keeps in its base, a year. */
  stateAddBack: number;
}

/** One paycheck, for a set of line amounts. */
export function paycheckRun(pi: PcInput, a: PcAmounts = pi.amounts): PcRun {
  const p = pi.p;
  let k401 = 0, roth401 = 0;
  (["match", "k401max"] as const).forEach((s) => { if (pi.roth[s]) roth401 += a[s]; else k401 += a[s]; });
  const R = computeTax({
    status: pi.status, gross: pi.gross, gross2: 0, pre: 0, dedType: "std", item: 0, state: pi.state,
    ded: [{ k401: k401 * p, ira: 0, hsa: a.hsa * p, health: pi.health * p, other: 0 }],
  }) as { federal: number; state: number; fica: number; stateName: string; preTax: { addBack: number } | null };
  const check = pi.gross / p;
  const fed = R.federal / p, state = R.state / p, fica = R.fica / p;
  const deposit = check - k401 - a.hsa - pi.health - fed - state - fica - roth401;
  const spend = pi.spendYear / p, toAssign = deposit - spend;
  const left = toAssign - a.ef - a.rothIra - a.brok;
  const match = (Math.min(k401 + roth401, (pi.matchUpTo / 100) * check) * pi.matchRate) / 100;
  return {
    check, k401, roth401, hsa: a.hsa, health: pi.health, fed, state, fica, taxes: fed + state + fica,
    deposit, spend, toAssign, ef: a.ef, rothIra: a.rothIra, brok: a.brok, left,
    saved: PC_STEPS.reduce((t, s) => t + a[s], 0), match, stateName: R.stateName, stateAddBack: R.preTax?.addBack ?? 0,
  };
}

/** The most of line `s` (up to `cap`) that leaves nothing negative, in whole
    cents: the cent above is taken when the check covers it to within half a
    cent, so no stray cent drops through to a lower line. */
function most(pi: PcInput, a: PcAmounts, s: PcStep, cap: number): number {
  const t = { ...a };
  t[s] = cap;
  if (paycheckRun(pi, t).left >= 0) return cap;
  t[s] = 0;
  if (paycheckRun(pi, t).left < 0) return 0;
  let lo = 0, hi = cap;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    t[s] = mid;
    if (paycheckRun(pi, t).left >= 0) lo = mid; else hi = mid;
  }
  const up = Math.min(cap, Math.ceil(lo * 100) / 100);
  t[s] = up;
  return paycheckRun(pi, t).left > -0.005 ? up : Math.floor(lo * 100) / 100;
}

/** Fill in order: each line, top to bottom, as much as it allows, rerunning
    the taxes as it goes. Brokerage takes what's left. */
export function paycheckFill(pi: PcInput): PcAmounts {
  const a = { ...PC_ZERO };
  for (const s of pi.order) {
    if (s === "brok") a.brok = Math.max(0, Math.floor(paycheckRun(pi, a).left * 100 + 0.5 - 1e-9) / 100);
    else a[s] = most(pi, a, s, pcCap(pi, s, a));
  }
  return a;
}

/** What a dollar on line `s` costs the deposit: under a dollar for
    pre-tax money, since part of it would have gone to tax. */
export function pcCostPer(pi: PcInput, s: PcStep): number {
  const a = pi.amounts, base = paycheckRun(pi, a).deposit;
  return (base - paycheckRun(pi, { ...a, [s]: a[s] + 100 }).deposit) / 100;
}

/** Whether line `s` is pre-tax as set (the HSA, or a traditional 401(k) line). */
export const pcPreTax = (pi: PcInput, s: PcStep) =>
  !!PC_LINES[s].pre || (!!PC_LINES[s].k401 && !pi.roth[s as "match" | "k401max"]);
