/* Trips into the tools. For each: how the guide fills the tool in on the
   way (prefill, from the tool's inputs as they stand), the coach's live
   checklist on the tool (tasks: ok true is a tick, false a nudge, undefined
   a plain note), the figure the coach shows (chip), and what coming back
   brings (capture). The coach's text is the guide's own HTML, as on the old
   site. Everything that reads the tool reads its inputs; what only the
   screen shows (a headline worked out in a worker, a view switched on) is
   read off the page. From GD_TRIPS in src/js/app/29-guide-trips.js. */

import { debtDate, PPY, projectBasic, BASIC_INFL } from "@/lib/engine/typed";
import { bridgeRun, budgetNums, debtNums, hcPrem, housing, on, q, text } from "@/lib/tool-reads";
import { fmtNum, groupDigits, money, parseNum, pctStr } from "@/lib/format";
import { STATE_OPTIONS } from "@/lib/states";
import { advancedFields } from "@/tools/advanced/model";
import { basicInput, RISK_OPTIONS, type BasicInputs } from "@/tools/basic/model";
import { annualize, type BudgetInputs, type BudgetRow } from "@/tools/budget/model";
import { collegeInput, collegeMonthly, type CollegeInputs } from "@/tools/college/model";
import { DEBT_DEFAULTS, type DebtInputs, type DebtRow } from "@/tools/debt/model";
import { ddWrite, type DdItem, type DrawdownState } from "@/tools/drawdown/fields";
import { routeTasks } from "@/tools/bridge/coach";
import type { BridgeInputs } from "@/tools/bridge/model";
import { escapeHtml } from "@/tools/drawdown/text";
import type { FireInputs } from "@/tools/fire/model";
import type { HealthcareInputs } from "@/tools/healthcare/model";
import type { Inputs as MortgageInputs } from "@/tools/mortgage/model";
import { stageFields, type StagesInputs } from "@/tools/stages/model";
import { runTax, taxInput, type TaxInputs } from "@/tools/tax/model";
import { bridgeSpend, bridgeSplit, coastNow, ddOpts, gdM, gross, mar, minSpend, mixFor, ok, pensionItems, pos, riskLabel, saveMo, saveNow, sim, stratName } from "./calc";
import { hasChanges, schedule } from "./schedule";
import type { Answers, Capture, ChangeEvent, Trip } from "./store";

export interface Task { h: string; ok?: boolean }
type Inputs = Record<string, unknown>;
interface Ctx<S> {
  a: Answers;
  /** The tool's inputs as they stand. */
  s: S;
  /** The trip, which a task can change (to remember what's been tried). */
  trip: Trip;
}
interface TripDef<S = Inputs> {
  /** The tool's inputs for this trip, from what they hold now. */
  prefill: (a: Answers, s: S, trip: Trip) => S;
  tasks?: (c: Ctx<S>) => Task[];
  /** Tools walked through in parts. */
  pages?: ((c: Ctx<S>) => Task[])[];
  chip: (c: Ctx<S>) => string;
  /** What coming back now would bring; null for nothing to bring. `sync`
      writes the household bar too. */
  capture: (c: Ctx<S>) => (Capture & { sync?: boolean }) | null;
}

const g = (v: number) => groupDigits(Math.round(v || 0), true);

/* Advanced and Stages are filled from the guide once per version of the
   plan, so a second tour keeps whatever you changed there, but a plan
   adjusted in the guide since then comes through. */
const filled: Record<string, string | boolean> = {};
/** Changes ahead's schedule, when the answers have one. */
function guideSchedule(a: Answers) {
  if (!hasChanges(a) || !ok(a.age) || !ok(a.retire) || !(a.retire > a.age)) return null;
  const stop = ok(a.stopAge) && a.stopAge < a.retire ? Math.max(a.age, a.stopAge) : null;
  const L = schedule(a, { monthly: saveMo(a), stop });
  return L.length ? L : null;
}
export function planSig(a: Answers) {
  return [a.age, a.retire, a.saved, saveMo(a), a.stopAge, a.risk, a.retSpend, a.debtMonths, a.debtMin, a.collegeMo, a.kidAge].join("|");
}
let stagesFrom = "", stagesN = 1;

function basicNow(s: BasicInputs) {
  const p = basicInput(s);
  return { monthly: (p.contrib * ((PPY as Record<string, number>)[p.period] || 12)) / 12, retire: p.retire, saved: p.initial, risk: p.real };
}
const and = (list: string[]) => list.join(", ").replace(/, ([^,]*)$/, " and $1");

const TRIPS: Record<string, TripDef<never>> = {
  tax: {
    prefill: (a: Answers, s: TaxInputs) => ({ ...s, mode: "normal", status: mar(a) ? "m" : "s", gross2: g(mar(a) ? a.income2 || 0 : 0),
      ...(ok(a.income) ? { gross: g(a.income) } : {}), ...(a.state ? { state: a.state } : {}), ...(ok(a.txPre) ? { pre: g(a.txPre) } : {}) }),
    tasks: ({ s }: Ctx<TaxInputs>) => [
      { h: "Check <b>Filing status</b> and <b>State</b> under Your situation. We filled them in from your answers." },
      { h: "<b>Gross income</b> holds your salary. If your paycheck puts money into a 401(k), 403(b) or HSA before tax, enter the yearly total in <b>Pre-tax deductions</b>.", ok: taxInput(s).pre > 0 ? true : undefined },
      { h: "Above the results, switch <b>Net pay</b> to <b>Take-home pay</b>: what actually reaches your bank account.", ok: s.view === "take" },
      { h: "<b>Per month</b> is your monthly take-home. Tap <b>Back to guide</b> and it comes with you." },
    ],
    chip: ({ s }: Ctx<TaxInputs>) => { const R = runTax(taxInput(s)); return R.gross > 0 ? "Take-home<br><b>" + money(R.net / 12) + "/mo</b>" : ""; },
    capture: ({ s }: Ctx<TaxInputs>) => {
      const R = runTax(taxInput(s));
      if (!(R.gross > 0)) return null;
      const v = Math.round(R.net / 12);
      return { set: { takehome: v, txPre: taxInput(s).pre }, msg: "From Income Tax: <b>" + money(v) + "/mo</b> take-home pay. If your pay stub says something different, use that instead." };
    },
  },

  budget: {
    prefill: (a: Answers, s: BudgetInputs) => {
      let next = s;
      // Tools don't keep what's typed across a reload, so the guide keeps a
      // copy of the lines and puts them back if the budget is blank again.
      if (Array.isArray(a.bgRows) && a.bgRows.length && s.rows.every((r) => !(parseNum(r.amount) > 0)))
        next = { ...next, rows: (a.bgRows as BudgetRow[]).map((r) => ({ ...r })) };
      if (pos(a.takehome)) next = { ...next, incomeFreq: 12, income: gdM(a.takehome) };
      return next;
    },
    tasks: ({ s }: Ctx<BudgetInputs>) => {
      const B = budgetNums(s);
      return [
        { h: "<b>Income after taxes</b> holds your take-home pay, set to <b>/mo</b>.", ok: B.inc > 0 },
        { h: "With your last two or three months of statements open, work down the list and fill in what you spend on each line. Skip lines that don't apply." +
          (B.lines ? "<em>" + B.lines + " filled</em>" : ""), ok: B.lines >= 5 },
        { h: "For bills that come once or twice a year (insurance, travel, gifts, car repairs), tap <b>/yr</b> on the line and enter the yearly total." },
        { h: "Money you move into savings or investments goes on <b>Savings &amp; investments</b>. It counts as saving, not spending.", ok: B.saved > 0 ? true : undefined },
        { h: "Something missing? <b>Add custom item</b> sits under the list." },
        { h: "<b>Left over</b>, beside the list (below it on a phone), is what's free each month for debt and saving." },
      ];
    },
    chip: ({ s }: Ctx<BudgetInputs>) => { const B = budgetNums(s); return B.spent > 0 ? "Spending <b>" + money(B.spent / 12) + "/mo</b><br>Left over <b>" + money(B.left / 12) + "/mo</b>" : ""; },
    capture: ({ a, s }: Ctx<BudgetInputs>) => {
      const B = budgetNums(s);
      if (!(B.spent > 0)) return null;
      const spend = Math.round(B.spent / 12), bgSave = Math.round(B.saved / 12);
      // Rent or mortgage, property tax and home insurance: the first, second
      // and fifth preset lines, which can be renamed but never move.
      const set: Partial<Answers> = { spend, bgSave,
        bgMort: s.rows[0] ? Math.round(annualize(s.rows[0]) / 12) || null : null,
        bgHousing: Math.round([0, 1, 4].reduce((t, i) => t + (s.rows[i] ? annualize(s.rows[i]) : 0), 0) / 12) || null,
        spendSrc: "budget", bgRows: s.rows.map((r) => ({ ...r })) };
      if (!pos(a.takehome) && B.inc > 0) set.takehome = Math.round(B.inc / 12);
      return { set, msg: "From your budget: <b>" + money(spend) + "/mo</b> in spending" + (bgSave > 0 ? " and <b>" + money(bgSave) + "/mo</b> going to savings" : "") +
        ", with <b>" + money(B.left / 12) + "/mo</b> left over." };
    },
  },

  debt: {
    prefill: (a: Answers, s: DebtInputs) => {
      if (JSON.stringify(s) !== JSON.stringify(DEBT_DEFAULTS)) return s;
      const keep = Array.isArray(a.debtRows) && a.debtRows.length;
      return { ...s, rows: keep ? (a.debtRows as DebtRow[]).map((r) => ({ ...r })) : [{ desc: "", balance: "0", apr: "0", min: "0" }],
        extra: keep && pos(a.debtExtra) ? gdM(a.debtExtra) : "" };
    },
    tasks: ({ a, s }: Ctx<DebtInputs>) => {
      const D = debtNums(s);
      return [
        { h: (Array.isArray(a.debtRows) && a.debtRows.length
          ? "Your debts from last time are back. Update any balance that's changed, and add new ones with <b>Add a debt</b>."
          : "The sample debts are cleared. Enter each of yours: a name, the <b>Balance</b>, the <b>Rate</b> (the APR on your statement) and the <b>Minimum</b> payment. <b>Add a debt</b> gives you another row.") +
          (D.live.length ? "<em>" + D.live.length + " entered</em>" : ""), ok: D.live.length > 0 },
        { h: "In <b>Extra payment</b>, type what you can pay each month on top of the minimums, or tap <b>Copy from Budget</b> to use your budget's left-over" +
          (pos(a.takehome) && pos(a.spend) && a.takehome - a.spend - (a.bgSave || 0) > 0 ? " (" + money(a.takehome - a.spend - (a.bgSave || 0)) + "/mo)." : "."), ok: parseNum(s.extra) > 0 },
        { h: "<b>Avalanche</b> pays the highest rate first and costs the least. <b>Snowball</b> clears the smallest balance first for quicker wins. Pick the one you'll stick with." },
        { h: "Your <b>Debt-free</b> date is at the top." },
      ];
    },
    chip: ({ s }: Ctx<DebtInputs>) => {
      const D = debtNums(s);
      if (!D.live.length || !D.pick) return "";
      return "Owed <b>" + money(D.total) + "</b><br>Debt-free <b>" + (D.pick.stalled ? "never" : debtDate(D.pick.monthsTotal)) + "</b>";
    },
    capture: ({ s }: Ctx<DebtInputs>) => {
      const D = debtNums(s);
      if (!D.live.length) return null;
      const debtMonths = D.pick && !D.pick.stalled ? D.pick.monthsTotal : null, extra = Math.round(parseNum(s.extra));
      return { set: { debtHas: "yes", debtSrc: "tool", debtTotal: Math.round(D.total), debtHi: Math.round(D.hi), debtMin: Math.round(D.min),
        debtN: D.live.length, debtTop: D.top, debtExtra: extra, debtMonths,
        debtRows: s.rows.filter((r) => parseNum(r.balance) > 0).map((r) => ({ ...r })) },
      msg: "From Debt Payoff: <b>" + D.live.length + (D.live.length === 1 ? " debt" : " debts") + "</b> totaling <b>" + money(D.total) + "</b>" +
        (D.hi > 0 ? ", " + money(D.hi) + " of it at 8% or more" : "") + "." +
        (debtMonths ? " With " + money(extra) + "/mo extra you're debt-free by <b>" + debtDate(debtMonths) + "</b>." : "") };
    },
  },

  mortBuy: {
    prefill: (a: Answers, s: MortgageInputs) => (a.moState ? { ...s, ...(a.moState as MortgageInputs) } : s),
    tasks: ({ a, s }: Ctx<MortgageInputs>) => {
      const inc = gross(a), H = housing(s), cap = (inc * 0.28) / 12;
      return [
        { h: "Enter a <b>Home price</b> you'd realistically shop at and your <b>Down payment</b>. Under 20% down adds PMI." },
        { h: "Set <b>Interest rate</b> to a current quote. Lenders' sites post today's rates, and your credit score moves yours." },
        { h: "Adjust <b>Property tax</b> and <b>Insurance</b> for the area if you know them." },
        { h: "<b>Monthly payment</b> at the top is the whole cost. Keep the house payment (loan, tax, insurance, PMI and HOA) under about 28% of gross income" +
          (inc > 0 ? ": <b>" + money(cap) + "/mo</b> for you." : "."), ok: inc > 0 && H.R.loan > 0 ? H.piti <= cap : undefined },
      ];
    },
    chip: ({ a, s }: Ctx<MortgageInputs>) => {
      const inc = gross(a), H = housing(s);
      if (!(H.R.loan > 0)) return "";
      return "House payment <b>" + money(H.piti) + "/mo</b>" + (inc > 0 ? "<br><b>" + pctStr((H.piti * 12) / inc, 0) + "</b> of gross income" : "");
    },
    capture: ({ s }: Ctx<MortgageInputs>) => {
      const H = housing(s);
      if (!(H.R.loan > 0)) return null;
      return { set: { housePay: Math.round(H.piti), moState: { ...s } }, msg: "From the Mortgage Calculator: a <b>" + money(parseNum(s.price)) + "</b> home comes to about <b>" + money(H.piti) + "/mo</b>." };
    },
  },

  mortOwn: {
    prefill: (a: Answers, s: MortgageInputs) => (a.moState ? { ...s, ...(a.moState as MortgageInputs) } : s),
    tasks: ({ s }: Ctx<MortgageInputs>) => [
      { h: "Enter your loan as it is today: the remaining balance as <b>Home price</b>, <b>Down payment</b> at 0%, your rate, the <b>Length</b> closest to the years you have left, and <b>PMI</b> at 0 unless you still pay it." },
      { h: "Under <b>Extra payments and refinancing</b>, choose <b>Yes, show these options</b>.", ok: s.extrasOn === "1" },
      { h: "Try $100 or $200 in <b>Extra toward principal</b> and see how much interest it saves and how much sooner you're done.", ok: s.extrasOn === "1" && parseNum(s.extraMo) > 0 },
      { h: "Paying extra is a guaranteed return equal to your rate. Above about 6%, it often beats investing; below 4%, investing usually wins." },
    ],
    chip: ({ s }: Ctx<MortgageInputs>) => { const H = housing(s); return H.R.loan > 0 ? "House payment<br><b>" + money(H.piti) + "/mo</b>" : ""; },
    capture: ({ s }: Ctx<MortgageInputs>) => {
      const H = housing(s);
      if (!(H.R.loan > 0)) return null;
      return { set: { housePay: Math.round(H.piti), mortPI: Math.round(H.R.pi), moState: { ...s } }, msg: "From the Mortgage Calculator: your house payment is about <b>" + money(H.piti) + "/mo</b>." };
    },
  },

  college: {
    prefill: (a: Answers, s: CollegeInputs) => {
      let next: CollegeInputs = a.clState ? { ...s, ...(a.clState as CollegeInputs) } : s;
      if (ok(a.kidAge)) next = { ...next, kids: next.kids.map((k, i) => (i ? k : { ...k, years: String(Math.max(0, Math.min(25, 18 - Math.round(a.kidAge!)))) })) };
      return next;
    },
    tasks: ({ a }: Ctx<CollegeInputs>) => [
      { h: "<b>Years until college</b> is set from your child's age.", ok: ok(a.kidAge) ? true : undefined },
      { h: "Pick a <b>School type</b>, or choose <b>Custom</b> and type a yearly cost." },
      { h: "Enter what's already in a 529 or other college account in <b>Currently saved</b>." },
      { h: "The monthly figure at the top is what to set aside. More than one child? <b>Add a child</b> for each, and the figure covers them all." },
    ],
    chip: ({ s }: Ctx<CollegeInputs>) => { const mo = collegeMonthly(collegeInput(s)); return mo > 0 ? "Save<br><b>" + money(mo) + "/mo</b>" : ""; },
    capture: ({ s }: Ctx<CollegeInputs>) => {
      const inp = collegeInput(s), mo = collegeMonthly(inp);
      if (!(mo >= 0)) return null;
      return { set: { collegeMo: Math.round(mo), clState: { ...s } }, msg: "From College Savings: set aside about <b>" + money(mo) + "/mo</b>" +
        (inp.kids.length > 1 ? " for all " + inp.kids.length + " children." : ". Change the figure below if you have more than one child.") };
    },
  },

  basic: {
    prefill: (a: Answers, s: BasicInputs, trip: Trip) => {
      const next = { ...s, contrib: gdM(saveNow(a)), period: "Monthly" };
      if (ok(a.age)) next.age = String(Math.round(a.age));
      if (ok(a.retire)) next.retire = String(Math.round(a.retire));
      if (ok(a.saved)) next.saved = gdM(a.saved);
      if (a.risk && RISK_OPTIONS.some((o) => o.value === String(a.risk))) next.risk = String(a.risk);
      trip.base = basicNow(next);
      return next;
    },
    tasks: ({ a, s, trip }: Ctx<BasicInputs>) => {
      const b = trip.base as ReturnType<typeof basicNow> | undefined, n = basicNow(s);
      const tried = !!b && (Math.round(n.monthly) !== Math.round(b.monthly) || n.retire !== b.retire);
      return [
        { h: "Your age, retirement age, savings and monthly saving (yours plus your employer's) are filled in on the left." +
          (ok(a.stopAge) && a.stopAge < a.retire! && !coastNow(a) ? " Basic saves right up to retirement, so it doesn't show your plan to stop at " + fmtNum(a.stopAge) + ": its figure runs higher. The <b>Stages</b> calculator shows the coast." : "") },
        { h: "<b>Value at retirement</b> is what your savings could grow to, in today's dollars, so you can compare it with prices now." },
        { h: "Raise <b>How much do you save</b> by $100 or $200 and watch it move. Then try retiring a year or two later.", ok: tried },
        { h: "The shaded band on the chart is the same plan in better and worse markets." },
        { h: "Want taxes, fees and account types? <b>Open these numbers in Advanced</b> at the bottom goes deeper." },
      ];
    },
    chip: ({ s }: Ctx<BasicInputs>) => { const p = basicInput(s); return p.years > 0 ? "At " + fmtNum(p.retire) + "<br><b>" + money(projectBasic(p).fv) + "</b>" : ""; },
    capture: ({ a, s, trip }: Ctx<BasicInputs>) => {
      const b = trip.base as ReturnType<typeof basicNow> | undefined, n = basicNow(s);
      if (!b) return null;
      const ch: string[] = [], set: Partial<Answers> = {}, undo: Partial<Answers> = { contrib: a.contrib, retire: a.retire, saved: a.saved, risk: a.risk };
      let stopAge = a.stopAge;
      if (Math.round(n.monthly) !== Math.round(b.monthly)) {
        ch.push("saving <b>" + money(n.monthly) + "/mo</b> (was " + money(b.monthly) + ")");
        set.contrib = Math.max(0, Math.round(n.monthly - (a.employer || 0)));
        // Saving again ends a plan to coast from now.
        if (coastNow(a) && n.monthly > 0) { undo.stopAge = a.stopAge; stopAge = null; set.stopAge = null; }
      }
      if (n.retire !== b.retire && n.retire > a.age!) {
        ch.push("retiring at <b>" + fmtNum(n.retire) + "</b> (was " + fmtNum(b.retire) + ")");
        set.retire = n.retire; undo.stopAge = a.stopAge == null ? null : a.stopAge;
        if (ok(stopAge) && stopAge >= n.retire) set.stopAge = null;
      }
      if (Math.round(n.saved) !== Math.round(b.saved)) { ch.push("<b>" + money(n.saved) + "</b> saved (was " + money(b.saved) + ")"); set.saved = Math.round(n.saved); }
      if (Math.abs(n.risk - b.risk) > 1e-9) { ch.push("a " + riskLabel(n.risk) + " mix"); set.risk = n.risk; }
      if (!ch.length) return { msg: "Back from the Basic calculator. Nothing changed there, so your answers stand." };
      return { set, undo, sync: true, msg: "You changed your plan in Basic: " + ch.join(", ") + ". Your answers and score now use the new numbers." };
    },
  },

  drawdown: {
    prefill: (a: Answers, s: DrawdownState, trip: Trip) => {
      const S = sim(a);
      if (!S) return s;
      const st = a.strategy || "fixed", o = ddOpts(a, S);
      const d: Record<string, unknown> = { initial: Math.round(S.fv), years: S.years, strategy: st, stock: S.mix, stockEnd: "", fee: 0,
        rate: Math.max(0.01, Math.round(o.initialPct * 100) / 100), retireAge: String(Math.round(S.retire)),
        guardBand: 20, adjust: 10, floor: 10, ceil: 10, yaleWeight: 70, yaleRate: Math.round(o.initialPct * 100) / 100,
        vpwRate: Math.round(o.vpwRate * 100) / 100, vpwFV: 0, spendFloor: minSpend(a), spendCeil: 0, legacyGoal: 0 };
      // The simulator's own estimate assumes a full career and no spousal
      // top-up, so it's only used when the guide's figure is the same; then
      // its claiming-age comparison works too. Otherwise the guide's own
      // amounts go in as known benefits.
      const est = !S.ss.own && !S.ss.spousal && S.ss.career >= 35 && (!mar(a) || !ok(a.spouseAge) || Math.round(a.spouseAge + (S.retire - a.age!)) - 22 >= 35);
      if (est) {
        Object.assign(d, { ssMode: "est", ssWho: mar(a) ? "couple" : "single", ssIncome: a.income || 0, ssClaim: S.ss.claim });
        if (mar(a)) Object.assign(d, { ssIncome2: a.income2 || 0, ssClaim2: S.ss.claim });
      } else Object.assign(d, { ssMode: "manual", ssWho: S.ss.a2 > 0 ? "couple" : "single", ssAmount: Math.round(S.ss.a1), ssAmount2: Math.round(S.ss.a2), ssDelay: S.ss.claim });
      // The guide's pension joins whatever other income is already listed.
      const keep = s.incomeItems.filter((x) => x.name !== "Pension (from the guide)");
      d.incomeItems = [...keep, ...S.inc.map((x) => ({ ...x, name: "Pension (from the guide)" } as DdItem))];
      trip.base = { strategy: st, stock: S.mix, claim: S.ss.claim, est, floor: minSpend(a), seen: { [st]: 1 } };
      trip.page = 0;
      return ddWrite(s, d);
    },
    pages: [
      ({ a, trip }: Ctx<DrawdownState>) => {
        const S = sim(a), b = trip.base as { est: boolean } | undefined;
        return [
          { h: "Your plan is loaded on the left: " + (S ? money(S.fv) + " at " + fmtNum(S.retire) + ", spending " + money(S.spend) + " a year plus about " + money(S.taxYr) + " for tax, since the simulator doesn't work tax out itself (a <b>Starting withdrawal rate</b> of " + pctStr((S.spend + S.taxYr) / Math.max(1, S.fv), 1) + ")" : "your savings and spending") +
            ", Social Security" + (b && !b.est ? " as a known benefit" : "") + " and " + (pos(a.pension) ? "your pension under <b>Other income</b>." : "no other income yet.") },
          { h: "<b>Success rate</b> is the share of real retirements since 1926 where the money never ran out. 85% or more is solid; close to 100% can mean room to spend more." },
          { h: "<b>Median ending balance</b> is what's typically left at the end, in today's dollars. <b>Worst case</b> is the leanest ending on record." },
          { h: "The sentence under the headline names the starting years that failed, if any. They're where the rest of this tour looks." },
        ];
      },
      () => [
        { h: "<b>How each starting year fared</b> lists every retirement tested. Tap a hard one, like <b>1966</b> or <b>1929</b>, or sort by <b>Ending balance</b> to find the worst." },
        { h: "Above the chart, switch to <b>Selected year</b> to watch that retirement play out.", ok: on('#segDDView [data-ddview="year"].on') },
        { h: "<b>What your income looked like</b> and <b>Year by year</b> show what you'd have lived on, and where the balance went, each year." },
        { h: "Retiring into a falling market early on does the most damage: it's called sequence risk, and it's why averages alone mislead." },
      ],
      ({ a, s, trip }: Ctx<DrawdownState>) => {
        const base = (trip.base || {}) as { seen?: Record<string, 1>; floor?: number };
        const seen = (base.seen = base.seen || {});
        seen[s.strategy as string] = 1;
        const n = Object.keys(seen).length;
        const row = (id: string, h: string): Task => ({ h, ok: seen[id] ? true : undefined });
        return [
          { h: "Change <b>Withdrawal strategy</b> and watch the <b>Success rate</b> and the spending columns in the table. Try at least three." + (n > 1 ? "<em>" + n + " tried</em>" : ""), ok: n >= 3 },
          row("guardrails", "<b>Guardrails</b>: steady spending, cut 10% when the withdrawal rate runs 20% high. Try moving the <b>Upper guardrail</b> further out, or ticking <b>No cuts in the final</b> 15 years."),
          row("floorceil", "<b>Floor &amp; ceiling</b>: follows the market, but never moves spending more than the <b>Max cut</b> or <b>Max raise</b> in a year."),
          row("yale", "<b>Yale Endowment</b>: blends last year's spending with a share of today's balance."),
          row("pct", "<b>Fixed %</b>: can't run out, but look at <b>Lowest year's spending</b> in the table."),
          row("vpw", "<b>VPW</b>: spends down on purpose, like an annuity, ending near zero."),
          { h: "For flexible strategies, <b>Minimum spending</b> sets a line spending never drops below" + (minSpend(a) ? ": yours, " + money(minSpend(a)) + ", is filled in. Try raising or lowering it and watch the success rate." : ". Try the least you could live on and watch the success rate.") +
            " <b>How the strategies compare</b>, under the picker, explains them side by side.", ok: trip.base && parseNum(String(s.spendFloor)) !== base.floor ? true : undefined },
        ];
      },
      ({ s, trip }: Ctx<DrawdownState>) => {
        const b = trip.base as { stock: number } | undefined;
        return [
          { h: "<b>Stocks</b> is " + (b ? b.stock : 60) + "%, the rest in bonds. Try 40% and 80%: more stocks usually lifts the median, and can cut either way on the worst case.", ok: b && parseNum(String(s.stock)) !== b.stock ? true : undefined },
          { h: "<b>Glide to</b> moves the mix gradually over retirement, for example from 60% down to 40% stocks, or up, which some research favors." },
          { h: "<b>Fees</b> come off every year. Try 0.5% or 1% to see what an advisor or pricier funds would cost over a whole retirement." },
        ];
      },
      ({ a, s, trip }: Ctx<DrawdownState>) => {
        const b = trip.base as { est: boolean; claim: number } | undefined;
        if (b && b.est) return [
          { h: "<b>Claim at age</b> sets when your benefit starts. Waiting raises it about 8% a year from 67 to 70; claiming at 62 cuts it about 30%, for life." },
          { h: "Scroll to <b>Social Security claiming age comparison</b>, near the bottom, for your success rate claiming at 62, 64, 67 and 70." },
          { h: "Later claiming means drawing more from savings first, but a bigger check for the rest of your life, and for a surviving spouse.", ok: parseNum(String(s.ssClaim)) !== b.claim ? true : undefined },
        ];
        return [
          { h: "Your benefit is entered as a known amount" + (a.ssOwn ? ", from your statement" : ", from the guide's estimate") + ", starting at " + (b ? b.claim : 67) + "." },
          { h: "Waiting raises a benefit about 8% a year from 67 to 70, and claiming at 62 cuts it about 30%. To try a different age, change <b>When will you claim it?</b> on the guide's Social Security card: the guide works out the new amount." },
        ];
      },
      ({ s }: Ctx<DrawdownState>) => [
        { h: "<b>+ Add income source</b> for part-time work in early retirement, rental income, a pension or an inheritance. Each has a start year and a length.", ok: s.incomeItems.some((x) => x.name !== "Pension (from the guide)") ? true : undefined },
        { h: "<b>+ Add future expense</b> for the big one-time costs: a new roof, a car every ten years, helping a child with a wedding or a home.", ok: s.expenseItems.length ? true : undefined },
        { h: "<b>Legacy goal</b> tests how often you'd also leave a set amount behind.", ok: parseNum(String(s.legacyGoal)) > 0 ? true : undefined },
      ],
      ({ trip }: Ctx<DrawdownState>) => [
        { h: "Switch <b>Historical</b> to <b>Monte Carlo</b> at the top: 5,000 retirements drawn at random from the same record, including sequences history never produced.", ok: on('#segDD [data-dd="mc"].on') ? true : undefined },
        { h: "<b>Return sensitivity</b>, further down, shows your success rate if every year earns a little less than history." },
        { h: "Done? <b>Back to guide</b> brings your strategy, stock mix" + ((trip.base as { est?: boolean } | undefined)?.est ? ", claiming age" : "") + " and success rate with you." },
      ],
    ],
    chip: () => { const t = text("#ddSuccess"); return t && t !== "—" ? "Success rate<br><b>" + t + "</b>" : ""; },
    capture: ({ a, s, trip }: Ctx<DrawdownState>) => {
      const t = text("#ddSuccess"), b = trip.base as { strategy: string; stock: number; claim: number; est: boolean; floor: number } | undefined;
      if (!t || t === "—" || !b) return null;
      const strat = s.strategy as string;
      const set: Partial<Answers> = { ddTool: { rate: t, strat } }, ch: string[] = [];
      const undo: Partial<Answers> = { strategy: a.strategy ?? null, retMix: a.retMix ?? null, ssClaim: a.ssClaim ?? null, minSpend: a.minSpend ?? null };
      const fl = Math.round(parseNum(String(s.spendFloor)));
      if (fl !== Math.round(b.floor || 0)) { set.minSpend = fl > 0 ? fl : null; ch.push(fl > 0 ? "a minimum of <b>" + money(fl) + " a year</b>" : "no minimum spending"); }
      if (strat !== b.strategy) { set.strategy = strat; ch.push("the <b>" + escapeHtml(stratName(strat)) + "</b> approach"); }
      const mix = Math.round(parseNum(String(s.stock)));
      if (mix !== b.stock && mix >= 0 && mix <= 100) { set.retMix = mix; ch.push("<b>" + mix + "%</b> in stocks in retirement"); }
      if (b.est && s.ssMode === "est") {
        const c = Math.round(parseNum(String(s.ssClaim)));
        if (c !== b.claim && c >= 62 && c <= 70) { set.ssClaim = c; ch.push("claiming Social Security at <b>" + c + "</b>"); }
      }
      const head = "Back from the Drawdown Simulator, where it reached a <b>" + t + "</b> success rate.";
      if (!ch.length) return { set, msg: head + " Nothing in your plan changed." };
      return { set, undo, sync: true, msg: head + " Your plan now uses " + and(ch) + "." + (set.retMix != null ? " Your score's historical test uses the new mix." : "") };
    },
  },

  bridge: {
    prefill: (a: Answers, s: BridgeInputs, trip: Trip) => {
      const B = bridgeSplit(a);
      const next: BridgeInputs = { ...s, age: String(Math.max(30, Math.min(59, Math.round(a.retire || 50)))), status: mar(a) ? "m" : "s",
        spend: g(bridgeSpend(a)), trad: g(B.trad), roth: g(B.roth), rothBasis: g(B.basis), brok: g(B.brok),
        basis: "60", g457: "0", work: "0", stock: String(B.mix), aca: "1", fill: "auto", household: mar(a) ? "2" : "1" };
      if (a.state && STATE_OPTIONS.some((o) => o.code === a.state)) next.state = a.state;
      if (!(Math.round(a.retire || 0) >= 55)) next.k401 = "0";
      trip.base = { seen: {}, fill: "auto" };
      trip.page = 0;
      return next;
    },
    pages: [
      ({ a, s }: Ctx<BridgeInputs>) => {
        const B = bridgeSplit(a), r = Math.round(a.retire!), split = B.roth > 0 || B.brok > 0;
        const T: Task[] = [
          { h: "Your savings at " + fmtNum(r) + ", about <b>" + money(B.total) + "</b> in today's dollars, are split into <b>Traditional</b>, <b>Roth</b> and <b>Brokerage</b>" +
            (split ? " in the same shares you have today." : ". The guide didn't know your split, so it's all under Traditional: move what's in a Roth or a taxable account.") },
          { h: "<b>Of that, contributions</b> is what you put into Roth accounts yourself, which can come out any time" +
            (B.basis > 0 ? ". We used today's Roth balance as a guess; your records or Form 8606 have the real number." : ". Enter it if you have a Roth.") },
          { h: "<b>Cost basis</b> is how much of the brokerage is money you put in rather than growth. 60% is a placeholder; your broker shows it." },
          { h: "<b>Yearly spending</b> is your retirement spending" + (bridgeSpend(a) < (a.retSpend || 0) - 1
            ? ", less the health premiums you added: the tool prices ACA coverage for each plan itself."
            : ". It should leave out health insurance, since the tool prices ACA coverage for each plan itself.") },
        ];
        if (r >= 55) T.push({ h: "Retiring at " + r + ", the rule of 55 may apply: enter what's in the 401(k) at the job you're leaving under <b>Of that, in the 401(k) you're leaving</b>.",
          ok: parseNum(s.k401) > 0 ? true : undefined });
        return T;
      },
      () => [
        { h: "<b>Best way to 59½</b> is the plan that gets there penalty-free in the most historical markets, then costs the least. What it does is listed underneath." },
        { h: "<b>Holds up in</b> is the share of retirements since 1926 where that plan made it to 59½ without running short or needing penalized money." },
        { h: "<b>Cost of the bridge</b> is the income tax, penalties and health premiums it pays on the way." },
      ],
      ({ s, trip }: Ctx<BridgeInputs>) => {
        const base = (trip.base || {}) as { seen?: Record<string, 1> };
        return routeTasks(s, (base.seen = base.seen || {}));
      },
      ({ s, trip }: Ctx<BridgeInputs>) => {
        const b = trip.base as { fill: string } | undefined;
        return [
          { h: "The table shows each account at 59½ in an <b>Average</b> market, and in <b>Above average</b> and <b>Below average</b> ones, all real starts from history." },
          { h: "Switch between them at the top of that panel; the charts and the year-by-year table follow.", ok: !on('#segBRPath [data-brpath="avg"].on') ? true : undefined },
          { h: "Under <b>Account balances</b>, switch to <b>Across history</b> to see the range over every start since 1926.", ok: on('#segBRBal [data-brbal="hist"].on') ? true : undefined },
          { h: "<b>Blended plan converts</b>, on the left, picks how much to convert automatically. Try <b>To the top of the 12% bracket</b> to see what converting more costs now in tax and health premiums.",
            ok: b && s.fill !== b.fill ? true : undefined },
          { h: "Later, <b>Send to Drawdown Simulator</b> carries these balances into the years after 59½. For now, <b>Back to guide</b> brings the plan with you." },
        ];
      },
    ],
    chip: ({ s }: Ctx<BridgeInputs>) => {
      const run = bridgeRun(s);
      if (!run) return "";
      const t = run.best.test;
      return "Holds up in<br><b>" + (t.of ? pctStr(t.hold / t.of, 0) : "—") + "</b>";
    },
    capture: ({ s }: Ctx<BridgeInputs>) => {
      const run = bridgeRun(s);
      if (!run) return null;
      const b = run.best, t = b.test, h = t.of ? t.hold / t.of : 0;
      return { set: { bridge: b.phrase, bridgeHold: Math.round(h * 100), bridgeLeft: Math.round(b.steady.end.total) },
        msg: "From the Early Retirement Bridge: with <b>" + escapeHtml(b.phrase) + "</b> (" + escapeHtml(b.desc || "") + "), you reach 59½ penalty-free in <b>" +
          pctStr(h, 0) + "</b> of historical markets, with about <b>" + money(b.steady.end.total) + "</b> left" +
          (h < 0.8 ? ". That's a shaky bridge: more in a Roth or taxable account, a later retirement or lower early spending would help." : ".") };
    },
  },

  healthcare: {
    prefill: (a: Answers, s: HealthcareInputs) => {
      const next = { ...s, status: mar(a) ? "m" : "s", household: mar(a) ? "2" : "1" };
      if (ok(a.retire)) next.retireAge = String(Math.max(40, Math.min(75, Math.round(a.retire))));
      if (mar(a) && ok(a.spouseAge) && ok(a.age) && ok(a.retire)) next.spouseAge = String(Math.round(a.spouseAge + (a.retire - a.age)));
      if (a.state && STATE_OPTIONS.some((o) => o.code === a.state)) next.state = a.state;
      if (pos(a.retSpend)) next.income = gdM(a.retSpend);
      return next;
    },
    tasks: () => [
      { h: "Retirement age, filing status, household size and state are filled in from your answers." },
      { h: "<b>Retirement MAGI</b> starts at your planned yearly spending, a cautious guess. Roth withdrawals and cash savings don't count toward it, so yours may be lower, which can mean a bigger subsidy." },
      { h: "Read the <b>Pre-65</b> section for your monthly premium before Medicare, then <b>Post-65</b> for what Medicare costs after." },
      { h: "Make sure those premiums fit inside the retirement spending you gave the guide." },
    ],
    chip: () => { const v = hcPrem(); return v != null ? "Premium before 65<br><b>" + money(v) + "/mo</b>" : ""; },
    capture: () => {
      const v = hcPrem();
      return { set: { hcSeen: true, ...(v != null ? { hcPrem: v } : {}) },
        msg: (v != null ? "From the Healthcare Cost Planner: about <b>" + money(v) + "/mo</b> for marketplace coverage before 65. " : "Back from the Healthcare Cost Planner. ") +
          "If that isn't part of your retirement spending, add it on the <b>Spending in retirement</b> step." };
    },
  },

  fire: {
    prefill: (a: Answers, s: FireInputs) => {
      const next = { ...s, contrib: gdM(saveNow(a)), period: "Monthly" };
      if (ok(a.age)) next.curAge = String(Math.max(18, Math.min(70, Math.round(a.age))));
      if (ok(a.retire)) next.retireAge = String(Math.round(a.retire));
      if (ok(a.saved)) next.initial = gdM(a.saved);
      if (pos(a.retSpend)) { next.target = gdM(a.retSpend); next.solveFor = "withdrawal"; }
      return next;
    },
    tasks: ({ s }: Ctx<FireInputs>) => [
      { h: "Your savings, monthly saving and yearly spending (as the target) are loaded." },
      { h: "<b>FIRE age</b> is when your savings could cover that spending at the <b>Withdrawal rate</b>: 4% is the classic figure, 3.5% more cautious." },
      { h: "Switch to <b>Coast FIRE</b> at the top of the inputs. It finds when you could stop contributing and let growth carry you to your planned retirement age.", ok: s.mode === "coast" },
      { h: "Raise the contribution a little and see how many years it takes off." },
    ],
    chip: () => { const t = text("#fiAge"); return t && t !== "—" ? escapeHtml(text("#fiAgeLabel")) + "<br><b>" + escapeHtml(t) + "</b>" : ""; },
    capture: () => {
      const t = text("#fiAge");
      if (!t || t === "—") return null;
      const label = text("#fiAgeLabel");
      return { set: { fiAge: t, fiLabel: label }, msg: "From the FIRE Calculator: " + escapeHtml(label) + " <b>" + escapeHtml(t) + "</b>." };
    },
  },

  advanced: {
    prefill: (a: Answers, s: Inputs) => {
      // Only the first time per version of the plan, so going back to tweak
      // it keeps your changes; and never over an account-type split.
      if (filled.advanced === planSig(a) || s.acOn || !ok(a.age) || !ok(a.retire) || !(a.retire > a.age)) return s;
      filled.advanced = planSig(a);
      const infl = BASIC_INFL as number, grossR = (1 + (a.risk || 0.045)) * (1 + infl) - 1;
      const next = { ...s, ...advancedFields({ initial: a.saved || 0, contrib: Math.round(saveMo(a)), period: "Monthly", growth: infl, gross: grossR, nominal: grossR,
        inflation: infl, years: Math.round(a.retire - a.age), withdrawal: 0.04, taxRate: 0.1, vol: 0.15, fees: 0 }) };
      if (pos(a.retSpend)) Object.assign(next, { solveFor: "After-Tax Withdrawal", target: gdM(a.retSpend) });
      return next;
    },
    tasks: ({ a, s }: Ctx<Inputs>) => {
      const mode = q("#segSingle [data-mode].on");
      return [
        { h: "Your plan is carried over: savings as <b>Starting value</b>, your monthly saving, <b>Time period</b> until retirement, and a <b>Rate of return</b> for your mix, before inflation. Figures are in future dollars unless marked <b>inflation adjusted</b>." },
        { h: "Plainly: Advanced leaves out Social Security and the guide's year-by-year taxes and health premiums, using one flat tax rate instead, so its numbers are for your savings alone. The guide's number stays the one for the retirement years." +
          (ok(a.stopAge) && a.stopAge < a.retire! ? " It also saves right up to retirement; your plan to stop at " + fmtNum(a.stopAge) + " shows in <b>Stages</b>." : "") +
          (hasChanges(a) ? " It saves one flat amount; your changes ahead show in <b>Stages</b>." : "") },
        { h: "<b>Contribution growth</b> raises what you save each year. It's set to match inflation; try 4% or 5% if you expect raises." },
        { h: "Turn on <b>Split by account type</b> to enter traditional, Roth and brokerage balances separately, plus your employer match. The <b>By account type</b> table then shows the tax on what you'd withdraw.", ok: s.acOn ? true : undefined },
        { h: "Set <b>Fees</b> to your funds' expense ratio (about 0.05% for index funds, 0.5% to 1% for managed ones) to see what they cost over decades.", ok: parseNum(String(s.fees)) > 0 ? true : undefined },
        { h: "<b>Work backwards from a target</b> starts at your retirement spending. It shows the contribution, or the timeline, that gets you there; <b>Use this contribution</b> applies it." },
        { h: "Above the chart, switch <b>Rate band</b> to <b>Historical</b> or <b>Monte Carlo</b> to see the plan in real and random markets.", ok: mode ? mode.getAttribute("data-mode") !== "band" : undefined },
      ];
    },
    chip: () => { const t = text("#rFVreal"); return t && t !== "—" ? "Inflation adjusted<br><b>" + escapeHtml(t) + "</b>" : ""; },
    capture: () => ({ set: { advSeen: true }, msg: "Back from Advanced. Your guide answers are unchanged, and whatever you set up there stays in Advanced for next time." }),
  },

  stages: {
    prefill: (a: Answers, s: StagesInputs, trip: Trip) => {
      const sched = guideSchedule(a), sig = planSig(a) + (sched ? "|" + JSON.stringify(sched.map((x) => [x.from, x.to, x.monthly])) : "");
      if (filled.stages === sig) return s;
      stagesFrom = "";
      if (s.saOn || !ok(a.age) || !ok(a.retire) || !(a.retire > a.age)) return s;
      filled.stages = sig;
      const yrs = Math.round(a.retire - a.age), mo = Math.round(saveMo(a)), infl = BASIC_INFL as number;
      const grossR = (1 + (a.risk || 0.045)) * (1 + infl) - 1;
      const st = (name: string, years: number, contrib: number, adj?: boolean) => ({ ...stageFields({ years, contrib, period: "Monthly", growth: infl, nominal: grossR, vol: 0.15, adj: !!adj }), name });
      // Changes ahead's schedule, stage by stage and named as the guide names
      // them, each in today's dollars ("Inflation adjusted"), so Stages shows
      // the guide's own number (doc 3, phase 4).
      if (sched) {
        const list = sched.map((x, i) => st(x.label, x.to - x.from, x.monthly, i > 0));
        stagesFrom = "your " + sched.length + " stages from Changes ahead: " + sched.map((x) => x.label.toLowerCase() + " (" + money(x.monthly) + "/mo)").join(", ");
        stagesN = list.length;
        trip.base = { sched: sched.map((x) => ({ from: x.from, to: x.to, monthly: x.monthly })) };
        return { ...s, initial: g(a.saved || 0), inflation: String(+(infl * 100).toFixed(6)), withdrawal: "4", taxRate: "10", fees: "0", stages: list,
          solveFor: "After-Tax Withdrawal", target: pos(a.retSpend) ? g(a.retSpend) : s.target };
      }
      let list;
      const dy = pos(a.debtMonths) ? Math.ceil(a.debtMonths / 12) : 0;
      const cy = a.college === "yes" && ok(a.kidAge) && pos(a.collegeMo) ? Math.max(1, Math.round(22 - a.kidAge)) : 0;
      const sy = ok(a.stopAge) && a.stopAge < a.retire ? Math.max(0, Math.round(a.stopAge - a.age)) : null;
      // Start from a real turning point in the answers when there is one:
      // a plan to stop saving, the debt paid off freeing its minimums, or
      // college ending freeing that saving.
      if (sy === 0) {
        list = [st("Coasting", yrs, 0)];
        stagesFrom = "one stage with no new saving, since your plan is to coast from here";
      } else if (sy != null) {
        list = [st("Saving", sy, mo), st("Coasting", yrs - sy, 0)];
        stagesFrom = "two stages: saving " + money(mo) + "/mo until " + fmtNum(a.stopAge!) + ", then coasting with no new saving until you retire at " + fmtNum(a.retire);
      } else if (dy && dy < yrs && pos(a.debtMin)) {
        list = [st("Paying off debt", dy, mo), st("Debt-free", yrs - dy, mo + Math.round(a.debtMin), true)];
        stagesFrom = "two stages: saving " + money(mo) + "/mo while you pay off debt, then adding the " + money(a.debtMin) + "/mo of minimums once it's gone";
      } else if (cy && cy < yrs) {
        list = [st("Kids at home", cy, mo), st("After college", yrs - cy, mo + Math.round(a.collegeMo!), true)];
        stagesFrom = "two stages: saving " + money(mo) + "/mo until your youngest finishes college, then adding the " + money(a.collegeMo!) + "/mo you'd been putting toward it";
      } else {
        list = [st("Until retirement", yrs, mo)];
        stagesFrom = "one stage: " + money(mo) + "/mo for " + yrs + " years";
      }
      stagesN = list.length;
      return { ...s, initial: g(a.saved || 0), inflation: String(+(infl * 100).toFixed(6)), withdrawal: "4", taxRate: "10", fees: "0", stages: list,
        solveFor: "After-Tax Withdrawal", target: pos(a.retSpend) ? g(a.retSpend) : s.target };
    },
    tasks: ({ s }: Ctx<StagesInputs>) => {
      const mode = q("#segSeries [data-mode].on");
      return [
        { h: "Stages splits your working years into chapters, each with its own contribution, raises and return." + (stagesFrom ? " From your answers we started with " + stagesFrom + "." : "") },
        { h: "Click <b>Add stage</b> for the next big change: a promotion, a paid-off car, going part-time. Give it <b>Years</b> and a <b>Contribution</b>.", ok: s.stages.length > stagesN },
        { h: "Tick <b>Inflation adjusted</b> on a later stage to type its contribution in today's dollars; it's grown by inflation up to that stage's start." },
        { h: "Each stage can have its own <b>Rate of return</b>, and the last one can glide toward bonds as retirement nears." },
        { h: "<b>Stage by stage</b>, under the chart, shows what each chapter adds, and the chart marks every boundary." },
        { h: "Switch the chart to <b>Historical</b> to see the whole multi-stage plan in real markets.", ok: mode ? mode.getAttribute("data-mode") !== "band" : undefined },
      ];
    },
    chip: () => { const t = text("#xFVreal"); return t && t !== "—" ? "Inflation adjusted<br><b>" + escapeHtml(t) + "</b>" : ""; },
    capture: ({ a, s, trip }: Ctx<StagesInputs>) => {
      const base = (trip.base as { sched?: { from: number; to: number; monthly: number }[] } | undefined)?.sched;
      const quiet = { set: { stagesSeen: true }, msg: "Back from Stages. Your guide answers are unchanged, and your stages stay there for next time." };
      if (!base || !base.length || !ok(a.age)) return quiet;
      // Each year's saving in today's dollars, as Stages now has it.
      const infl = BASIC_INFL as number, age0 = base[0].from, now: number[] = [];
      let t = 0;
      for (const x of s.stages) {
        const n = Math.max(0, Math.round(parseNum(x.years))), per = ((PPY as Record<string, number>)[x.period] || 12) / 12, c = parseNum(x.contrib) * per;
        const real = x.adj || t === 0 ? c : c / Math.pow(1 + infl, t);
        for (let k = 0; k < n; k++) now.push(Math.round(real));
        t += n;
      }
      const was: number[] = [];
      for (const x of base) for (let y = x.from; y < x.to; y++) was.push(x.monthly);
      const edits: ChangeEvent[] = [];
      for (let i = 0; i < was.length && i < now.length;) {
        if (now[i] === was[i]) { i++; continue; }
        let j = i;
        while (j < was.length && j < now.length && now[j] - was[j] === now[i] - was[i]) j++;
        edits.push({ id: "stg-" + (age0 + i) + "-" + (age0 + j), kind: "custom", from: age0 + i, to: age0 + j, delta: now[i] - was[i], label: "" });
        i = j;
      }
      if (!edits.length) return quiet;
      const events = [...(a.events || []).filter((e) => !e.id.startsWith("stg-")), ...edits];
      return { set: { stagesSeen: true, events }, undo: { events: a.events ?? null },
        msg: "From Stages: " + edits.map((e) => (e.kind === "custom" ? "ages " + e.from + " to " + e.to + ", " + (e.delta > 0 ? "+" : "−") + money(Math.abs(e.delta)) + "/mo" : "")).join("; ") +
          ". They're on Changes ahead now as your own edits, and your number uses them." };
    },
  },

  /* The already-retired on-ramp (doc 2, "Already retired"): the Drawdown
     Simulator filled from the on-ramp's answers, as a trip fills it, with
     no plan run first. Social Security already claimed goes in as a known
     benefit from now; a pension as other income. */
  retired: {
    prefill: (a: Answers, s: DrawdownState, trip: Trip) => {
      if (!ok(a.age) || !pos(a.saved) || !pos(a.retSpend)) return s;
      const age = Math.round(a.age), spAge = mar(a) && ok(a.spouseAge) ? Math.round(a.spouseAge) : null;
      const years = Math.max(20, Math.min(60, Math.max(95 - age, spAge != null ? 95 - spAge : 0)));
      const rate = Math.round((a.retSpend / a.saved) * 10000) / 100;
      const d: Record<string, unknown> = { initial: Math.round(a.saved), years, strategy: "fixed", stock: 60, stockEnd: "", fee: 0, rate: Math.max(0.01, rate),
        retireAge: String(age), guardBand: 20, adjust: 10, floor: 10, ceil: 10, yaleWeight: 70, yaleRate: rate, vpwRate: 3.7, vpwFV: 0, spendFloor: 0, spendCeil: 0, legacyGoal: 0,
        ssMode: "manual", ssWho: mar(a) && pos(a.ssOwn2) ? "couple" : "single", ssAmount: Math.round((a.ssOwn || 0) * 12), ssAmount2: Math.round((a.ssOwn2 || 0) * 12), ssDelay: age };
      const keep = s.incomeItems.filter((x) => x.name !== "Pension (from the guide)");
      d.incomeItems = [...keep, ...pensionItems(a, age).map((x) => ({ ...x, name: "Pension (from the guide)" } as DdItem))];
      trip.base = { seen: {} };
      return ddWrite(s, d);
    },
    tasks: ({ a }: Ctx<DrawdownState>) => [
      { h: "Your " + (pos(a.saved) ? money(a.saved) : "savings") + " and " + (pos(a.retSpend) ? money(a.retSpend) + " a year" : "spending") + " are loaded as a <b>Starting withdrawal rate</b>" +
        (pos(a.ssOwn) ? ", with Social Security from now" : "") + (pos(a.pension) ? " and your pension under <b>Other income</b>" : "") + ". The simulator doesn't work out tax, so include it in what you spend." },
      { h: "<b>Success rate</b> is the share of real retirements since 1926 where the money never ran out. 85% or more is solid." },
      { h: "Under <b>How each starting year fared</b>, tap a hard one such as <b>1966</b> or <b>1929</b>, and switch the chart to <b>Selected year</b> to watch it play out.", ok: on('#segDDView [data-ddview="year"].on') },
      { h: "Try <b>Guardrails</b> under <b>Withdrawal strategy</b>: it cuts a little in bad years, and you'll see how much longer the money lasts for it." },
    ],
    chip: () => { const t = text("#ddSuccess"); return t && t !== "—" ? "Success rate<br><b>" + t + "</b>" : ""; },
    capture: () => ({ msg: "Back from the Drawdown Simulator. Your answers stay here, and the simulator keeps your numbers for next time." }),
  },

  backtest: {
    prefill: (a: Answers, s: Inputs) => {
      if (filled.backtest) return s;
      filled.backtest = true;
      return { ...s, stock: String(mixFor(a.risk)), sv: "0", cash: "0" };
    },
    tasks: ({ a, s }: Ctx<Inputs>) => {
      const mix = mixFor(a.risk), era = q("#segBTEra button.on");
      const moved = (era && era.getAttribute("data-era") !== "all") || parseNum(String(s.stock)) !== mix || parseNum(String(s.sv)) > 0 || parseNum(String(s.cash)) > 0;
      return [
        { h: "<b>Asset mix</b> is set to " + mix + "% stocks, close to your " + riskLabel(a.risk || 0.045) + " mix; the rest is bonds. This shows what that mix actually earned, year by year, since 1926." },
        { h: "<b>After inflation</b> is the figure to compare with the " + pctStr(a.risk || 0.045, 1) + " a year the guide assumed for your plan. <b>Return, per year</b> is the same before inflation." },
        { h: "Try <b>Last 30</b> or <b>Last 50</b>, and a different mix, to see how much the answer moves with the period you pick.", ok: !!moved },
        { h: "<b>Worst year</b> and <b>Deepest fall</b> show what you'd have had to sit through. If a drop like that would have made you sell, a lower stock mix may suit you better." },
        { h: "<b>Rolling returns</b> lists every stretch of years, not just one average, so you can see the range: the best, the worst and the typical." },
        { h: "Use it to choose a reasonable rate for planning, and <b>Use these figures in Advanced</b> carries it over. Past performance doesn't predict future returns: treat history as a range of what's possible, and plan toward the cautious end of it." },
      ];
    },
    chip: () => { const t = text("#btReal"); return t && t !== "—" ? "After inflation<br><b>" + escapeHtml(t) + "</b>" : ""; },
    capture: ({ a }: Ctx<Inputs>) => ({ set: { btSeen: true }, msg: "Back from Portfolio Backtest. Remember, history shows the range of what's happened, not a forecast. The guide keeps assuming " +
      pctStr(a.risk || 0.045, 1) + " a year after inflation; change your mix on the <b>How it's invested</b> card if you'd like a different one." }),
  },
} as unknown as Record<string, TripDef<never>>;

/** A trip's workings, typed loosely for the coach and the guide. */
export const trip = (id: string) => TRIPS[id] as unknown as TripDef<Inputs> | undefined;
