"use client";

/* The full report on screen and on paper (REPORT_BRIEF.md). It reads the
   Guide as this browser keeps it, works the figures out here (nothing is
   sent anywhere), shows the pages scaled to the window with a bar to name
   the plan and print, and prints them as US Letter sheets. The names are
   kept in this browser only, apart from the Guide's answers, so a link or
   an account sync never carries them. */

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGuide } from "../store";
import { tuneState } from "../tune";
import { reportModel, type ReportModel, type ReportNames } from "./model";
import { ReportPages } from "./pages";

const NAMES_KEY = "retcalc.report.v1";
const PAGE_W = 816;
/* The longest first name the cover takes, as the paycheck report's. */
const NAME_MAX = 30;

/* The names, as a tiny store over this browser's storage: read once, kept
   in memory after, so a private window still works for the visit. */
let names: ReportNames | null = null;
const nameListeners = new Set<() => void>();
const NONE: ReportNames = {};
function readNames(): ReportNames {
  if (names) return names;
  try {
    const o = JSON.parse(localStorage.getItem(NAMES_KEY) || "{}");
    // Cut to the fields' length: the names sit in the cover's title.
    const name = (v: unknown) => (typeof v === "string" ? v.slice(0, NAME_MAX) : "");
    names = { you: name(o.you), spouse: name(o.spouse) };
  } catch { names = {}; }
  return names;
}
function setNames(n: ReportNames) {
  names = n;
  try { localStorage.setItem(NAMES_KEY, JSON.stringify(n)); } catch { /* private window: kept for this visit only */ }
  nameListeners.forEach((l) => l());
}
const useNames = () => useSyncExternalStore((l) => { nameListeners.add(l); return () => nameListeners.delete(l); }, readNames, () => NONE);

export function Report({ fontClass }: { fontClass: string }) {
  const g = useGuide(), levers = tuneState().levers;
  const names = useNames();
  const [M, setM] = useState<ReportModel | null | undefined>(undefined);
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

  // The figures: after the first paint, so "Building your report" shows
  // while the plan runs through every historical start.
  const married = g.a.status === "m";
  const key = useMemo(() => JSON.stringify([g.a, g.src, levers, names]), [g.a, g.src, levers, names]);
  useEffect(() => {
    const t = setTimeout(() => setM(reportModel(g.a, g.src, levers, names)), 30);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Printing is this page's whole job: the site's header, bar and footer
  // stay off the paper, and the sheets print edge to edge.
  // Safari doesn't honor the sheets' own named print page (17-report.css),
  // so while this page is open the whole document prints without margins;
  // leaving it restores the site's own, which the one-page summaries use.
  useEffect(() => {
    document.documentElement.classList.add("rp-on");
    // iPhone and iPad print with their own margins, header and footer, and
    // ignore @page, so there the sheets print a little smaller to fit
    // (17-report.css, html.rp-ios). iPadOS reports itself as a Mac.
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
  // a PDF viewer fitting the width. A transform, not zoom: Safari's minimum
  // font size and text autosizing would otherwise enlarge the small text and
  // break the layout.
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, (el.clientWidth - 8) / PAGE_W));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const setName = (k: keyof ReportNames, v: string) => {
    setNames({ ...names, [k]: v.slice(0, 30) });
  };

  return (
    <div className={"rp " + fontClass}>
      <div className="rp-bar">
        <div className="rp-bar-l">
          <Link href="/guide" className="rp-back">← Back to the Guide</Link>
          <h1 id="pageH1">Your retirement report</h1>
          <p>{M ? M.pages.length + " pages, from your Guide answers. Everything here was worked out in your browser." : "Your plan, from your Guide answers, ready to print or save as a PDF."}</p>
        </div>
        <div className="rp-bar-r">
          <div className="rp-name"><Label htmlFor="rp-you">Your first name</Label>
            <Input id="rp-you" value={names?.you ?? ""} placeholder="Optional" autoComplete="given-name" maxLength={NAME_MAX} onChange={(e) => setName("you", e.target.value)} /></div>
          {married ? <div className="rp-name"><Label htmlFor="rp-spouse">Spouse&apos;s first name</Label>
            <Input id="rp-spouse" value={names?.spouse ?? ""} placeholder="Optional" maxLength={NAME_MAX} onChange={(e) => setName("spouse", e.target.value)} /></div> : null}
          <Button type="button" onClick={() => window.print()} disabled={!M}>Print or save as PDF</Button>
        </div>
      </div>
      <div className="rp-stage" ref={wrap}>
        {M === undefined ? <p className="rp-wait" role="status">Building your report…</p>
          : M === null ? <div className="rp-wait"><p>Answer more of the Guide to build your report: it needs your age, savings, retirement age and spending in retirement.</p>
            <Link href="/guide" className={buttonVariants({ variant: "secondary" })}>Open the Guide</Link></div>
            : <div className="rp-fit" style={{ "--rp-zoom": scale, "--rp-h": tall } as React.CSSProperties}>
              <div className="rp-pages" ref={pagesRef}><ReportPages M={M} /></div></div>}
      </div>
    </div>
  );
}
