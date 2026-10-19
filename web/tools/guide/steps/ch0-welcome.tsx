"use client";

/* Welcome (doc 2, "Welcome"): choosing a pace and setting expectations in
   one screen. Each pace says what it delivers, in three lines, and how
   long it takes; and the guide says that nothing leaves the browser. */

import { paceMinutes } from "../route";
import type { Pace } from "../store";
import { Callout, Lead, Q, useGuideView } from "../ui";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ReportThumb } from "../report/Thumb";

const PACES: { id: Pace; title: string; lines: string[] }[] = [
  { id: "quick", title: "Quick check", lines: [
    "Twelve short cards, with three questions at most on each.",
    "Your number by the sixth card, then a test of whether it lasts.",
    "Defaults stand in for the details, and every one says so.",
  ] },
  { id: "full", title: "Full walkthrough", lines: [
    "Every card, with trips into the tools that find the numbers you don't know.",
    "Saving that changes over time: children, raises, a paid-off mortgage.",
    "Best with your statements open. It saves as you go, so stop whenever you like.",
  ] },
];

export function Welcome() {
  const G = useGuideView(), { g, a, act } = G;
  const started = Object.keys(g.done).length > 0;
  const mins = (p: Pace) => (p === "quick" ? "About " + paceMinutes(a, "quick") + " minutes" : "An hour or more");
  return (
    <>
      <Q>{started ? "Welcome back" : "How ready are you for retirement?"}</Q>
      <Lead>One idea at a time, in your own numbers. Each card explains one thing, asks two or three questions, and shows what your answers mean.
        {" "}You&apos;ll see your number early, and it sharpens with every card after.</Lead>
      <div className="gd-choices two" role="radiogroup" aria-label="Pace">
        {PACES.map((p) => {
          const on = g.pace === p.id;
          return (
            <button key={p.id} type="button" role="radio" aria-checked={on} className={"gd-choice gd-pace" + (on ? " on" : "")} data-pace={p.id}
              onClick={() => act("pace:" + p.id)}>
              <i className="dot" aria-hidden="true"></i>
              <span className="t"><b>{p.title}</b><span className="gd-pace-time">{mins(p.id)}</span>
                <ul>{p.lines.map((l) => <li key={l}>{l}</li>)}</ul></span>
            </button>
          );
        })}
      </div>
      {/* The other way in: straight to the numbers (PAYCHECK_PLAN_BRIEF.md). */}
      <Link href="/guide/paycheck" className="group mt-3 flex items-center gap-4 rounded-xl border border-border bg-muted px-4.5 py-3.5 no-underline text-foreground hover:border-muted-foreground">
        <span className="min-w-0 flex-1">
          <b className="font-semibold">Just want the numbers? Paycheck to Retirement</b>
          <span className="block text-note text-muted-foreground">Your pay after taxes, your budget, where each paycheck goes, and where that gets you by retirement, with kids if you&apos;re planning them. Six steps, about fifteen minutes.</span>
        </span>
        <i className="arw flex-none" aria-hidden="true"></i>
      </Link>
      <div className="rp-offer my-4">
        <ReportThumb />
        <p><b>Either pace ends with your full report.</b>A full-color plan in your own numbers, to print or save as a PDF: what you&apos;ll have, how it holds up against every market since 1926, Social Security, taxes and health insurance, and your next moves.</p>
      </div>
      <Callout>Switch pace whenever you like; nothing you&apos;ve answered is lost. Your answers are saved in this browser, and to your account only if you sign in.</Callout>
      <p className="hint mt-3">Already retired?{" "}
        <Button variant="quiet" size="inline" data-gd="retired" onClick={() => { G.set("retired", true, true); G.go("retired"); }}>Start from what you have instead</Button></p>
    </>
  );
}

export function WelcomeFoot() {
  const { g, act } = useGuideView();
  return Object.keys(g.done).length > 0
    ? <><Button variant="outline" size="lg" data-gd="restart" onClick={() => act("restart")}>Start over</Button><span className="sp"></span>
      <Button size="lg" className="max-sm:flex-auto" data-gd="resume" onClick={() => act("resume")}>Pick up where you left off<i className="arw" aria-hidden="true"></i></Button></>
    : <><span className="sp"></span><Button size="lg" className="max-sm:flex-auto" data-gd="next" onClick={() => act("next")}>
      {g.pace === "full" ? "Start the full walkthrough" : "Start the Quick check"}<i className="arw" aria-hidden="true"></i></Button></>;
}
