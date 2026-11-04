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
import { NEWEST_YEAR } from "@/lib/engine/data/years.js";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { HomeData } from "./data";
import {
  BridgeChart, BudgetChart, CloudChart, FanChart, FireChart, GrowthChart, HealthChart, MortgageChart, RothChart, ScoreRing, TaxChart,
} from "./charts";
import { RentBuyBlueprint } from "@/components/tools/picker-charts";
import { Century } from "./Century";

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
            Saving, withdrawals, taxes and Social Security, tested against <b>every market since 1926</b>. Free, with no account needed.
          </p>
          <div className="hm-btns">
            <DashboardButton />
            <Link href="/calculator" className={buttonVariants({ variant: "outline", size: "xl" })}>Open the Calculator</Link>
            <Link href="/guide" className={buttonVariants({ variant: "outline", size: "xl" })}>Start the guide</Link>
          </div>
        </div>
        <Century start={data.century.start} real={data.century.real} />
      </section>

      <section aria-labelledby="hmTools">
        <div className="hm-head">
          <h2 className="hm-h2" id="hmTools">From saving to retirement.</h2>
          <p className="hm-body">
            A calculator, a guide and 14 tools. Enter your household once and it fills in everywhere.
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
                <p>Enter your age, what you&apos;ve saved and what you add each month.</p>
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
          <Link href="/guide/readiness" className="hm-tile hm-jade hm-left hm-r3 hm-stag" data-draw="" data-rv="">
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
              <p><b>It ends with your full report.</b>A full-color plan to print or save as a PDF.</p>
            </div>
            <Go>Start the guide</Go>
          </Link>

          <Node row={4} label="40s" />
          <Tile href="/fire" className="hm-right hm-r4 hm-stag" kick="FIRE Calculator" title="Find the year work becomes optional."><FireChart /></Tile>

          <Node row={5} label="52 to 59½" />
          <Tile href="/bridge" className="hm-left hm-r5 hm-stag" kick="Early Retirement Bridge" kickClass="hm-c-lav" title="Pay for the years before 59½."><BridgeChart /></Tile>

          <Node row={6} label="Until 65" />
          <Tile href="/healthcare" className="hm-right hm-r6 hm-stag" kick="Healthcare Cost Planner" kickClass="hm-c-sky" title="Price health insurance until Medicare."><HealthChart /></Tile>

          <Node row={7} label="62 to 70" />
          <Tile href="/optimizer" className="hm-left hm-r7 hm-stag" kick="Retirement Plan Optimizer" kickClass="hm-c-amber"
            title="Put it all together into one plan."
            text="Tries thousands of claiming ages, withdrawal orders and Roth conversions to find what leaves you the most."><CloudChart /></Tile>

          <Node row={8} label="65" />
          <Link href="/drawdown" className="hm-tile hm-steel hm-wide hm-r9" data-draw="" data-rv="">
            <span className="hm-kick hm-c-steel">Drawdown Simulator</span>
            <div className="hm-split hm-dd">
              <div>
                <h3 className="hm-h3">Check that your money lasts.</h3>
                <p>Retire in every month since 1926, and compare 15 withdrawal strategies.</p>
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
          <Tile href="/roth" className="hm-right hm-r10" kick="Roth Conversion Calculator" kickClass="hm-c-teal" title="Plan for required distributions."
            text="Your required withdrawals, and what converting saves against doing nothing."><RothChart /></Tile>
        </div>
      </section>

      {/* After the tools along a life, the place that keeps them together. */}
      <section aria-labelledby="hmDash">
        <div className="hm-head hm-later">
          <h2 className="hm-h2" id="hmDash" data-rv="">Your whole plan, in one place.</h2>
          <p className="hm-body" data-rv="" style={{ "--d": 1 } as React.CSSProperties}>A free account keeps your accounts, pay, spending and retirement together. No bank logins: you type your own numbers.</p>
        </div>
        {/* The Dashboard on a laptop and an iPhone, with three of its figures lifted out. */}
        <Link href="/dashboard" className="hm-devices" data-draw="" data-draw-at="0.25" aria-label="Open My Dashboard">
          <div className="hm-mac">
            <Image className="dl-lt" src="/dashboard-landing/v2/dash-light.png" width={2880} height={1800} sizes="(max-width: 900px) 100vw, 1100px" alt="The Dashboard: net worth, readiness score, chance of success and retirement income" />
            <Image className="dl-dk" src="/dashboard-landing/v2/dash-dark.png" width={2880} height={1800} sizes="(max-width: 900px) 100vw, 1100px" alt="The Dashboard: net worth, readiness score, chance of success and retirement income" />
          </div>
          <div className="hm-iphone">
            <i className="hm-island" aria-hidden="true" />
            <Image className="dl-lt" src="/dashboard-landing/v2/phone-networth-light.png" width={1206} height={2622} sizes="(max-width: 900px) 34vw, 260px" alt="The Dashboard's net worth chart on an iPhone" />
            <Image className="dl-dk" src="/dashboard-landing/v2/phone-networth-dark.png" width={1206} height={2622} sizes="(max-width: 900px) 34vw, 260px" alt="The Dashboard's net worth chart on an iPhone" />
          </div>
          <div className="hm-callout hm-co1"><CountUp className="v" to={96} format={(x) => String(Math.round(x))} /><span>Readiness score, of 100</span></div>
          <div className="hm-callout hm-co2"><CountUp className="v" to={610500} format={(x) => "$" + Math.round(x).toLocaleString("en-US")} /><span>Net worth today</span></div>
          <div className="hm-callout hm-co3"><CountUp className="v" to={100} format={(x) => Math.round(x) + "%"} /><span>Chance of success</span></div>
        </Link>
        <div className="hm-devices-go" data-rv="">
          <Link href="/dashboard" className={buttonVariants({ size: "xl" })}>Open My Dashboard<ArrowRightIcon data-icon="inline-end" aria-hidden="true" /></Link>
        </div>
      </section>

      <section aria-labelledby="hmEveryday">
        <div className="hm-head hm-later">
          <h2 className="hm-h2" id="hmEveryday" data-rv="">Taxes, debt, housing and investing.</h2>
        </div>
        <div className="hm-grid">
          <Tile href="/incometax" className="hm-s6" name="Income Tax"
            text={`Take-home pay, or the tax on a year in retirement. ${NEWEST_YEAR} rules for all 50 states and DC.`}>
            <TaxChart tax={data.tax} />
          </Tile>
          <Tile href="/rentbuy" className="hm-s6" name="Rent vs. Buy" d={1}
            text="Buying, against renting and investing the difference.">
            <RentBuyBlueprint buy={data.rentbuy.buy} rent={data.rentbuy.rent} />
          </Tile>
          <Tile href="/mortgage" className="hm-s4" name="Mortgage Calculator"
            text="Your payment, and what extra payments save.">
            <MortgageChart years={data.mortgage} />
          </Tile>
          <Tile href="/budget" className="hm-s4" name="Budget" d={1} text="Where your money goes, and what's left to save.">
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
          <p className="hm-body">Free. What you enter stays in your browser unless you sign in.</p>
          <div className="hm-btns">
            <DashboardButton />
            <Link href="/calculator" className={buttonVariants({ variant: "outline", size: "xl" })}>Open the Calculator</Link>
            <Link href="/guide" className={buttonVariants({ variant: "outline", size: "xl" })}>Start the guide</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/** First of the three, for everyone: signed out (or not set up yet),
    /dashboard is its front page, which explains it. */
function DashboardButton() {
  return <Link href="/dashboard" className={buttonVariants({ size: "xl" })}>My Dashboard<ArrowRightIcon data-icon="inline-end" aria-hidden="true" /></Link>;
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
          // How much of it must show first: most of it, or its own share
          // (data-draw-at) for one so tall that most of it leaves a gap.
          const need = Math.min(r.height, vh - top) * Number(n.dataset.drawAt ?? 0.9), seen = Math.min(r.bottom, vh) - Math.max(r.top, top);
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
