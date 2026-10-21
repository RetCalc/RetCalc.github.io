"use client";

/* The Paycheck to Retirement report on screen and on paper: the
   walkthrough's results (results.ts) as US Letter sheets in the Guide
   report's system, scaled to the window, with a bar to name it and print.
   The name stays in this browser only, never in a link or an account. */

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useHousehold } from "@/components/household/HouseholdProvider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readStored, writeStored } from "@/lib/storage";
import { readPlan, subscribePlan } from "../model";
import { planSummary } from "../results";
import { PlanReportPages, planPages } from "./pages";

const NAME = { key: "paycheck-report", version: 1 } as const;
const PAGE_W = 816;
const NONE = () => null;

export function PlanReport({ fontClass }: { fontClass: string }) {
  const plan = useSyncExternalStore(subscribePlan, readPlan, NONE);
  const { profile } = useHousehold();
  const [name, setName] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is only readable once the page has loaded
  useEffect(() => { const v = readStored<unknown>(NAME.key, NAME.version); setName(typeof v === "string" ? v.slice(0, 30) : ""); }, []);
  const S = useMemo(() => (plan ? planSummary(plan, profile) : undefined), [plan, profile]);
  const date = useMemo(() => new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), []);
  const title = name.trim() ? name.trim() + (name.trim().endsWith("s") ? "' plan" : "'s plan") : "Your paycheck plan";

  // Printing is the page's job: the sheets print edge to edge, alone
  // (17-report.css), as the Guide report does.
  useEffect(() => {
    document.documentElement.classList.add("rp-on");
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
    if (ios) document.documentElement.classList.add("rp-ios");
    let sheet: CSSStyleSheet | null = null;
    try {
      sheet = new CSSStyleSheet();
      sheet.replaceSync("@page{size:letter;margin:0}");
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    } catch { /* an older browser: the named page still covers Chrome and Firefox */ }
    return () => {
      document.documentElement.classList.remove("rp-on", "rp-ios");
      if (sheet) document.adoptedStyleSheets = document.adoptedStyleSheets.filter((x) => x !== sheet);
    };
  }, []);

  // The sheets fit the window's width, scaled whole like a PDF viewer.
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1), [tall, setTall] = useState(0);
  const ro = useRef<ResizeObserver | null>(null);
  const pagesRef = (el: HTMLDivElement | null) => {
    ro.current?.disconnect();
    if (!el) return;
    ro.current = new ResizeObserver(() => setTall(el.offsetHeight));
    ro.current.observe(el);
  };
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, (el.clientWidth - 8) / PAGE_W));
    fit();
    const o = new ResizeObserver(fit);
    o.observe(el);
    return () => o.disconnect();
  }, [S]);

  return (
    <div className={"rp " + fontClass}>
      <div className="rp-bar">
        <div className="rp-bar-l">
          <Link href="/guide/paycheck" className="rp-back">← Back to Paycheck to Retirement</Link>
          <h1 id="pageH1">Your paycheck plan</h1>
          <p>{S ? planPages(S).length + " pages, from your answers. Everything here was worked out in your browser." : "Your plan as a full report, ready to print or save as a PDF."}</p>
        </div>
        <div className="rp-bar-r">
          <div className="rp-name"><Label htmlFor="pp-name">Your first name</Label>
            <Input id="pp-name" value={name} placeholder="Optional" autoComplete="given-name"
              onChange={(e) => { const v = e.target.value.slice(0, 30); setName(v); writeStored(NAME.key, NAME.version, v); }} /></div>
          <Button type="button" onClick={() => window.print()} disabled={!S}>Print or save as PDF</Button>
        </div>
      </div>
      <div className="rp-stage" ref={wrap}>
        {S === undefined ? <p className="rp-wait" role="status">Building your report…</p>
          : S === null ? <div className="rp-wait"><p>Finish Paycheck to Retirement first: the report needs your ages, your pay and your plan.</p>
            <Link href="/guide/paycheck" className={buttonVariants({ variant: "secondary" })}>Open Paycheck to Retirement</Link></div>
            : <div className="rp-fit" style={{ "--rp-zoom": scale, "--rp-h": tall } as React.CSSProperties}>
              <div className="rp-pages" ref={pagesRef}><PlanReportPages R={{ S, title, date }} /></div></div>}
      </div>
    </div>
  );
}
