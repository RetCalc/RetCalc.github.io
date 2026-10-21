"use client";

/* The homepage: what RetCalc is, then the tools laid along a life, in the
   order you'd reach for them, then the everyday money tools. No tool runs
   here; every tile opens one. Built from the owner's chosen mock
   (HOMEPAGE_BRIEF.md, .impeccable/mocks/homepage/f.html).

   Motion (styles/16-home.css): the top of the page (the hero and the first
   section's heading) is still, so it's there the moment the page opens;
   further down, text eases in as it arrives; a tile's chart
   draws once about 90% of the tile is on screen below the header, and resets
   when the tile drops back below the fold, so scrolling up and down replays
   it. The age line fills with the scroll and its nodes light as the reading
   line passes them. Reduced motion shows everything as it ends. */

import { ReportThumb } from "@/tools/guide/report/Thumb";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { HomeData } from "./data";
import {
  BridgeChart, BudgetChart, CloudChart, FanChart, FireChart, GrowthChart, HealthChart, MortgageChart, RothChart, ScoreRing, TaxChart,
} from "./charts";
import { RentBuyBlueprint } from "@/components/tools/picker-charts";

const fmtMoney = (v: number) => (v >= 1e6 ? "$" + (v / 1e6).toFixed(2) + "M" : "$" + Math.round(v / 1000).toLocaleString("en-US") + "K");

export function Home({ data }: { data: HomeData }) {
  const root = useRef<HTMLDivElement>(null);
  useHomeMotion(root);
  const fv = data.growth[data.growth.length - 1];
  return (
    <div className="hm" ref={root}>
      <section className="hm-hero" aria-labelledby="hmTitle">
        <h1 className="hm-display" id="hmTitle">The complete <em>retirement planning</em> toolkit.</h1>
        <div>
          <p className="hm-lede">
            Calculators for saving, withdrawals, taxes, Roth conversions, healthcare and Social Security, each checked against <b>every market since 1926</b>. Free, and you don&apos;t need an account.
          </p>
          <div className="hm-btns">
            <Link href="/calculator" className={buttonVariants({ size: "xl" })}>Open the Calculator<ArrowRightIcon data-icon="inline-end" aria-hidden="true" /></Link>
            <Link href="/guide" className={buttonVariants({ variant: "outline", size: "xl" })}>Start the guide</Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="hmTools">
        <div className="hm-head">
          <h2 className="hm-h2" id="hmTools">From saving to retirement.</h2>
          <p className="hm-body">
            A calculator, a guide and 14 planning tools. They share one household, so what you enter once fills in everywhere.
          </p>
        </div>

        <div className="hm-tl" data-tl="">
          <div className="hm-spine" aria-hidden="true" />
          <div className="hm-fill" aria-hidden="true" />

          <Node row={1} label="30s" />
          <Link href="/calculator" className="hm-tile hm-amber hm-wide hm-r2" data-draw="" data-rv="">
            <span className="hm-kick hm-c-amber">Calculator</span>
            <div className="hm-split">
              <div>
                <h3 className="hm-h3">See what your savings grow to.</h3>
                <p>Put in your age, what you&apos;ve saved and what you add each month. Advanced mode adds taxes and fees; Stages lets the plan change over time.</p>
                <div className="hm-readout">
                  <div className="k">At 65, in today&apos;s dollars</div>
                  <CountUp className="v amber" to={fv} format={fmtMoney} />
                </div>
              </div>
              <GrowthChart values={data.growth} />
            </div>
            <Go>Open the Calculator</Go>
          </Link>

          <Node row={3} label="30s" />
          <Link href="/guide" className="hm-tile hm-jade hm-left hm-r3" data-draw="" data-rv="">
            <span className="hm-kick hm-c-jade">Retirement Readiness Guide</span>
            <h3 className="hm-h3">Get a readiness score.</h3>
            <div className="hm-guide">
              <ScoreRing />
              <ul className="hm-steps">
                <li className="done"><b aria-hidden="true"><CheckIcon /></b>Savings</li>
                <li className="done"><b aria-hidden="true"><CheckIcon /></b>Spending</li>
                <li className="now"><b aria-hidden="true">3</b>Retirement age</li>
                <li><b aria-hidden="true">4</b>Your plan</li>
              </ul>
            </div>
            <div className="rp-offer">
              <ReportThumb />
              <p><b>It ends with your full report.</b>A full-color plan to print or save as a PDF: your savings against every market since 1926, Social Security, taxes, health insurance and your next moves.</p>
            </div>
            <Go>Start the guide</Go>
          </Link>

          <Node row={4} label="40s" />
          <Tile href="/fire" className="hm-right hm-r4" kick="FIRE Calculator" title="Find the year work becomes optional."><FireChart /></Tile>

          <Node row={5} label="52 to 59½" />
          <Tile href="/bridge" className="hm-left hm-r5" kick="Early Retirement Bridge" kickClass="hm-c-lav" title="Pay for the years before 59½."
            text="A Roth ladder, 72(t) payments, the rule of 55 or your brokerage account, with the tax and penalties of each."><BridgeChart /></Tile>

          <Node row={6} label="Until 65" />
          <Tile href="/healthcare" className="hm-right hm-r6" kick="Healthcare Cost Planner" kickClass="hm-c-sky" title="Price health insurance until Medicare."
            text="ACA premiums and subsidies, then Part B, Part D and IRMAA."><HealthChart /></Tile>

          <Node row={7} label="62 to 70" />
          <Tile href="/optimizer" className="hm-left hm-r7" kick="Plan Optimizer" kickClass="hm-c-amber"
            title="Put it all together into one plan."
            text="Tries thousands of claiming ages, withdrawal orders and Roth conversions, and finds the combination that leaves you the most."><CloudChart /></Tile>

          <Node row={8} label="65" />
          <Link href="/drawdown" className="hm-tile hm-steel hm-wide hm-r9" data-draw="" data-rv="">
            <span className="hm-kick hm-c-steel">Drawdown Simulator</span>
            <div className="hm-split hm-dd">
              <div>
                <h3 className="hm-h3">Check that your money lasts.</h3>
                <p>It retires you in every month since 1926, through the Depression, the 1970s and 2008. 15 withdrawal strategies to compare.</p>
                <div className="hm-readout">
                  <div className="v">{Math.round(data.lasted * 100)}%</div>
                  <div className="k">of retirements since 1926 lasted 30 years at 4% per year</div>
                </div>
              </div>
              <FanChart fan={data.fan} />
            </div>
            <Go>Open the Drawdown Simulator</Go>
          </Link>

          <Node row={10} label="73" />
          <Tile href="/roth" className="hm-right hm-r10" kick="Roth Conversion & RMDs" kickClass="hm-c-teal" title="Plan for required distributions."
            text="Your required withdrawals to age 100, and what a conversion schedule saves against doing nothing."><RothChart /></Tile>
        </div>
      </section>

      <section aria-labelledby="hmEveryday">
        <div className="hm-head hm-later">
          <h2 className="hm-h2" id="hmEveryday" data-rv="">Taxes, debt, housing and investing.</h2>
          <p className="hm-body" data-rv="" style={{ "--d": 1 } as React.CSSProperties}>Same household, same saved scenarios.</p>
        </div>
        <div className="hm-grid">
          <Tile href="/incometax" className="hm-s6" name="Income Tax"
            text="Take-home pay, or the tax on a year of retirement income. Uses the 2026 federal brackets and the income tax rules of all 50 states and DC.">
            <TaxChart tax={data.tax} />
          </Tile>
          <Tile href="/rentbuy" className="hm-s6" name="Rent vs. Buy Analysis" d={1}
            text="Your net worth if you buy, against renting and investing the difference, over any number of years.">
            <RentBuyBlueprint buy={data.rentbuy.buy} rent={data.rentbuy.rent} />
          </Tile>
          <Tile href="/mortgage" className="hm-s4" name="Mortgage Calculator"
            text="Your payment, the interest over the life of the loan, and what extra payments save.">
            <MortgageChart years={data.mortgage} />
          </Tile>
          <Tile href="/budget" className="hm-s4" name="Budget" d={1} text="Where your money goes each month, and how much is left to save.">
            <BudgetChart />
          </Tile>
          <div className="hm-tile hm-s4" data-rv="" style={{ "--d": 2 } as React.CSSProperties}>
            <h3 className="hm-name">More tools</h3>
            <nav className="hm-links" aria-label="More tools">
              <Link href="/social-security">Social Security Calculator<ArrowRightIcon aria-hidden="true" /></Link>
              <Link href="/debt">Debt Payoff<ArrowRightIcon aria-hidden="true" /></Link>
              <Link href="/college">College Savings<ArrowRightIcon aria-hidden="true" /></Link>
              <Link href="/backtest">Portfolio Backtest<ArrowRightIcon aria-hidden="true" /></Link>
            </nav>
            <Link href="/tools" className="hm-go">Browse all tools<ArrowRightIcon aria-hidden="true" /></Link>
          </div>
        </div>
      </section>

      <section className="hm-close" aria-labelledby="hmClose">
        <h2 className="hm-h2" id="hmClose" data-rv="">Find out where you stand.</h2>
        <div data-rv="" style={{ "--d": 1 } as React.CSSProperties}>
          <p className="hm-body">Free, and no account needed. Everything you enter stays in your browser unless you sign in to save it.</p>
          <div className="hm-btns">
            <Link href="/calculator" className={buttonVariants({ size: "xl" })}>Open the Calculator<ArrowRightIcon data-icon="inline-end" aria-hidden="true" /></Link>
            <Link href="/guide" className={buttonVariants({ variant: "outline", size: "xl" })}>Start the guide</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

const ROWS = ["", "hm-r1", "hm-r2", "hm-r3", "hm-r4", "hm-r5", "hm-r6", "hm-r7", "hm-r8", "hm-r9", "hm-r10"] as const;

function Node({ row, label }: { row: number; label: string }) {
  return <div className={"hm-node " + ROWS[row]} data-node="" aria-hidden="true"><i /><span>{label}</span></div>;
}

function Go({ children }: { children: React.ReactNode }) {
  return <span className="hm-go">{children}<ArrowRightIcon aria-hidden="true" /></span>;
}

/** A tool's tile: its name (or kicker and heading), a line about it, and its chart. */
function Tile({ href, className, kick, kickClass, title, name, text, d = 0, children }: {
  href: string; className: string; kick?: React.ReactNode; kickClass?: string; title?: string; name?: string; text?: string; d?: number; children: React.ReactNode;
}) {
  return (
    <Link href={href} className={"hm-tile " + className} data-draw="" data-rv="" style={{ "--d": d } as React.CSSProperties}>
      {kick ? <span className={"hm-kick " + (kickClass ?? "")}>{kick}</span> : null}
      {title ? <h3 className="hm-h3">{title}</h3> : null}
      {name ? <h3 className="hm-name">{name}</h3> : null}
      {text ? <p>{text}</p> : null}
      <div className="hm-mini">{children}</div>
    </Link>
  );
}

/** A figure that counts up when its tile plays and goes back to zero when it resets. */
function CountUp({ to, format, className }: { to: number; format: (v: number) => string; className: string }) {
  const el = useRef<HTMLDivElement>(null);
  const [v, setV] = useState(to);
  useEffect(() => {
    const tile = el.current?.closest("[data-draw]");
    if (!tile) return;
    let raf = 0;
    const play = () => {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(to); return; }
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / 1400);
        setV(to * (1 - Math.pow(1 - k, 4)));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(step);
    };
    const reset = () => { cancelAnimationFrame(raf); setV(0); };
    tile.addEventListener("hm:draw", play);
    tile.addEventListener("hm:undraw", reset);
    return () => { cancelAnimationFrame(raf); tile.removeEventListener("hm:draw", play); tile.removeEventListener("hm:undraw", reset); };
  }, [to]);
  return <div ref={el} className={className + " num"}>{format(v)}</div>;
}

/* The page's motion, on attributes React doesn't render (data-rv,
   data-draw, data-on, --fill), so a re-render never undoes it. */
function useHomeMotion(root: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rvs = [...el.querySelectorAll<HTMLElement>("[data-rv]")];
    const draws = [...el.querySelectorAll<HTMLElement>("[data-draw]")];
    const tl = el.querySelector<HTMLElement>("[data-tl]");
    const nodes = [...el.querySelectorAll<HTMLElement>("[data-node]")];
    if (!still) {
      rvs.forEach((n) => n.setAttribute("data-rv", "pre"));
      draws.forEach((n) => n.setAttribute("data-draw", "pending"));
    }
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
      if (!still) {
        for (const n of rvs) {
          const r = n.getBoundingClientRect();
          if (r.top < vh * 0.9 && r.bottom > top) n.setAttribute("data-rv", "in");
          else if (r.top >= vh) n.setAttribute("data-rv", "pre");
        }
        for (const n of draws) {
          const r = n.getBoundingClientRect(), on = n.getAttribute("data-draw") === "go";
          const need = Math.min(r.height, vh - top) * 0.9, seen = Math.min(r.bottom, vh) - Math.max(r.top, top);
          if (!on && seen >= need) { n.setAttribute("data-draw", "go"); n.dispatchEvent(new Event("hm:draw")); }
          else if (on && r.top >= vh) { n.setAttribute("data-draw", "pending"); n.dispatchEvent(new Event("hm:undraw")); }
        }
      }
      if (tl) {
        const r = tl.getBoundingClientRect(), line = vh * 0.6;
        tl.style.setProperty("--fill", Math.max(0, Math.min(r.height, line - r.top)) + "px");
        for (const nd of nodes) nd.toggleAttribute("data-on", nd.getBoundingClientRect().top + 22 < line);
      }
    };
    const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(tick); } };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    const t = setTimeout(tick, 120);
    return () => { clearTimeout(t); removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll); };
  }, [root]);
}
