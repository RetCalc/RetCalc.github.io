"use client";

/* The top of the homepage: the headline, then one household's whole life
   on a single chart. The scene stays put while the page scrolls; scrolling
   moves the age forward, from 32 to 95. The line draws up to that age, the
   balance counts with it, and each tool comes to the front of a deck of
   glass panes at the age you'd reach for it, then flies past. At 65 the
   one line opens into every retirement since 1926.

   Everything that moves is written straight to the page (custom properties,
   transforms, text), never through React state, so a scroll frame costs no
   render. Styles: styles/23-home-life.css, phones in styles/phone/33-home.css.
   Reduced motion: the panes swap without flying and nothing eases. */

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { HomeData } from "./data";
import { EXAMPLE } from "./example";
import { BridgeChart, CloudChart, FireChart, GrowthChart, HealthChart, RothChart, ScoreRing, SocialChart } from "./charts";

const A0 = 30, A1 = 96, RETIRE = EXAMPLE.retire, END = 95;
/** How much of the scroll the headline takes to leave, and where the last
    pane settles; the rest of the way the age runs on to 95. */
const T0 = 0.06, T1 = 0.88;

const fmtMoney = (v: number) => (v >= 1e6 ? "$" + (v / 1e6).toFixed(2) + "M" : "$" + Math.round(v / 1000).toLocaleString("en-US") + "K");
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

interface Chapter { age: number; href: string; tool: string; tone: string; title: string; text?: string; go: string }

const CHAPTERS: Chapter[] = [
  { age: 32, href: "/calculator", tool: "Calculator", tone: "amber", title: "See what your savings grow to.",
    text: "Enter your age, what you've saved and what you add each month.", go: "Open the Calculator" },
  { age: 36, href: "/guide/readiness", tool: "Retirement Readiness Guide", tone: "jade", title: "Get a readiness score.",
    text: "It ends with a full-color report of your plan, to print or save as a PDF.", go: "Start the guide" },
  { age: 45, href: "/fire", tool: "FIRE Calculator", tone: "amber", title: "Find the year work becomes optional.", go: "Open the FIRE Calculator" },
  { age: 55, href: "/bridge", tool: "Early Retirement Bridge", tone: "lav", title: "Pay for the years before 59½.",
    text: "A Roth ladder, 72(t) payments, the rule of 55 or your brokerage, and what each one costs.", go: "Open the Bridge" },
  { age: 60, href: "/healthcare", tool: "Healthcare Cost Planner", tone: "sky", title: "Price health insurance until Medicare.", go: "Open the Healthcare Cost Planner" },
  { age: 62, href: "/social-security", tool: "Social Security Calculator", tone: "teal", title: "Choose when to claim Social Security.",
    text: "Your check at every age you could claim, 62 to 70.", go: "Open the Social Security Calculator" },
  { age: 64, href: "/optimizer", tool: "Retirement Plan Optimizer", tone: "amber", title: "Put it all together into one plan.",
    text: "Tries thousands of claiming ages, withdrawal orders and Roth conversions to find what leaves you the most.", go: "Open the Optimizer" },
  { age: 65, href: "/drawdown", tool: "Drawdown Simulator", tone: "steel", title: "Check that your money lasts.",
    text: "Retire in every month since 1926, and compare 15 withdrawal strategies.", go: "Open the Drawdown Simulator" },
  { age: 73, href: "/roth", tool: "Roth Conversion Calculator", tone: "teal", title: "Plan for required distributions.",
    text: "Your required withdrawals, and what converting saves against doing nothing.", go: "Open the Roth Conversion Calculator" },
];
const N = CHAPTERS.length;

/** Where a pane sits for its distance from the front: 0 is the front, 1 the
    next one waiting behind it, -1 the one that has just flown past. */
function paneStyle(d: number, still: boolean): { transform: string; opacity: string; filter: string; zIndex: string } {
  if (still) return { transform: "none", opacity: Math.abs(d) < 0.5 ? "1" : "0", filter: "none", zIndex: String(100 - Math.round(Math.abs(d) * 10)) };
  if (d >= 0) {
    return {
      transform: `translate3d(${(d * 5).toFixed(2)}%, ${(-d * 12).toFixed(2)}%, ${(-d * 170).toFixed(1)}px)`,
      opacity: clamp(1 - d * 0.5).toFixed(3),
      filter: d > 0.04 ? `blur(${Math.min(d * 2.5, 6).toFixed(2)}px)` : "none",
      zIndex: String(100 - Math.round(d * 10)),
    };
  }
  const k = -d;
  return {
    transform: `translate3d(${(-k * 9).toFixed(2)}%, ${(k * 34).toFixed(2)}%, ${(k * 330).toFixed(1)}px) rotateX(${(-k * 16).toFixed(2)}deg)`,
    opacity: clamp(1 - k * 2.4).toFixed(3),
    filter: `blur(${Math.min(k * 12, 10).toFixed(2)}px)`,
    zIndex: "120",
  };
}

export function Life({ data }: { data: HomeData }) {
  const track = useRef<HTMLElement>(null);
  const geo = useMemo(() => lifeGeometry(data), [data]);
  useLifeMotion(track, geo);

  return (
    <section className="hx-life" ref={track} aria-labelledby="hmTitle">
      <div className="hx-stage" data-stage="">
        <div className="hx-pool" aria-hidden="true" />

        <div className="hx-hero" data-hero="">
          <h1 className="hx-display" id="hmTitle">The complete <em>retirement planning</em> toolkit.</h1>
          <p className="hx-lede">
            Saving, withdrawals, taxes and Social Security, tested against <b>every market since 1926</b>. Free, with no account needed.
          </p>
          <div className="hx-btns">
            <Link href="/dashboard" className={buttonVariants({ size: "xl" })}>My Dashboard<ArrowRightIcon data-icon="inline-end" aria-hidden="true" /></Link>
            <Link href="/calculator" className={buttonVariants({ variant: "outline", size: "xl" })}>Open the Calculator</Link>
            <Link href="/guide" className={buttonVariants({ variant: "outline", size: "xl" }) + " hx-btn-3"}>Start the guide</Link>
          </div>
        </div>

        {/* The live reading: decoration for a sighted visitor, so it's kept
            from a screen reader, which gets the panes as a plain list. */}
        <div className="hx-age">
          <div className="hx-age-n" aria-hidden="true"><span>Age</span><b className="num" data-age="">{EXAMPLE.age}</b></div>
          <div className="hx-bal" aria-hidden="true">
            <b className="num" data-bal="">{fmtMoney(EXAMPLE.saved)}</b>
            <span data-bal-k="">saved, in today&apos;s dollars</span>
          </div>
        </div>

        <ol className="hx-deck" data-deck="">
          {CHAPTERS.map((c, i) => (
            <li key={c.href} className={"hx-pane hx-t-" + c.tone} data-pane="" data-draw={i ? "pending" : "go"} style={{ "--d": i } as React.CSSProperties}>
              <Link href={c.href} className="hx-pane-in">
                <span className="hx-kick">{c.tool}<i>Age {c.age}</i></span>
                <h2 className="hx-pane-h">{c.title}</h2>
                {c.text ? <p>{c.text}</p> : null}
                <div className="hx-viz"><PaneViz i={i} data={data} /></div>
                <span className="hx-go">{c.go}<ArrowRightIcon aria-hidden="true" /></span>
              </Link>
            </li>
          ))}
        </ol>

        <div className="hx-chart" aria-hidden="true">
          <svg className="hx-ghost" viewBox="0 0 1000 400" preserveAspectRatio="none">
            <path className="hx-env" d={geo.envelope} />
            <path className="hx-ln" d={geo.growth + geo.median.replace(/^M/, "L")} />
          </svg>
          <div className="hx-lit">
            <svg viewBox="0 0 1000 400" preserveAspectRatio="none">
              <path className="hx-area" d={geo.area} />
              {geo.fan.map((f, i) => <path key={i} className={f.failed ? "hx-fail" : "hx-run"} d={f.d} />)}
              <path className="hx-ln" d={geo.growth} />
              <path className="hx-ln" d={geo.median} />
            </svg>
          </div>
          <i className="hx-retire" style={{ "--x": geo.x(RETIRE) / 10 + "%" } as React.CSSProperties}><span>Retire at {RETIRE}</span></i>
          <i className="hx-cursor" />
          <i className="hx-now" />
          <div className="hx-axis">
            {[30, 40, 50, 60, 70, 80, 90].map((a) => <span key={a} style={{ "--x": geo.x(a) / 10 + "%" } as React.CSSProperties}>{a}</span>)}
          </div>
        </div>

        <div className="hx-marks">
          {CHAPTERS.map((c, i) => (
            <button key={c.href} type="button" data-mark={i} style={{ "--x": geo.x(c.age) / 10 + "%" } as React.CSSProperties} tabIndex={-1} aria-hidden="true" title={c.tool} />
          ))}
        </div>

        <div className="hx-cue" aria-hidden="true"><span>Scroll to follow one plan from 32 to 95</span><i /></div>
      </div>
    </section>
  );
}

/** What each pane shows under its heading. */
function PaneViz({ i, data }: { i: number; data: HomeData }) {
  switch (i) {
    case 0: return (
      <div>
        <div className="hx-fig"><b className="num">{fmtMoney(data.growth[data.growth.length - 1])}</b><span>at 65, in today&apos;s dollars</span></div>
        <GrowthChart values={data.growth} w={520} h={150} />
      </div>
    );
    case 1: return (
      <div className="hm-guide">
        <ScoreRing />
        <ul className="hm-steps">
          <li className="done"><b aria-hidden="true"><CheckIcon /></b>Savings</li>
          <li className="done"><b aria-hidden="true"><CheckIcon /></b>Spending</li>
          <li className="now"><b aria-hidden="true">3</b>Retirement age</li>
          <li><b aria-hidden="true">4</b>Your plan</li>
        </ul>
      </div>
    );
    case 2: return <FireChart />;
    case 3: return <BridgeChart />;
    case 4: return <HealthChart />;
    case 5: return <SocialChart />;
    case 6: return <CloudChart />;
    case 7: return (
      <div className="hx-fig hx-fig-big">
        <b className="num">{Math.round(data.lasted * 100)}%</b>
        <span>of retirements since 1926 lasted 30 years at 4% per year</span>
      </div>
    );
    default: return <RothChart />;
  }
}

interface Geo {
  x: (age: number) => number;
  growth: string; median: string; area: string; envelope: string;
  fan: { d: string; failed: boolean }[];
  /** The balance at an age, and how far up the chart it sits (0 top, 1 bottom). */
  at: (age: number) => { v: number; y: number };
}

/** The chart's shapes, in a 1000 by 400 box that stretches to whatever
    space the page gives it: the example household's savings to 65, then
    every January retirement since 1926, scaled from the Drawdown
    Simulator's $1M to what the household has by then (spending 4% of the
    starting balance scales with it, so the paths keep their shape). */
function lifeGeometry(data: HomeData): Geo {
  const fv = data.growth[data.growth.length - 1], k = fv / data.fan.lines[0][0];
  const lines = data.fan.lines.map((l) => l.map((v) => v * k));
  const years = lines[0].length;
  const median: number[] = [], lo: number[] = [], hi: number[] = [];
  for (let t = 0; t < years; t++) {
    const col = lines.map((l) => l[t]).sort((a, b) => a - b);
    median.push(col[Math.floor(col.length / 2)]);
    lo.push(col[Math.floor(col.length * 0.05)]);
    hi.push(col[Math.floor(col.length * 0.95)]);
  }
  const top = fv * 2.25;
  const x = (age: number) => ((age - A0) / (A1 - A0)) * 1000;
  const yf = (v: number) => 1 - Math.min(v / top, 1.06) * 0.94;
  const y = (v: number) => yf(v) * 400;
  const path = (pts: [number, number][]) => pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join("");
  const g = data.growth.map((v, i): [number, number] => [x(EXAMPLE.age + i), y(v)]);
  const fx = (t: number) => x(RETIRE + t);
  return {
    x,
    growth: path(g),
    median: path(median.map((v, t): [number, number] => [fx(t), y(v)])),
    area: path(g) + `L${x(RETIRE).toFixed(1)} 400L${x(EXAMPLE.age).toFixed(1)} 400Z`,
    envelope: path(hi.map((v, t): [number, number] => [fx(t), y(v)])) + path(lo.map((v, t): [number, number] => [fx(t), y(v)]).reverse()).replace(/^M/, "L") + "Z",
    fan: lines.map((l, i) => ({ d: path(l.map((v, t): [number, number] => [fx(t), y(v)])), failed: data.fan.failed[i] })),
    at: (age) => {
      const src = age <= RETIRE ? data.growth : median, a = age <= RETIRE ? age - EXAMPLE.age : age - RETIRE;
      const i = clamp(Math.floor(a), 0, src.length - 1), j = Math.min(i + 1, src.length - 1), f = clamp(a - i);
      const v = src[i] + (src[j] - src[i]) * f;
      return { v, y: yf(v) };
    },
  };
}

function useLifeMotion(track: React.RefObject<HTMLElement | null>, geo: Geo) {
  useEffect(() => {
    const el = track.current;
    const stage = el?.querySelector<HTMLElement>("[data-stage]");
    if (!el || !stage) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const panes = [...el.querySelectorAll<HTMLElement>("[data-pane]")];
    const marks = [...el.querySelectorAll<HTMLElement>("[data-mark]")];
    const deck = el.querySelector<HTMLElement>("[data-deck]");
    const ageEl = el.querySelector<HTMLElement>("[data-age]"), balEl = el.querySelector<HTMLElement>("[data-bal]"), balK = el.querySelector<HTMLElement>("[data-bal-k]");
    let lastAge = -1, lastBal = "", lastK = -1, front = -1;

    /** How far through the scene the page has scrolled, 0 to 1. */
    const progress = () => {
      const r = el.getBoundingClientRect(), s = stage.getBoundingClientRect();
      const run = r.height - s.height;
      return run > 0 ? clamp((s.top - r.top) / run) : 0;
    };
    const tick = () => {
      const t = progress();
      const h = clamp(t / T0), raw = clamp((t - T0) / (T1 - T0)) * (N - 1), tail = clamp((t - T1) / (1 - T1));
      const i = Math.min(Math.floor(raw), N - 2), f = raw - i;
      // The age moves steadily; a pane holds the front for most of its
      // stretch, then hands over quickly, so two are never read at once.
      const e = clamp((f - 0.3) / 0.4), pos = i + e * e * (3 - 2 * e);
      const age = CHAPTERS[i].age + (CHAPTERS[i + 1].age - CHAPTERS[i].age) * f + (END - CHAPTERS[N - 1].age) * tail;
      const here = geo.at(age);
      stage.style.setProperty("--h", h.toFixed(3));
      stage.style.setProperty("--p", (geo.x(age) / 1000).toFixed(4));
      stage.style.setProperty("--cy", here.y.toFixed(4));
      // The light behind the deck: gold while saving, jade as work becomes
      // optional, steel in retirement.
      stage.style.setProperty("--k1", clamp((age - 42) / 14).toFixed(3));
      stage.style.setProperty("--k2", clamp((age - 60) / 8).toFixed(3));
      stage.toggleAttribute("data-live", h > 0.5);
      stage.toggleAttribute("data-retired", age >= RETIRE);
      const whole = Math.round(age);
      if (whole !== lastAge && ageEl) { ageEl.textContent = String(whole); lastAge = whole; }
      const bal = fmtMoney(here.v);
      if (bal !== lastBal && balEl) { balEl.textContent = bal; lastBal = bal; }
      const kk = age > RETIRE ? 1 : 0;
      if (kk !== lastK && balK) { balK.textContent = kk ? "left, in the middle of those markets" : "saved, in today's dollars"; lastK = kk; }
      const now = Math.round(pos);
      panes.forEach((p, n) => {
        const d = n - pos;
        Object.assign(p.style, paneStyle(d, still));
        p.style.pointerEvents = Math.abs(d) < 0.5 ? "" : "none";
        p.toggleAttribute("data-front", n === now);
        const on = p.getAttribute("data-draw") === "go";
        if (!on && d < 0.45 && d > -0.6) p.setAttribute("data-draw", "go");
        else if (on && d > 0.8) p.setAttribute("data-draw", "pending");
      });
      if (now !== front) { marks.forEach((m, n) => { m.toggleAttribute("data-on", n <= now); m.toggleAttribute("data-here", n === now); }); front = now; }
    };

    let queued = false;
    const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; tick(); }); } };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    tick();

    /** Scrolls to where pane n is at the front. */
    const goTo = (n: number) => {
      const r = el.getBoundingClientRect(), s = stage.getBoundingClientRect();
      const t = T0 + (n / (N - 1)) * (T1 - T0) + 0.002, pin = parseFloat(getComputedStyle(stage).top) || 0;
      scrollTo({ top: scrollY + r.top - pin + t * (r.height - s.height), behavior: still ? "auto" : "smooth" });
    };
    const onMark = (e: Event) => { const n = (e.currentTarget as HTMLElement).dataset.mark; if (n != null) goTo(Number(n)); };
    marks.forEach((m) => m.addEventListener("click", onMark));
    // Tabbing to a pane that isn't at the front brings it there.
    const onFocus = (e: FocusEvent) => {
      const n = panes.indexOf((e.target as HTMLElement).closest<HTMLElement>("[data-pane]") as HTMLElement);
      if (n >= 0 && n !== front && (e.target as HTMLElement).matches(":focus-visible")) goTo(n);
    };
    deck?.addEventListener("focusin", onFocus);

    // The deck leans toward the pointer, a few degrees, easing after it.
    let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0;
    const lean = () => {
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      stage.style.setProperty("--rx", cy.toFixed(3));
      stage.style.setProperty("--ry", cx.toFixed(3));
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.002 ? requestAnimationFrame(lean) : 0;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = stage.getBoundingClientRect();
      tx = clamp((e.clientX - r.left) / r.width) - 0.5; ty = clamp((e.clientY - r.top) / r.height) - 0.5;
      if (!raf) raf = requestAnimationFrame(lean);
    };
    if (!still) stage.addEventListener("pointermove", onMove);

    return () => {
      removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll);
      marks.forEach((m) => m.removeEventListener("click", onMark));
      deck?.removeEventListener("focusin", onFocus);
      stage.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [track, geo]);
}
