/* Split by account type, for Advanced and Stages. The split doesn't change
   how anything grows: every account earns the same return on the same
   contribution schedule, so the plan's total is the sum of the parts. What
   it changes is the tax: the first year's withdrawal is run through the
   Income Tax tool's retirement engine instead of a flat typed-in rate.
   Ported from src/js/app/02-accounts-advanced.js. */
import { fvFactors, retireTax, PER_YEAR } from "@/lib/engine/typed";
import type { Plan, RetireTax } from "@/lib/engine/types";
import type { Household } from "@/lib/household";

export interface GrowthRates { t: number; r: number; b: number }

/** The accounts as entered: balances, what you add each period, the match. */
export interface Accounts {
  tradBal: number; tradC: number; rothBal: number; rothC: number; brokBal: number; brokC: number;
  brokBasis: number | null; salary: number; matchPct: number; matchCap: number;
  status: string; state: string; gRates?: GrowthRates;
}

/** The accounts at retirement, in today's dollars, and the tax on the first
    year's withdrawal from them. */
export interface AccountResult {
  a: Accounts;
  real: { trad: number; roth: number; brok: number };
  totalReal: number;
  w: { trad: number; roth: number; brok: number; gainPct: number };
  wTotal: number; gainPct: number; seniors: number; tax: RetireTax; effRate: number;
  shares: { trad: number; roth: number; brok: number };
  match?: number; matchTotal: number; perDollar?: number; rothIn?: number; years?: number;
}


/* The employer matches matchPct% of what you put into the workplace plan,
   on your contributions up to matchCap% of salary -- "50% on the first 6%"
   tops out at 3% of salary. Traditional and Roth contributions both count
   toward it; the match itself always lands in traditional. */
export function matchPer(a: Accounts, ppy: number): number {
  if (!(a.salary > 0) || !(a.matchPct > 0)) return 0;
  const eligible = Math.min(a.tradC + a.rothC, a.salary * a.matchCap / 100 / ppy);
  return Math.max(0, eligible * a.matchPct / 100);
}

/* 65+ at retirement earns the extra standard deduction and the senior bonus.
   The calculators have no age of their own, so this reads it off the
   household profile and assumes under 65 when there isn't one. */
export function seniorsAt(a: Accounts, years: number, h: Household | null): number {
  if (!h || !(h.age! > 0)) return 0;
  let n = h.age! + years >= 65 ? 1 : 0;
  if (a.status === "m" && h.status === "m" && h.spouseAge! > 0 && h.spouseAge! + years >= 65) n++;
  return n;
}

function taxOn(a: Accounts, w: AccountResult["w"], seniors: number): RetireTax {
  return retireTax({ status: a.status, seniors, trad: w.trad, roth: w.roth, brok: w.brok,
    gainPct: w.gainPct, ss: 0, pension: 0, penPublic: false, other: 0, pre: 0,
    dedType: "std", item: 0, state: a.state, _noMarginal: true });
}

/* Contribution growth by account. Everything downstream runs on one
   contribution stream with one growth rate; the blend is the rate at which
   the combined contribution ends at exactly the same balance as the three
   accounts each growing at their own. `w` is each account's share (or
   amount) of your contribution; any employer match grows at the blend. */
export function growthBlend(p: Plan, years: number, w: GrowthRates, g: GrowthRates): number {
  const ann = (x: number) => fvFactors({ ...p, growth: x }, years).annuity;
  const W = w.t + w.r + w.b;
  if (!(W > 0)) return (g.t + g.r + g.b) / 3;
  const target = (w.t * ann(g.t) + w.r * ann(g.r) + w.b * ann(g.b)) / W;
  let lo = Math.min(g.t, g.r, g.b), hi = Math.max(g.t, g.r, g.b);
  if (hi - lo < 1e-12) return lo;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (ann(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Each account's ending balance for a single plan, and the tax on it. */
export function accountBreakdown(p: Plan, a: Accounts, seniors: number): AccountResult {
  const ppy = PER_YEAR[p.period];
  const match = matchPer(a, ppy);
  const F = fvFactors(p, p.years);
  const gr = a.gRates || { t: p.growth, r: p.growth, b: p.growth };
  const ann = (x: number) => (x === p.growth ? F.annuity : fvFactors({ ...p, growth: x }, p.years).annuity);
  const fvT = a.tradBal * F.initFactor + a.tradC * ann(gr.t) + match * F.annuity;
  const fvR = a.rothBal * F.initFactor + a.rothC * ann(gr.r);
  const fvB = a.brokBal * F.initFactor + a.brokC * ann(gr.b);
  // Dollars a $1-per-period schedule puts in, stepping up once a year: the
  // brokerage basis grows by exactly this times the brokerage contribution.
  const dollarsIn = (x: number) => {
    let d = 0;
    for (let y = 1; y * ppy - ppy < F.n; y++) d += Math.min(ppy, F.n - (y - 1) * ppy) * Math.pow(1 + x, y - 1);
    return d;
  };
  const perDollar = dollarsIn(p.growth);
  const basis0 = a.brokBasis == null ? a.brokBal : a.brokBasis;
  const inflYears = p.inflYears == null || p.inflYears === "" ? p.years : p.inflYears;
  return {
    ...finishAccounts(a, { trad: fvT, roth: fvR, brok: fvB }, basis0 + a.brokC * dollarsIn(gr.b),
      Math.pow(1 + p.inflation, inflYears), p.withdrawal, seniors),
    match, matchTotal: match * perDollar, perDollar, rothIn: a.rothC * dollarsIn(gr.r),
  };
}

/* Shared by Advanced and Stages once each has its accounts' ending balances:
   today's dollars, the first year's withdrawal split pro rata, and the tax on
   it. `fv` is in future dollars, `defl` converts to today's. */
export function finishAccounts(a: Accounts, fv: { trad: number; roth: number; brok: number }, basisEnd: number,
  defl: number, withdrawal: number, seniors: number): AccountResult {
  const gainPct = fv.brok > 0 ? Math.max(0, Math.min(1, 1 - basisEnd / fv.brok)) : 0;
  const real = { trad: fv.trad / defl, roth: fv.roth / defl, brok: fv.brok / defl };
  const totalReal = real.trad + real.roth + real.brok;
  const w = { trad: real.trad * withdrawal, roth: real.roth * withdrawal, brok: real.brok * withdrawal, gainPct };
  const wTotal = w.trad + w.roth + w.brok;
  const tax = taxOn(a, w, seniors);
  return {
    a, real, totalReal, w, wTotal, gainPct, seniors, tax, matchTotal: 0,
    effRate: wTotal > 0 ? tax.total / wTotal : 0,
    shares: totalReal > 0
      ? { trad: real.trad / totalReal, roth: real.roth / totalReal, brok: real.brok / totalReal }
      : { trad: 1, roth: 0, brok: 0 },
  };
}

/* The headline tax rate comes from the income the plan produces. An
   after-tax income target is a different income, taxed at a different rate
   on a progressive schedule, so the solve finds the gross withdrawal whose
   after-tax amount is the target: same account mix, same rules. */
export function targetRate(B: AccountResult, target: number, fallback: number): number {
  if (!(target > 0)) return fallback;
  const s = B.shares;
  const net = (G: number) => G - taxOn(B.a, { trad: G * s.trad, roth: G * s.roth, brok: G * s.brok, gainPct: B.gainPct }, B.seniors).total;
  let lo = target, hi = target * 2;
  while (net(hi) < target && hi < target * 64) hi *= 2;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (net(mid) < target) lo = mid;
    else hi = mid;
  }
  return 1 - target / hi;
}

/* Solves and the converter hand back one total per period. It's spread over
   the accounts you're already paying into, in the same proportions, with
   the match following; the match is capped, so the scale is found by
   bisection rather than a straight divide. */
export function spreadTotal(a: Accounts, ppy: number, total: number): { trad: number; roth: number; brok: number } {
  let base = { trad: a.tradC, roth: a.rothC, brok: a.brokC };
  if (base.trad + base.roth + base.brok <= 0) base = { trad: 1, roth: 0, brok: 0 };
  const at = (k: number) => {
    const b = { ...a, tradC: base.trad * k, rothC: base.roth * k, brokC: base.brok * k };
    return b.tradC + b.rothC + b.brokC + matchPer(b, ppy);
  };
  let lo = 0, hi = 1;
  while (at(hi) < total && hi < 1e9) hi *= 2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid) < total) lo = mid;
    else hi = mid;
  }
  return { trad: base.trad * hi, roth: base.roth * hi, brok: base.brok * hi };
}
