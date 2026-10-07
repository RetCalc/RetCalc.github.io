/* The plan card's lists (doc 2, "The plan and the hand-off"; doc 3,
   section 3, items 7 and 11): your next moves, in order, each naming its
   figure, why, the tool or card that does it, when, and the points it
   could add; what's going well, which never names an area a move is
   working on; and the toolkit, at most four tools chosen for this plan.
   Plain data from the plan the worker ran, so the tests check the rules
   and the sheet prints the same list. From gdActions() in
   src/js/app/30-guide-steps.js. */

import { debtDate } from "@/lib/engine/typed";
import { fmtNum, money, pctStr } from "@/lib/format";
import {
  FACTORS, accts, gross, mar, months, need, ok, options, parts, pos, saveMo, score, sim, tactics, target, withGuess,
  type FactorId, type Levers, type OptSet, type Part, type Sim,
} from "./calc";
import { headroom } from "./score";
import type { Answers, Sources } from "./store";

export type When = "This month" | "This year" | "When you're ready";
export interface Move {
  /** Stable, for the ticks that persist. */
  id: string;
  /** The area of the score it works on. */
  area?: FactorId;
  /** The title, naming the figure. */
  t: string;
  /** One line of why, with figures in bold (the guide's own HTML). */
  d: string;
  when: When;
  /** The points it could add: the area's headroom. */
  pts?: number;
  trip?: string; go?: string; btn?: string;
}

/** What the lists are worked out from: the plan, what it needs, and the
    solved options (for the gap's fixes or what the surplus could buy). */
export interface PlanFacts {
  S: Sim | null;
  need: number | null;
  O: { ahead: boolean; list: { id: string; set: OptSet }[] } | null;
}

/** The same facts worked out here, on the page: for the printed sheet and
    the tests. The card itself takes them from the worker. */
export function factsHere(a: Answers, levers: Levers): PlanFacts {
  const b = withGuess(a), S = sim(b);
  const O = S ? options(b, levers) : null;
  return { S, need: S ? need(b, S) : null, O: O ? { ahead: O.ahead, list: O.list } : null };
}

const or = (bits: string[]) => bits.join(", or ").replace(/, or ([^,]*)$/, ", or $1");

/** Today's rules, ordered by the points each could add (the area's
    headroom), today's order breaking ties and placing the moves that earn
    no points; at most six. That's doc 3's "sorts partly by headroom", and
    gives doc 2's examples: Maya and Sam's emergency fund, then the 8% debt,
    then what the surplus could buy; Dan's gap first. */
export function moves(a: Answers, F: PlanFacts): Move[] {
  const { S, O } = F, P = parts(a, S), inc = gross(a), out: Move[] = [];
  const pts = (id: FactorId) => headroom(id, P[id], a)?.pts;
  if (P.flow && !P.flow.bad && a.takehome! < a.spend!)
    out.push({ id: "overspend", area: "flow", when: "This month", t: "Spend " + money(a.spend! - a.takehome!) + " a month less",
      d: "You're spending more than your take-home. Go through your budget line by line and trim the biggest items until it's back in the black.", trip: "budget", btn: "Open Budget" });
  if (P.cushion && !P.cushion.bad && P.cushion.m! < 1)
    out.push({ id: "starter", area: "cushion", when: "This month", t: "Put " + money(a.spend!) + " aside: one month of spending",
      d: "A starter emergency fund, in a savings account, before anything else, so a surprise bill doesn't land on a credit card." });
  if (a.match === "partial")
    out.push({ id: "match", area: "rate", when: "This month", t: "Get all of your employer's match",
      d: "Raise your 401(k) contribution until every matched dollar comes in. A match is an instant 50% to 100% return you won't find anywhere else." });
  if (a.debtHas === "yes" && (a.debtHi || 0) > 0)
    out.push({ id: "debt", area: "debt", when: "This year", t: "Pay off the " + money(Math.min(a.debtHi!, a.debtTotal || a.debtHi!)) + " at 8% or more",
      d: "It costs more than investing is likely to earn. Put every spare dollar at it, highest rate first." +
        (a.debtMonths ? " Your current plan has you debt-free by " + debtDate(a.debtMonths) + "." : ""), trip: "debt", btn: "Open Debt Payoff" });
  if (a.match === "unsure")
    out.push({ id: "match-unsure", area: "rate", when: "This month", t: "Find out whether your employer matches",
      d: "Check your benefits site or ask HR. If there's a match, contribute at least enough to get all of it." });
  if (P.cushion && !P.cushion.bad && P.cushion.m! >= 1 && P.cushion.m! < 3)
    out.push({ id: "cushion", area: "cushion", when: "This year", t: "Grow your emergency fund to " + money(a.spend! * 3),
      d: "You have " + months(P.cushion.m!) + " months of spending; three is " + money(a.spend! * 3) + " and six is " + money(a.spend! * 6) + ". Automate a transfer each payday until you're there." });
  const goal = target(a), ahead = !!S && S.success >= goal - 1e-9;
  if (P.rate && P.rate.r! < 0.15 && inc > 0 && !ahead)
    out.push({ id: "rate", area: "rate", when: "This year", t: "Save " + money(Math.max(0, (inc * 0.15) / 12 - saveMo(a))) + " a month more, toward 15%",
      d: "You save " + pctStr(P.rate.r!, 1) + " of your income. Raising it 1% a year, or at every raise, gets you there without feeling it.", trip: "basic", btn: "Try it in Basic" });
  if (S && !ahead) {
    const pick = (id: string) => O?.list.find((o) => o.id === id)?.set;
    const bits: string[] = [], x = pick("extra"), l = pick("later"), sp = pick("less-spend");
    if (x) bits.push("save <b>" + money(x.contrib! - (a.contrib || 0)) + " a month more</b>");
    if (l) bits.push("retire at <b>" + l.retire + "</b>");
    if (sp) bits.push("plan on <b>" + money(sp.retSpend!) + " a year</b> in retirement");
    out.push({ id: "gap", area: "outlook", when: "This year", t: "Close the gap: it lasted in " + pctStr(S.success, 0) + " of history",
      d: (bits.length ? "Any one of these gets it to " + pctStr(goal, 0) + ": " + or(bits) + ". A mix of smaller changes works too." : "Saving more, retiring later and spending less all help."),
      go: "adjust", btn: "See the options and apply one" });
  } else if (S && O) {
    // Ahead of target: say what the surplus could buy, not just "you're fine".
    const pick = (id: string) => O.list.find((o) => o.id === id)?.set;
    const bits: string[] = [], e = pick("earlier"), c = pick("coast"), m = pick("more");
    if (e) bits.push("retire at <b>" + e.retire + "</b>");
    if (c) bits.push(c.stopAge! <= a.age! ? "<b>stop saving now</b>" : "stop saving at <b>" + c.stopAge + "</b>");
    if (m) bits.push("spend <b>" + money(m.retSpend!) + " a year</b>");
    if (bits.length && F.need != null && F.need > 0 && S.fv >= F.need * 1.2)
      out.push({ id: "surplus", when: "When you're ready", t: "Decide what to do with " + money(S.fv - F.need) + " to spare",
        d: "You're on course for " + money(S.fv) + " against the " + money(F.need) + " your plan needs. You could " + or(bits) +
          " and still last in " + (goal >= 1 ? "every" : pctStr(goal, 0) + " of") + " historical retirements. Or keep the margin: that's a fine choice too.",
        go: "adjust", btn: "Compare and apply" });
  }
  if (ok(a.retire) && a.retire < 59.5 && !a.bridge)
    out.push({ id: "bridge", when: "When you're ready", t: "Plan the " + Math.ceil(59.5 - a.retire) + " years before 59½",
      d: "Retiring at " + fmtNum(a.retire) + " leaves them before 401(k) and IRA withdrawals are penalty-free. The Early Retirement Bridge compares " +
        (a.retire >= 55 ? "the rule of 55, 72(t) payments" : "a Roth ladder, 72(t) payments") + " and living off a brokerage account.", trip: "bridge", btn: "Open Early Retirement Bridge" });
  else if (ok(a.retire) && a.retire < 59.5 && ok(a.bridgeHold) && a.bridgeHold < 80)
    out.push({ id: "bridge-shore", when: "When you're ready", t: "Shore up the bridge to 59½: it held in " + a.bridgeHold + "% of markets",
      d: "More savings in a Roth or taxable account, a later retirement or lower spending in the early years would widen the margin.", trip: "bridge", btn: "Revisit the bridge" });
  if (S && !tactics(a))
    out.push({ id: "optimizer", when: "When you're ready", t: "Let the Plan Optimizer look at the " + money(S.lifeTax) + " in tax",
      d: "It tries every claiming age from 62 to 70" + (mar(a) ? " for each of you" : "") + ", every order for drawing down your accounts and every Roth conversion level, through every market since 1926, and keeps the plan that does best.",
      go: "optimize", btn: "Open the Plan Optimizer" });
  if (ok(a.retire) && a.retire < 65 && !a.hcSeen && S && S.hcYr > 0)
    out.push({ id: "healthcare", when: "When you're ready", t: "Get to know the " + money(S.hcYr) + " a year for health insurance before 65",
      d: "That's marketplace coverage after the subsidy your plan's income earns. The Healthcare Cost Planner shows how the subsidy moves with income, and what Medicare costs after.",
      trip: "healthcare", btn: "Open Healthcare Cost Planner" });
  if (a.college === "yes" && !pos(a.collegeMo))
    out.push({ id: "college", when: "This year", t: "Set a monthly college number", d: "Find out what to put aside each month, and consider a 529 plan for the tax break.", trip: "college", btn: "Open College Savings" });
  if (!pos(a.ssOwn) && S)
    out.push({ id: "ss", when: "This month", t: "Replace the Social Security estimate of " + money(S.ss.total / 12) + " a month",
      d: "Your statement at ssa.gov/myaccount uses your real earnings record and takes five minutes to get.", go: "social", btn: "Add it to your answers" });
  if (S && S.success >= 0.85 && !a.ddTool)
    out.push({ id: "stress", when: "When you're ready", t: "Stress-test how you'll spend it",
      d: "The Drawdown Simulator tour replays your plan through 1929, 1966 and 2000, and walks through each withdrawal strategy, your stock mix, when to claim Social Security, and big one-time costs.",
      trip: "drawdown", btn: "Start the tour" });
  for (const m of out) if (m.area) m.pts = pts(m.area);
  return out.map((m, i) => ({ m, i })).sort((x, y) => (y.m.pts ?? 0) - (x.m.pts ?? 0) || x.i - y.i).map((x) => x.m).slice(0, 6);
}

/** What's going well (correction 2): an area at 90% or more of its points
    that no move is working on. */
export function wins(P: Partial<Record<FactorId, Part>>, list: Move[]) {
  return FACTORS.filter((f) => P[f.id] && !P[f.id]!.bad && P[f.id]!.p >= 0.9 && !list.some((m) => m.area === f.id));
}

/* ---------- the toolkit (doc 3, section 3, item 11) ---------- */
export interface Kit {
  id: string; name: string;
  /** Why it's here, in the person's figures. */
  why: string;
  /** The question it answers. */
  q: string;
  /** A trip with the numbers filled in, or the guide's own card. */
  trip?: string; go?: string;
}
export function toolkit(a: Answers, src: Sources, F: PlanFacts, list: Move[]): Kit[] {
  const { S } = F, P = parts(a, S), A = accts(a), saved = A.trad + A.roth + A.brok;
  const est = (k: "takehome" | "spend") => src[k]?.kind === "estimated" || src[k]?.kind === "default";
  const all: (Kit & { on: boolean })[] = [
    { id: "drawdown", name: "Drawdown Simulator", trip: "drawdown", on: !!S, why: "Every plan: any single starting year, in full",
      q: "How does one retirement play out year by year, and what does a flexible rule change?" },
    { id: "optimizer", name: "Plan Optimizer", go: "optimize", on: !!S && (mar(a) || (saved > 0 && A.trad / saved > 0.4) || (ok(a.retire) && a.retire < 65)),
      why: mar(a) ? "Two claiming ages to choose" : ok(a.retire) && a.retire < 65 ? "Retiring at " + fmtNum(a.retire) + ", before Medicare" : "Most of your savings is traditional",
      q: "When to claim, which account to draw first, and whether to convert to Roth" },
    { id: "healthcare", name: "Healthcare Cost Planner", trip: "healthcare", on: ok(a.retire) && a.retire < 65,
      why: ok(a.retire) ? "Retiring at " + fmtNum(a.retire) + ", " + Math.ceil(65 - a.retire) + " years before Medicare" : "", q: "Marketplace premiums and the subsidy, then Medicare" },
    { id: "bridge", name: "Early Retirement Bridge", trip: "bridge", on: ok(a.retire) && a.retire < 59.5,
      why: ok(a.retire) ? "Retiring at " + fmtNum(a.retire) + ", before 59½" : "", q: "How to reach the money without the penalty" },
    { id: "debt", name: "Debt Payoff", trip: "debt", on: a.debtHas === "yes" && (a.debtHi || 0) > 0,
      why: money(Math.min(a.debtHi || 0, a.debtTotal || a.debtHi || 0)) + " at 8% or more", q: "The order to pay, and the debt-free month" },
    { id: "budget", name: "Budget", trip: "budget", on: est("spend") || (!!P.flow && (P.flow.m ?? 1) < 0.1),
      why: est("spend") ? "Your spending is an estimate" : "Less than 10% of take-home left", q: "Where the money goes" },
    { id: "tax", name: "Income Tax", trip: "tax", on: est("takehome"), why: "Your take-home is an estimate", q: "Your real take-home" },
    { id: "college", name: "College Savings", trip: "college", on: a.college === "yes", why: "Saving for college", q: "The monthly amount" },
    { id: "fire", name: "FIRE Calculator", trip: "fire", on: !!S && ((ok(a.retire) && a.retire <= 55) || (F.need != null && F.need > 0 && S.fv >= F.need * 1.2)),
      why: ok(a.retire) && a.retire <= 55 ? "Retiring at " + fmtNum(a.retire) : "Ahead of what your plan needs", q: "The age your savings alone could carry your spending" },
    { id: "backtest", name: "Portfolio Backtest", trip: "backtest", on: a.risk === 0.07 || a.risk === 0.02,
      why: a.risk === 0.07 ? "An aggressive mix" : "A very conservative mix", q: "What your mix has actually earned" },
  ];
  const tied = (k: Kit) => list.findIndex((m) => (!!k.trip && m.trip === k.trip) || (!!k.go && m.go === k.go));
  const on = all.filter((k) => k.on);
  // The tools tied to the moves first, in the moves' order, then by the rule's order; Drawdown always.
  const picked = on.filter((k) => k.id !== "drawdown").map((k, i) => ({ k, i, t: tied(k) }))
    .sort((x, y) => (x.t < 0 ? 99 : x.t) - (y.t < 0 ? 99 : y.t) || x.i - y.i).map((x) => x.k).slice(0, S ? 3 : 4);
  const dd = on.find((k) => k.id === "drawdown");
  return [...picked, ...(dd ? [dd] : [])].map(({ on: _on, ...k }) => k);
}

/** The score, the moves and the wins together, for the card and the sheet. */
export function planLists(a: Answers, src: Sources, F: PlanFacts) {
  const R = score(a, F.S), list = moves(a, F);
  return { R, list, wins: wins(R.P, list), kit: toolkit(a, src, F, list) };
}
