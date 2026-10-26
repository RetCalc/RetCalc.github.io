/* Where the Dashboard's numbers meet the tools. Income, Taxes, Spending and
   Savings are the Budget tool's Paycheck (pay, health premiums, the match,
   the saving sliders, the budget's lines) and the Income Tax tool, kept in
   the profile; Retirement is the Drawdown Simulator; Social Security's pay
   history is the Social Security Calculator's. Each tool's inputs are built
   from the profile as it opens, and what's shared goes back to the profile
   when it changes, so every tab reads one set of numbers. */

import { withDefaults, type ToolInputs } from "@/components/tools/ToolState";
import { dollarsField, groupDigits, parseNum } from "@/lib/format";
import { BUDGET_DEF, budgetCompute, budgetTotals, openBudget, type BudgetInputs, type BudgetRow } from "@/tools/budget/model";
import { PC_ZERO, paycheckInput, paycheckRun, pcCap, type PcInput, type PcRun } from "@/tools/budget/paycheck-math";
import { taxFromPaycheck } from "@/tools/budget/to-calculator";
import { TAX_DEF, runTax, taxInput, type TaxInputs } from "@/tools/tax/model";
import { SOCIAL_DEF, social, type SocialInputs } from "@/tools/social/model";
import { DRAWDOWN_DEF, ddWrite, drawdownSetup, type DrawdownState } from "@/tools/drawdown/model";
import { ddQuick } from "@/lib/engine/drawdown";
import { OUTSIDE_US, PER_YEAR, type Per, type Person, type Profile } from "./store";

/** The budget line setup's one spending number lives on, until the budget
    is filled in line by line. */
export const ALL_TOGETHER = "Everything else";

const FREQ: Record<Per, string> = { week: "52", "2weeks": "26", twice: "24", month: "12", year: "26" };
const PER_OF: Record<string, Per> = { "52": "week", "26": "2weeks", "24": "twice", "12": "month" };
/** Pay before taxes over a year, as the paycheck reads it. */
const grossOf = (p: Person, abroad = false) => (p.pay == null ? null : (p.pay * PER_YEAR[p.per]) / (p.taxed === "after" && !abroad ? 0.76 : 1));
/** Where taxes are figured: the state, or a stand-in outside the US. */
export const taxState = (pr: Profile) => (!pr.state || pr.state === OUTSIDE_US ? "IL" : pr.state);

/* ---------- Budget and Paycheck ---------- */

/** The budget as the profile has it: the stored lines and sliders, with the
    pay, filing status and state laid over from the profile. */
export function budgetFor(pr: Profile): BudgetInputs {
  const stored = pr.tools.budget ? openBudget(withDefaults(BUDGET_DEF, pr.tools.budget)) : seedBudget(pr);
  return overlay(stored, pr);
}

function overlay(b: BudgetInputs, pr: Profile): BudgetInputs {
  const two = pr.who === "couple" && (pr.p2.pay ?? 0) > 0;
  // Outside the US pay is entered after taxes and the paycheck takes none.
  const abroad = pr.state === OUTSIDE_US;
  const g1 = grossOf(pr.p1, abroad), g2 = two ? grossOf(pr.p2, abroad) : null;
  return {
    ...b, pcNoTax: abroad,
    ...(g1 != null ? { pcGross: dollarsField(g1), pcFreq: FREQ[pr.p1.per] } : {}),
    ...(g2 != null ? { pcGross2: dollarsField(g2), pcFreq2: FREQ[pr.p2.per] } : {}),
    pcStatus: pr.who !== "couple" ? "s" : two ? "m2" : "m",
    pcState: taxState(pr),
  };
}

/** A first budget from setup's answers: the one spending number as a line,
    and what setup said goes to savings in the 401(k) lines. */
function seedBudget(pr: Profile): BudgetInputs {
  let b = openBudget({ ...BUDGET_DEF.defaults });
  // What's known goes on its own line: the rent, or the mortgage payment.
  const housing = pr.home === "rent" ? pr.rent : pr.home === "own" ? pr.mortPay : null;
  if (housing) b = { ...b, rows: b.rows.map((r) => (r.slot === "Rent / Mortgage" ? { ...r, amount: groupDigits(housing, true) } : r)) };
  // Setup's one number is the rest of it.
  const rest = (pr.spend ?? 0) - (housing ?? 0);
  if (pr.spend) b = { ...b, rows: [...b.rows, { group: "Custom", desc: ALL_TOGETHER, amount: groupDigits(Math.max(0, rest), true), freq: 12, custom: true }] };
  b = overlay(b, pr);
  const monthly = pr.contrib == null ? 0 : (pr.contrib * PER_YEAR[pr.cper]) / 12;
  if (monthly > 0) {
    const pi = paycheckInput(b, taxState(pr));
    const per = (monthly * 12) / pi.p, cap = pcCap(pi, "match", PC_ZERO);
    const match = Math.min(per, cap), rest = Math.max(0, per - match);
    const cents = (v: number) => String(Math.round(v * 100) / 100);
    b = { ...b, pcMatch: cents(match), pcK401max: cents(rest) };
  }
  return b;
}

/** What the profile keeps when the budget changes: the budget itself, and
    the pay, status and state it holds, back into the profile's own. */
export function fromBudget(pr: Profile, b: BudgetInputs): Profile {
  const g1 = parseNum(b.pcGross), g2 = parseNum(b.pcGross2), two = b.pcStatus === "m2";
  const back = (p: Person, g: number, f: string): Person => {
    // The pay's own "how often" stays, unless the paychecks were changed there.
    const per = f !== FREQ[p.per] ? PER_OF[f] ?? p.per : p.per;
    // Unchanged in the tool: the pay stays as it was entered (after taxes, say).
    if (per === p.per && Math.abs(g - (grossOf(p, pr.state === OUTSIDE_US) ?? 0)) < 1) return p;
    return g > 0 ? { ...p, per, taxed: "before", pay: Math.round(((g / PER_YEAR[per]) * 100)) / 100 } : p;
  };
  const spend = budgetTotals(b).spentYr / 12;
  return {
    ...pr,
    tools: { ...pr.tools, budget: b as unknown as ToolInputs },
    // The tool's stand-ins (single, the tax state) aren't answers.
    who: pr.who == null && b.pcStatus === "s" ? null : b.pcStatus === "s" ? "single" : "couple",
    p1: back(pr.p1, g1, b.pcFreq),
    p2: two ? back(pr.p2, g2, b.pcFreq2) : pr.p2,
    state: pr.state === OUTSIDE_US || (pr.state == null && b.pcState === taxState(pr)) ? pr.state : b.pcState || pr.state,
    spend: spend > 0 ? Math.round(spend) : pr.spend,
  };
}

/** The budget's spending a month (every line; yearly ones spread out). */
export const budgetMonth = (b: BudgetInputs) => budgetTotals(b).spentYr / 12;
/** The lines filled in besides the one-number line. */
export const detailed = (b: BudgetInputs) => b.rows.some((r) => r.desc !== ALL_TOGETHER && parseNum(r.amount) > 0);

/** Sets the budget's total to `monthly` by moving the one-number line. */
export function setAllTogether(b: BudgetInputs, monthly: number): BudgetInputs {
  const others = b.rows.filter((r) => r.desc !== ALL_TOGETHER).reduce((s, r) => s + (parseNum(r.amount) * r.freq) / 12, 0);
  const amount = groupDigits(Math.max(0, Math.round(monthly - others)), true);
  const i = b.rows.findIndex((r) => r.desc === ALL_TOGETHER);
  const row: BudgetRow = { group: "Custom", desc: ALL_TOGETHER, amount, freq: 12, custom: true };
  return { ...b, rows: i >= 0 ? b.rows.map((r, j) => (j === i ? { ...r, amount, freq: 12 } : r)) : [...b.rows, row] };
}

export interface Flow {
  b: BudgetInputs; pi: PcInput; r: PcRun;
  /** A month, both of you together. `spend` is the budget's total;
      `spendPaid` leaves out premiums already taken out of pay. */
  gross: number; taxes: number; health: number; afterTax: number; spend: number; spendPaid: number;
  /** Saved and invested (not the emergency fund line), the match, and what's unassigned. */
  invested: number; match: number; ef: number; left: number;
  /** The invested month split by tax treatment, for the plan. */
  trad: number; roth: number; brok: number;
  /** Whether each person's saving reaches the full match. */
  fullMatch: boolean | null;
  /** The emergency fund's target, by the budget chosen for it. */
  efMonths: number; efTarget: number;
  /** Income Tax's reading of the year, with the deductions set there. */
  tax: ReturnType<typeof runTax> | null;
  hasPay: boolean;
  /** Set aside for college each month in the budget (its College savings line). */
  college: number;
}

/** The paycheck, taxes and budget as one month. */
export function flow(pr: Profile): Flow {
  // The paycheck takes Income Tax's own local tax, as the Taxes tab does.
  const b = budgetFor(pr), pi = paycheckInput(b, taxState(pr), withDefaults(TAX_DEF, pr.tools.tax ?? {})), r = paycheckRun(pi), a = pi.amounts;
  const m = pi.p / 12, hasPay = pi.gross + pi.gross2 > 0;
  const tx = hasPay ? taxFor(pr, b, pi, r) : null;
  const T = tx ? runTax(taxInput(tx)) : null;
  // Taxes: Income Tax's year (its deductions included), else the paycheck's;
  // none outside the US, where pay is entered after them.
  const abroad = pr.state === OUTSIDE_US;
  const taxesYr = abroad ? 0 : T ? T.total : r.taxes * pi.p;
  const gross = (pi.gross + pi.gross2) / 12, health = r.health * m;
  const net = abroad ? [pr.p1, ...(pr.who === "couple" ? [pr.p2] : [])].reduce((s, p) => s + (p.pay ?? 0) * PER_YEAR[p.per], 0) / 12 : gross - taxesYr / 12 - health;
  const roth = pi.roth;
  const trad = ((roth.match ? 0 : a.match) + (roth.k401max ? 0 : a.k401max) + (roth.rothIra ? 0 : a.rothIra)) * m;
  const rothAmt = ((roth.match ? a.match : 0) + (roth.k401max ? a.k401max : 0) + (roth.rothIra ? a.rothIra : 0) + a.hsa) * m;
  const cap = pcCap(pi, "match", { ...a, match: 0 });
  const C = budgetCompute(b), spendPaid = pi.spendYear / 12, invested = trad + rothAmt + a.brok * m;
  return {
    b, pi, r, gross, taxes: taxesYr / 12, health, afterTax: net, spend: C.spentYr / 12, spendPaid,
    // What's left: pay after taxes (as Taxes figures them), less saving and spending.
    invested, match: r.match * m, ef: a.ef * m, left: hasPay ? net - invested - a.ef * m - spendPaid : r.left * m,
    trad, roth: rothAmt, brok: a.brok * m,
    fullMatch: pi.match.some((x) => x.rate > 0) ? a.match >= cap - 0.5 : null,
    efMonths: C.ef, efTarget: C.efTarget,
    tax: T, hasPay, college: C.savedYr / 12,
  };
}

/* ---------- Taxes ---------- */

/** Income Tax as the profile has it: its own choices (deductions, year),
    with the pay and the pre-tax money through work from the paycheck. */
export function taxFor(pr: Profile, b = budgetFor(pr), pi = paycheckInput(b, taxState(pr)), r = paycheckRun(pi)): TaxInputs {
  const stored = withDefaults(TAX_DEF, pr.tools.tax ?? {});
  return taxFromPaycheck({ ...stored, dedType: stored.dedType, item: stored.item }, pi, r);
}

/** What the profile keeps when Income Tax changes: its own choices. */
export function fromTax(pr: Profile, t: TaxInputs): Profile {
  return { ...pr, tools: { ...pr.tools, tax: t as unknown as ToolInputs } };
}

/* ---------- Social Security's pay history ---------- */

/** The Social Security Calculator's inputs for the household: birth years,
    today's pay, the claiming age, and any pay history already edited. */
export function socialFor(pr: Profile): SocialInputs {
  const s = withDefaults(SOCIAL_DEF, pr.tools.social ?? {});
  const who = (p: Person, cur: SocialInputs["you"], claim: number | null) => ({
    ...cur, src: "pay" as const,
    ...(p.by ? { birth: String(p.by) } : {}),
    ...(p.retire ? { stop: String(p.retire) } : {}),
    ...(grossOf(p) != null ? { pay: dollarsField(grossOf(p)!) } : {}),
    ...(claim ? { claim: String(claim) } : {}),
  });
  return { ...s, status: pr.who === "couple" ? "m" : "s", you: who(pr.p1, s.you, pr.ss.claim), spouse: who(pr.p2, s.spouse, pr.ss.claim2 ?? null) };
}

/** Each person's benefit at full retirement age, a month, from the pay history. */
export function socialBenefits(s: SocialInputs): { you: number; spouse: number | null } {
  const S = social(s) as unknown as { you: { pia: number }; spouse?: { pia: number } | null };
  return { you: S.you.pia, spouse: s.status === "m" && S.spouse ? S.spouse.pia : null };
}

/* ---------- Drawdown ---------- */

/** The Drawdown Simulator on the plan: what's saved at retirement, the
    years to 95, the stock mix, Social Security and the strategy come from
    the profile; the strategy's own settings are the ones saved there. */
/** The simulator's figures that come from the plan, which a person can set
    for themselves on Retirement (kept in Profile.ddOwn). The stock mix and
    the first claiming age go back into the plan's own settings instead. */
export const DD_OWN = ["rate", "initial", "years", "retireAge", "ssMode", "ssAmount", "ssAmount2", "ssDelay2"] as const;

export function drawdownFor(pr: Profile, plan: { fv: number; spendYr: number; taxYr: number; years: number; ss1: number; ss2: number; claim: number; claim2?: number | null; retire: number } | null, own = true): DrawdownState {
  const cur = withDefaults(DRAWDOWN_DEF, pr.tools.drawdown ?? {});
  if (!plan) return cur;
  const couple = pr.who === "couple" && plan.ss2 > 0;
  // A partial fill, so each strategy's own saved settings (guardrails,
  // floors and ceilings, a spending path) are kept as they are.
  const next = ddWrite(cur, {
    initial: Math.round(plan.fv), years: plan.years, stock: pr.assume.stocks, retireAge: String(plan.retire),
    ssMode: plan.ss1 > 0 ? "manual" : "none", ssWho: couple ? "couple" : "single",
    ssAmount: Math.round(plan.ss1 * 12), ssAmount2: Math.round(plan.ss2 * 12), ssDelay: plan.claim,
  });
  // Each of you from your own start year.
  if (couple && plan.claim2 != null) next.ssDelay2 = String(Math.round(plan.claim2));
  // The starting rate: the plan's spending in its first year, with a year's
  // tax on it; Social Security pays part of it once claimed, savings the
  // rest. Always from the plan, so the two can't drift apart.
  // Unless set on Retirement: then it's the plan's spending that follows.
  const rate = Math.round(((plan.spendYr + plan.taxYr) / Math.max(1, plan.fv)) * 10000) / 100;
  return { ...next, rate: String(rate), ...(own ? pr.ddOwn : {}), ...(pr.strategy ? { strategy: pr.strategy } : {}) } as DrawdownState;
}

/** What the profile keeps when the Drawdown changes: its settings, and the
    strategy once one is picked there (opening it on its default isn't a choice). */
export function fromDrawdown(pr: Profile, d: DrawdownState, opened?: string, plan?: Parameters<typeof drawdownFor>[1]): Profile {
  const strategy = pr.strategy == null && String(d.strategy) === opened ? null : String(d.strategy);
  const next: Profile = { ...pr, strategy, tools: { ...pr.tools, drawdown: d as unknown as ToolInputs } };
  if (!plan) return next;
  // Every figure changed here is kept: one that differs from the plan's is
  // the person's own; set back to the plan's, it follows the plan again.
  const base = drawdownFor(pr, plan, false) as unknown as Record<string, unknown>, now = d as unknown as Record<string, unknown>;
  const same = (k: string) => (k === "ssMode" ? String(now[k]) === String(base[k]) : Math.abs(parseNum(String(now[k] ?? "")) - parseNum(String(base[k] ?? ""))) < 0.005);
  const own: Record<string, string> = {};
  DD_OWN.forEach((k) => { if (now[k] != null && !same(k)) own[k] = String(now[k]); });
  next.ddOwn = Object.keys(own).length ? own : undefined;
  if (!same("stock")) next.assume = { ...pr.assume, stocks: Math.max(0, Math.min(100, Math.round(parseNum(String(now.stock))))) };
  if (!same("ssDelay")) next.ss = { ...pr.ss, claim: Math.max(62, Math.min(70, Math.round(parseNum(String(now.ssDelay))))) };
  return next;
}

/** The chosen strategy's chance across history, with its saved settings. */
export function drawdownSuccess(d: DrawdownState): number {
  return ddQuick(drawdownSetup(d).o).successRate;
}

/* ---------- Saving that grows ---------- */

export const GROW_LINES = ["match", "hsa", "rothIra", "k401max", "brok"] as const;
export type GrowLine = (typeof GROW_LINES)[number];
export const GROW_NAMES: Record<GrowLine, string> = {
  match: "401(k) up to the match", hsa: "HSA", rothIra: "IRA", k401max: "401(k) beyond the match", brok: "Taxable brokerage",
};

/** Each saving line: what goes in a month, its limit a month (limits keep
    pace with inflation, so in today's dollars they hold still), its growth
    beyond inflation, and the years until it reaches the limit. */
export function growthLines(pr: Profile, F: Flow = flow(pr)) {
  const { pi } = F, m = pi.p / 12, a = pi.amounts;
  return GROW_LINES.map((id) => {
    const amount = a[id] * m, cap = pcCap(pi, id, a) * m, g = pr.growth[id] ?? 0;
    const capped = isFinite(cap) && amount > 0 && amount >= cap - 0.5;
    const years = !capped && g > 0 && amount > 0 && isFinite(cap) ? Math.ceil(Math.log(cap / amount) / Math.log(1 + g)) : null;
    return { id, name: GROW_NAMES[id], amount, cap, growth: capped ? 0 : g, capped, years };
  });
}

/** Saving a month k years from now (yours and the match), each line grown
    and held at its limit. */
export function savingAt(pr: Profile, k: number, F: Flow = flow(pr)): number {
  const L = growthLines(pr, F);
  const own = L.reduce((s, l) => s + Math.min(l.amount * Math.pow(1 + l.growth, k), isFinite(l.cap) ? Math.max(l.cap, l.amount) : Infinity), 0);
  const m0 = L.find((l) => l.id === "match")!;
  const matchNow = m0.amount > 0 ? Math.min(m0.amount * Math.pow(1 + m0.growth, k), Math.max(m0.cap, m0.amount)) / m0.amount : 1;
  return own + F.match * matchNow;
}

/* ---------- College ---------- */

/** The budget line saving for college, as the Budget tool names it. */
export const COLLEGE_LINE = "College savings";

/** Adds (or sets) the budget's College savings line, a month. */
export function withCollegeLine(b: BudgetInputs, monthly: number): BudgetInputs {
  const amount = groupDigits(Math.round(monthly), true), i = b.rows.findIndex((r) => r.desc === COLLEGE_LINE);
  return { ...b, rows: i >= 0 ? b.rows.map((r, j) => (j === i ? { ...r, amount, freq: 12 } : r)) : [...b.rows, { group: "Custom", desc: COLLEGE_LINE, amount, freq: 12, custom: true }] };
}
