/* The Paycheck tab's saving, carried into Advanced with its savings split
   by account type: what goes into each account (the "You
   add" amounts), on your pay schedule, and the employer match. Balances
   aren't touched; the emergency fund stays behind (it's cash).

   The schedule is your paycheck's: weekly, every two weeks or monthly.
   Twice a month (which the calculators don't offer) comes across as
   monthly, and so do two incomes on different schedules; two incomes on
   the same one keep it. The match: one income brings its terms (salary,
   rate, on the first); two incomes, which the calculators can't hold
   apart, bring combined terms set so the match comes to the same dollars.
   (So does one income short of its match with an IRA beside it: the
   calculators match IRA money too, and the terms as they are would
   overstate it.) Per-account growth rates are left as they are. */
import { dollarsField, groupDigits, parseNum } from "@/lib/format";
import { TAX_DEFAULTS, type TaxInputs } from "@/tools/tax/model";
import { ADVANCED_DEFAULTS, type AdvancedInputs } from "@/tools/advanced/model";
import { paycheckRun, pcSplit, type PcInput, type PcRun } from "./paycheck-math";

const SCHEDULES: Record<number, string> = { 52: "Weekly", 26: "Bi-Weekly", 12: "Monthly" };
const PER: Record<string, number> = { Weekly: 52, "Bi-Weekly": 26, Monthly: 12 };

export interface PcCopy {
  /** The calculators' frequency name, and each account's amount on it. */
  period: string;
  trad: number; roth: number; brok: number; hsa: number;
  /** The match as the calculators take it: salary a year, the rate, and on the first % of salary. */
  salary: number; matchPct: number; matchCap: number;
}

const cents = (v: number) => Math.round(v * 100) / 100;
const centsField = (v: number) => groupDigits(cents(v).toFixed(2), true);
const pctText = (v: number) => String(+v.toFixed(4));

/** What the Paycheck tab saves, account by account, on the schedule it goes over on. */
export function paycheckCopy(pi: PcInput): PcCopy {
  const r = paycheckRun(pi), a = pi.amounts, sp = pcSplit(pi);
  const one = pi.two ? (pi.pays[0] === pi.pays[1] ? pi.pays[0] : 12) : pi.pays[0];
  const period = SCHEDULES[one] ?? "Monthly";
  // Each line is per period (a check, or a month with two incomes): a year of it, then per new period.
  const conv = (v: number) => cents((v * pi.p) / PER[period]);
  const ira = a.rothIra;
  const trad = r.k401 + (pi.roth.rothIra ? 0 : ira), roth = r.roth401 + (pi.roth.rothIra ? ira : 0);
  const salary = pi.gross + pi.gross2, g = [pi.gross, pi.gross2];
  const deferred = [0, 1].map((i) => (sp.match[i] + sp.k401max[i]) * pi.p);
  const eligible = [0, 1].reduce((t, i) => t + Math.min(deferred[i], (pi.match[i].upTo / 100) * g[i]), 0);
  let matchPct = pi.match[0].rate, matchCap = pi.match[0].upTo;
  if (pi.two || (ira > 0 && deferred[0] < (pi.match[0].upTo / 100) * pi.gross)) {
    // Combined terms: the share of pay the match is on, at the rate that gives the same dollars.
    matchCap = salary > 0 && eligible > 0 ? (eligible / salary) * 100 : 0;
    matchPct = eligible > 0 ? ((r.match * pi.p) / eligible) * 100 : 0;
  }
  return { period, trad: conv(trad), roth: conv(roth), brok: conv(a.brok), hsa: conv(a.hsa), salary, matchPct, matchCap };
}

const filled = (...v: string[]) => v.some((x) => parseNum(x) > 0);

/** Whether Advanced already has saving of its own the copy would replace. */
export function advancedHasSaving(s: AdvancedInputs): boolean {
  if (filled(s.tradC, s.rothC, s.brokC, s.hsaC, s.matchPct)) return true;
  return !s.acOn && parseNum(s.contrib) > 0 && parseNum(s.contrib) !== parseNum(ADVANCED_DEFAULTS.contrib);
}

/** Retirement tax settings for an account split turned on here, as the
    household's, else the paycheck's). */
export interface TaxSeed { status: string; state: string }

/** Advanced with the copy in. A split turned on here starts from the
    single starting value, as Advanced's own switch does. */
export function intoAdvanced(s: AdvancedInputs, c: PcCopy, t: TaxSeed): AdvancedInputs {
  const blank = !filled(s.tradBal, s.rothBal, s.brokBal, s.hsaBal);
  const start = !s.acOn && blank
    ? { tradBal: dollarsField(parseNum(s.initial)), rothBal: "0", brokBal: "0", hsaBal: "0", brokBasis: "", acStatus: t.status, acState: t.state } : {};
  return {
    ...s, ...start, acOn: true, period: c.period,
    tradC: centsField(c.trad), rothC: centsField(c.roth), brokC: centsField(c.brok), hsaC: centsField(c.hsa),
    salary: dollarsField(c.salary), matchPct: pctText(c.matchPct), matchCap: pctText(c.matchCap),
  };
}

/** Income Tax, filled in from the paycheck: the pay and the pre-tax
    deductions by kind, a year of each (a traditional IRA among them). Roth
    and after-tax saving don't change the tax, so they stay on the paycheck.
    With two incomes, each person's lines go to their own column. */
export function taxFromPaycheck(cur: TaxInputs, pi: PcInput, r: PcRun): TaxInputs {
  const two = pi.two;
  const yr = (v: number) => groupDigits(String(cents(v * pi.p)), true);
  const health = r.healths;
  const ira = pi.roth.rothIra ? [0, 0] : pcSplit(pi).rothIra;
  return {
    ...cur, mode: "normal", view: "net", gross: dollarsField(pi.gross), gross2: two ? dollarsField(pi.gross2) : "0",
    status: pi.status, state: pi.state, itemize: true, year: TAX_DEFAULTS.year,
    // To the cent, so Income Tax shows the same tax as the stub.
    k401: yr(r.k401s[0]), ira: yr(ira[0]), hsa: yr(r.hsas[0]), health: yr(health[0]), dother: "0",
    k4012: yr(r.k401s[1]), ira2: yr(ira[1]), hsa2: yr(r.hsas[1]), health2: yr(health[1]), dother2: "0",
    pre: yr(r.k401 + r.hsa + r.health + ira[0] + ira[1]),
    // Its pop-up shows them per paycheck on this schedule, or per month with two incomes.
    preUnits: two ? "month,year,month,month,year" : "check,year,check,check,year", prePay: String(pi.pays[0]),
  };
}
