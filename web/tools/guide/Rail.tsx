"use client";

/* The rail beside the card (doc 1, "The shell"; doc 2, parts 7 to 9): your
   number so far, the readiness score and the route. On a phone it folds
   into a strip under the progress bar (Strip, in Top.tsx), whose Route
   button opens the score and the route as a sheet. */

import { useState } from "react";
import { FACTORS, barColor, guessing, ok, rating, retPath, type Part, type Sim } from "./calc";
import { Ring } from "./Ring";
import { CHAPTERS, STEPS, applies, deeper, type RouteFacts, type StepDecl } from "./route";
import { RULES, confidence, confidenceLine, headroom } from "./score";
import { SourceBadge } from "./SourceBadge";
import type { GuideState } from "./store";
import { rounded } from "./words";
import { money } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDownIcon } from "lucide-react";

/** What the rail shows, worked out by the page from the worker's answers. */
export interface RailPlan {
  /** The plan, with retirement spending's placeholder standing in. */
  S: Sim | null | undefined;
  need: number | null | undefined;
  /** A newer answer is on its way. */
  stale: boolean;
  score: { score: number | null; P: Partial<Record<(typeof FACTORS)[number]["id"], Part>>; n: number } | null;
}

/** The plan's balance by age, saving years then the median retirement:
    a sparkline in the plan's color. */
function Sparkline({ S }: { S: Sim }) {
  const pts = [...S.path, ...retPath(S).map((r) => r.p50)];
  const max = Math.max(1, ...pts), W = 100, H = 28;
  const d = pts.map((v, i) => (i ? "L" : "M") + ((i / Math.max(1, pts.length - 1)) * W).toFixed(2) + "," + (H - (Math.max(0, v) / max) * (H - 2) - 1).toFixed(2)).join("");
  const x = ((S.path.length - 1) / Math.max(1, pts.length - 1)) * W;
  return (
    <svg className="gd-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <line className="mk" x1={x} x2={x} y1="0" y2={H} vectorEffect="non-scaling-stroke" />
      <path d={d} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** "Your number so far": what you're on course for at retirement against
    what the plan needs, and what the card you're on changed. */
export function NumberTile({ g, cur, plan }: { g: GuideState; cur: StepDecl; plan: RailPlan }) {
  const { S, need, stale } = plan;
  // The figures as you arrived on this card, to say what it changed.
  const [entry, setEntry] = useState<{ cur: string; fv: number; need: number | null } | null>(null);
  if (S && need !== undefined && entry?.cur !== cur.id) setEntry({ cur: cur.id, fv: S.fv, need });
  if (!S) {
    return (
      <div className="gd-num" aria-busy={stale || undefined}>
        <p className="gd-num-empty">{stale && S === undefined && ok(g.a.age) && ok(g.a.saved) ? "Working it out…"
          : "Your number appears once your age, retirement age, savings and monthly saving are in."}</p>
      </div>
    );
  }
  const placeholder = guessing(g.a), moved: string[] = [];
  if (entry && entry.cur === cur.id) {
    if (Math.abs(entry.fv - S.fv) >= 1) moved.push((S.fv > entry.fv ? "raised" : "lowered") + " what you're on course for from " + rounded(entry.fv) + " to " + rounded(S.fv));
    if (entry.need != null && need != null && entry.need !== need) moved.push((need < entry.need ? "cut" : "raised") + " what the plan needs from " + rounded(entry.need) + " to " + rounded(need));
  }
  return (
    <div className={"gd-num" + (stale ? " stale" : "")} aria-busy={stale || undefined}>
      <div className="gd-num-row">
        <div><div className="k">On course at {Math.round(S.retire)}</div><div className="v key" id="gdNumFv">{rounded(S.fv)}</div></div>
        <div><div className="k">The plan needs</div><div className="v" id="gdNumNeed">{need == null ? "—" : rounded(need)}</div></div>
      </div>
      <Sparkline S={S} />
      <p className="gd-num-note">
        {need != null ? <>To last in {S.I.target >= 1 ? "every" : Math.round(S.I.target * 100) + "% of"} historical retirements, spending {money(S.spend)} a year after tax. </> : null}
        {placeholder ? <><SourceBadge kind="default" /> Spending is 80% of your take-home until you enter it.</> : null}
      </p>
      {moved.length ? <p className="gd-num-moved">This card {moved.join(", and ")}.</p> : null}
      <span className="sr-only" role="status">{stale ? "Updating your number" : ""}</span>
    </div>
  );
}

/** The readiness score: the ring and rating, how much rests on your own
    answers, and each area with its points, its rule and your figure. */
export function ScoreCard({ g, plan, go, ring }: { g: GuideState; plan: RailPlan; go: (id: string) => void; ring: boolean }) {
  const R = plan.score;
  if (!R) return <p className="gd-num-empty">Working it out…</p>;
  const rt = rating(R.score), have = FACTORS.filter((f) => R.P[f.id]).map((f) => f.id);
  return (
    <>
      <div className="gd-score-top" hidden={!ring}><Ring score={R.score} /><div className="gd-score-t"><div className="r text-(color:--ink)" style={{ "--ink": rt.color } as React.CSSProperties}>{rt.label}</div>
        <div className="n">{R.score == null ? (R.n ? "Your score appears once two areas are answered." : "Your score appears as you answer.") : R.n < FACTORS.length ? "From " + R.n + " of " + FACTORS.length + " areas so far" : "All five areas answered"}</div>
        {R.score != null ? <div className="n gd-conf">{confidenceLine(confidence(g.a, g.src, have))}</div> : null}</div></div>
      <div className="gd-facs">{FACTORS.map((f) => {
        const p = R.P[f.id], h = headroom(f.id, p, g.a), to = p?.bad ?? f.step;
        return (
          <button key={f.id} type="button" className={"gd-fac" + (p ? "" : " na") + (p?.bad ? " bad" : "")} data-go={to} onClick={() => go(to)}>
            <div className="top"><span>{f.name}</span><em>{p ? Math.round(p.p * f.w) + " / " + f.w : "—"}</em></div>
            <div className="bar"><i className="w-(--w) bg-(--swatch)" style={{ "--w": (p ? p.p * 100 : 0).toFixed(0) + "%", "--swatch": p ? barColor(p.p) : "transparent" } as React.CSSProperties}></i></div>
            <div className="sub">{p ? p.txt : "Not answered yet"}</div>
            <div className="rule">{RULES[f.id]}</div>
            {h ? <div className="head">Up to {h.pts} more: {h.line}.</div> : null}</button>
        );
      })}</div>
    </>
  );
}

/** The route: each chapter's cards, the one you're on, those done, and on
    the Quick check the deeper cards it skips, marked and still open. */
export function RouteMap({ g, cur, facts, go, act }: { g: GuideState; cur: StepDecl; facts: RouteFacts; go: (id: string) => void; act: (w: string) => void }) {
  // The cards that hang on the retirement age stay out until it's known.
  const known = ok(g.a.retire);
  return (
    <>
      {CHAPTERS.map((c, i) => {
        const ch = i + 1, list = STEPS.filter((s) => s.chapter === ch && (known || !s.when));
        const walked = list.filter((s) => applies(s, g.a) && !deeper(s, g.a, g.pace, facts)), d = walked.filter((s) => g.done[s.id]).length;
        const here = cur.chapter === ch || (cur.chapter === 0 && ch === 1);
        return (
          <div key={c + (here ? ":here" : "")} className="gd-map-chw"><Collapsible defaultOpen={here}>
            <div className="gd-map-ch"><CollapsibleTrigger>{c}<span className="gd-map-n">{walked.length ? d + " of " + walked.length : "deeper"}</span><ChevronDownIcon aria-hidden="true" /></CollapsibleTrigger></div>
            <CollapsibleContent>
              {list.map((s) => {
                const na = !applies(s, g.a), deep = !na && deeper(s, g.a, g.pace, facts);
                const cls = na ? "na" : s.id === cur.id ? "cur" : g.done[s.id] ? "done" : deep ? "deep" : "";
                return (
                  <button key={s.id} type="button" className={"gd-map-st " + cls} disabled={na} data-go={na ? undefined : s.id} onClick={() => go(s.id)}
                    aria-current={s.id === cur.id ? "step" : undefined}>
                    <i aria-hidden="true"></i>{s.title}{na ? <span className="tag">not needed</span> : deep && s.id !== cur.id ? <span className="tag">deeper · open</span> : null}</button>
                );
              })}
            </CollapsibleContent>
          </Collapsible></div>
        );
      })}
      <div className="gd-map-foot text-note"><Button variant="quiet" size="inline" data-gd="restart" onClick={() => act("restart")}>Start over</Button></div>
    </>
  );
}

export function Rail({ g, cur, facts, plan, go, act }: { g: GuideState; cur: StepDecl; facts: RouteFacts; plan: RailPlan; go: (id: string) => void; act: (w: string) => void }) {
  return (
    <div className="gd-side">
      <Card data-rail="number" className="max-sm:hidden">
        <CardHeader><CardTitle>Your number so far</CardTitle></CardHeader>
        <CardContent id="gdNumber"><NumberTile g={g} cur={cur} plan={plan} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{cur.id === "plan" ? "What's behind the score" : "Readiness score"}</CardTitle></CardHeader>
        <CardContent id="gdScore"><ScoreCard g={g} plan={plan} go={go} ring={cur.id !== "plan"} /></CardContent>
      </Card>
      <Card data-rail="route" className="max-sm:hidden">
        <CardHeader><CardTitle>Your route</CardTitle></CardHeader>
        <CardContent className="px-2.5 pt-2 pb-3" id="gdMap"><RouteMap g={g} cur={cur} facts={facts} go={go} act={act} /></CardContent>
      </Card>
    </div>
  );
}
