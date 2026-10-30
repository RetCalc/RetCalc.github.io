"use client";

/* The Dashboard's printed report: every page of the household's plan, built
   in the browser from the Dashboard as this account keeps it (nothing is
   sent anywhere to make it), shown scaled to the window with a bar to print
   it, and printed as US Letter sheets. The Guide report's shell
   (tools/guide/report/Report.tsx) with the Dashboard's figures; the names
   come from Profile. Signed in only, like the rest of the Dashboard. */

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAccount } from "@/components/account/AccountProvider";
import { unstarted, useDashboard } from "../store";
import { dashReport, type DashReport } from "./model";
import { DashPages } from "./pages";

const PAGE_W = 816;

export function DashboardReport({ fontClass }: { fontClass: string }) {
  const { ready, account } = useAccount();
  const { data } = useDashboard();
  const [M, setM] = useState<DashReport | { missing: string } | undefined>(undefined);
  const [scale, setScale] = useState(1);
  const [tall, setTall] = useState(0);
  const pagesRO = useRef<ResizeObserver | null>(null);
  // The sheets' full-size height, so the scaled box around them is the right height.
  const pagesRef = (el: HTMLDivElement | null) => {
    pagesRO.current?.disconnect();
    if (!el) return;
    pagesRO.current = new ResizeObserver(() => setTall(el.offsetHeight));
    pagesRO.current.observe(el);
  };
  const wrap = useRef<HTMLDivElement>(null);
  const fresh = unstarted(data);

  // The figures: after the first paint, so "Building your report" shows
  // while the plan runs through every month of history.
  useEffect(() => {
    if (!account || fresh) return;
    const t = setTimeout(() => setM(dashReport(data)), 30);
    return () => clearTimeout(t);
  }, [data, account, fresh]);

  // Printing is this page's whole job: the site's header and footer stay
  // off the paper and the sheets print edge to edge (17-report.css), as
  // the Guide's report does.
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

  // Pages are 8.5in wide; on a narrow window they're scaled down whole, like
  // a PDF viewer fitting the width.
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, (el.clientWidth - 8) / PAGE_W));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const report = M && !M.missing ? (M as DashReport) : null;
  const wait = !ready || (account && !fresh && M === undefined);
  return (
    <div className={"rp " + fontClass}>
      <div className="rp-bar">
        <div className="rp-bar-l">
          <Link href="/dashboard/summary" className="rp-back">← Back to the Dashboard</Link>
          <h1 id="pageH1">Your financial plan report</h1>
          <p>{report ? report.pages.length + " pages, from your Dashboard as of today. Everything here was worked out in your browser." : "Your whole Dashboard as a report, ready to print or save as a PDF."}</p>
        </div>
        {report ? <div className="rp-bar-r"><Button type="button" onClick={() => window.print()}>Print or save as PDF</Button></div> : null}
      </div>
      <div className="rp-stage" ref={wrap}>
        {wait ? <p className="rp-wait" role="status">Building your report…</p>
          : !account ? <div className="rp-wait"><p>Your report is built from your Dashboard, which needs you signed in.</p><Link href="/dashboard" className={buttonVariants()}>Open the Dashboard</Link></div>
            : fresh || (M && M.missing) ? <div className="rp-wait"><p>{fresh ? "Set up your Dashboard first: the report is built from it." : M!.missing}</p>
              <Link href={fresh ? "/dashboard/setup" : "/dashboard/profile"} className={buttonVariants()}>{fresh ? "Set up the Dashboard" : "Open Profile"}</Link></div>
              : report ? <div className="rp-fit" style={{ "--rp-zoom": scale, "--rp-h": tall } as React.CSSProperties}>
                <div className="rp-pages" ref={pagesRef}><DashPages M={report} /></div></div> : null}
      </div>
    </div>
  );
}
