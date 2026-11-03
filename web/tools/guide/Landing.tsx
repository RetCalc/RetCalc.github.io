"use client";

/* The Guide tab's landing page (/guide): the two walkthroughs side by side,
   each with what it's for, what you get and how long it takes. The
   Retirement Readiness Guide (/guide/readiness) shows its two paces, each
   with its own start; Paycheck to Retirement (/guide/paycheck) its five
   steps. A walkthrough already under way offers to pick up where it was.
   Both end with a report, said once under them.

   A plan shared before the Readiness Guide moved here (/guide#g=...) is
   sent on to it. */

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { STEPS, planHasWork, readPlan, subscribePlan } from "@/tools/plan/model";
import { ReportThumb } from "./report/Thumb";
import { Ring } from "./Ring";
import { paceMinutes } from "./route";
import { useGuide } from "./store";

const READY = "/guide/readiness", PAY = "/guide/paycheck";

const PACES = [
  { id: "quick", name: "Quick check", time: "About " + paceMinutes({}, "quick") + " minutes",
    text: "Twelve short cards with a few questions each. Defaults stand in for the details, and each one says so." },
  { id: "full", name: "Full walkthrough", time: "An hour or more",
    text: "Every card, with trips into the tools that find the numbers you don't know. Best with your statements open." },
] as const;

/** What each of Paycheck to Retirement's steps does, in a line. */
const STEP_LINE: Record<string, string> = {
  budget: "What you spend in a typical month, line by line.",
  paycheck: "Take-home pay after taxes, and where each paycheck's saving goes.",
  plan: "What you've saved so far, and what it grows to by retirement.",
  stages: "Kids, a raise or a bigger house, if you see them coming.",
  summary: "The whole plan on one page, with a report to print.",
};

const noPlanWork = () => false;
const planWork = () => planHasWork(readPlan());

export function GuideLanding() {
  const router = useRouter();
  useEffect(() => {
    if (window.location.hash.startsWith("#g=")) router.replace(READY + window.location.hash);
  }, [router]);
  const g = useGuide();
  const underWay = Object.keys(g.done).length > 0 || g.cur !== "welcome";
  const payUnderWay = useSyncExternalStore(subscribePlan, planWork, noPlanWork);
  const steps = STEPS.filter((s) => s.id !== "start");

  return (
    <div className="gl">
      <div className="gl-head">
        <h2 className="gl-title">Two ways through your plan</h2>
        <p className="gl-lede">Each walks you through your money one step at a time and starts from your household if you&apos;ve set it up.
          Not sure which? The Quick check shows where you stand in about ten minutes.</p>
      </div>

      <div className="gl-grid">
        <Card size="flush" id="gl-readiness"><div className="gl-in">
          <div className="gl-art" aria-hidden="true">
            <Ring score={78} size={112} />
            <ul className="gl-factors">
              <li><b>40</b>Retirement outlook</li>
              <li><b>20</b>Savings rate</li>
              <li><b>15</b>Emergency fund</li>
              <li><b>15</b>Debt</li>
              <li><b>10</b>Monthly cash flow</li>
            </ul>
          </div>
          <div className="gl-body">
            <p className="gl-kick">Retirement Readiness Guide</p>
            <h3 className="gl-h">Am I on track?</h3>
            <p className="gl-for">Start here if you&apos;re not sure where you stand.</p>
            <p>It asks about your income, spending, savings and debts, then works out your number, a readiness score out of 100, your plan tested
              against every market since 1926, and the changes that would help most.</p>
            {underWay ? (
              <div className="gl-resume">
                <p>You&apos;re partway through, on the {g.pace === "full" ? "Full walkthrough" : "Quick check"}. You can switch pace inside the guide.</p>
                <Link href={READY + "?start=resume"} className={buttonVariants({ size: "lg" })}>Pick up where you left off<i className="arw" aria-hidden="true"></i></Link>
              </div>
            ) : (
              <>
                <p className="gl-sub">Two paces, both ending in a score</p>
                <div className="gl-paces">
                  {PACES.map((p) => (
                    <div key={p.id} className="gl-pace">
                      <p className="gl-pace-t"><b>{p.name}</b><span>{p.time}</span></p>
                      <p className="gl-pace-x">{p.text}</p>
                      <Link href={READY + "?start=" + p.id} className={cn(buttonVariants({ variant: p.id === "quick" ? "default" : "outline" }), "gl-go")}>
                        {p.id === "quick" ? "Start the Quick check" : "Start the full walkthrough"}<i className="arw" aria-hidden="true"></i></Link>
                    </div>
                  ))}
                </div>
                <p className="hint">Already retired? <Link href={READY + "?start=retired"}>Start from what you have</Link></p>
              </>
            )}
          </div>
        </div></Card>

        <Card size="flush" id="gl-paycheck"><div className="gl-in">
          <div className="gl-art" aria-hidden="true">
            <div className="gl-split">
              <p className="gl-split-h">Each paycheck</p>
              <div className="gl-bar"><i className="tax" /><i className="spend" /><i className="save" /></div>
              <p className="gl-split-k"><span><i className="tax" />Taxes</span><span><i className="spend" />Spending</span><span><i className="save" />Saving</span></p>
            </div>
          </div>
          <div className="gl-body">
            <p className="gl-kick">Paycheck to Retirement</p>
            <h3 className="gl-h">Where does my paycheck go?</h3>
            <p className="gl-for">Start here if you know your pay and want the numbers.</p>
            <p>It goes straight from your pay to a plan: what&apos;s left after federal, state and payroll taxes, your budget, how to split
              your saving between a 401(k), HSA, IRA and brokerage account, and what that adds up to by retirement.</p>
            <p className="gl-sub">Five steps, about fifteen minutes</p>
            <ol className="gl-steps">
              {steps.map((s, i) => (
                <li key={s.id}><b>{i + 1}</b><span><span className="gl-step-n">{s.name}{s.id === "stages" ? <em> (optional)</em> : null}</span>{STEP_LINE[s.id]}</span></li>
              ))}
            </ol>
            <Link href={PAY} className={cn(buttonVariants({ size: "lg" }), "gl-go")}>
              {payUnderWay ? "Pick up where you left off" : "Start Paycheck to Retirement"}<i className="arw" aria-hidden="true"></i></Link>
          </div>
        </div></Card>
      </div>

      <div className="gl-report">
        <ReportThumb />
        <p><b>Both end with a report in your own numbers</b>, to print or save as a PDF. What you enter is saved in this browser as you go,
          and to your account only if you sign in.</p>
      </div>
    </div>
  );
}
