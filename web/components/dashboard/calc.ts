/* The calculators filled in from the Dashboard: Advanced and Stages with
   the accounts, the saving by account, the match, the assumptions and the
   years to retirement; Stages also with the children, as its "Planning for
   kids?" builds them; College Savings with each child's years to go. */

import { withDefaults } from "@/components/tools/ToolState";
import { groupDigits, parseNum } from "@/lib/format";
import { ADVANCED_DEF, type AdvancedInputs } from "@/tools/advanced/model";
import { STAGES_DEF, readStage, stageFields, stagesCompute, type LumpAccount, type StageInputs, type StagesInputs } from "@/tools/stages/model";
import { NO_KIDS, type PlanKids } from "@/tools/plan/model";
import { flow, taxState } from "./flows";
import { shiftCover, yearlySaving } from "./cover";
import { lumpAccount, lumpsOn, nominalAt, ownOn, payAt, scenarioName, withoutOwn, yearChange, type Scenario } from "./scenarios";
import { KID_BASE } from "@/tools/stages/kids";
import { ageOf, answers, couple, holdings, realGrowth, results, spendMonth, type Results } from "./model";
import { OUTSIDE_US, sum, type Entry, type Profile } from "./store";

const g = (n: number) => groupDigits(Math.round(n), true);
const pc = (v: number) => String(+(v * 100).toFixed(4));

/** What both calculators share: balances by account, saving by account a
    month, the match, and contribution growth (before inflation). */
function shared(pr: Profile, entries: Entry[]) {
  const F = flow(pr), H = holdings(entries, pr), last = entries[entries.length - 1];
  const hsaBal = last ? sum(last.items, "asset", ["hsa"]) : 0;
  const hsaC = F.pi.amounts.hsa * (F.pi.p / 12);
  const infl = pr.assume.inflation;
  // Contribution growth: saving follows pay (cover.ts), so one rate, the
  // one that takes today's saving to the plan's last year before retirement.
  const A = answers(pr, entries), B = A.age != null && A.retire != null ? yearlySaving(pr, F, A).base : [];
  const real = B.length > 1 && B[0] > 0 ? Math.pow(B[B.length - 1] / B[0], 1 / (B.length - 1)) - 1 : 0;
  const nom = (1 + real) * (1 + infl) - 1;
  return {
    F, tradBal: H.trad, rothBal: Math.max(0, H.roth - hsaBal), hsaBal, brokBal: H.brok, brokBasis: H.brokBasis,
    tradC: F.trad, rothC: Math.max(0, F.roth - hsaC), hsaC, brokC: F.brok,
    rates: { t: nom, r: nom, b: nom, h: nom },
    salary: F.pi.gross, matchPct: F.b.pcMatchRate, matchCap: F.b.pcMatchUpTo,
    status: couple(pr) ? "m" : "s", state: taxState(pr),
    years: pr.p1.retire && ageOf(pr.p1) != null ? Math.max(1, pr.p1.retire - ageOf(pr.p1)!) : 30,
    // What the plan spends once retired: the goal, or the strategy's when a rate is set on Retirement.
    target: Math.round((results(pr, entries).spend ?? pr.retSpend ?? spendMonth(pr) ?? 0) * 12),
    nominal: (1 + realGrowth(pr)) * (1 + infl) - 1,
  };
}

/** Advanced, its account split on, from the profile. */
export function advancedFor(pr: Profile, entries: Entry[]): AdvancedInputs {
  const A = shared(pr, entries), own = A.tradC + A.rothC + A.brokC + A.hsaC;
  const total = A.tradBal + A.rothBal + A.brokBal + A.hsaBal;
  return {
    ...withDefaults(ADVANCED_DEF, {}),
    initial: g(total), contrib: g(own), period: "Monthly",
    growth: pc((A.rates.t + A.rates.r + A.rates.b) / 3), nominal: pc(A.nominal), inflation: pc(pr.assume.inflation), years: String(A.years),
    ...(A.target > 0 ? { solveFor: "After-Tax Withdrawal", target: g(A.target) } : {}),
    acOn: true, tradBal: g(A.tradBal), tradC: g(A.tradC), rothBal: g(A.rothBal), rothC: g(A.rothC),
    brokBal: g(A.brokBal), brokC: g(A.brokC), brokBasis: g(A.brokBasis ?? A.brokBal * 0.6), hsaBal: g(A.hsaBal), hsaC: g(A.hsaC),
    salary: g(A.salary), matchPct: A.matchPct, matchCap: A.matchCap, acStatus: A.status, acState: A.state,
    gRates: A.rates,
    // Your age, so the changes ahead read by age.
    age: ageOf(pr.p1) != null ? String(ageOf(pr.p1)) : "",
  };
}

/** The children as Stages' "Planning for kids?" holds them. */
export function planKidsOf(pr: Profile): PlanKids | null {
  const now = pr.kidList.slice(0, pr.kids).filter((k) => k.by).map((k) => ageOf(k)!).filter((a) => a >= 0 && a < 30);
  if (!now.length && !pr.planned.count) return null;
  const C = pr.childCosts;
  return { ...NO_KIDS, now, planned: pr.planned.count, firstIn: pr.planned.firstIn, spacing: pr.planned.spacing, childcare: pr.childcare, area: pr.careArea,
    early: C.early, school: C.school, teen: C.teen, later: C.later };
}

/** A year of the plan's saving: what goes in each month that year, yours
    and your employers', in today's dollars, and what's going on. */
interface PlanYear {
  monthly: number; label: string; split?: { t: number; r: number; b: number };
  /** The scenarios at work that year (their names), and the return before
      inflation it earns (a returns scenario changes it). */
  tags: string[]; nominal: number;
  /** A lump sum on the year's first day, in today's dollars, and its account. */
  lump?: { amount: number; to: LumpAccount };
}

/** A stage's name without the yearly growth in it ("after the raise" once
    for every year saving has grown): the stage's growth rate says that. */
function plainLabel(label: string): string {
  const s = label.split(", ").filter((x) => !/^after the raise$/i.test(x)).join(", ");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Saving";
}

/** The plan's saving year by year, from its schedule (children, college,
    saving that grows to its limits), or today's saving to retirement. */
function planYears(R: Results, scen: Scenario[], nominal: number): PlanYear[] {
  const S = R.S;
  if (!S) return [];
  const age = Math.round(S.I.age), end = Math.round(S.retire);
  const sched: { from: number; to: number; monthly: number; label: string; split?: PlanYear["split"] }[] = S.sched?.length ? S.sched : [{ from: age, to: end, monthly: S.monthly, label: "Saving" }];
  const out: PlanYear[] = [];
  const nameOf = (id: string) => scenarioName(scen.find((s) => s.id === id)!);
  for (const s of sched) for (let t = Math.round(s.from); t < Math.round(s.to); t++) {
    // Which scenarios touch the year: the saving ones by what they do to
    // today's saving (a share of nothing is nothing), the returns ones by age.
    const Y = yearChange(scen, t, end, S.monthly), N = nominalAt(scen, t, nominal);
    // Pay changes at work this year (their effect is in the saving already).
    const P = [...payAt(scen, 0, t, end, 1, 0).tags, ...payAt(scen, 1, t, end, 1, 0).tags];
    // Lump sums land on the year's first day; two the same year into one
    // account add up (the first one's account when they differ).
    const L = lumpsOn(scen).filter((x) => x.from === t && x.amount !== 0);
    const lump = L.length ? { amount: L.reduce((a, x) => a + x.amount, 0), to: lumpAccount(L[0]) } : undefined;
    // A hidden scenario (its id starts with "__") does its work without a name.
    out.push({ monthly: s.monthly, label: plainLabel(s.label), ...(s.split ? { split: s.split } : {}), tags: [...P, ...Y.tags, ...N.tags, ...L.map((x) => x.id)].filter((id) => !id.startsWith("__")).map(nameOf), nominal: N.nominal, ...(lump ? { lump } : {}) });
  }
  return out;
}

/** The plan's years as stages: a new stage wherever what's going on
    changes (its words, the scenarios at work, the return), or saving turns
    from rising to level or back; within one, saving grows at the rate that
    puts the same amount in by retirement. */
function planGroups(years: PlanYear[]) {
  const trend = (i: number) => (i === 0 ? 0 : Math.sign(Math.round(years[i].monthly - years[i - 1].monthly)));
  const keyOf = (y: PlanYear) => y.label + "|" + y.tags.join(",") + "|" + y.nominal.toFixed(6) + (y.lump ? "|lump" : "");
  const groups: { from: number; to: number; label: string; key: string }[] = [];
  years.forEach((y, i) => {
    const last = groups[groups.length - 1], key = keyOf(y);
    // A rise into the year counts with the year before it, so a stage that
    // grows starts at its first rise. A lump sum's year starts a stage of
    // its own: the lump lands on a stage's first day.
    const same = !y.lump && last && last.key === key && (i - last.from < 2 || trend(i) === trend(i - 1)) && trend(i) >= 0;
    if (same) last.to = i + 1;
    else groups.push({ from: i, to: i + 1, label: y.tags.length ? y.label + ", " + y.tags.join(", ") : y.label, key });
  });
  return groups;
}

/** Stages from the plan itself: every change in saving the plan makes
    (children, college years, saving that grows to its limits, both
    employers' match), so the Calculator reaches what the plan has at
    retirement. */
export function stagesFor(pr: Profile, entries: Entry[]): StagesInputs {
  // A returns scenario is the Calculator's own: the plan runs on its one
  // return, and takes the Calculator's result (calcFvOf). The plan is read
  // without it here, so nothing goes round in circles.
  const scen = pr.scenarios ?? [], retOn = ownOn(scen), plan = retOn ? { ...pr, scenarios: withoutOwn(scen) } : pr;
  const A = shared(plan, entries), own = A.tradC + A.rothC + A.brokC + A.hsaC;
  const R = results(plan, entries), F = A.F;
  // Both employers' match as one rate on what you put in before taxes and to
  // Roth: the share of every dollar of yours your employers add.
  // Outside the US the plan counts every account as tax-free, the match in
  // with the rest, so the stages carry it inside each contribution.
  const abroad = pr.state === OUTSIDE_US;
  const matched = abroad ? 0 : own * (own > 0 ? (A.tradC + A.rothC) / own : 0);
  const matchPct = F.match > 0 && matched > 0 ? (F.match / matched) * 100 : 0, mf = 1 + (matched > 0 ? F.match / own : 0);
  const infl = pr.assume.inflation, nom = (real: number) => (1 + real) * (1 + infl) - 1;
  const todaySplit = own > 0 ? { sTrad: A.tradC / own, sRoth: A.rothC / own, ...(A.hsaC > 0 ? { sHsa: A.hsaC / own } : {}) } : {};
  // A stage's own saving and its split from the plan's saving by account,
  // so that with the match added it puts the same into each: the match goes
  // to traditional at p of every dollar of yours there and in Roth.
  const p = matchPct / 100, hsaOfR = A.rothC + A.hsaC > 0 ? A.hsaC / (A.rothC + A.hsaC) : 0;
  const mineOf = (y: Pick<PlanYear, "monthly" | "split">) => {
    if (!y.split) return { mine: y.monthly / mf, split: todaySplit };
    const r1 = y.split.r * (1 - hsaOfR), hsa = y.split.r - r1, t = Math.max(0, (y.split.t - p * r1) / (1 + p)), mine = t + y.split.r + y.split.b;
    return { mine, split: mine > 0 ? { sTrad: t / mine, sRoth: r1 / mine, ...(hsa > 0 ? { sHsa: hsa / mine } : {}) } : todaySplit };
  };
  const stage = (years: number, y: Pick<PlanYear, "monthly" | "split"> & Partial<Pick<PlanYear, "nominal" | "lump">>, growth: number, name?: string, adj = false): StageInputs => {
    const m = mineOf(y);
    return {
      ...stageFields({ years, contrib: Math.round(m.mine), period: "Monthly", growth: nom(growth), nominal: y.nominal ?? A.nominal, vol: 0.15, adj, ...m.split, ...(y.lump ? { lump: Math.round(y.lump.amount), lumpTo: y.lump.to } : {}) }),
      ...(name ? { name } : {}),
    };
  };
  const base: StagesInputs = {
    ...withDefaults(STAGES_DEF, {}),
    initial: g(A.tradBal + A.rothBal + A.brokBal + A.hsaBal), inflation: pc(infl),
    ...(A.target > 0 ? { solveFor: "After-Tax Withdrawal", target: g(A.target) } : {}),
    saOn: true, saTradBal: g(A.tradBal), saRothBal: g(A.rothBal), saBrokBal: g(A.brokBal), saBrokBasis: g(A.brokBasis ?? A.brokBal * 0.6), saHsaBal: g(A.hsaBal),
    saSalary: g(F.gross * 12), saMatchPct: matchPct > 0 ? String(+matchPct.toFixed(4)) : "0", saMatchCap: "100", saStatus: A.status, saState: A.state,
    stages: [stage(A.years, { monthly: own + F.match }, 0)],
  };
  // The children, and how their costs are covered, counted from year 0 as the Calculator counts.
  // Historical mode's mix as last set in the Calculator.
  const M = pr.calcMix, withMix = (s: StagesInputs): StagesInputs => (M ? { ...s, histMix: M.stock, histSv: M.sv, histCash: M.cash, histMixEnd: M.end } : s);
  const kids = planKidsOf(pr), withKids = (s: StagesInputs) => (kids ? { ...s, kids, kidCover: shiftCover(pr.kidCover ?? {}, KID_BASE - (ageOf(pr.p1) ?? KID_BASE)) } : s);
  const years = planYears(R, scen, A.nominal);
  if (!years.length) return withMix(withKids(base));
  const groups = planGroups(years);
  // Each stage as the plan has it year by year, then as one stage growing
  // at a steady rate, found so the two come to the same at retirement.
  const exact = (gi: number) => groups[gi].label;
  const yearly = groups.flatMap((gr) => years.slice(gr.from, gr.to).map((y) => ({ y, name: gr.label })));
  const value = (stages: StageInputs[]) => stagesCompute({ ...base, stages }, null).R.fvReal;
  const asYears = (from: number) => yearly.slice(from).map((x, i) => stage(1, x.y, 0, x.name, from + i > 0));
  const out: StageInputs[] = [], made: { n: number; first: PlanYear; growth: number }[] = [];
  groups.forEach((gr, gi) => {
    const first = years[gr.from], n = gr.to - gr.from, level = years.slice(gr.from, gr.to).every((y) => Math.abs(y.monthly - first.monthly) < 0.5);
    if (level || n < 2) { out.push(stage(n, first, 0, exact(gi), gi > 0)); made.push({ n, first, growth: 0 }); return; }
    const want = value([...out, ...asYears(gr.from)]);
    let lo = -0.5, hi = 0.5;
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      if (value([...out, stage(n, first, mid, exact(gi), gi > 0), ...asYears(gr.to)]) < want) lo = mid; else hi = mid;
    }
    out.push(stage(n, first, (lo + hi) / 2, exact(gi), gi > 0)); made.push({ n, first, growth: (lo + hi) / 2 });
  });
  // The plan counts the first part-year to the next birthday a little
  // differently, and the stages save in whole dollars, so they can end a
  // few dollars apart. The last stage's growth takes up the difference, so
  // the Calculator lands on the plan's own figure (Retirement starts there).
  // With a returns scenario on there's no plan figure to land on: the
  // Calculator's own result becomes the plan's.
  const target = retOn ? null : R.atRetire, li = out.length - 1, total = (stages: StageInputs[]) => stagesCompute(withKids({ ...base, stages }), null).R.fvReal;
  if (target != null && li >= 0 && Math.abs(total(out) - target) >= 0.5) {
    const m = made[li], at = (gr: number) => [...out.slice(0, li), stage(m.n, m.first, gr, exact(li), li > 0)];
    let lo = m.growth - 0.05, hi = m.growth + 0.05;
    for (let k = 0; k < 50; k++) { const mid = (lo + hi) / 2; if (total(at(mid)) < target) lo = mid; else hi = mid; }
    const fixed = at((lo + hi) / 2);
    if (Math.abs(total(fixed) - target) < Math.abs(total(out) - target)) out.splice(0, out.length, ...fixed);
  }
  return withMix(withKids({ ...base, stages: out }));
}


/* ---------- The Calculator's own changes ---------- */

/** Stages inputs the profile keeps elsewhere (the children's costs and how
    they're covered, historical mode's mix), so never kept as the
    Calculator's own. */
const PROFILE_KEYS = new Set(["kids", "kidCover", "histMix", "histSv", "histCash", "histMixEnd"]);
/** The stages themselves are built from the plan and its scenarios, never
    kept by hand (any kept before are let go of). */
const BUILT_KEYS = new Set(["stages"]);

/** Stages inputs the plan sets, which the Calculator locks (Profile, Income
    and Net worth set them): the balances and cost basis, pay and the
    match, filing status and state, inflation. Never kept as its own, and
    any kept before they were locked are let go of. */
export const CALC_LOCKED_KEYS = ["saOn", "initial", "saTradBal", "saRothBal", "saBrokBal", "saBrokBasis", "saHsaBal", "saSalary", "saMatchPct", "saMatchCap", "saStatus", "saState", "inflation"];
/** The groups of them the Calculator leaves out (its `facts` say them). */
export const CALC_LOCKED = ["savings", "inflation"];

/** A value as compared: figures as numbers, whatever their formatting. */
function norm(v: unknown): unknown {
  if (typeof v === "string" && /^\s*-?[\d,]*\.?\d+\s*%?\s*$/.test(v)) return Math.round(parseNum(v) * 1e4) / 1e4;
  if (Array.isArray(v)) return v.map(norm);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, norm(x)]));
  return v;
}

/* The plan's own stages are costly to build (each stage's growth is
   solved for), so they're kept for the profile they came from. */
const built = new Map<string, StagesInputs>();
function planStages(pr: Profile, entries: Entry[]): StagesInputs {
  const base = { ...pr, calcOwn: undefined }, key = JSON.stringify([base, entries]);
  let s = built.get(key);
  if (!s) { if (built.size > 30) built.clear(); s = stagesFor(base, entries); built.set(key, s); }
  return s;
}

/** The Calculator as it opens: the plan's stages with your own changes on top. */
const ownKeys = (pr: Profile) => Object.entries(pr.calcOwn ?? {}).filter(([k]) => !CALC_LOCKED_KEYS.includes(k) && !BUILT_KEYS.has(k));

export function calcInputs(pr: Profile, entries: Entry[]): StagesInputs {
  const s = planStages(pr, entries);
  const own = ownKeys(pr);
  return own.length ? ({ ...s, ...Object.fromEntries(own) } as StagesInputs) : s;
}

/** The inputs that differ from the plan's, to keep; null when none do. */
export function calcOwnOf(pr: Profile, entries: Entry[], d: StagesInputs): Record<string, unknown> | null {
  const base = planStages(pr, entries) as unknown as Record<string, unknown>, now = d as unknown as Record<string, unknown>, own: Record<string, unknown> = {};
  for (const k of Object.keys(now)) if (!PROFILE_KEYS.has(k) && !BUILT_KEYS.has(k) && !CALC_LOCKED_KEYS.includes(k) && JSON.stringify(norm(now[k])) !== JSON.stringify(norm(base[k]))) own[k] = now[k];
  return Object.keys(own).length ? own : null;
}

const fvs = new Map<string, number | null>();
/** The Calculator's result, savings at retirement in today's dollars, when
    your changes there (or a returns scenario) move it away from the plan's
    own; null otherwise. */
export function calcFvOf(pr: Profile, entries: Entry[]): number | null {
  const retOn = ownOn(pr.scenarios);
  if (!retOn && !ownKeys(pr).length) return null;
  const key = JSON.stringify([pr, entries]);
  if (fvs.has(key)) return fvs.get(key)!;
  const fv = stagesCompute(calcInputs(pr, entries), null).R.fvReal;
  // Against the plan's own stages before any changes here; with a returns
  // scenario the Calculator's result always stands.
  const was = retOn ? NaN : stagesCompute(planStages(pr, entries), null).R.fvReal;
  const out = Number.isFinite(fv) && (retOn || Math.abs(fv - was) >= 0.5) ? Math.max(0, fv) : null;
  if (fvs.size > 60) fvs.clear();
  fvs.set(key, out);
  return out;
}

/** Lump sums taken out that the account can't cover on the day: by the
    scenario's id, what the account holds that day and what's asked, both
    in today's dollars. The Calculator's stages are the only run that
    knows each account's balance along the way. */
export function lumpShortfalls(pr: Profile, entries: Entry[], age: number): Record<string, { have: number; need: number; acct: LumpAccount }> {
  const out: Record<string, { have: number; need: number; acct: LumpAccount }> = {};
  const lumps = lumpsOn(pr.scenarios).filter((x) => x.amount < 0);
  if (!lumps.length) return out;
  const s = calcInputs(pr, entries), P = stagesCompute(s, null).P;
  if (!P.slices) return out;
  const infl = parseNum(s.inflation) / 100;
  let start = 0;
  s.stages.map(readStage).forEach((st, i) => {
    if (st.lump && st.lump < 0) {
      const acct = st.lumpTo ?? "b", run = P.slices![acct];
      const have = run ? run.summary[i].start / Math.pow(1 + infl, start) : 0;
      // The year's lumps, as the stage holds them together.
      const here = lumps.filter((x) => x.from - age === start);
      const need = here.reduce((a, x) => a + Math.max(0, -x.amount), 0);
      if (need > have + 0.5) for (const x of here) out[x.id] = { have: Math.max(0, have), need, acct };
    }
    start += st.years;
  });
  return out;
}
