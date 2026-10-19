/* The Budget tool's Paycheck tab: from gross pay through the taxes and the
   budget to what's left, and where that goes. Kept apart from the screen so
   it can be tested and baselined.

   The facts (pay, schedule, filing status, state, health premiums through
   work, the 401(k) match, HSA coverage) are inputs; the decisions are the
   amounts on six lines, in an order the person sets. Pre-tax lines run
   through the Income Tax engine (computeTax with deductions by kind, per
   earner), so every change reruns the taxes.

   Single and "Married, one income" plan one paycheck: every amount here is
   per check. "Married, two incomes" plans the household by the month (two
   paychecks can come on different schedules): every amount is per month,
   the taxes are figured jointly, and each line is the household's, split
   between the two of you (pcSplit) for the tax and each person's limits:
   the 401(k) match line fills the higher match first, the line beyond it
   goes in proportion to each person's room under their own limit, the IRA
   goes evenly, and so does the HSA, unless only one of you earns under
   the Social Security wage cap: then it comes out of that pay first, where
   it skips Social Security tax too.

   The IRA line (keyed "rothIra" from when it was Roth only) is traditional
   or Roth. Traditional money comes out of the deposit like the Roth, but it
   comes off income tax as far as the deduction allows (the engine phases it
   out for anyone in a 401(k) at work). Past the Roth IRA's income range the
   line isn't capped: it says to go through a backdoor Roth instead. */
import { computeTax, yearData } from "@/lib/engine/typed";
import { parseNum } from "@/lib/format";
import { HEALTH_SLOT, annualize, isPlannedRow, slotRow, type BudgetInputs, type BudgetRow } from "./model";

/** The lines, in their default order. */
export const PC_STEPS = ["match", "hsa", "ef", "rothIra", "k401max", "brok"] as const;
export type PcStep = (typeof PC_STEPS)[number];
export type PcAmounts = Record<PcStep, number>;
export const PC_ZERO: PcAmounts = { match: 0, hsa: 0, ef: 0, rothIra: 0, k401max: 0, brok: 0 };

/** Each line's name, and whether it's pre-tax (always) or has a
    Traditional/Roth switch (pre-tax unless switched to Roth). */
export const PC_LINES: Record<PcStep, { name: string; pre?: boolean; k401?: boolean; roth?: boolean }> = {
  match: { name: "401(k) up to the match", k401: true, roth: true },
  hsa: { name: "HSA", pre: true },
  ef: { name: "Emergency fund" },
  rothIra: { name: "IRA", roth: true },
  k401max: { name: "401(k) beyond the match", k401: true, roth: true },
  brok: { name: "Taxable brokerage" },
};

const AMT_KEY: Record<PcStep, keyof BudgetInputs> = {
  match: "pcMatch", hsa: "pcHsa", ef: "pcEf", rothIra: "pcRothIra", k401max: "pcK401max", brok: "pcBrok",
};
export const pcAmountKey = (s: PcStep) => AMT_KEY[s] as "pcMatch";
export const pcRothKey = (s: PcStep) => (s === "match" ? "pcMatchRoth" : s === "rothIra" ? "pcIraRoth" : "pcK401maxRoth") as "pcMatchRoth";


/** How a Budget row comes across: counted, left out (this tab plans it), or
    moved (the health premiums fields hold it). */
export function rowRole(b: BudgetInputs, r: BudgetRow): "count" | "save" | "work" {
  if (isPlannedRow(r)) return "save";
  if (healthThroughWork(b) && r === slotRow(b.rows, HEALTH_SLOT)) return "work";
  return "count";
}

/** HSA coverage: self-only (for one of you), family, or with two incomes
    self-only for each of you (two limits). */
export type HsaCov = "self" | "family" | "self2";

export interface PcInput {
  /** Each person's gross pay, a year (the spouse's 0 unless two incomes). */
  gross: number;
  gross2: number;
  /** Married, two incomes: planned by the month. */
  two: boolean;
  /** Periods a year: paychecks, or 12 with two incomes. */
  p: number;
  /** Each person's paychecks a year (with two incomes, for their own check). */
  pays: [number, number];
  status: "s" | "m";
  state: string;
  /** Health premiums through work, per period: through your job, and your
      spouse's (typed per check on each one's own schedule). */
  health: [number, number];
  match: { rate: number; upTo: number }[];
  hsa: HsaCov;
  efCap: number;
  /** Whether there's an emergency fund line (it's added, or has money on it). */
  efOn: boolean;
  /** Which switchable lines are Roth (the IRA is Roth unless switched). */
  roth: { match: boolean; k401max: boolean; rothIra: boolean };
  /** The budget's spending a year, after what this tab plans or moves. */
  spendYear: number;
  order: PcStep[];
  amounts: PcAmounts;
}

/** Whether health premiums come out of pay: unless they're set to 0 (both
    of them, with two incomes), which keeps the Budget's Health insurance
    row as an expense. */
export const healthThroughWork = (b: BudgetInputs) =>
  b.pcHealth.trim() === "" || parseNum(b.pcHealth) > 0 || (b.pcStatus === "m2" && parseNum(b.pcHealth2) > 0);

/** The Budget's Health insurance row as a monthly figure (0 when blank). */
export function healthRowMonthly(b: BudgetInputs): number {
  const r = slotRow(b.rows, HEALTH_SLOT);
  return r ? annualize(r) / 12 : 0;
}

/** The order as stored, with anything missing put back at the end (and
    anything it doesn't know, like an older version's lines, dropped). */
export function pcOrder(raw: string): PcStep[] {
  const seen = raw.split(",").filter((x): x is PcStep => (PC_STEPS as readonly string[]).includes(x));
  const uniq = seen.filter((x, i) => seen.indexOf(x) === i);
  return [...uniq, ...PC_STEPS.filter((x) => !uniq.includes(x))];
}

/** The tab's inputs as numbers. `taxState` is the Income Tax tool's state,
    used while the tab has none of its own. */
export function paycheckInput(b: BudgetInputs, taxState: string): PcInput {
  const two = b.pcStatus === "m2";
  const sched = (v: string) => ([52, 26, 24, 12].includes(+v) ? +v : 26);
  const pays: [number, number] = [sched(b.pcFreq), sched(b.pcFreq2)];
  const p = two ? 12 : pays[0];
  const spendYear = b.rows.reduce((a, r) => a + (rowRole(b, r) === "count" ? annualize(r) : 0), 0);
  const n = (v: string) => Math.max(0, parseNum(v));
  // Premiums are typed per check on each person's schedule; with two
  // incomes they're carried as a month.
  const health1 = b.pcHealth.trim() === "" ? (healthRowMonthly(b) * 12) / p : (n(b.pcHealth) * pays[0]) / (two ? 12 : pays[0]);
  const efOn = !!b.pcEfOn || n(b.pcEf) > 0;
  const amounts = Object.fromEntries(PC_STEPS.map((s) => [s, s === "ef" && !efOn ? 0 : n(b[pcAmountKey(s)])])) as PcAmounts;
  return {
    gross: n(b.pcGross), gross2: two ? n(b.pcGross2) : 0, two, p, pays, status: b.pcStatus === "s" ? "s" : "m", state: b.pcState || taxState,
    health: [health1, two ? (n(b.pcHealth2) * pays[1]) / 12 : 0],
    match: [{ rate: n(b.pcMatchRate), upTo: n(b.pcMatchUpTo) }, { rate: n(b.pcMatchRate2), upTo: n(b.pcMatchUpTo2) }],
    hsa: b.pcHsaFamily ? "family" : two && b.pcHsaBoth ? "self2" : "self",
    efCap: n(b.pcEfCap), efOn, roth: { match: !!b.pcMatchRoth, k401max: !!b.pcK401maxRoth, rothIra: b.pcIraRoth !== false },
    spendYear, order: pcOrder(b.pcOrder).filter((s) => s !== "ef" || efOn), amounts,
  };
}

const limits = () => yearData().limits;

/** Each person's full match, per period: what they defer to get all of it. */
function matchCaps(pi: PcInput): [number, number] {
  const L = limits();
  const cap = (i: number, g: number) => Math.min((pi.match[i].upTo / 100) * g, L.k401.base) / pi.p;
  return [cap(0, pi.gross), pi.two ? cap(1, pi.gross2) : 0];
}

export interface PcSplit {
  /** Each line's amount, [you, spouse], per period. */
  match: [number, number]; k401max: [number, number]; hsa: [number, number]; rothIra: [number, number];
  /** Whose pay the HSA favors to save Social Security tax (0 you, 1 your
      spouse): the one under the wage cap when the other is over it. */
  hsaFirst: 0 | 1 | null;
}

/** How the household's lines divide between the two of you (all yours with
    one paycheck). The match line fills the higher match first (more free
    money per dollar), then the other; beyond the match, each person in
    proportion to their room left under their own limit; the HSA (two
    people's) and Roth IRA evenly. */
export function pcSplit(pi: PcInput, a: PcAmounts = pi.amounts): PcSplit {
  if (!pi.two) return { match: [a.match, 0], k401max: [a.k401max, 0], hsa: [a.hsa, 0], rothIra: [a.rothIra, 0], hsaFirst: null };
  const L = limits(), mc = matchCaps(pi);
  const first = pi.match[1].rate > pi.match[0].rate ? 1 : 0, second = 1 - first;
  const m: [number, number] = [0, 0];
  m[first] = Math.min(a.match, mc[first]);
  m[second] = Math.min(a.match - m[first], mc[second]);
  m[first] += a.match - m[0] - m[1]; // anything over both matches: on the first (it shows as over the limit)
  const room = [0, 1].map((i) => Math.max(0, L.k401.base / pi.p - m[i]));
  const rooms = room[0] + room[1];
  const x: [number, number] = rooms > 0 ? [(a.k401max * room[0]) / rooms, (a.k401max * room[1]) / rooms] : [a.k401max / 2, a.k401max / 2];
  // HSA money through payroll also skips the 6.2% Social Security tax, but
  // only on pay under the wage cap. With one of you over it, it comes out of
  // the other's pay first: all of a family limit, or up to their own
  // self-only limit. Otherwise it splits evenly.
  const cap = yearData().fica.ssCap, over = [pi.gross >= cap, pi.gross2 >= cap];
  const hsaFirst: 0 | 1 | null = pi.hsa !== "self" && over[0] !== over[1] ? (over[0] ? 1 : 0) : null;
  let hsa: [number, number];
  if (pi.hsa === "self") hsa = [a.hsa, 0];
  else if (hsaFirst == null) hsa = [a.hsa / 2, a.hsa / 2];
  else {
    const own = pi.hsa === "family" ? a.hsa : Math.min(a.hsa, L.hsa.self / pi.p);
    hsa = hsaFirst === 0 ? [own, a.hsa - own] : [a.hsa - own, own];
  }
  return { match: m, k401max: x, hsa, rothIra: [a.rothIra / 2, a.rothIra / 2], hsaFirst };
}

/** Where Fill stops a line, per period (Infinity for brokerage). The 401(k)
    line beyond the match shares each person's yearly limit with the match
    line; with two incomes the limits are the two of yours together. */
export function pcCap(pi: PcInput, s: PcStep, a: PcAmounts): number {
  const L = limits(), p = pi.p;
  switch (s) {
    case "match": { const mc = matchCaps(pi); return mc[0] + mc[1]; }
    case "k401max": {
      const m = pcSplit(pi, a).match;
      return Math.max(0, L.k401.base / p - m[0]) + (pi.two ? Math.max(0, L.k401.base / p - m[1]) : 0);
    }
    case "hsa": return (pi.hsa === "family" ? L.hsa.family : pi.hsa === "self2" ? 2 * L.hsa.self : L.hsa.self) / p;
    case "rothIra": return ((pi.two ? 2 : 1) * L.ira.base) / p;
    case "ef": return pi.efCap;
    case "brok": return Infinity;
  }
}

/** Whether a line has a limit of its own to warn against (the emergency
    fund's is only where Fill stops). */
export const pcHasLimit = (s: PcStep) => s !== "ef" && s !== "brok";

export interface PcPerson { gross: number; k401: number; roth401: number; hsa: number; health: number; fed: number; state: number; fica: number; deposit: number }

export interface PcRun {
  /** Gross pay a period: both together, and each person's. */
  check: number;
  gross1: number; gross2: number;
  /** Per period, [you, spouse]: traditional and Roth 401(k), HSA, health premiums. */
  k401s: [number, number]; roth401s: [number, number]; hsas: [number, number]; healths: [number, number];
  k401: number; roth401: number; hsa: number; health: number;
  fed: number; state: number; fica: number; taxes: number;
  deposit: number; spend: number; toAssign: number; ef: number; rothIra: number; brok: number;
  /** The IRA line when traditional (else 0), and the part of it the
      deduction allows, per period, both of you together. */
  iraTrad: number; iraDed: number;
  /** The income the IRA tests read, a year: pay less the pre-tax money
      through payroll. */
  magi: number;
  /** Unassigned: negative when more is assigned than the deposit covers. */
  left: number;
  saved: number;
  /** The employers' match, per period. */
  match: number;
  /** Each person's own check, per period ([you, spouse]): their pay and what
      comes out of it, down to what they deposit. The joint income tax is
      shared in proportion to each one's taxable pay; Social Security and
      Medicare are each person's own. */
  people: PcPerson[];
  stateName: string;
  /** Pre-tax money the state keeps in its base, a year. */
  stateAddBack: number;
}

/** One period (a paycheck, or with two incomes a month), for a set of line amounts. */
export function paycheckRun(pi: PcInput, a: PcAmounts = pi.amounts): PcRun {
  const p = pi.p, sp = pcSplit(pi, a);
  const k401s = [0, 1].map((i) => (pi.roth.match ? 0 : sp.match[i]) + (pi.roth.k401max ? 0 : sp.k401max[i])) as [number, number];
  const roth401s = [0, 1].map((i) => (pi.roth.match ? sp.match[i] : 0) + (pi.roth.k401max ? sp.k401max[i] : 0)) as [number, number];
  const hsas = sp.hsa, healths = pi.health;
  const iras = [0, 1].map((i) => (pi.roth.rothIra ? 0 : sp.rothIra[i]));
  const R = computeTax({
    status: pi.status, gross: pi.gross, gross2: pi.gross2, pre: 0, dedType: "std", item: 0, state: pi.state,
    // In a 401(k) at work, traditional or Roth, is what phases out the IRA deduction.
    ded: [0, 1].map((i) => ({ k401: k401s[i] * p, ira: iras[i] * p, hsa: hsas[i] * p, health: healths[i] * p, other: 0,
      covered: sp.match[i] + sp.k401max[i] > 0 })),
  }) as { federal: number; state: number; fica: number; ss1: number; ss2: number; addl: number; stateName: string;
    preTax: { addBack: number; ficaOff: number[]; magi: number; people: { iraDed: number }[] } | null };
  const gross1 = pi.gross / p, gross2 = pi.gross2 / p, check = gross1 + gross2;
  const sum = (x: number[]) => x[0] + x[1];
  const k401 = sum(k401s), roth401 = sum(roth401s), hsa = sum(hsas), health = sum(healths);
  const fed = R.federal / p, state = R.state / p, fica = R.fica / p;
  const deposit = check - k401 - hsa - health - fed - state - fica - roth401;
  const spend = pi.spendYear / p, toAssign = deposit - spend;
  const left = toAssign - a.ef - a.rothIra - a.brok;
  const deferred = [k401s[0] + roth401s[0], k401s[1] + roth401s[1]];
  const matchOf = (i: number, g: number) => (Math.min(deferred[i], (pi.match[i].upTo / 100) * g) * pi.match[i].rate) / 100;
  // Each person's check: the joint income tax shared by taxable pay; FICA
  // their own (Medicare on their FICA wages, the surtax shared by them).
  const grosses = [pi.gross, pi.gross2];
  const taxable = [0, 1].map((i) => Math.max(0, grosses[i] - (k401s[i] + hsas[i] + healths[i]) * p - (R.preTax?.people[i].iraDed ?? 0)));
  const tShare = (i: number) => (taxable[0] + taxable[1] > 0 ? taxable[i] / (taxable[0] + taxable[1]) : i === 0 ? 1 : 0);
  const ficaWage = [0, 1].map((i) => Math.max(0, grosses[i] - (R.preTax?.ficaOff[i] ?? 0)));
  const medRate = yearData().fica.medRate;
  const fShare = (i: number) => (ficaWage[0] + ficaWage[1] > 0 ? ficaWage[i] / (ficaWage[0] + ficaWage[1]) : 0);
  const people = [0, 1].map((i): PcPerson => {
    const g = grosses[i] / p, f = R.federal * tShare(i) / p, st = R.state * tShare(i) / p;
    const fc = ((i ? R.ss2 : R.ss1) + ficaWage[i] * medRate + R.addl * fShare(i)) / p;
    return { gross: g, k401: k401s[i], roth401: roth401s[i], hsa: hsas[i], health: healths[i], fed: f, state: st, fica: fc,
      deposit: g - k401s[i] - roth401s[i] - hsas[i] - healths[i] - f - st - fc };
  });
  return {
    check, gross1, gross2, k401s, roth401s, hsas, healths, k401, roth401, hsa, health, fed, state, fica, taxes: fed + state + fica,
    deposit, spend, toAssign, ef: a.ef, rothIra: a.rothIra, brok: a.brok, left,
    iraTrad: iras[0] + iras[1], iraDed: ((R.preTax?.people[0].iraDed ?? 0) + (R.preTax?.people[1].iraDed ?? 0)) / p,
    magi: R.preTax?.magi ?? pi.gross + pi.gross2,
    saved: PC_STEPS.reduce((t, s) => t + a[s], 0), match: matchOf(0, gross1) + (pi.two ? matchOf(1, gross2) : 0), people,
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

/** Fill in order: each line of `order` (the lines shown, by default), top
    to bottom, as much as it allows, rerunning the taxes as it goes;
    brokerage takes what's left. Lines not in `order` get nothing. */
export function paycheckFill(pi: PcInput, order: PcStep[] = pi.order): PcAmounts {
  const a = { ...PC_ZERO };
  const ord = order.filter((s) => s !== "ef" || pi.efOn);
  for (const s of ord) if (s !== "brok") a[s] = most(pi, a, s, pcCap(pi, s, a));
  // Every line in whole cents, as it's kept, never over its limit.
  for (const s of ord) if (s !== "brok") a[s] = Math.min(Math.round(a[s] * 100), Math.floor(pcCap(pi, s, a) * 100 + 1e-6)) / 100;
  // Rounding up can leave it a fraction of a cent short: the last line
  // filled gives back a cent at a time until it isn't.
  const last = [...ord].reverse().find((s) => s !== "brok" && a[s] > 0);
  for (let i = 0; last && i < 20 && paycheckRun(pi, a).left < 0; i++) a[last] = Math.max(0, Math.round(a[last] * 100 - 1) / 100);
  // A line the money ran out on takes what cents are left, as far as they go;
  // brokerage gets money only once every line above it is full.
  const full = (s: PcStep) => a[s] >= Math.floor(pcCap(pi, s, a) * 100 + 1e-6) / 100 - 1e-9;
  const partial = ord.find((s) => s !== "brok" && !full(s));
  if (partial) {
    for (let i = 0; i < 100 && !full(partial); i++) {
      a[partial] = Math.round(a[partial] * 100 + 1) / 100;
      if (paycheckRun(pi, a).left < 0) { a[partial] = Math.round(a[partial] * 100 - 1) / 100; break; }
    }
  } else if (ord.includes("brok")) a.brok = Math.max(0, Math.floor(paycheckRun(pi, a).left * 100 + 1e-6) / 100);
  return a;
}

/** A line's Max: as much as it takes (to its limit, or what's left for
    brokerage) without going short, in whole cents, the others as they are. */
export function pcMost(pi: PcInput, s: PcStep): number {
  const a = { ...pi.amounts, [s]: 0 };
  if (s === "brok") return Math.max(0, Math.floor(paycheckRun(pi, a).left * 100 + 1e-6) / 100);
  const c = pcCap(pi, s, a), v = most(pi, a, s, c);
  return Math.min(Math.round(v * 100), Math.floor(c * 100 + 1e-6)) / 100;
}

/** The plans a slider card starts from: an order to fill in, whether the
    401(k) lines go traditional, and the IRA's kind ("deductible":
    traditional while any of it is deductible, else Roth). Lines a plan
    leaves out get nothing. The emergency fund, when there is one, comes
    right after the match (before the IRA when maximizing tax breaks). */
export const PC_PLANS = {
  usual: { name: "The usual order", order: ["match", "ef", "hsa", "rothIra", "k401max", "brok"] as PcStep[], traditional: false, ira: "roth",
    note: "The full 401(k) match, then the HSA, a Roth IRA, the rest of the 401(k) and brokerage" },
  tax: { name: "Max tax breaks", order: ["match", "hsa", "k401max", "ef", "rothIra", "brok"] as PcStep[], traditional: true, ira: "deductible",
    note: "Everything pre-tax first: the match, the HSA and the 401(k) to its limit, all traditional. Then an IRA (traditional while it's deductible, else Roth) and brokerage" },
  flex: { name: "Stay flexible", order: ["match", "ef", "rothIra", "brok"] as PcStep[], traditional: false, ira: "roth",
    note: "The match, then money you can reach before retirement: a Roth IRA (contributions can come back out) and brokerage. No HSA or extra 401(k)" },
} as const;
export type PcPlan = keyof typeof PC_PLANS;

/** What a plan sets: the Roth switches and every line's amount. */
export function pcPlanApply(pi: PcInput, k: PcPlan): { roth: PcInput["roth"]; amounts: PcAmounts } {
  const plan = PC_PLANS[k];
  const k401 = plan.traditional ? { match: false, k401max: false } : { match: pi.roth.match, k401max: pi.roth.k401max };
  const fill = (rothIra: boolean) => {
    const roth = { ...k401, rothIra }, amounts = paycheckFill({ ...pi, roth }, [...plan.order]);
    return { roth, amounts };
  };
  if (plan.ira === "roth") return fill(true);
  // Traditional only while some of it comes off the tax: a nondeductible IRA
  // does no better than a Roth. Asked of at least a dollar, so the switch is
  // set right even when the plan has nothing left for the IRA.
  const t = fill(false), probe = { ...t.amounts, rothIra: Math.max(1, t.amounts.rothIra) };
  return paycheckRun({ ...pi, roth: t.roth }, probe).iraDed >= 0.005 ? t : fill(true);
}

/** The Roth IRA's income test, for the IRA line as set: how much of the
    yearly limit each of you can put in directly (the IRS worksheet: the
    limit scaled down across the range, rounded up to $10 and at least $200
    until it's gone), and whether that's none. Nothing is capped by it: past
    the range a backdoor Roth (a nondeductible IRA, converted) gets there. */
export function pcRothRoom(pi: PcInput, r: PcRun): { direct: number; limit: number; over: boolean; reduced: boolean } {
  const L = limits(), limit = L.ira.base, [lo, hi] = L.rothPhase[pi.status];
  const f = Math.min(1, Math.max(0, (r.magi - lo) / (hi - lo)));
  const direct = f >= 1 ? 0 : f <= 0 ? limit : Math.min(limit, Math.max(200, Math.ceil((limit * (1 - f)) / 10) * 10));
  return { direct, limit, over: direct === 0, reduced: direct > 0 && direct < limit };
}

/** A plan's display order: its own lines, then the ones it leaves out. */
export const pcPlanOrder = (k: PcPlan): PcStep[] => [...PC_PLANS[k].order, ...PC_STEPS.filter((s) => !PC_PLANS[k].order.includes(s))];

/** What a dollar on line `s` costs what's left to assign: under a dollar
    for pre-tax money, since part of it would have gone to tax. Averaged
    over the amount on the line (a deduction can stop at a limit, so the
    next dollar may cost more); the next $100 when there's nothing on it. */
export function pcCostPer(pi: PcInput, s: PcStep): number {
  const a = pi.amounts, v = a[s], left = paycheckRun(pi, a).left;
  if (v > 0) return (paycheckRun(pi, { ...a, [s]: 0 }).left - left) / v;
  return (left - paycheckRun(pi, { ...a, [s]: 100 }).left) / 100;
}

/** Whether line `s` is pre-tax as set (the HSA, or a line switched to traditional). */
export const pcPreTax = (pi: PcInput, s: PcStep) =>
  !!PC_LINES[s].pre || (!!PC_LINES[s].roth && !pi.roth[s as "match" | "k401max" | "rothIra"]);

/** A month of the Paycheck tab as it's set, for tools that read it (Debt
    Payoff's extra payment, the Guide): what's deposited and what's still
    unassigned. Null until it has a gross pay. */
export function paycheckMonthly(b: BudgetInputs, taxState: string): { deposit: number; left: number } | null {
  const pi = paycheckInput(b, taxState);
  if (!(pi.gross + pi.gross2 > 0)) return null;
  const r = paycheckRun(pi);
  return { deposit: (r.deposit * pi.p) / 12, left: (r.left * pi.p) / 12 };
}
