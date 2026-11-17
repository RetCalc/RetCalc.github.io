"use client";

/* The homepage, redesigned from the ground up (branch homepage-v3):

   1. Life (Life.tsx): the headline, then one household followed from 32 to
      95 on a single pinned chart, the tools coming forward at the ages
      you'd use them.
   2. The Dashboard: the real screen lying in space, its cards lifted off
      it, coming upright and settling as the page scrolls. On a phone, two
      iPhones instead of the laptop screen.
   3. Every tool as a card with its picture, in three belts that drift
      slowly, right, left, right (on a phone, three rows to swipe).
   4. The record the plans are tested against, each year since 1926.
   5. The close.

   No tool runs here; everything opens one. Motion is on attributes React
   doesn't render (data-rv, data-draw, --s), so a re-render never undoes it,
   and reduced motion shows everything as it ends. Styles:
   styles/23-home-life.css (and 16-home.css for the charts); phones in
   styles/phone/33-home.css. */

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { TOOL_GROUPS, type ToolSub } from "@/lib/tools";
import { BacktestSliders, CollegeStairs, DebtDownhill, RentBuyBlueprint } from "@/components/tools/picker-charts";
import type { HomeData } from "./data";
import {
  BridgeChart, BudgetChart, CloudChart, FanChart, FireChart, HealthChart, MortgageChart, RothChart, SocialChart, TaxChart,
} from "./charts";
import { Century } from "./Century";
import { Life } from "./Life";

const SHOTS = "/dashboard-landing/v2/";

export function Home({ data }: { data: HomeData }) {
  const root = useRef<HTMLDivElement>(null);
  useHomeMotion(root);
  return (
    <div className="hm hx" ref={root}>
      <Life data={data} />

      <section className="hx-dash" aria-labelledby="hxDash">
        <div className="hx-in hx-dash-head">
          <h2 className="hx-h2" id="hxDash" data-rv="">Your whole plan, in one place.</h2>
          <div data-rv="" style={{ "--d": 1 } as React.CSSProperties}>
            <p className="hx-body">
              A free account keeps your accounts, pay, spending and retirement together, on every device. No bank logins: you type your own numbers.
            </p>
            <Link href="/dashboard" className={buttonVariants({ size: "xl" })}>Open My Dashboard<ArrowRightIcon data-icon="inline-end" aria-hidden="true" /></Link>
          </div>
        </div>

        {/* The laptop screen in space (768px and up). */}
        <Link href="/dashboard" className="hx-scene max-phone:hidden" data-scrub="" aria-label="Open My Dashboard">
          <div className="hx-plane">
            <div className="hx-base"><Shot name="dash" w={2880} h={1800} sizes="(max-width: 767px) 1px, 1400px" alt="The Dashboard: net worth, readiness score, chance of success and retirement income" /></div>
            <Layer cls="hx-l1" box={[0.0725, 0.264, 0.592, 0.591]} />
            <Layer cls="hx-l2" box={[0.6785, 0.264, 0.2965, 0.356]} />
            <Layer cls="hx-l3" box={[0.6785, 0.638, 0.2965, 0.217]} />
            <div className="hx-phone hx-l4">
              <i className="hx-island" aria-hidden="true" />
              <Shot name="phone-networth" w={1206} h={2622} sizes="(max-width: 767px) 1px, 300px" alt="The Dashboard's net worth chart on an iPhone" />
            </div>
          </div>
        </Link>

        {/* Two iPhones (phones only). */}
        <Link href="/dashboard" className="hx-phones phone:hidden" data-scrub="" aria-label="Open My Dashboard">
          <div className="hx-phone hx-p1">
            <i className="hx-island" aria-hidden="true" />
            <Shot name="phone-networth" w={1206} h={2622} sizes="(min-width: 768px) 1px, 60vw" alt="The Dashboard's net worth chart on an iPhone" />
          </div>
          <div className="hx-phone hx-p2">
            <i className="hx-island" aria-hidden="true" />
            <Shot name="phone-summary" w={804} h={1748} sizes="(min-width: 768px) 1px, 60vw" alt="The Dashboard's Plan summary on an iPhone" />
          </div>
        </Link>

        <ul className="hx-in hx-points">
          <li data-rv=""><b>Net worth</b>Every account and debt, and how it has moved since you last looked.</li>
          <li data-rv="" style={{ "--d": 1 } as React.CSSProperties}><b>A readiness score</b>Out of 100, with what to do next to raise it.</li>
          <li data-rv="" style={{ "--d": 2 } as React.CSSProperties}><b>Chance of success</b>Your own plan, run through every market since 1926.</li>
          <li data-rv="" style={{ "--d": 3 } as React.CSSProperties}><b>A monthly check-in</b>One email, to keep your balances current. Turn it off any time.</li>
        </ul>
      </section>

      <Tools data={data} />

      <section className="hx-record hx-in" aria-labelledby="hxRecord">
        <div className="hx-head">
          <h2 className="hx-h2" id="hxRecord" data-rv="">Tested against every market since 1926.</h2>
          <p className="hx-body" data-rv="" style={{ "--d": 1 } as React.CSSProperties}>
            An average return hides the bad decades. The Drawdown Simulator, the Optimizer and your Dashboard run a plan through each one, month by month.
          </p>
        </div>
        <Century start={data.century.start} real={data.century.real} />
      </section>

      <section className="hx-close" aria-labelledby="hxClose">
        <div className="hx-in">
          <h2 className="hx-display hx-close-h" id="hxClose" data-rv="">Find out where you <em>stand</em>.</h2>
          <div data-rv="" style={{ "--d": 1 } as React.CSSProperties}>
            <p className="hx-body">Free. What you enter stays in your browser unless you sign in to save it.</p>
            <div className="hx-btns">
              <Link href="/dashboard" className={buttonVariants({ size: "xl" })}>My Dashboard<ArrowRightIcon data-icon="inline-end" aria-hidden="true" /></Link>
              <Link href="/calculator" className={buttonVariants({ variant: "outline", size: "xl" })}>Open the Calculator</Link>
              <Link href="/guide" className={buttonVariants({ variant: "outline", size: "xl" })}>Start the guide</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/** A Dashboard picture in both themes; the page's theme shows one. */
function Shot({ name, w, h, sizes, alt }: { name: string; w: number; h: number; sizes: string; alt: string }) {
  return (
    <>
      <Image className="dl-lt" src={`${SHOTS}${name}-light.png`} width={w} height={h} sizes={sizes} alt={alt} />
      <Image className="dl-dk" src={`${SHOTS}${name}-dark.png`} width={w} height={h} sizes={sizes} alt={alt} />
    </>
  );
}

/** One card of the Dashboard screen, cut from the same picture and lifted
    off it: `box` is its left, top, width and height as shares of the screen. */
function Layer({ cls, box: [l, t, w, h] }: { cls: string; box: [number, number, number, number] }) {
  const pct = (v: number) => (v * 100).toFixed(3) + "%";
  return (
    <div className={"hx-layer " + cls} aria-hidden="true" style={{ "--l": pct(l), "--t": pct(t), "--w": pct(w), "--h": pct(h), "--iw": pct(1 / w), "--il": pct(-l / w), "--it": pct(-t / h) } as React.CSSProperties}>
      <div>
        <Shot name="dash" w={2880} h={1800} sizes="(max-width: 767px) 1px, 1400px" alt="" />
      </div>
    </div>
  );
}

function ToolViz({ sub, data }: { sub: ToolSub; data: HomeData }) {
  switch (sub) {
    case "drawdown": return <FanChart fan={data.fan} w={340} h={170} />;
    case "optimizer": return <CloudChart />;
    case "social": return <SocialChart />;
    case "bridge": return <BridgeChart />;
    case "roth": return <RothChart />;
    case "healthcare": return <HealthChart />;
    case "fire": return <FireChart />;
    case "backtest": return <BacktestSliders />;
    case "college": return <CollegeStairs />;
    case "rentbuy": return <RentBuyBlueprint buy={data.rentbuy.buy} rent={data.rentbuy.rent} />;
    case "tax": return <TaxChart tax={data.tax} w={400} h={140} />;
    case "budget": return <BudgetChart />;
    case "debt": return <DebtDownhill />;
    case "mortgage": return <MortgageChart years={data.mortgage} />;
  }
}

/** Every tool, as a card with its picture. On a desktop each group is a
    belt of cards that drifts slowly on its own, the first to the right,
    the next to the left, the third to the right, and stops under the
    pointer; the cards repeat so the belt never ends. A belt can be moved
    by hand: drag it, swipe sideways on a trackpad, or use its arrows. On
    a phone each group is one row to swipe, with no repeats. */
function Tools({ data }: { data: HomeData }) {
  const box = useRef<HTMLElement>(null);
  useBelts(box);
  /** Draws a card's picture again, from nothing, each time the pointer comes to it. */
  const replay = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse" || e.buttons) return;
    const card = e.currentTarget;
    // Back to the start at once (no easing out), then play.
    card.classList.add("hx-snap");
    card.setAttribute("data-draw", "pending");
    void card.offsetWidth;
    card.classList.remove("hx-snap");
    requestAnimationFrame(() => card.setAttribute("data-draw", "go"));
  };
  return (
    <section className="hx-tools" ref={box} aria-labelledby="hxTools">
      <div className="hx-in">
        <div className="hx-head">
          <h2 className="hx-h2" id="hxTools" data-rv="">A calculator, a guide and 14 tools.</h2>
          <p className="hx-body" data-rv="" style={{ "--d": 1 } as React.CSSProperties}>
            Enter your household once and it fills in everywhere.
          </p>
        </div>
        <nav className="hx-trio" aria-label="Start here">
          <Link href="/calculator"><b>Calculator</b><span>What your savings grow to, in Basic or Advanced.</span><ArrowRightIcon aria-hidden="true" /></Link>
          <Link href="/guide"><b>Guide</b><span>Step by step, starting with a readiness score.</span><ArrowRightIcon aria-hidden="true" /></Link>
          <Link href="/learn"><b>Learn</b><span>{data.lessons} short lessons, from compound interest to Roth conversions.</span><ArrowRightIcon aria-hidden="true" /></Link>
        </nav>
      </div>
      <div className="hx-rows">
        {TOOL_GROUPS.map((g, gi) => {
          // Enough cards in each half of the belt to outrun a wide screen.
          const reps = Math.ceil(8 / g.cards.length);
          const half = (copy: boolean) => Array.from({ length: reps }, (_, r) => g.cards.map((c) => {
            const extra = copy || r > 0;
            return (
              <li key={`${copy ? "b" : "a"}${r}${c.sub}`} className={extra ? "hx-copy" : undefined} aria-hidden={extra || undefined}>
                <Link href={"/" + c.path} className="hx-tool" draggable={false} data-draw="" data-draw-at="0.6" tabIndex={extra ? -1 : undefined} onPointerEnter={replay}>
                  <span className="hx-peek" aria-hidden="true"><ToolViz sub={c.sub} data={data} /></span>
                  <span className="hx-tool-n">{c.name}<ArrowRightIcon aria-hidden="true" /></span>
                  <span className="hx-tool-q">{c.q}</span>
                </Link>
              </li>
            );
          }));
          return (
            <div key={g.label} className="hx-row">
              <div className="hx-in hx-row-head">
                <h3>{g.title}</h3>
                <div className="hx-nudge max-phone:hidden">
                  <Button variant="outline" size="icon" data-nudge="-1" aria-label={`${g.title}: earlier tools`}><ArrowLeftIcon aria-hidden="true" /></Button>
                  <Button variant="outline" size="icon" data-nudge="1" aria-label={`${g.title}: more tools`}><ArrowRightIcon aria-hidden="true" /></Button>
                </div>
              </div>
              <div className="hx-belt" data-belt={gi % 2 ? "left" : "right"}>
                <ul className="hx-track" style={{ "--n": reps * g.cards.length } as React.CSSProperties}>{half(false)}{half(true)}</ul>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* The belts (768px and up). Each keeps its own place (x, in pixels) and is
   moved a frame at a time: by hand while it's dragged, then on what's left
   of that push, then toward where an arrow sent it, and otherwise at its
   own slow drift, which waits while the pointer is over the belt. The
   track holds its cards twice, so the place wraps at half its width. On a
   phone the belts are plain rows that scroll and none of this runs. */
function useBelts(box: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches, phone = matchMedia("(width < 768px)");
    const DRIFT = 30;
    interface Belt {
      belt: HTMLElement; track: HTMLElement; dir: number; x: number; v: number; target: number | null; over: boolean;
      drag: { x0: number; from: number; last: number; t: number; moved: boolean } | null;
    }
    const belts: Belt[] = [...el.querySelectorAll<HTMLElement>("[data-belt]")].map((belt) => ({
      belt, track: belt.querySelector<HTMLElement>(".hx-track") as HTMLElement, dir: belt.dataset.belt === "left" ? -1 : 1,
      x: 0, v: 0, target: null, over: false, drag: null,
    }));
    let raf = 0, last = 0, seen = false;
    const frame = (t: number) => {
      const dt = Math.min(0.05, last ? (t - last) / 1000 : 0);
      last = t;
      for (const b of belts) {
        if (phone.matches) { if (b.track.style.transform) b.track.style.transform = ""; continue; }
        const half = b.track.scrollWidth / 2;
        if (b.drag) { /* the pointer sets x */ }
        else if (b.target != null) {
          const d = b.target - b.x;
          b.x += d * Math.min(1, dt * 7);
          if (Math.abs(d) < 0.5) { b.x = b.target; b.target = null; }
        } else if (Math.abs(b.v) > 6) { b.x += b.v * dt; b.v *= Math.pow(0.03, dt); }
        else if (!b.over && !still) b.x += b.dir * DRIFT * dt;
        if (half > 0) {
          const wrap = b.x <= -half ? half : b.x > 0 ? -half : 0;
          if (wrap) { b.x += wrap; if (b.target != null) b.target += wrap; if (b.drag) b.drag.x0 += wrap; }
        }
        b.track.style.transform = `translate3d(${b.x.toFixed(2)}px,0,0)`;
      }
      raf = seen ? requestAnimationFrame(frame) : 0;
    };
    const io = new IntersectionObserver(([e]) => {
      seen = e.isIntersecting;
      if (seen && !raf) { last = 0; raf = requestAnimationFrame(frame); }
    }, { rootMargin: "200px" });
    io.observe(el);

    const offs: (() => void)[] = [];
    const on = <K extends keyof HTMLElementEventMap>(n: HTMLElement, k: K, f: (e: HTMLElementEventMap[K]) => void, o?: AddEventListenerOptions) => {
      n.addEventListener(k, f as EventListener, o);
      offs.push(() => n.removeEventListener(k, f as EventListener, o));
    };
    for (const b of belts) {
      on(b.belt, "pointerenter", (e) => { if (e.pointerType === "mouse") b.over = true; });
      on(b.belt, "pointerleave", () => { b.over = false; });
      on(b.belt, "focusin", () => { b.over = true; });
      on(b.belt, "focusout", () => { b.over = false; });
      on(b.belt, "pointerdown", (e) => {
        if (phone.matches || (e.pointerType === "mouse" && e.button !== 0)) return;
        b.drag = { x0: b.x, from: e.clientX, last: e.clientX, t: e.timeStamp, moved: false };
        b.v = 0; b.target = null;
      });
      on(b.belt, "pointermove", (e) => {
        const d = b.drag;
        if (!d) return;
        const dx = e.clientX - d.from;
        if (!d.moved && Math.abs(dx) > 6) { d.moved = true; b.belt.setPointerCapture(e.pointerId); b.belt.setAttribute("data-drag", ""); }
        if (!d.moved) return;
        b.x = d.x0 + dx;
        const dt = (e.timeStamp - d.t) / 1000;
        if (dt > 0) b.v = b.v * 0.6 + ((e.clientX - d.last) / dt) * 0.4;
        d.last = e.clientX; d.t = e.timeStamp;
      });
      const end = (e: PointerEvent) => {
        const d = b.drag;
        if (!d) return;
        b.drag = null;
        b.belt.removeAttribute("data-drag");
        if (!d.moved) { b.v = 0; return; }
        if (e.timeStamp - d.t > 80) b.v = 0;
        // The press that ended a drag isn't a click on the card under it.
        const stop = (c: Event) => { c.preventDefault(); c.stopPropagation(); };
        b.belt.addEventListener("click", stop, { capture: true, once: true });
        setTimeout(() => b.belt.removeEventListener("click", stop, { capture: true }), 0);
      };
      on(b.belt, "pointerup", end);
      on(b.belt, "pointercancel", end);
      // A sideways swipe on a trackpad moves the belt; up and down still scrolls the page.
      on(b.belt, "wheel", (e) => {
        if (phone.matches || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
        e.preventDefault();
        b.x -= e.deltaX; b.v = 0; b.target = null;
      }, { passive: false });
      const row = b.belt.closest(".hx-row");
      row?.querySelectorAll<HTMLElement>("[data-nudge]").forEach((btn) => on(btn, "click", () => {
        const card = b.track.querySelector("li")?.getBoundingClientRect().width ?? 340;
        b.v = 0;
        b.target = (b.target ?? b.x) - Number(btn.dataset.nudge) * card * 2;
      }));
    }
    return () => { io.disconnect(); cancelAnimationFrame(raf); offs.forEach((f) => f()); };
  }, [box]);
}

/* The page's motion below the first scene: text eases in as it arrives
   (data-rv), a chart draws once most of it is on screen and resets when it
   drops back below the fold (data-draw), and a scene follows the scroll
   (data-scrub: --s runs 0 to 1 as it comes up the screen). */
function useHomeMotion(root: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rvs = [...el.querySelectorAll<HTMLElement>("[data-rv]")];
    const draws = [...el.querySelectorAll<HTMLElement>("[data-draw]:not([data-pane])")];
    const scrubs = [...el.querySelectorAll<HTMLElement>("[data-scrub]")];
    if (!still) {
      rvs.forEach((n) => n.setAttribute("data-rv", "pre"));
      draws.forEach((n) => n.setAttribute("data-draw", "pending"));
    } else scrubs.forEach((n) => n.style.setProperty("--s", "1"));
    /* The part of the screen the header leaves: below it, or above it in
       the home-screen app, where it's a tab bar along the bottom. */
    const view = (): [number, number] => {
      const r = document.querySelector<HTMLElement>(".navbar")?.getBoundingClientRect();
      if (!r) return [0, innerHeight];
      return r.top > innerHeight / 2 ? [0, r.top] : [Math.max(0, r.bottom), innerHeight];
    };
    let queued = false;
    const tick = () => {
      queued = false;
      const [top, vh] = view();
      if (still) return;
      for (const n of rvs) {
        const r = n.getBoundingClientRect();
        if (r.top < vh * 0.9 && r.bottom > top) n.setAttribute("data-rv", "in");
        else if (r.top >= vh) n.setAttribute("data-rv", "pre");
      }
      for (const n of draws) {
        const r = n.getBoundingClientRect(), on = n.getAttribute("data-draw") === "go";
        if (!r.height) continue;
        const need = Math.min(r.height, vh - top) * Number(n.dataset.drawAt ?? 0.9), seen = Math.min(r.bottom, vh) - Math.max(r.top, top);
        if (!on && seen >= need) n.setAttribute("data-draw", "go");
        else if (on && r.top >= vh) n.setAttribute("data-draw", "pending");
      }
      for (const n of scrubs) {
        const r = n.getBoundingClientRect();
        if (!r.height) continue;
        // 0 as its top edge comes on screen, 1 just before that edge reaches the top.
        const s = Math.max(0, Math.min(1, (vh * 0.98 - r.top) / ((vh - top) * 0.9)));
        n.style.setProperty("--s", (s * s * (3 - 2 * s)).toFixed(4));
      }
    };
    const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(tick); } };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    const t = setTimeout(tick, 120);
    return () => { clearTimeout(t); removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll); };
  }, [root]);
}
