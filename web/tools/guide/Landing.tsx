"use client";

/* The Guide tab's landing page (/guide): the two walkthroughs side by side,
   each with what it's for, what you get and how long it takes. The
   Retirement Readiness Guide (/guide/readiness) shows its two paces, each
   with its own start; Paycheck to Retirement (/guide/paycheck) its five
   steps. A walkthrough already under way offers to pick up where it was.
   Both end with a report, said once under them.

   A plan shared before the Readiness Guide moved here (/guide#g=...) is
   sent on to it. */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { STEPS, planHasWork, readPlan, subscribePlan } from "@/tools/plan/model";
import { ReportThumb } from "./report/Thumb";
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
    <div className="gl" role="tabpanel" id="tab-guide" aria-labelledby="tabbtn-guide">
      <div className="gl-head">
        <h2 className="gl-title">Two ways through your plan</h2>
        <p className="gl-lede">Each walks you through your money one step at a time and starts from your household if you&apos;ve set it up.
          Not sure which? The Quick check shows where you stand in about ten minutes.</p>
      </div>

      <div className="gl-grid">
        <Card size="flush" id="gl-readiness"><div className="gl-in">
          <ReadyArt />
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
                      <Link href={READY + "?start=" + p.id} className={cn(buttonVariants(), "gl-go")}>
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
          <PayArt />
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

/* ---- the two stages: a picture of what each walkthrough gives you ----
   Each waits until it scrolls into view, then plays once: the score ring
   fills and counts up while its five parts fill in; the paycheck flows
   left to right into taxes, spending and saving, the saving into four
   accounts, and a curve grows to retirement. Under reduced motion each is
   drawn finished. Illustrations, with example figures. */

function useStage() {
  const ref = useRef<HTMLDivElement>(null);
  const [st, setSt] = useState<"wait" | "go">("wait");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- known only in the browser
      setSt("go");
      return;
    }
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) { setSt("go"); io.disconnect(); }
    }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, st };
}

/** The example score's five parts: points earned of points possible. */
const PARTS: [string, number, number][] = [
  ["Retirement outlook", 30, 40], ["Savings rate", 20, 20], ["Emergency fund", 11, 15], ["Debt", 12, 15], ["Monthly cash flow", 5, 10],
];
const SCORE = PARTS.reduce((t, p) => t + p[1], 0);

function ReadyArt() {
  const { ref, st } = useStage();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (st !== "go") return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(SCORE); return; } // eslint-disable-line react-hooks/set-state-in-effect -- one jump to the end
    let raf = 0;
    const t0 = performance.now(), dur = 1500;
    const tick = (t: number) => {
      const f = Math.min(1, (t - t0) / dur);
      setN(Math.round(SCORE * (1 - Math.pow(1 - f, 3))));
      if (f < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [st]);
  const r = 54, c = 2 * Math.PI * r;
  return (
    <div ref={ref} className="gl-stage gl-ready" data-st={st} aria-hidden="true">
      <p className="gl-stage-h">Example readiness score</p>
      <div className="gl-ready-in">
        <svg className="gl-ring" viewBox="0 0 132 132">
          <circle className="trk" cx="66" cy="66" r={r} />
          <circle className="val" cx="66" cy="66" r={r} transform="rotate(-90 66 66)"
            style={{ "--c": c.toFixed(1), "--off": (c * (1 - SCORE / 100)).toFixed(1) } as React.CSSProperties} />
          <text x="66" y="72" textAnchor="middle">{n}</text>
          <text className="sub" x="66" y="92" textAnchor="middle">Nearly there</text>
        </svg>
        <ul className="gl-parts">
          {PARTS.map(([name, got, of], i) => (
            <li key={name} style={{ "--i": i } as React.CSSProperties}>
              <span className="nm">{name}</span><span className="pt">{got}<i>/{of}</i></span>
              <span className="br"><b style={{ "--f": got / of } as React.CSSProperties} /></span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** A ribbon from a span at x0 to a span at x1. */
const rib = (x0: number, a0: number, b0: number, x1: number, a1: number, b1: number) => {
  const m = (x0 + x1) / 2;
  return `M${x0} ${a0}C${m} ${a0} ${m} ${a1} ${x1} ${a1}L${x1} ${b1}C${m} ${b1} ${m} ${b0} ${x0} ${b0}Z`;
};
const ACCTS: [string, number, number, number, number][] = [
  // name, from (on the saving bar), to (at the account)
  ["401(k)", 182, 198, 118, 134], ["HSA", 198, 204, 148, 154], ["IRA", 204, 211, 168, 175], ["Brokerage", 211, 218, 189, 196],
];

function PayArt() {
  const { ref, st } = useStage();
  return (
    <div ref={ref} className="gl-stage gl-pay" data-st={st} aria-hidden="true">
      <p className="gl-stage-h">Where each paycheck goes</p>
      <svg className="gl-flow" viewBox="0 0 460 236">
        <defs>
          <clipPath id="glSweep"><rect className="sweep" x="0" y="0" height="236" /></clipPath>
          <linearGradient id="glGrow" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="var(--gl-save)" stopOpacity=".05" /><stop offset="1" stopColor="var(--gl-save)" stopOpacity=".55" />
          </linearGradient>
        </defs>
        <g clipPath="url(#glSweep)">
          <path className="tax" d={rib(12, 30, 73, 120, 16, 59)} />
          <path className="spend" d={rib(12, 73, 174, 120, 67, 168)} />
          <path className="save" d={rib(12, 174, 210, 120, 182, 218)} />
          {ACCTS.map(([n, a0, b0, a1, b1]) => <path key={n} className="save" d={rib(132, a0, b0, 250, a1, b1)} />)}
          <rect className="node" x="0" y="30" width="12" height="180" rx="3" />
          <rect className="node tax-n" x="120" y="16" width="12" height="43" rx="3" />
          <rect className="node spend-n" x="120" y="67" width="12" height="101" rx="3" />
          <rect className="node save-n" x="120" y="182" width="12" height="36" rx="3" />
          {ACCTS.map(([n, , , a1, b1]) => <rect key={n} className="node save-n" x="250" y={a1} width="10" height={b1 - a1} rx="2" />)}
        </g>
        <text className="lb" x="0" y="20">Paycheck</text>
        <text className="lb dim" x="140" y="42">Taxes</text>
        <text className="lb dim" x="140" y="122">Spending</text>
        <text className="lb dim" x="140" y="232">Saving</text>
        {ACCTS.map(([n, , , a1, b1]) => <text key={n} className="ac" x="266" y={(a1 + b1) / 2 + 4}>{n}</text>)}
        <path className="grow-a" d="M346 222 C390 215 420 180 456 40 L456 222 Z" fill="url(#glGrow)" />
        <path className="grow-l" pathLength={1} d="M346 222 C390 215 420 180 456 40" />
        <circle className="grow-d" cx="456" cy="40" r="4.5" />
        <text className="lb grow-t" x="456" y="22" textAnchor="end">By retirement</text>
      </svg>
    </div>
  );
}
