"use client";

/* The Plan Optimizer as a step of the guide: the same search and result as
   its own page, on the guide's plan, with "Use this plan" to apply what it
   finds. From opGuideHTML(), opApplyToGuide() and opClearGuide() in
   src/js/app/31b-plan-optimizer.js. */

import { HIST_START } from "@/lib/engine/typed";
import { plKey } from "@/lib/engine/typed-plan";
import { fmtNum, groupDigits, money } from "@/lib/format";
import { OpGoals } from "@/tools/optimizer/Optimizer";
import { OptimizerStatus, Progress } from "@/tools/optimizer/Progress";
import { OptimizerResult } from "@/tools/optimizer/Result";
import { opEstimate, opSig, startOptimizer, useOptimizer, type Goal } from "@/tools/optimizer/run";
import { lowerFirst, opClaims, opTacticsLine } from "@/tools/optimizer/words";
import { accts, sim, tactics } from "./calc";
import type { Answers } from "./store";
import { NeedsPlan } from "./steps";
import { BackNote, Callout, H3, Q, useGuideView } from "./ui";
import { Button } from "@/components/ui/button";

export const optGoal = (a: Answers): Goal => (a.optGoal === "last" || a.optGoal === "spend" ? a.optGoal : "legacy");

export function OptimizeStep() {
  const G = useGuideView(), { v: a } = G, H = useOptimizer("guide");
  const S = sim(a, undefined, true), goal = optGoal(a);
  if (!S) return <NeedsPlan title="Find the best way to run your retirement" msg="This needs your age, savings and retirement spending first." />;
  const E = opEstimate(S.P), A = accts(a);
  const T = tactics(a), SA = T ? sim(a) : null;
  const stale = !!H.res && H.res.sig !== opSig(S.P, goal);
  const applied = !!T && !!H.res && plKey(T) === plKey(H.res.best.T);
  return (
    <>
      <Q>Find the best way to run your retirement</Q>
      <p className="gd-lead">Your plan so far claims Social Security at {opClaims(S.T, S.C)} and draws from the brokerage, then traditional, then Roth.
        {" "}The Plan Optimizer tries every other way: each claiming age from 62 to 70{S.C.married ? " for each of you" : ""}, drawing traditional money first up to each tax bracket,
        {" "}converting to Roth for different stretches, and staying under the ACA and Medicare income lines. It runs all <b>{groupDigits(E.n, true)}</b> plans through every market since {HIST_START as number}
        {" "}and keeps the best.</p>
      <BackNote step="optimize" />
      <div className="op-acct"><span>Starting from <b>{money(A.trad)}</b> traditional, <b>{money(A.roth)}</b> Roth and <b>{money(A.brok)}</b> brokerage today, growing to {money(S.fv)} by {fmtNum(S.retire)}.</span><Button variant="quiet" size="inline" data-go="savings" onClick={() => G.go("savings")}>Change the split</Button></div>
      {SA && !H.run ? (
        <Callout cls="ok"><b>Your plan uses a roadmap:</b> Social Security at {opClaims(SA.T, SA.C)}; {lowerFirst(opTacticsLine(SA.T, SA.C))}. Your score and every step use it.
          <div className="mt-2"><Button variant="outline" size="sm" className="mt-2" data-gd="optclear" onClick={() => G.act("optclear")}>Go back to the usual way</Button></div></Callout>
      ) : null}
      <H3>What should the best plan do?</H3>
      <OpGoals host="guide" goal={goal} onPick={(g) => G.set("optGoal", g, true)} />
      <div className="op-go"><Button size="lg" variant="outline" data-op="run" data-host="guide" disabled={!!H.run} onClick={() => startOptimizer("guide", S.P, goal)}>
        {H.res && !stale ? "Run it again" : "Find my best plan"}<i className="arw" aria-hidden="true"></i></Button>
        <span className="hint">{groupDigits(E.runs, true)} retirements to simulate, about {E.secs} seconds. Nothing leaves your browser.</span></div>
      <OptimizerStatus host="guide" />
      {H.run ? <Progress host="guide" R={H.run} /> : H.res ? (
        <>
          {stale ? <Callout cls="warn">Your answers or the goal changed since this ran. Run it again to see the best plan for them now.</Callout> : null}
          <OptimizerResult key={H.res.sig + H.res.runs} host="guide" res={H.res} fresh={H.fresh} />
          {!stale && !H.res.same ? (
            <div className="gd-apply op-apply">{applied ? <span className="gd-callout ok m-0">Your plan uses this roadmap.</span>
              : <><Button variant="outline" size="lg" data-gd="optapply" onClick={() => G.act("optapply")}>Use this plan</Button>
                <span className="hint">Your projection, score and every step after use it. You can undo it.</span></>}</div>
          ) : null}
        </>
      ) : null}
    </>
  );
}
