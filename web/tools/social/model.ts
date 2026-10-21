/* The Social Security Calculator's inputs, and every figure the page reads
   from them: each person's full retirement age and benefit (from a
   statement, or estimated from a career of pay), the household's checks at
   every claiming age, where the choices cross, which age wins for each
   lifespan, and for a couple every pair of claiming ages
   (lib/engine/math.js, the claiming section). */
import type { ToolDef } from "@/components/tools/ToolState";
import { NEWEST_YEAR, SS_AWI, ssBreakEven, ssClaimFactor, ssFRA, ssHousehold, ssPiaFromEarnings, ssTaxable, yearData } from "@/lib/engine/typed";
import type { SsHousehold, SsHouseholdInput } from "@/lib/engine/types";
import { groupDigits, parseNum } from "@/lib/format";

export const CLAIM_AGES = [62, 63, 64, 65, 66, 67, 68, 69, 70] as const;

/* One person's inputs, as typed. `src` is where the benefit comes from:
   "pay" estimates it from a career, "statement" takes the figure on the
   Social Security statement. Raises are above wage growth, a year. `edits`
   are years of pay set by hand, by age, in today's dollars. */
const personDefaults = (birth: string, pay: number, pia: number, start: string, stop: string, through: string) => ({
  birth, src: "pay" as "pay" | "statement", pay: groupDigits(pay, true), pia: groupDigits(pia, true),
  start, stop, claim: "67", through, earn: "0", gPast: "2", gAhead: "1", edits: {} as Record<string, string>,
});

export const SOCIAL_DEFAULTS = {
  status: "s" as "s" | "m",
  you: personDefaults("1990", 85000, 2400, "22", "67", "90"),
  spouse: personDefaults("1992", 55000, 1500, "24", "65", "92"),
  /** Other taxable income a year in retirement, for how much of the
      benefit is taxed. */
  other: groupDigits(40000, true),
};
export type SocialInputs = typeof SOCIAL_DEFAULTS;
export type PersonInputs = SocialInputs["you"];
export type Who = "you" | "spouse";

export const SOCIAL_DEF: ToolDef<SocialInputs> = { id: "social", label: "Social Security", noun: "Social Security plan", defaults: SOCIAL_DEFAULTS };

const clampAge = (v: string, lo: number, hi: number, dflt: number) => {
  const n = parseNum(v);
  return n > 0 ? Math.max(lo, Math.min(hi, Math.round(n))) : dflt;
};

export interface CareerYear {
  age: number; year: number;
  /** What the year counts as, in today's wages (past pay indexed). */
  pay: number;
  /** What was earned that year, as paid: the same as `pay` from this year on. */
  earned: number;
  /** Set by hand. */
  edited: boolean;
  /** Before this year, or this year. */
  past: boolean; now: boolean;
  /** Among the best 35 years the benefit counts. */
  counted: boolean;
}

/** How much a year's earnings grow when Social Security indexes them to
    wage levels: the average wage index two years before the data year
    (the year the bend points were set from) over that year's. Years after
    the index year count as paid, as SSA counts them. */
export function wageIndex(year: number): number {
  const base = NEWEST_YEAR - 2, years = Object.keys(SS_AWI).map(Number);
  const first = Math.min(...years);
  if (year >= base || !SS_AWI[base]) return 1;
  return SS_AWI[base] / SS_AWI[Math.max(first, year)];
}

/** Pay at every age of a career. Before this year, each year is today's
    pay walked back at the past raise (in today's wages), and a year set by
    hand is what was earned that year, as paid, indexed to today's wages;
    it stands alone, like a line of an earnings record. This year is
    today's pay. After it, each year is the year before plus the raise
    ahead, in today's dollars, so a year set by hand (a promotion, a cut)
    carries forward and the raises continue from it. */
export function careerYears(p: PersonInputs, ageNow: number): CareerYear[] {
  const start = clampAge(p.start, 14, 70, 22), stop = Math.max(start + 1, clampAge(p.stop, 15, 80, 67));
  const payNow = Math.max(0, parseNum(p.pay)), gPast = parseNum(p.gPast) / 100, gAhead = parseNum(p.gAhead) / 100;
  const out: CareerYear[] = [];
  let prev: number | null = null;
  for (let age = start; age < stop; age++) {
    const d = age - ageNow, e = p.edits[String(age)], hand = e != null && e !== "";
    let pay: number, earned: number | null = null;
    if (d < 0) {
      const f = wageIndex(NEWEST_YEAR + d);
      if (hand) { earned = Math.max(0, parseNum(e)); pay = earned * f; }
      else { pay = payNow / Math.pow(1 + gPast, -d); earned = pay / f; }
    }
    else if (d === 0) pay = payNow;
    else pay = hand ? parseNum(e) : (prev ?? payNow * Math.pow(1 + gAhead, d - 1)) * (1 + gAhead);
    pay = Math.max(0, pay);
    prev = pay;
    out.push({ age, year: NEWEST_YEAR + d, pay, earned: earned ?? pay, edited: hand && d !== 0, past: d < 0, now: d === 0, counted: false });
  }
  // The best 35 years count, each capped at the wage base.
  const cap = yearData().fica.ssCap;
  out.map((y, i) => i).sort((a, b) => Math.min(out[b].pay, cap) - Math.min(out[a].pay, cap)).slice(0, 35)
    .forEach((i) => { if (out[i].pay > 0) out[i].counted = true; });
  return out;
}

export interface Person {
  birth: number; fra: number; ageNow: number;
  /** The benefit at full retirement age, a month. */
  pia: number;
  claim: number; through: number; earn: number;
  /** The career behind an estimate; null when the benefit is the statement's. */
  career: CareerYear[] | null;
  /** The estimate's average indexed monthly earnings and years counted. */
  aime: number; years: number;
}

function person(p: PersonInputs, dfltBirth: number): Person {
  const birth = clampAge(p.birth, 1930, NEWEST_YEAR - 16, dfltBirth);
  const fra = ssFRA(birth), ageNow = NEWEST_YEAR - birth;
  const claim = clampAge(p.claim, 62, 70, 67);
  const through = Math.max(claim + 1, clampAge(p.through, 63, 110, 90));
  let pia = Math.max(0, parseNum(p.pia)), career: CareerYear[] | null = null, aime = 0, years = 0;
  if (p.src === "pay") {
    career = careerYears(p, ageNow);
    const r = ssPiaFromEarnings(career.map((y) => y.pay));
    pia = r.pia; aime = r.aime; years = r.years;
  }
  return { birth, fra, ageNow, pia, claim, through, earn: Math.max(0, parseNum(p.earn)), career, aime, years };
}

export interface AgeRow {
  age: number;
  /** Your check as a share of the full benefit. */
  factor: number;
  /** Your own check, a month, claiming at this age. */
  own: number;
  /** The household's checks a month once both have claimed: yours and your
      top-up, then your spouse's. */
  mine: number; theirs: number; monthly: number;
  /** All the checks through the ages planned to. */
  total: number;
}

export interface Social {
  married: boolean;
  you: Person; spouse: Person | null;
  /** The spouse's age minus yours. */
  gap: number;
  other: number;
  /** The household with the ages chosen. */
  H: SsHousehold;
  rows: AgeRow[];
  best: AgeRow; chosen: AgeRow;
  /** The household's checks a month once both have claimed. */
  monthly: number; monthlyYou: number; monthlySpouse: number;
  /** What the longer-lived spouse keeps: the larger own check, credits for
      waiting included (the engine's survivor rule). */
  survivor: number;
  taxedShare: number;
  /** Your claiming age that collects the most, for each age you might live
      to: runs of ages each claiming age wins, in order. */
  wins: { claim: number; from: number; to: number }[];
  /** Where your own check's choices cross. */
  breakEvens: { a: number; b: number; at: number | null }[];
  /** A couple's total for every pair of claiming ages (yours by row). */
  pairs: { grid: number[][]; best: { you: number; spouse: number; total: number }; chosen: number; min: number } | null;
}

export function social(s: SocialInputs): Social {
  const married = s.status === "m";
  const you = person(s.you, 1990), spouse = married ? person(s.spouse, 1992) : null;
  const gap = spouse ? you.birth - spouse.birth : 0;
  const hh = (c1 = you.claim, c2 = spouse?.claim ?? 67, t1 = you.through): SsHousehold => {
    const o: SsHouseholdInput = { pia1: you.pia, fra1: you.fra, claim1: c1, through1: t1, earn1: you.earn, married };
    if (spouse) Object.assign(o, { pia2: spouse.pia, fra2: spouse.fra, claim2: c2, through2: spouse.through, earn2: spouse.earn, gap });
    return ssHousehold(o);
  };
  const H = hh();
  const rows: AgeRow[] = CLAIM_AGES.map((age) => {
    const h = hh(age);
    const mine = h.you.monthly + h.top1, theirs = h.spouse ? h.spouse.monthly + h.top2 : 0;
    return { age, factor: ssClaimFactor(age, you.fra), own: you.pia * ssClaimFactor(age, you.fra), mine, theirs, monthly: mine + theirs, total: h.total };
  });
  const best = rows.reduce((b, r) => (r.total > b.total + 1e-6 ? r : b), rows[0]);
  const chosen = rows.find((r) => r.age === you.claim)!;
  const monthlyYou = H.you.monthly + H.top1, monthlySpouse = H.spouse ? H.spouse.monthly + H.top2 : 0;
  const monthly = monthlyYou + monthlySpouse;
  const other = Math.max(0, parseNum(s.other));
  const taxedShare = monthly > 0 ? ssTaxable(monthly * 12, other, married ? "m" : "s").taxable / (monthly * 12) : 0;

  const wins: Social["wins"] = [];
  for (let t = 70; t <= 100; t++) {
    let bestA = 62, bestT = -1;
    for (const a of CLAIM_AGES) {
      if (a >= t) break;
      const tt = hh(a, spouse?.claim, t).total;
      if (tt > bestT + 1e-6) { bestT = tt; bestA = a; }
    }
    const last = wins[wins.length - 1];
    if (last && last.claim === bestA) last.to = t;
    else wins.push({ claim: bestA, from: t, to: t });
  }

  const ben = (a: number) => you.pia * ssClaimFactor(a, you.fra) * 12;
  const fraR = Math.round(you.fra);
  const breakEvens = ([[62, fraR], [fraR, 70], [62, 70]] as [number, number][]).filter(([a, b]) => b > a)
    .map(([a, b]) => ({ a, b, at: ssBreakEven(a, ben(a), b, ben(b)) }));

  let pairs: Social["pairs"] = null;
  if (spouse) {
    const grid = CLAIM_AGES.map((a) => CLAIM_AGES.map((b) => hh(a, b).total));
    let bi = 0, bj = 0;
    grid.forEach((row, i) => row.forEach((t, j) => { if (t > grid[bi][bj] + 1e-6) { bi = i; bj = j; } }));
    pairs = { grid, best: { you: CLAIM_AGES[bi], spouse: CLAIM_AGES[bj], total: grid[bi][bj] },
      chosen: grid[CLAIM_AGES.indexOf(you.claim as (typeof CLAIM_AGES)[number])][CLAIM_AGES.indexOf(spouse.claim as (typeof CLAIM_AGES)[number])],
      min: Math.min(...grid.flat()) };
  }

  return {
    married, you, spouse, gap, other, H, rows, best, chosen, monthly, monthlyYou, monthlySpouse,
    survivor: H.spouse ? Math.max(H.you.laterMonthly, H.spouse.laterMonthly) : 0,
    taxedShare, wins, breakEvens, pairs,
  };
}

/** Your own checks added up from claiming at `age`, by age, to `to`. */
export function cumulative(p: Person, age: number, to: number): { year: number; value: number }[] {
  const annual = p.pia * ssClaimFactor(age, p.fra) * 12, pts: { year: number; value: number }[] = [];
  for (let x = 62, c = 0; x <= to; x++) { pts.push({ year: x - 62, value: c }); if (x >= age) c += annual; }
  return pts;
}

/** What the Drawdown Simulator takes from this tool: each person's yearly
    benefit once both have claimed (today's dollars, any spousal top-up
    included), and the claiming ages. */
export function forDrawdown(s: SocialInputs): { couple: boolean; annual: number; annual2: number; claim: number; claim2: number } {
  const S = social(s);
  return {
    couple: S.married,
    annual: Math.round((S.H.you.laterMonthly + S.H.top1) * 12),
    annual2: S.H.spouse ? Math.round((S.H.spouse.laterMonthly + S.H.top2) * 12) : 0,
    claim: S.you.claim, claim2: S.spouse?.claim ?? S.you.claim,
  };
}

/** "67" or "66 and 8 months". */
export function fraLabel(fra: number): string {
  const months = Math.round((fra % 1) * 12);
  return months ? `${Math.floor(fra)} and ${months} months` : String(fra);
}

/** The wage base and bend points, for the explanations. */
export function ssRules(): { cap: number; bend1: number; bend2: number; earnLimit: number } {
  const Y = yearData();
  return { cap: Y.fica.ssCap, bend1: Y.ss.bend1, bend2: Y.ss.bend2, earnLimit: Y.ss.earn.under };
}
