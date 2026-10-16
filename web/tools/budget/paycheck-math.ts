/* The Budget tool's Paycheck tab: from gross pay through the taxes and the
   budget to what's left, and where that goes. Kept apart from the screen so
   it can be tested and baselined.

   The facts (pay, schedule, filing status, state, health premiums through
   work, the 401(k) match, HSA coverage) are inputs; the decisions are the
   amounts on the lines, in an order the person sets. Pre-tax lines run
   through the Income Tax engine (computeTax with deductions by kind, per
   earner), so every change reruns the taxes.

   Single and "Married, one income" plan one paycheck: every amount here is
   per check. "Married, two incomes" plans the household by the month (two
   paychecks can come on different schedules): every amount is per month,
   the taxes are figured jointly, and each person has their own 401(k),
   HSA and Roth IRA lines (the "…2" lines), with the emergency fund and
   brokerage shared. */
import { computeTax, yearData } from "@/lib/engine/typed";
import { parseNum } from "@/lib/format";
import { PRESET_DESCS, annualize, isPlannedRow, type BudgetInputs, type BudgetRow } from "./model";

/** Every line, in the default order. The spouse's ("…2") lines show only
    with two incomes, each right after its counterpart. */
export const PC_STEPS = ["match", "match2", "hsa", "hsa2", "ef", "rothIra", "rothIra2", "k401max", "k401max2", "brok"] as const;
export type PcStep = (typeof PC_STEPS)[number];
export type PcAmounts = Record<PcStep, number>;
export const PC_ZERO = Object.fromEntries(PC_STEPS.map((s) => [s, 0])) as PcAmounts;
type K401Step = "match" | "match2" | "k401max" | "k401max2";

/** Each line's name, whose it is (1 you, 2 your spouse; none: shared), and
    whether it's pre-tax (always) or a 401(k) line (pre-tax unless Roth). */
export const PC_LINES: Record<PcStep, { name: string; who?: 1 | 2; pre?: boolean; k401?: boolean }> = {
  match: { name: "401(k) up to the match", who: 1, k401: true },
  match2: { name: "401(k) up to the match", who: 2, k401: true },
  hsa: { name: "HSA", who: 1, pre: true },
  hsa2: { name: "HSA", who: 2, pre: true },
  ef: { name: "Emergency fund" },
  rothIra: { name: "Roth IRA", who: 1 },
  rothIra2: { name: "Roth IRA", who: 2 },
  k401max: { name: "401(k) beyond the match", who: 1, k401: true },
  k401max2: { name: "401(k) beyond the match", who: 2, k401: true },
  brok: { name: "Taxable brokerage" },
};
/** A line's name as shown: "Your …" and "Spouse's …" with two incomes. */
export const pcLineName = (s: PcStep, two: boolean) =>
  !two || !PC_LINES[s].who ? PC_LINES[s].name : (PC_LINES[s].who === 1 ? "Your " : "Spouse's ") + PC_LINES[s].name;

const AMT_KEY: Record<PcStep, keyof BudgetInputs> = {
  match: "pcMatch", match2: "pcMatch2", hsa: "pcHsa", hsa2: "pcHsa2", ef: "pcEf", rothIra: "pcRothIra", rothIra2: "pcRothIra2",
  k401max: "pcK401max", k401max2: "pcK401max2", brok: "pcBrok",
};
export const pcAmountKey = (s: PcStep) => AMT_KEY[s] as "pcMatch";
const ROTH_KEY: Record<K401Step, keyof BudgetInputs> = { match: "pcMatchRoth", match2: "pcMatch2Roth", k401max: "pcK401maxRoth", k401max2: "pcK401max2Roth" };
export const pcRothKey = (s: PcStep) => ROTH_KEY[s as K401Step] as "pcMatchRoth";

const HEALTH_SLOT = PRESET_DESCS.indexOf("Health insurance");

/** How a Budget row comes across: counted, left out (this tab plans it), or
    moved (the health premiums field holds it). */
export function rowRole(b: BudgetInputs, r: BudgetRow, i: number): "count" | "save" | "work" {
  if (isPlannedRow(r)) return "save";
  if (healthThroughWork(b) && !r.custom && i === HEALTH_SLOT) return "work";
  return "count";
}

export interface PcInput {
  /** Each person's gross pay, a year (the spouse's 0 unless two incomes). */
  gross: number;
  gross2: number;
  /** Married, two incomes: planned by the month. */
  two: boolean;
  /** Periods a year: paychecks, or 12 with two incomes. */
  p: number;
  status: "s" | "m";
  state: string;
  /** Health premiums through work, per period, and whose pay they come out of. */
  health: number;
  healthFrom: 1 | 2;
  match: { rate: number; upTo: number }[];
  hsaFamily: boolean;
  efCap: number;
  roth: Record<K401Step, boolean>;
  /** The budget's spending a year, after what this tab plans or moves. */
  spendYear: number;
  /** The lines shown, in order. */
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

/** The order as stored, put right: anything missing goes back in, a
    spouse's line right after its counterpart (so an order saved before two
    incomes keeps its shape), the rest at the end. */
export function pcOrder(raw: string): PcStep[] {
  const seen = raw.split(",").filter((x): x is PcStep => (PC_STEPS as readonly string[]).includes(x));
  const o = seen.filter((x, i) => seen.indexOf(x) === i);
  for (const s of PC_STEPS) {
    if (o.includes(s)) continue;
    const twin = s.endsWith("2") ? (s.slice(0, -1) as PcStep) : null;
    const at = twin ? o.indexOf(twin) : -1;
    if (at >= 0) o.splice(at + 1, 0, s); else o.push(s);
  }
  return o;
}

/** The tab's inputs as numbers. `taxState` is the Income Tax tool's state,
    used while the tab has none of its own. */
export function paycheckInput(b: BudgetInputs, taxState: string): PcInput {
  const two = b.pcStatus === "m2";
  const p = two ? 12 : [52, 26, 24, 12].includes(+b.pcFreq) ? +b.pcFreq : 26;
  const spendYear = b.rows.reduce((a, r, i) => a + (rowRole(b, r, i) === "count" ? annualize(r) : 0), 0);
  const health = b.pcHealth.trim() === "" ? (healthRowMonthly(b) * 12) / p : parseNum(b.pcHealth);
  const order = pcOrder(b.pcOrder).filter((s) => two || !PC_LINES[s].who || PC_LINES[s].who === 1);
  const amounts = Object.fromEntries(PC_STEPS.map((s) => [s, order.includes(s) ? Math.max(0, parseNum(b[pcAmountKey(s)])) : 0])) as PcAmounts;
  const n = (v: string) => Math.max(0, parseNum(v));
  return {
    gross: n(b.pcGross), gross2: two ? n(b.pcGross2) : 0, two, p, status: b.pcStatus === "s" ? "s" : "m", state: b.pcState || taxState,
    health: Math.max(0, health), healthFrom: two && b.pcHealthFrom === "2" ? 2 : 1,
    match: [{ rate: n(b.pcMatchRate), upTo: n(b.pcMatchUpTo) }, { rate: n(b.pcMatchRate2), upTo: n(b.pcMatchUpTo2) }],
    hsaFamily: !!b.pcHsaFamily, efCap: n(b.pcEfCap),
    roth: { match: !!b.pcMatchRoth, match2: !!b.pcMatch2Roth, k401max: !!b.pcK401maxRoth, k401max2: !!b.pcK401max2Roth },
    spendYear, order, amounts,
  };
}

const limits = () => yearData().limits;

/** Where Fill stops a line, per period (Infinity for brokerage). Each
    person's second 401(k) line shares the yearly limit with their first;
    on family coverage the two HSA lines share one family limit. */
export function pcCap(pi: PcInput, s: PcStep, a: PcAmounts): number {
  const L = limits(), p = pi.p;
  switch (s) {
    case "match": return Math.min((pi.match[0].upTo / 100) * pi.gross, L.k401.base) / p;
    case "match2": return Math.min((pi.match[1].upTo / 100) * pi.gross2, L.k401.base) / p;
    case "k401max": return Math.max(0, L.k401.base / p - a.match);
    case "k401max2": return Math.max(0, L.k401.base / p - a.match2);
    case "hsa": return pi.hsaFamily ? Math.max(0, L.hsa.family / p - a.hsa2) : L.hsa.self / p;
    case "hsa2": return pi.hsaFamily ? Math.max(0, L.hsa.family / p - a.hsa) : L.hsa.self / p;
    case "rothIra": case "rothIra2": return L.ira.base / p;
    case "ef": return pi.efCap;
    case "brok": return Infinity;
  }
}

/** Whether a line has a limit of its own to warn against (the emergency
    fund's is only where Fill stops). */
export const pcHasLimit = (s: PcStep) => s !== "ef" && s !== "brok";

export interface PcRun {
  /** Gross pay a period: both together, and each person's. */
  check: number;
  gross1: number; gross2: number;
  /** Per period: traditional and Roth 401(k), and HSA, each person's
      ([you, spouse]) and together. */
  k401s: number[]; roth401s: number[]; hsas: number[];
  k401: number; roth401: number; hsa: number; health: number;
  fed: number; state: number; fica: number; taxes: number;
  deposit: number; spend: number; toAssign: number; ef: number; rothIra: number; rothIra2: number; brok: number;
  /** Unassigned: negative when more is assigned than the deposit covers. */
  left: number;
  saved: number;
  /** The employers' match, per period. */
  match: number;
  stateName: string;
  /** Pre-tax money the state keeps in its base, a year. */
  stateAddBack: number;
}

/** One period (a paycheck, or with two incomes a month), for a set of line amounts. */
export function paycheckRun(pi: PcInput, a: PcAmounts = pi.amounts): PcRun {
  const p = pi.p;
  const k401s = [0, 0], roth401s = [0, 0];
  (["match", "k401max", "match2", "k401max2"] as const).forEach((s) => {
    const i = PC_LINES[s].who === 2 ? 1 : 0;
    if (pi.roth[s]) roth401s[i] += a[s]; else k401s[i] += a[s];
  });
  const hsas = [a.hsa, a.hsa2];
  const health = [pi.healthFrom === 1 ? pi.health : 0, pi.healthFrom === 2 ? pi.health : 0];
  const R = computeTax({
    status: pi.status, gross: pi.gross, gross2: pi.gross2, pre: 0, dedType: "std", item: 0, state: pi.state,
    ded: [0, 1].map((i) => ({ k401: k401s[i] * p, ira: 0, hsa: hsas[i] * p, health: health[i] * p, other: 0 })),
  }) as { federal: number; state: number; fica: number; stateName: string; preTax: { addBack: number } | null };
  const gross1 = pi.gross / p, gross2 = pi.gross2 / p, check = gross1 + gross2;
  const sum = (x: number[]) => x[0] + x[1];
  const k401 = sum(k401s), roth401 = sum(roth401s), hsa = sum(hsas);
  const fed = R.federal / p, state = R.state / p, fica = R.fica / p;
  const deposit = check - k401 - hsa - pi.health - fed - state - fica - roth401;
  const spend = pi.spendYear / p, toAssign = deposit - spend;
  const left = toAssign - a.ef - a.rothIra - a.rothIra2 - a.brok;
  const matchOf = (i: number, g: number) => (Math.min(k401s[i] + roth401s[i], (pi.match[i].upTo / 100) * g) * pi.match[i].rate) / 100;
  return {
    check, gross1, gross2, k401s, roth401s, hsas, k401, roth401, hsa, health: pi.health, fed, state, fica, taxes: fed + state + fica,
    deposit, spend, toAssign, ef: a.ef, rothIra: a.rothIra, rothIra2: a.rothIra2, brok: a.brok, left,
    saved: PC_STEPS.reduce((t, s) => t + a[s], 0), match: matchOf(0, gross1) + (pi.two ? matchOf(1, gross2) : 0),
    stateName: R.stateName, stateAddBack: R.preTax?.addBack ?? 0,
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

/** Fill in order: each line shown, top to bottom, as much as it allows,
    rerunning the taxes as it goes. Brokerage takes what's left. */
export function paycheckFill(pi: PcInput): PcAmounts {
  const a = { ...PC_ZERO };
  for (const s of pi.order) if (s !== "brok") a[s] = most(pi, a, s, pcCap(pi, s, a));
  // Every line in whole cents, as it's kept; then brokerage takes what's
  // left of those, rounded down, so the rounding never runs short.
  for (const s of pi.order) if (s !== "brok") a[s] = Math.min(Math.round(a[s] * 100), Math.floor(pcCap(pi, s, a) * 100 + 1e-6)) / 100;
  // Rounding up can leave it a fraction of a cent short: the last line
  // filled gives back a cent at a time until it isn't.
  const last = [...pi.order].reverse().find((s) => s !== "brok" && a[s] > 0);
  for (let i = 0; last && i < 20 && paycheckRun(pi, a).left < 0; i++) a[last] = Math.max(0, Math.round(a[last] * 100 - 1) / 100);
  // A line the money ran out on takes what cents are left, as far as they go;
  // brokerage gets money only once every line above it is full.
  const full = (s: PcStep) => a[s] >= Math.floor(pcCap(pi, s, a) * 100 + 1e-6) / 100 - 1e-9;
  const partial = pi.order.find((s) => s !== "brok" && !full(s));
  if (partial) {
    for (let i = 0; i < 100 && !full(partial); i++) {
      a[partial] = Math.round(a[partial] * 100 + 1) / 100;
      if (paycheckRun(pi, a).left < 0) { a[partial] = Math.round(a[partial] * 100 - 1) / 100; break; }
    }
  } else if (pi.order.includes("brok")) a.brok = Math.max(0, Math.floor(paycheckRun(pi, a).left * 100 + 1e-6) / 100);
  return a;
}

/** What a dollar on line `s` costs the deposit: under a dollar for
    pre-tax money, since part of it would have gone to tax. */
export function pcCostPer(pi: PcInput, s: PcStep): number {
  const a = pi.amounts, base = paycheckRun(pi, a).deposit;
  return (base - paycheckRun(pi, { ...a, [s]: a[s] + 100 }).deposit) / 100;
}

/** Whether line `s` is pre-tax as set (an HSA, or a traditional 401(k) line). */
export const pcPreTax = (pi: PcInput, s: PcStep) =>
  !!PC_LINES[s].pre || (!!PC_LINES[s].k401 && !pi.roth[s as K401Step]);

/** A month of the Paycheck tab as it's set, for tools that read it (Debt
    Payoff's extra payment, the Guide): what's deposited and what's still
    unassigned. Null until it has a gross pay. */
export function paycheckMonthly(b: BudgetInputs, taxState: string): { deposit: number; left: number } | null {
  const pi = paycheckInput(b, taxState);
  if (!(pi.gross + pi.gross2 > 0)) return null;
  const r = paycheckRun(pi);
  return { deposit: (r.deposit * pi.p) / 12, left: (r.left * pi.p) / 12 };
}
