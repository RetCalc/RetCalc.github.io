"use client";

/* The score and the plan: the readiness score, the next moves in the order
   that matters, the plan as it stands, what's going well and your numbers.
   From gdResultsHTML(), gdActions() and gdRing() in src/js/app/30-guide-steps.js
   and 28-guide-core.js. */

import { debtDate } from "@/lib/engine/typed";
import { opTacticsLine } from "@/tools/optimizer/words";
import { fmtNum, money, pctStr } from "@/lib/format";
import { Html } from "@/components/ui/Html";
import { KV } from "@/components/ui/Readout";
import {
  FACTORS, coastNow, fixes, gross, mar, minSpend, months, need, ok, options, parts, pos, rating, saveMo, score, sim, stratName, tactics, target,
} from "./calc";
import type { Answers } from "./store";
import { firstOpen } from "./steps";
import { tuneState } from "./tune";
import { BackNote, Callout, H3, Q, useGuideView } from "./ui";

/** The score as a ring, with the number in it. */
export function Ring({ score: s, size }: { score: number | null; size?: number }) {
  const r = 52, c = 2 * Math.PI * r, f = s == null ? 0 : Math.max(0, Math.min(100, s)) / 100;
  return (
    <svg className="gd-ring" viewBox="0 0 120 120" role="img" aria-label={s == null ? "No score yet" : "Score " + s + " out of 100"}
      style={size ? { width: size + "px", height: size + "px" } : undefined}>
      <circle className="trk" cx="60" cy="60" r={r} fill="none" strokeWidth="10" />
      <circle className="val" cx="60" cy="60" r={r} fill="none" strokeWidth="10" strokeLinecap="round" stroke={rating(s).color}
        strokeDasharray={c.toFixed(1)} strokeDashoffset={(c * (1 - f)).toFixed(1)} transform="rotate(-90 60 60)" />
      <text x="60" y={s == null ? 67 : 69} textAnchor="middle" fontSize={s == null ? 22 : 32}>{s == null ? "—" : s}</text>
    </svg>
  );
}

/** One of the next moves: what to do and why (the guide's own words, with
    a figure in bold), and the tool or step that does it. */
export interface Action { t: string; d: string; trip?: string; go?: string; btn?: string }

export function actions(a: Answers): Action[] {
  const P = parts(a), S = sim(a), A: Action[] = [];
  const inc = gross(a);
  if (P.flow && a.takehome! < a.spend!)
    A.push({ t: "Spend less than you bring home",
      d: "You're spending " + money(a.spend! - a.takehome!) + "/mo more than your take-home. Go through your budget line by line and trim the biggest items until it's back in the black.", trip: "budget", btn: "Open Budget" });
  if (P.cushion && P.cushion.m! < 1)
    A.push({ t: "Build a starter emergency fund",
      d: "Get one month of spending, " + money(a.spend!) + ", into a savings account before anything else, so a surprise bill doesn't land on a credit card." });
  if (a.match === "partial")
    A.push({ t: "Get your full employer match",
      d: "Raise your 401(k) contribution until every matched dollar comes in. A match is an instant 50% to 100% return you won't find anywhere else." });
  if (a.match === "unsure")
    A.push({ t: "Find out whether your employer matches",
      d: "Check your benefits site or ask HR. If there's a match, contribute at least enough to get all of it." });
  if (a.debtHas === "yes" && (a.debtHi || 0) > 0)
    A.push({ t: "Pay off your high-interest debt",
      d: money(a.debtHi!) + " at 8% or more costs more than investing is likely to earn. Put every spare dollar at it, highest rate first." +
        (a.debtMonths ? " Your current plan has you debt-free by " + debtDate(a.debtMonths) + "." : ""), trip: "debt", btn: "Open Debt Payoff" });
  if (P.cushion && P.cushion.m! >= 1 && P.cushion.m! < 3)
    A.push({ t: "Grow your emergency fund to 3 months or more",
      d: "You have " + months(P.cushion.m!) + " months. The target is " + money(a.spend! * 3) + " to " + money(a.spend! * 6) + ". Automate a transfer each payday until you're there." });
  const goal = target(a), ahead = !!S && S.success >= goal - 1e-9;
  if (P.rate && P.rate.r! < 0.15 && inc > 0 && !ahead)
    A.push({ t: "Raise your savings rate toward 15%",
      d: "You save " + pctStr(P.rate.r!, 1) + " of your income. Reaching 15% means about " + money(Math.max(0, (inc * 0.15) / 12 - saveMo(a))) + "/mo more. Raising it 1% each year, or at every raise, gets you there without feeling it.",
      trip: "basic", btn: "Try it in Basic" });
  if (S && !ahead) {
    const F = fixes(a, tuneState().levers) || {};
    const opts: string[] = [];
    if (F.extra) opts.push("save <b>" + money(F.extra) + "/mo more</b>");
    if (F.retire) opts.push("retire at <b>" + F.retire + "</b>");
    if (F.spend) opts.push("plan on <b>" + money(F.spend) + " a year</b> in retirement");
    A.push({ t: "Close your retirement gap",
      d: "Your plan lasted in " + pctStr(S.success, 0) + " of historical retirements. " +
        (opts.length ? "Any one of these gets it to " + pctStr(goal, 0) + ": " + opts.join(", or ").replace(/, or ([^,]*)$/, ", or $1") + ". A mix of smaller changes works too." : "Saving more, retiring later and spending less all help."),
      go: "tune", btn: "See the options and apply one" });
  } else if (S) {
    // Ahead of target: say what the surplus could buy, not just "you're fine".
    const O = options(a, tuneState().levers), pick = (id: string) => O && O.list.find((o) => o.id === id);
    const bits: string[] = [];
    const e = pick("earlier"), c = pick("coast"), m = pick("more");
    if (e) bits.push("retire at <b>" + e.set.retire + "</b>");
    if (c) bits.push(c.set.stopAge! <= a.age! ? "<b>stop saving now</b>" : "stop saving at <b>" + c.set.stopAge + "</b>");
    if (m) bits.push("spend <b>" + money(m.set.retSpend!) + " a year</b>");
    const want = need(a, S);
    if (bits.length && want > 0 && S.fv >= want * 1.2)
      A.push({ t: "Decide what to do with your surplus",
        d: "You're on course for " + money(S.fv) + " against the " + money(want) + " your plan needs. You could " + bits.join(", or ").replace(/, or ([^,]*)$/, ", or $1") +
          " and still last in " + (goal >= 1 ? "every" : pctStr(goal, 0) + " of") + " historical retirements. Or keep the margin: that's a fine choice too.",
        go: "tune", btn: "Compare and apply" });
  }
  if (ok(a.retire) && a.retire < 59.5 && !a.bridge)
    A.push({ t: "Plan how you'll reach your money before 59½",
      d: "Retiring at " + fmtNum(a.retire) + " leaves " + Math.ceil(59.5 - a.retire) + " years before 401(k) and IRA withdrawals are penalty-free. The Early Retirement Bridge compares " + (a.retire >= 55 ? "the rule of 55, 72(t) payments" : "a Roth ladder, 72(t) payments") + " and living off a brokerage account, and shows what you'd have left at 59½.",
      trip: "bridge", btn: "Open Early Retirement Bridge" });
  else if (ok(a.retire) && a.retire < 59.5 && ok(a.bridgeHold) && a.bridgeHold < 80)
    A.push({ t: "Shore up the bridge to 59½",
      d: "Your best plan in the Early Retirement Bridge held up in only " + a.bridgeHold + "% of markets. More savings in a Roth or taxable account, a later retirement or lower spending in the early years would widen the margin.",
      trip: "bridge", btn: "Revisit the bridge" });
  if (S && !tactics(a))
    A.push({ t: "Let the Plan Optimizer tune your withdrawals",
      d: "It tries every age from 62 to 70 for " + (mar(a) ? "each of you to claim" : "claiming") + " Social Security, every order for drawing down your accounts and every Roth conversion level, through every market since 1926, and keeps the plan that does best. " +
        "Your plan now pays about " + money(S.lifeTax) + " in tax over retirement.", go: "optimize", btn: "Open the Plan Optimizer" });
  if (ok(a.retire) && a.retire < 65 && !a.hcSeen && S && S.hcYr > 0)
    A.push({ t: "Get to know your health insurance costs before Medicare",
      d: "Your plan prices marketplace coverage at about " + money(S.hcYr) + " a year until 65, after the subsidy its income earns. The Healthcare Cost Planner shows how that subsidy moves with income, and what Medicare costs after.", trip: "healthcare", btn: "Open Healthcare Cost Planner" });
  if (a.college === "yes" && !pos(a.collegeMo))
    A.push({ t: "Set a monthly college number", d: "Find out what to put aside each month, and consider a 529 plan for the tax break.", trip: "college", btn: "Open College Savings" });
  if (!pos(a.ssOwn) && S)
    A.push({ t: "Check your Social Security estimate",
      d: "We estimated it from today's income. Your statement at ssa.gov/myaccount uses your real earnings record and takes five minutes to get.", go: "retspend", btn: "Add it to your answers" });
  if (S && S.success >= 0.85 && !a.ddTool)
    A.push({ t: "Stress-test how you'll spend it", d: "The Drawdown Simulator tour replays your plan through 1929, 1966 and 2000, and walks through each withdrawal strategy, your stock mix, when to claim Social Security, and big one-time costs.", trip: "drawdown", btn: "Start the tour" });
  return A.slice(0, 6);
}

export function Results() {
  const G = useGuideView(), { v: a, g } = G, R = score(a), rt = rating(R.score), S = sim(a);
  if (R.score == null) return (
    <>
      <Q>Your retirement readiness</Q>
      <BackNote step="results" />
      <Callout cls="warn">There isn&apos;t enough to score yet. Answer the questions before this one and your score will appear here.</Callout>
      <button type="button" className="btn primary" data-go={firstOpen(g)} onClick={() => G.go(firstOpen(g))}>Go to the next open question</button>
    </>
  );
  const summary = R.score >= 85 ? "You're doing the big things right. Keep it going, and use the list below to fine-tune."
    : R.score >= 70 ? "You're close. A couple of changes below would put you firmly on track."
      : R.score >= 50 ? "You've got a foundation to build on. Work down the list below, in order."
        : "There's real work to do, and the list below puts it in the order that matters most. Every item moves the score.";
  const A = actions(a);
  const wins = FACTORS.filter((f) => R.P[f.id] && R.P[f.id]!.p >= 0.9).map((f) => f.name + ": " + R.P[f.id]!.txt);
  const want = S ? need(a, S) : 0;
  return (
    <>
      <Q>Your retirement readiness</Q>
      <BackNote step="results" />
      <div className="gd-hero"><Ring score={R.score} size={132} /><div className="gd-hero-t"><div className="r" style={{ color: rt.color }}>{rt.label}</div>
        <p>{summary}</p>{R.n < FACTORS.length ? <p className="hint" style={{ marginTop: "6px" }}>Based on {R.n} of {FACTORS.length} areas. Answer the rest to complete it.</p> : null}</div></div>
      {A.length ? (
        <>
          <H3>Your next moves, in order</H3>
          <ol className="gd-acts">{A.map((x) => (
            <li key={x.t} className="gd-act"><div><b>{x.t}</b><Html as="p" html={x.d} />
              {x.trip ? <button type="button" className="btn mini" data-trip={x.trip} data-from="results" onClick={() => G.trip(x.trip!, "results")}>{x.btn}<i className="arw" aria-hidden="true"></i></button> : null}
              {x.go ? <button type="button" className="btn mini" data-go={x.go} onClick={() => G.go(x.go!)}>{x.btn}</button> : null}</div></li>
          ))}</ol>
        </>
      ) : null}
      {S ? (
        <>
          <H3>Your plan</H3>
          <div className="gd-kvs">
            <KV k="Retire at" v={fmtNum(S.retire)} />
            <KV k="Saving" v={S.stop != null ? (S.stop <= a.age! ? "Coasting: no new savings" : money(S.monthly) + "/mo until " + fmtNum(S.stop) + ", then coasting") : money(S.monthly) + "/mo until you retire"} />
            <KV k="Spending in retirement" v={money(S.spend) + " a year"} />
            <KV k="Social Security" v={mar(a) && S.ss.a2 > 0 ? money(S.ss.a1 / 12) + "/mo from " + S.ss.claim + ", spouse " + money(S.ss.a2 / 12) + "/mo from " + S.ss.claim2 : money(S.ss.total / 12) + "/mo from " + S.ss.claim} />
            {S.pension ? <KV k="Pension" v={money(S.pension / 12) + "/mo"} /> : null}
            <KV k="Withdrawals" v={S.tactics ? opTacticsLine(S.T, S.C) : "Brokerage, then traditional, then Roth"} />
            <KV k="Income tax" v={"About " + money(S.taxYr) + " a year, " + money(S.lifeTax) + " in all"} />
            <KV k="Withdrawal approach" v={stratName(a.strategy || "fixed")} />
            {minSpend(a) ? <KV k="Minimum spending" v={money(minSpend(a)) + " a year"} /> : null}
            <KV k="Lasted, spending a fixed amount" v={pctStr(S.success, 0) + " of historical retirements"} />
          </div>
          <button type="button" className="btn mini" data-go="tune" style={{ margin: "-2px 8px 16px 0" }} onClick={() => G.go("tune")}>Adjust your plan</button>
          <button type="button" className="btn mini" data-go="optimize" style={{ margin: "-2px 0 16px" }} onClick={() => G.go("optimize")}>{S.tactics ? "Your roadmap" : "Plan Optimizer"}</button>
        </>
      ) : null}
      {wins.length ? <><H3>What&apos;s going well</H3><div className="gd-wins">{wins.map((w) => <span key={w}>{w}</span>)}</div></> : null}
      {(() => {
        const kv: [string, string][] = [];
        if (pos(a.takehome)) kv.push(["Take-home pay", money(a.takehome) + "/mo"]);
        if (pos(a.spend)) kv.push(["Spending", money(a.spend) + "/mo"]);
        if (ok(a.cash)) kv.push(["Emergency fund", money(a.cash)]);
        if (a.debtHas === "yes" && ok(a.debtTotal)) kv.push(["Debt, not counting a mortgage", money(a.debtTotal)]);
        if (ok(a.saved)) kv.push(["Retirement savings", money(a.saved)]);
        if (ok(a.contrib)) kv.push(["Saving for retirement", coastNow(a) ? "Nothing new: coasting" : money(saveMo(a)) + "/mo"]);
        if (S) { kv.push(["Projected at " + fmtNum(S.retire), money(S.fv)]); if (want > 0) kv.push(["Needed at " + fmtNum(S.retire), money(want)]); }
        if (a.fiAge) kv.push([a.fiLabel || "FIRE age", a.fiAge]);
        return kv.length ? <><H3>Your numbers</H3><div className="gd-kvs">{kv.map(([k, v]) => <KV key={k} k={k} v={v} />)}</div></> : null;
      })()}
      <div className="gd-share"><button type="button" className="btn" data-gd="print" onClick={() => G.act("print")}>Print or save as PDF</button>
        <button type="button" className="btn" data-gd="share" onClick={() => G.act("share")}>Copy a link to this plan</button>
        <span className="hint">The link carries your answers, so share it only with people you&apos;d show your finances to.</span></div>
      <H3>Ready for more detail?</H3>
      <p className="hint" style={{ margin: "-4px 0 10px" }}>Advanced, Stages and Portfolio Backtest open with your numbers and the guide panel beside them, walking you through what&apos;s there.</p>
      <div className="gd-more">
        <button type="button" className="btn mini" data-trip="advanced" data-from="results" onClick={() => G.trip("advanced", "results")}>Advanced: taxes and account types<i className="arw" aria-hidden="true"></i></button>
        <button type="button" className="btn mini" data-trip="stages" data-from="results" onClick={() => G.trip("stages", "results")}>Stages: plans that change over time<i className="arw" aria-hidden="true"></i></button>
        <button type="button" className="btn mini" data-trip="backtest" data-from="results" onClick={() => G.trip("backtest", "results")}>Portfolio Backtest: what your mix has earned<i className="arw" aria-hidden="true"></i></button>
      </div>
      <p className="hint">Retirement spending here is what you live on after tax. Each year&apos;s federal and state income tax, Medicare&apos;s income surcharge and health insurance before 65 are worked out from where the money comes from, and paid on top.
        {" "}This score is a rule-of-thumb check, not financial advice, and it leaves out home equity.</p>
    </>
  );
}

export function ResultsFoot() {
  const G = useGuideView();
  return (
    <>
      <button type="button" className="btn" data-gd="prev" onClick={() => G.act("prev")}><i className="arw back" aria-hidden="true"></i>Back</button><span className="sp"></span>
      <button type="button" className="btn" data-gd="restart" onClick={() => G.act("restart")}>Start over</button>
      <button type="button" className="btn primary" data-go="about" onClick={() => G.go("about")}>Review my answers</button>
    </>
  );
}
