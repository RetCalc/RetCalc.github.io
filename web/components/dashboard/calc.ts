/* The calculators filled in from the Dashboard: Advanced and Stages with
   the accounts, the saving by account, the match, the assumptions and the
   years to retirement; Stages also with the children, as its "Planning for
   kids?" builds them; College Savings with each child's years to go. */

import { withDefaults } from "@/components/tools/ToolState";
import { groupDigits } from "@/lib/format";
import { ADVANCED_DEF, type AdvancedInputs } from "@/tools/advanced/model";
import { STAGES_DEF, stageFields, stagesCompute, type StageInputs, type StagesInputs } from "@/tools/stages/model";
import { NO_KIDS, type PlanKids } from "@/tools/plan/model";
import { COLLEGE_DEFAULTS } from "@/tools/college/model";
import { flow, growthLines, taxState } from "./flows";
import { shiftCover } from "./cover";
import { KID_BASE } from "@/tools/stages/kids";
import { ageOf, collegeStarts, couple, holdings, realGrowth, results, spendMonth, type Results } from "./model";
import { sum, type Entry, type Profile } from "./store";

const g = (n: number) => groupDigits(Math.round(n), true);
const pc = (v: number) => String(+(v * 100).toFixed(4));

/** What both calculators share: balances by account, saving by account a
    month, the match, and contribution growth (before inflation). */
function shared(pr: Profile, entries: Entry[]) {
  const F = flow(pr), H = holdings(entries, pr), last = entries[entries.length - 1];
  const hsaBal = last ? sum(last.items, "asset", ["hsa"]) : 0;
  const hsaC = F.pi.amounts.hsa * (F.pi.p / 12);
  const L = growthLines(pr, F), infl = pr.assume.inflation;
  // Each account's contribution growth: its lines' rates, weighted by what goes in.
  const rate = (ids: string[]) => {
    const ls = L.filter((l) => ids.includes(l.id) && l.amount > 0), tot = ls.reduce((s, l) => s + l.amount, 0);
    const real = tot > 0 ? ls.reduce((s, l) => s + l.growth * l.amount, 0) / tot : 0;
    return (1 + real) * (1 + infl) - 1;
  };
  const trad = (k: "match" | "k401max" | "rothIra") => !F.pi.roth[k];
  const tIds = (["match", "k401max", "rothIra"] as const).filter(trad), rIds = (["match", "k401max", "rothIra"] as const).filter((k) => !trad(k));
  return {
    F, tradBal: H.trad, rothBal: Math.max(0, H.roth - hsaBal), hsaBal, brokBal: H.brok,
    tradC: F.trad, rothC: Math.max(0, F.roth - hsaC), hsaC, brokC: F.brok,
    rates: { t: rate(tIds), r: rate(rIds), b: rate(["brok"]), h: rate(["hsa"]) },
    salary: F.pi.gross, matchPct: F.b.pcMatchRate, matchCap: F.b.pcMatchUpTo,
    status: couple(pr) ? "m" : "s", state: taxState(pr),
    years: pr.p1.retire && ageOf(pr.p1) != null ? Math.max(1, pr.p1.retire - ageOf(pr.p1)!) : 30,
    target: ((pr.retSpend ?? spendMonth(pr) ?? 0) * 12),
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
    brokBal: g(A.brokBal), brokC: g(A.brokC), brokBasis: g(A.brokBal * 0.6), hsaBal: g(A.hsaBal), hsaC: g(A.hsaC),
    salary: g(A.salary), matchPct: A.matchPct, matchCap: A.matchCap, acStatus: A.status, acState: A.state,
    gRates: A.rates,
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
interface PlanYear { monthly: number; label: string; split?: { t: number; r: number; b: number } }

/** A stage's name without the yearly growth in it ("after the raise" once
    for every year saving has grown): the stage's growth rate says that. */
function plainLabel(label: string): string {
  const s = label.split(", ").filter((x) => !/^after the raise$/i.test(x)).join(", ");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Saving";
}

/** The plan's saving year by year, from its schedule (children, college,
    saving that grows to its limits), or today's saving to retirement. */
function planYears(R: Results): PlanYear[] {
  const S = R.S;
  if (!S) return [];
  const age = Math.round(S.I.age), end = Math.round(S.retire);
  const sched: { from: number; to: number; monthly: number; label: string; split?: PlanYear["split"] }[] = S.sched?.length ? S.sched : [{ from: age, to: end, monthly: S.monthly, label: "Saving" }];
  const out: PlanYear[] = [];
  for (const s of sched) for (let t = Math.round(s.from); t < Math.round(s.to); t++) out.push({ monthly: s.monthly, label: plainLabel(s.label), ...(s.split ? { split: s.split } : {}) });
  return out;
}

/** The plan's years as stages: a new stage wherever what's going on
    changes, or saving turns from rising to level or back; within one,
    saving grows at the rate that puts the same amount in by retirement. */
function planGroups(years: PlanYear[]) {
  const trend = (i: number) => (i === 0 ? 0 : Math.sign(Math.round(years[i].monthly - years[i - 1].monthly)));
  const groups: { from: number; to: number; label: string }[] = [];
  years.forEach((y, i) => {
    const last = groups[groups.length - 1];
    // A rise into the year counts with the year before it, so a stage that
    // grows starts at its first rise.
    const same = last && last.label === y.label && (i - last.from < 2 || trend(i) === trend(i - 1)) && trend(i) >= 0;
    if (same) last.to = i + 1;
    else groups.push({ from: i, to: i + 1, label: y.label });
  });
  return groups;
}

/** Stages from the plan itself: every change in saving the plan makes
    (children, college years, saving that grows to its limits, both
    employers' match), so the Calculator reaches what the plan has at
    retirement. */
export function stagesFor(pr: Profile, entries: Entry[]): StagesInputs {
  const A = shared(pr, entries), own = A.tradC + A.rothC + A.brokC + A.hsaC;
  const R = results(pr, entries), F = A.F;
  // Both employers' match as one rate on what you put in before taxes and to
  // Roth: the share of every dollar of yours your employers add.
  const matched = own * (own > 0 ? (A.tradC + A.rothC) / own : 0);
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
  const stage = (years: number, y: Pick<PlanYear, "monthly" | "split">, growth: number, name?: string, adj = false): StageInputs => {
    const m = mineOf(y);
    return {
      ...stageFields({ years, contrib: Math.round(m.mine), period: "Monthly", growth: nom(growth), nominal: A.nominal, vol: 0.15, adj, ...m.split }),
      ...(name ? { name } : {}),
    };
  };
  const base: StagesInputs = {
    ...withDefaults(STAGES_DEF, {}),
    initial: g(A.tradBal + A.rothBal + A.brokBal + A.hsaBal), inflation: pc(infl),
    ...(A.target > 0 ? { solveFor: "After-Tax Withdrawal", target: g(A.target) } : {}),
    saOn: true, saTradBal: g(A.tradBal), saRothBal: g(A.rothBal), saBrokBal: g(A.brokBal), saBrokBasis: g(A.brokBal * 0.6), saHsaBal: g(A.hsaBal),
    saSalary: g(F.gross * 12), saMatchPct: matchPct > 0 ? String(+matchPct.toFixed(4)) : "0", saMatchCap: "100", saStatus: A.status, saState: A.state,
    stages: [stage(A.years, { monthly: own + F.match }, 0)],
  };
  // The children, and how their costs are covered, counted from year 0 as the Calculator counts.
  const kids = planKidsOf(pr), withKids = (s: StagesInputs) => (kids ? { ...s, kids, kidCover: shiftCover(pr.kidCover ?? {}, KID_BASE - (ageOf(pr.p1) ?? KID_BASE)) } : s);
  const years = planYears(R);
  if (!years.length) return withKids(base);
  const groups = planGroups(years);
  // Each stage as the plan has it year by year, then as one stage growing
  // at a steady rate, found so the two come to the same at retirement.
  const exact = (gi: number) => groups[gi].label;
  const yearly = groups.flatMap((gr) => years.slice(gr.from, gr.to).map((y) => ({ y, name: gr.label })));
  const value = (stages: StageInputs[]) => stagesCompute({ ...base, stages }, null).R.fvReal;
  const asYears = (from: number) => yearly.slice(from).map((x, i) => stage(1, x.y, 0, x.name, from + i > 0));
  const out: StageInputs[] = [];
  groups.forEach((gr, gi) => {
    const first = years[gr.from], n = gr.to - gr.from, level = years.slice(gr.from, gr.to).every((y) => Math.abs(y.monthly - first.monthly) < 0.5);
    if (level || n < 2) { out.push(stage(n, first, 0, exact(gi), gi > 0)); return; }
    const want = value([...out, ...asYears(gr.from)]);
    let lo = -0.5, hi = 0.5;
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      if (value([...out, stage(n, first, mid, exact(gi), gi > 0), ...asYears(gr.to)]) < want) lo = mid; else hi = mid;
    }
    out.push(stage(n, first, (lo + hi) / 2, exact(gi), gi > 0));
  });
  return withKids({ ...base, stages: out });
}

/** College Savings with each child's years to go and the school chosen. */
export function collegeFor(pr: Profile) {
  const starts = collegeStarts(pr).filter((y) => y >= 0);
  if (!starts.length) return undefined;
  const cost = pr.college.cost, preset = ["27000", "59000", "82000"].includes(String(cost)) ? String(cost) : "0";
  return { ...COLLEGE_DEFAULTS, kids: starts.map((y) => ({ preset, cost: g(cost), years: String(Math.min(25, y)), collegeYrs: "4" })) };
}

