/* The Social Security Claiming tool's inputs, and the figures the page
   reads from them: each person's full retirement age and benefit, the
   household's benefits for the claiming ages chosen, every other claiming
   age beside them, where the choices cross, and the claim-early-and-invest
   test across market history (lib/engine/math.js, the claiming section). */
import type { ToolDef } from "@/components/tools/ToolState";
import { NEWEST_YEAR, ssBreakEven, ssClaimFactor, ssFRA, ssHousehold, ssInvestEarly, ssPiaFromEarnings, ssTaxable } from "@/lib/engine/typed";
import type { SsHousehold, SsHouseholdInput, SsInvest } from "@/lib/engine/types";
import { groupDigits, parseNum } from "@/lib/format";

/** How a person's pay runs over a career, for the estimate: the ages they
    started and will stop, raises above wage growth so far and ahead (a
    year), and any ages whose pay was set by hand (today's dollars). */
export interface Career { start: string; stop: string; growPast: string; growAhead: string; edits: Record<string, string> }
export const CAREER_DEFAULT: Career = { start: "22", stop: "67", growPast: "2", growAhead: "1", edits: {} };

export const SOCIAL_DEFAULTS = {
  status: "s" as "s" | "m",
  /** You: birth year, how the benefit is given (the statement's figure at
      full retirement age, or an estimate from income and years worked),
      the claiming age, the age planned through, and earnings a year while
      claiming before full retirement age. */
  birth1: "1964", src1: "statement" as "statement" | "estimate", pia1: groupDigits(2400, true), inc1: groupDigits(85000, true), career1: CAREER_DEFAULT as Career,
  claim1: "67", through1: "90", earn1: "0",
  birth2: "1966", src2: "statement" as "statement" | "estimate", pia2: groupDigits(1500, true), inc2: groupDigits(55000, true), career2: CAREER_DEFAULT as Career,
  claim2: "67", through2: "92", earn2: "0",
  /** Other taxable income a year in retirement, for how much of the
      benefit is taxed. */
  other: groupDigits(40000, true),
  /** The claim-early-and-invest test: the two ages compared and the stock
      share the checks are invested at. */
  early: "62", late: "70", mix: "60",
};
export type SocialInputs = typeof SOCIAL_DEFAULTS;

export const SOCIAL_DEF: ToolDef<SocialInputs> = { id: "social", label: "Social Security", noun: "claiming plan", defaults: SOCIAL_DEFAULTS };

export const CLAIM_AGES = [62, 63, 64, 65, 66, 67, 68, 69, 70] as const;

const clampAge = (v: string, lo: number, hi: number, dflt: number) => {
  const n = parseNum(v);
  return n > 0 ? Math.max(lo, Math.min(hi, Math.round(n))) : dflt;
};

export interface Person {
  birth: number; fra: number; pia: number; claim: number; through: number; earn: number;
  /** The benefit came from an estimate, not a statement. */
  estimated: boolean;
  /** Age this year (the data's year), for the career model. */
  ageNow: number;
  /** The pay by age the estimate used, today's dollars. */
  career: CareerYear[] | null;
}

export interface CareerYear { age: number; year: number; pay: number; edited: boolean }

/** Pay at every age from the start of a career to the year before it ends,
    in today's dollars: today's pay walked back at the past raise and
    forward at the one ahead, with any age set by hand taking its own
    figure. The year is the calendar year. */
export function careerYears(c: Career, ageNow: number, incomeNow: number): CareerYear[] {
  const start = clampAge(c.start, 14, 70, 22), stop = Math.max(start + 1, clampAge(c.stop, 15, 80, 67));
  const gPast = parseNum(c.growPast) / 100, gAhead = parseNum(c.growAhead) / 100;
  const out: CareerYear[] = [];
  for (let age = start; age < stop; age++) {
    const d = age - ageNow;
    const pattern = d < 0 ? incomeNow / Math.pow(1 + gPast, -d) : incomeNow * Math.pow(1 + gAhead, d);
    const edit = c.edits[String(age)];
    const edited = edit != null && edit !== "";
    out.push({ age, year: NEWEST_YEAR + d, pay: Math.max(0, edited ? parseNum(edit) : pattern), edited });
  }
  return out;
}

/** The benefit at full retirement age a career's pay earns. */
export function careerPia(years: CareerYear[]): { pia: number; aime: number; years: number } {
  return ssPiaFromEarnings(years.map((y) => y.pay));
}

/* As the engine takes them. A blank or senseless field takes its default;
   the age planned through is at least a year past the claiming age. */
function person(s: SocialInputs, k: "1" | "2"): Person {
  const birth = clampAge(s[`birth${k}`], 1930, NEWEST_YEAR - 18, k === "1" ? 1964 : 1966);
  const fra = ssFRA(birth);
  const estimated = s[`src${k}`] === "estimate";
  const ageNow = NEWEST_YEAR - birth;
  const career = estimated ? careerYears(s[`career${k}`] ?? CAREER_DEFAULT, ageNow, Math.max(0, parseNum(s[`inc${k}`]))) : null;
  const pia = career ? careerPia(career).pia : Math.max(0, parseNum(s[`pia${k}`]));
  const claim = clampAge(s[`claim${k}`], 62, 70, 67);
  const through = Math.max(claim + 1, clampAge(s[`through${k}`], 63, 110, 90));
  return { birth, fra, pia, claim, through, earn: Math.max(0, parseNum(s[`earn${k}`])), estimated, ageNow, career };
}

export interface SocialPlan {
  married: boolean;
  you: Person; spouse: Person | null;
  /** The spouse's age minus yours. */
  gap: number;
  other: number; early: number; late: number; mix: number;
}

export function socialInput(s: SocialInputs): SocialPlan {
  const married = s.status === "m";
  const you = person(s, "1"), spouse = married ? person(s, "2") : null;
  const early = clampAge(s.early, 62, 69, 62);
  return {
    married, you, spouse, gap: spouse ? you.birth - spouse.birth : 0,
    other: Math.max(0, parseNum(s.other)),
    early, late: Math.max(early + 1, clampAge(s.late, 63, 70, 70)),
    mix: Math.max(0, Math.min(1, parseNum(s.mix) / 100)),
  };
}

/** The household's benefits with you claiming at `claim1` (the spouse as set). */
export function household(p: SocialPlan, claim1 = p.you.claim, claim2 = p.spouse?.claim): SsHousehold {
  const o: SsHouseholdInput = { pia1: p.you.pia, fra1: p.you.fra, claim1, through1: p.you.through, earn1: p.you.earn, married: p.married };
  if (p.spouse) Object.assign(o, { pia2: p.spouse.pia, fra2: p.spouse.fra, claim2: claim2 ?? p.spouse.claim, through2: p.spouse.through, earn2: p.spouse.earn, gap: p.gap });
  return ssHousehold(o);
}

export interface AgeRow {
  age: number;
  /** Each person's own monthly benefit claiming at this age. */
  you: number; spouse: number;
  /** The household's lifetime benefits with you claiming at this age. */
  lifetime: number;
  /** And with the spouse claiming at this age (you as set). */
  lifetimeSpouse: number;
}

/** Every claiming age from 62 to 70, and the best one for each of you by
    lifetime benefits. */
export function ageRows(p: SocialPlan): { rows: AgeRow[]; best1: number; best2: number } {
  const rows = CLAIM_AGES.map((age) => ({
    age,
    you: p.you.pia * ssClaimFactor(age, p.you.fra),
    spouse: p.spouse ? p.spouse.pia * ssClaimFactor(age, p.spouse.fra) : 0,
    lifetime: household(p, age).total,
    lifetimeSpouse: p.spouse ? household(p, p.you.claim, age).total : 0,
  }));
  const best1 = rows.reduce((b, r) => (r.lifetime > b.lifetime ? r : b), rows[0]).age;
  const best2 = p.spouse ? rows.reduce((b, r) => (r.lifetimeSpouse > b.lifetimeSpouse ? r : b), rows[0]).age : 0;
  return { rows, best1, best2 };
}

/** Where your own benefit's choices cross: 62 against full retirement age,
    full retirement age against 70, and 62 against 70. */
export function breakEvens(p: Person): { a: number; b: number; at: number | null }[] {
  const ben = (age: number) => p.pia * ssClaimFactor(age, p.fra) * 12;
  const fra = Math.round(p.fra * 12) / 12;
  const pairs: [number, number][] = fra > 62 && fra < 70 ? [[62, fra], [fra, 70], [62, 70]] : [[62, 70]];
  return pairs.map(([a, b]) => ({ a, b, at: ssBreakEven(a, ben(a), b, ben(b)) }));
}

/** Which of your claiming ages pays the most in all, for each age you
    might live to: the runs of ages each claiming age wins, in order. */
export function winsByLifespan(p: SocialPlan): { claim: number; from: number; to: number }[] {
  const out: { claim: number; from: number; to: number }[] = [];
  for (let through = 70; through <= 100; through++) {
    const q: SocialPlan = { ...p, you: { ...p.you, through } };
    let best = 62, bestTotal = -1;
    for (const age of CLAIM_AGES) {
      if (age >= through) break;
      const t = household(q, age).total;
      if (t > bestTotal + 1e-6) { bestTotal = t; best = age; }
    }
    const last = out[out.length - 1];
    if (last && last.claim === best) last.to = through;
    else out.push({ claim: best, from: through, to: through });
  }
  return out;
}

/** The claim-early-and-invest test on your own benefit. */
export function investEarly(p: SocialPlan): SsInvest & { benEarly: number; benLate: number } {
  const benEarly = p.you.pia * ssClaimFactor(p.early, p.you.fra) * 12;
  const benLate = p.you.pia * ssClaimFactor(p.late, p.you.fra) * 12;
  return { ...ssInvestEarly({ early: p.early, late: p.late, benEarly, benLate, through: p.you.through, mix: p.mix }), benEarly, benLate };
}

/** How much of a year's benefits is taxed, with the other income entered. */
export function taxedShare(p: SocialPlan, annual: number): number {
  if (!(annual > 0)) return 0;
  return ssTaxable(annual, p.other, p.married ? "m" : "s").taxable / annual;
}

/** "67" or "66 and 8 months". */
export function fraLabel(fra: number): string {
  const months = Math.round((fra % 1) * 12);
  return months ? `${Math.floor(fra)} and ${months} months` : String(fra);
}
