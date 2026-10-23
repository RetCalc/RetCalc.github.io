/* The calculators filled in from the Dashboard: Advanced and Stages with
   the accounts, the saving by account, the match, the assumptions and the
   years to retirement; Stages also with the children, as its "Planning for
   kids?" builds them; College Savings with each child's years to go. */

import { withDefaults } from "@/components/tools/ToolState";
import { groupDigits } from "@/lib/format";
import { ADVANCED_DEF, type AdvancedInputs } from "@/tools/advanced/model";
import { STAGES_DEF, stageFields, type StagesInputs } from "@/tools/stages/model";
import { stagesFromKidsYears } from "@/tools/stages/kids";
import { NO_KIDS, type PlanKids } from "@/tools/plan/model";
import { COLLEGE_DEFAULTS } from "@/tools/college/model";
import { flow, growthLines, taxState } from "./flows";
import { ageOf, collegeStarts, couple, holdings, realGrowth, spendMonth } from "./model";
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
  return { ...NO_KIDS, now, planned: pr.planned.count, firstIn: pr.planned.firstIn, spacing: pr.planned.spacing, childcare: pr.childcare, area: pr.careArea };
}

/** Stages from the profile: one stage to retirement, then, with children,
    the stages their costs make. */
export function stagesFor(pr: Profile, entries: Entry[]): StagesInputs {
  const A = shared(pr, entries), own = A.tradC + A.rothC + A.brokC + A.hsaC;
  const base: StagesInputs = {
    ...withDefaults(STAGES_DEF, {}),
    initial: g(A.tradBal + A.rothBal + A.brokBal + A.hsaBal), inflation: pc(pr.assume.inflation),
    ...(A.target > 0 ? { solveFor: "After-Tax Withdrawal", target: g(A.target) } : {}),
    saOn: true, saTradBal: g(A.tradBal), saRothBal: g(A.rothBal), saBrokBal: g(A.brokBal), saBrokBasis: g(A.brokBal * 0.6), saHsaBal: g(A.hsaBal),
    saSalary: g(A.salary), saMatchPct: A.matchPct, saMatchCap: A.matchCap, saStatus: A.status, saState: A.state,
    stages: [stageFields({
      years: A.years, contrib: Math.round(own), period: "Monthly", growth: (A.rates.t + A.rates.r + A.rates.b) / 3, nominal: A.nominal, vol: 0.15,
      ...(own > 0 ? { sTrad: A.tradC / own, sRoth: A.rothC / own, sHsa: A.hsaC / own } : {}),
    })],
  };
  const kids = planKidsOf(pr);
  return kids ? { ...base, stages: stagesFromKidsYears(base, kids, {}).stages, kids, kidCover: {} } : base;
}

/** College Savings with each child's years to go and the school chosen. */
export function collegeFor(pr: Profile) {
  const starts = collegeStarts(pr).filter((y) => y >= 0);
  if (!starts.length) return undefined;
  const cost = pr.college.cost, preset = ["27000", "59000", "82000"].includes(String(cost)) ? String(cost) : "0";
  return { ...COLLEGE_DEFAULTS, kids: starts.map((y) => ({ preset, cost: g(cost), years: String(Math.min(25, y)), collegeYrs: "4" })) };
}
