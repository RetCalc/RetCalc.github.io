"use client";

/* The Dashboard's front page, shown in its place to anyone signed out and
   to someone signed in who hasn't started setup: what it does, with real
   screenshots of the sample household (Sam and Jordan, never real people),
   and a way in. Signed out, the way in is an account; signed in, setup.
   The site's own top bar and footer stay around it. The same page is also
   at /financial-dashboard (`standalone`), sent whole from the server for
   search engines: there the way in follows whoever is looking.

   The page scrolls freely; nothing holds it in place. What moves follows
   the scroll (components/home/motion.ts): the tour's window tips upright
   as it comes up the screen with two of the Dashboard's cards floating
   off its corners, the feature cards stick and slide over one another in two
   piles, each one's picture turning to face you, the timeline slides
   sideways as it passes, and the pages drift past in two belts you can
   drag. Styles: styles/20-dash-landing.css and 24-dash-landing-motion.css;
   phones in styles/phone/23-dash-account.css and 34-landing.css. */

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import {
  ArrowRightIcon, BanknoteIcon, CalculatorIcon, CalendarRangeIcon, CheckIcon, ClipboardListIcon, ClockIcon, GraduationCapIcon, HouseIcon,
  LayoutGridIcon, ListChecksIcon, LockIcon, MessageCircleIcon, PiggyBankIcon, PlayIcon, ReceiptIcon, SunsetIcon, WalletIcon,
  WrenchIcon, CircleDollarSignIcon, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/components/account/AccountProvider";
import { useBelts, usePageMotion } from "@/components/home/motion";
import { unstarted, useDashboard } from "./store";

/** A screenshot in the site's light and dark themes; only the one showing loads. */
function Shot({ name, w, h, alt, sizes }: { name: string; w: number; h: number; alt: string; sizes: string }) {
  return (
    <>
      <Image className="dl-lt" src={`/dashboard-landing/v2/${name}-light.png`} width={w} height={h} alt={alt} sizes={sizes} />
      <Image className="dl-dk" src={`/dashboard-landing/v2/${name}-dark.png`} width={w} height={h} alt={alt} sizes={sizes} />
    </>
  );
}

/** The 90-second tour: the Dashboard's own picture with a play button on it.
    The video (a separate, large file) is only asked for once the button is
    pressed, so the page loads as it did before; when it ends, the picture
    comes back. The video is the dark theme in both of the site's themes. */
function Tour({ playing, setPlaying }: { playing: boolean; setPlaying: (on: boolean) => void }) {
  return (
    <div className="dl-tour">
      {playing ? (
        <video className="dl-video" src="/dashboard-landing/dashboard-tour.mp4" controls autoPlay playsInline
          aria-label="A 90-second tour of the Dashboard, with music and on-screen text" onEnded={() => setPlaying(false)} />
      ) : (
        <>
          <Shot name="dash" w={2880} h={1800} sizes="(max-width: 1330px) 100vw, 1290px"
            alt="The Dashboard: a one-line answer, net worth today and projected, readiness score, chance of success, retirement income and Social Security" />
          <div className="dl-play">
            <Button size="xl" onClick={() => setPlaying(true)}>
              <PlayIcon data-icon="inline-start" aria-hidden="true" />Watch the 90-second tour
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** On a phone, where the browser window and its tour are hidden: the same
    page in an iPhone, with the tour's button under it. Pressed, the phone
    cut of the tour (portrait, 1080x1920: marketing/video/promo-phone.html)
    plays on the phone's screen, and its controls offer full screen; when it
    ends, the picture comes back. The
    iPhone's titanium edge, side buttons and Dynamic Island are drawn here;
    the status bar and home indicator are in the screenshot. */
function PhoneTour() {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="dl-phone-tour" data-playing={playing ? "" : undefined}>
      <div className="dl-phone">
        <i className="dl-ph-btn dl-ph-act" aria-hidden="true" /><i className="dl-ph-btn dl-ph-up" aria-hidden="true" />
        <i className="dl-ph-btn dl-ph-dn" aria-hidden="true" /><i className="dl-ph-btn dl-ph-pwr" aria-hidden="true" />
        <div className="dl-ph-screen">
          <Shot name="mobile" w={1170} h={2532} sizes="300px" alt="The Dashboard on a phone: the one-line answer, Update balances, net worth, and the tabs along the bottom" />
          {/* Pressed, the video plays on the phone's screen, so nothing
              around it moves; its controls offer full screen. When it ends,
              the picture comes back. */}
          {playing ? (
            <video className="dl-video dl-ph-video" src="/dashboard-landing/dashboard-tour-phone.mp4" controls autoPlay playsInline
              aria-label="A 90-second tour of the Dashboard, with music and on-screen text" onEnded={() => setPlaying(false)} />
          ) : (
            <button type="button" className="dl-ph-play" aria-label="Watch the 90-second tour" onClick={() => setPlaying(true)}>
              <PlayIcon aria-hidden="true" />
            </button>
          )}
          <span className="dl-ph-island" aria-hidden="true" />
        </div>
      </div>
      <div className="dl-mplay">
        <Button size="xl" variant="outline" disabled={playing} onClick={() => setPlaying(true)}>
          <PlayIcon data-icon="inline-start" aria-hidden="true" />Watch the 90-second tour
        </Button>
      </div>
    </div>
  );
}

function Points({ items }: { items: string[] }) {
  return <ul className="dl-points">{items.map((t) => <li key={t}><CheckIcon aria-hidden="true" />{t}</li>)}</ul>;
}

/** One of the Dashboard's cards, cut from the picture of its main screen
    and floated beside the tour's window: `box` is its left, top, width and
    height as shares of that picture. */
function Crop({ cls, box: [l, t, w, h] }: { cls: string; box: [number, number, number, number] }) {
  const pct = (v: number) => (v * 100).toFixed(3) + "%";
  return (
    <div className={"dlx-crop " + cls} aria-hidden="true" style={{ "--ar": String((w * 2880) / (h * 1800)), "--iw": pct(1 / w), "--il": pct(-l / w), "--it": pct(-t / h) } as React.CSSProperties}>
      <div><Shot name="dash" w={2880} h={1800} sizes="(max-width: 767px) 1px, 1300px" alt="" /></div>
    </div>
  );
}

/** A feature: what it is on one side, its picture on the other. In a pile
    (data-stack) each one sticks under the header and the next slides over it. */
function Card({ tone, name, title, sub, points, flip, i, children }: { tone: string; name: string; title: string; sub: string; points?: string[]; flip?: boolean; i: number; children: ReactNode }) {
  return (
    <article className={"dlx-card dlx-" + tone + (flip ? " dlx-flip" : "")} data-scrub="" style={{ "--i": i } as React.CSSProperties}>
      <div className="dlx-card-in">
        <div className="dl-copy">
          <div className="dl-kicker">{name}</div>
          <h3 className="dl-h2 dl-h2-sm">{title}</h3>
          <p className="dl-sub">{sub}</p>
          {points ? <Points items={points} /> : null}
        </div>
        <div className="dlx-shot">{children}</div>
        <p className="dl-swipe phone:hidden">Swipe the picture sideways to see all of it.</p>
      </div>
    </article>
  );
}

const PAGES: { icon: LucideIcon; name: string; what: string }[] = [
  { icon: LayoutGridIcon, name: "Dashboard", what: "Your main numbers on one screen" },
  { icon: ClipboardListIcon, name: "Plan summary", what: "The whole plan on one page, with stress tests" },
  { icon: WalletIcon, name: "Net worth", what: "Accounts and debts, kept by date" },
  { icon: HouseIcon, name: "Your home", what: "Your mortgage and what owning costs, or your rent" },
  { icon: BanknoteIcon, name: "Income", what: "Pay, the employer match and Social Security" },
  { icon: ReceiptIcon, name: "Spending", what: "Your budget and emergency fund" },
  { icon: PiggyBankIcon, name: "Taxes & Savings", what: "This year's taxes on your pay, and where each paycheck goes" },
  { icon: CalculatorIcon, name: "Calculator", what: "Your savings to retirement, and the changes ahead" },
  { icon: CalendarRangeIcon, name: "Year by year", what: "Every year of the plan, in one table" },
  { icon: SunsetIcon, name: "Retirement", what: "Withdrawal strategies, early retirement and health cover" },
  { icon: WrenchIcon, name: "Tools", what: "All 14, opened with your numbers" },
  { icon: ListChecksIcon, name: "Next steps", what: "Changes ranked by how much they help" },
  { icon: GraduationCapIcon, name: "Learn", what: "66 lessons on the ideas behind your plan" },
];

/** Who's looking: signed out, signed in with setup still to do, or set up. */
type Who = "out" | "new" | "set";

/** The way in: an account when signed out, setup when it's still to do,
    and the Dashboard itself once it's set up. */
function Ways({ who }: { who: Who }) {
  const { configured, setStep } = useAccount();
  if (who !== "out") {
    return (
      <div className="dl-ctas">
        <Button size="xl" nativeButton={false} render={<Link href={who === "new" ? "/dashboard/setup" : "/dashboard"} />}>{who === "new" ? "Set up my Dashboard" : "Open my Dashboard"}<ArrowRightIcon data-icon="inline-end" aria-hidden="true" /></Button>
      </div>
    );
  }
  if (!configured) return <p className="dl-sub dl-center">Accounts aren&apos;t set up on this copy of the site.</p>;
  return (
    <div className="dl-ctas">
      <Button size="xl" onClick={() => setStep({ at: "start" })}>Create a free account</Button>
      <Button size="xl" variant="secondary" onClick={() => setStep({ at: "start" })}>Sign in</Button>
    </div>
  );
}

export function Landing({ signedIn = false, standalone }: { signedIn?: boolean; standalone?: boolean }) {
  const { ready, account } = useAccount();
  const { data } = useDashboard();
  const root = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  usePageMotion(root);
  useBelts(root);
  // At /dashboard the page knows; at its public address it asks the account
  // (signed out until it has loaded, as the server sends it).
  const who: Who = standalone ? (ready && account ? (unstarted(data) ? "new" : "set") : "out") : signedIn ? "new" : "out";
  const half = Math.ceil(PAGES.length / 2);
  return (
    <div className="dl dlx" ref={root}>
      <div className="dl-hero">
        <div className="dlx-pool" aria-hidden="true" />
        <h1 className="dl-display">One place for your money and <em>your retirement plan.</em></h1>
        <p className="dl-lede">Net worth, pay, taxes, spending, saving and retirement, all worked out from <b>one profile</b>. Come back each month or quarter, update your balances, and see where you stand.</p>
        <Ways who={who} />
        {who === "new" ? (
          <p className="dl-started"><ClockIcon aria-hidden="true" /><span><b>Up to eight short steps.</b> Skip anything you don&apos;t know yet. Each answer is saved as you go, so you can stop and finish later.</span></p>
        ) : null}
        <div className="dl-fine">
          <span><CheckIcon aria-hidden="true" />Free</span>
          <span><CheckIcon aria-hidden="true" />No bank logins: you type your own numbers</span>
          <span><CheckIcon aria-hidden="true" />Works on your phone</span>
        </div>
        <div className="dl-stage dlx-stage" data-scrub="" data-playing={playing ? "" : undefined}>
          <div className="dlx-tilt">
            <div className="dl-window">
              <div className="dl-chrome" aria-hidden="true"><i /><i /><i /><span>retcalc.app/dashboard</span></div>
              <Tour playing={playing} setPlaying={setPlaying} />
            </div>
            <div className="dlx-crop dlx-f1" aria-hidden="true"><Shot name="retire-tile" w={1520} h={650} sizes="(max-width: 1000px) 1px, 460px" alt="" /></div>
            <Crop cls="dlx-f2" box={[0.6785, 0.638, 0.2965, 0.217]} />
          </div>
          <PhoneTour />
        </div>
      </div>

      <section className="dl-sec dl-center">
        <h2 className="dl-h2" data-rv="">Set it up once, then update it as things change.</h2>
        <p className="dl-sub" data-rv="" style={{ "--d": 1 } as React.CSSProperties}>Everything you enter goes into one profile, and every page works from it.</p>
        <div className="dl-steps dlx-steps" data-pan="">
          <i className="dlx-line" aria-hidden="true" />
          <div className="dl-step" data-rv="">
            <div className="dl-step-t"><span className="dl-n">1</span><h3>Answer a few questions</h3><p>Who&apos;s in your household, what you earn, what you&apos;ve saved and when you&apos;d like to retire.</p></div>
            <div className="dl-pic"><div className="dl-sum"><Shot name="setupsum" w={720} h={1143} sizes="340px" alt="Your plan so far: household, ages, retirement ages, pay and savings, filling in as you answer" /></div></div>
          </div>
          <div className="dl-step" data-rv="" style={{ "--d": 1 } as React.CSSProperties}>
            <div className="dl-step-t"><span className="dl-n">2</span><h3>See where you stand</h3><p>A readiness score out of 100, your chance of success and the changes that would move your plan most.</p></div>
            <div className="dl-pic">
              <div className="dl-snip" aria-hidden="true">
                <p><b>You&apos;re on track:</b> $1,895,000 at 60, and your plan lasted in every past market since 1926.</p>
                <div className="dl-snrow"><div><small>Readiness score</small><strong>96</strong><span> of 100</span></div><div><small>Chance of success</small><strong>100%</strong></div></div>
              </div>
            </div>
          </div>
          <div className="dl-step" data-rv="" style={{ "--d": 2 } as React.CSSProperties}>
            <div className="dl-step-t"><span className="dl-n">3</span><h3>Come back and update</h3><p>Add today&apos;s balances each month or quarter. Each entry is saved, so you can see how your net worth changes.</p></div>
            <div className="dl-pic">
              <div className="dl-snip" aria-hidden="true">
                <div className="dl-entry"><span>Your last entry was <b>October 20, 2026</b>, 13 days ago.</span><span className="dl-fakebtn">Update balances</span></div>
                <ul className="dl-entries">
                  <li><span>October 20, 2026</span><b>$610,500</b><em>+$51,865</em></li>
                  <li><span>April 15, 2026</span><b>$558,635</b><em>+$55,762</em></li>
                  <li><span>October 15, 2025</span><b>$502,873</b><em>First entry</em></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="dl-sec">
        <div className="dl-center dlx-head">
          <h2 className="dl-h2" data-rv="">Your money today.</h2>
          <p className="dl-sub" data-rv="" style={{ "--d": 1 } as React.CSSProperties}>What you have, what you earn, what it costs to live, and every year from here to retirement.</p>
        </div>
        <div className="dlx-stack" data-stack="">
          <Card i={0} tone="gold" name="Net worth" title="Your net worth now, and where it's heading." sub="Your accounts, home and debts added up, then projected through retirement."
            points={["Your own entries over time, then the projection", "The range of 8 in 10 past markets, in today's dollars", "A payoff plan for your debts, with the date each one clears"]}>
            <Shot name="networth-tile" w={1707} h={1064} sizes="(max-width: 900px) 100vw, 760px" alt="Net worth chart with entries, the projection and the range of past markets" />
          </Card>
          <Card i={1} flip tone="jade" name="Income, taxes and savings" title="See where each paycheck goes." sub="Pay, taxes, your budget and your saving are worked out together, so the numbers match on every page."
            points={["Federal, state, Social Security and Medicare taxes worked out for you", "Saving split across your 401(k), HSA, IRA and brokerage", "Shows whether you're getting your full employer match"]}>
            <Shot name="savings" w={1280} h={814} sizes="(max-width: 900px) 100vw, 760px" alt="Each month: what you save and invest, the employer match, your savings rate, and where each month's pay goes: savings, taxes, expenses and unassigned" />
          </Card>
          <Card i={2} tone="lav" name="Spending" title="See how your budget compares." sub="Your budget line by line, then set against the rules of thumb people use."
            points={["Housing, debt payments and saving, each against its usual guideline", "Needs, wants and saving against the 50/30/20 rule", "An emergency fund sized on what you spend"]}>
            <Shot name="rules" w={2080} h={702} sizes="(max-width: 900px) 100vw, 760px" alt="How you compare to the usual rules: housing 12% of pay, all debt payments 12%, saving and investing 16%, each with its guideline" />
          </Card>
          <Card i={3} flip tone="steel" name="Year by year" title="Every year of your plan, in one table." sub="Pay, taxes, spending and saving for each year to retirement, with your ages beside them."
            points={["Type over any year: a raise, a year off, a big expense", "Open any figure to see how it's worked out", "Switch between today's dollars and future dollars"]}>
            <Shot name="years" w={2080} h={1120} sizes="(max-width: 900px) 100vw, 760px" alt="Every year to retirement: each year's pay, taxes, spending and what goes into each kind of account" />
          </Card>
        </div>
      </section>

      <section className="dl-sec">
        <div className="dl-center dlx-head">
          <h2 className="dl-h2" data-rv="">Your retirement, tested.</h2>
          <p className="dl-sub" data-rv="" style={{ "--d": 1 } as React.CSSProperties}>Your own plan run through every market since 1926, then through the things that go wrong.</p>
        </div>
        <div className="dlx-stack" data-stack="">
          <Card i={0} tone="steel" name="Retirement" title="Test your retirement plan against past markets." sub="Choose from 15 withdrawal strategies and see how often your plan lasted in every market since 1926."
            points={["What you'll have, what you'll spend and the taxes on it", "Social Security for each of you, from the age you claim", "Health cover until Medicare, and a bridge to 59½ if you retire early"]}>
            <Shot name="retire-tile" w={1520} h={650} sizes="(max-width: 900px) 100vw, 760px" alt="At retirement: savings, chance of success, planned spending, taxes and Social Security, and the years of health cover to plan before Medicare" />
          </Card>
          <Card i={1} flip tone="rose" name="Stress tests" title="See what happens if things go wrong." sub="Your plan run again with one hard thing added, and whether it still holds up."
            points={["One of you passing away, a year without work, long-term care", "Retiring into 1929, 1937, 1966 or 1973", "Social Security paying less than promised"]}>
            <Shot name="stress" w={2080} h={1096} sizes="(max-width: 900px) 100vw, 760px" alt="If things go wrong: the plan holds up in 5 of 5 stress tests, with the chance of success and what's left in each" />
          </Card>
          <Card i={2} tone="gold" name="Next steps" title="Know what to work on next." sub="A short list of changes, ranked by how much each one improves your plan, with a link to make each one.">
            <Shot name="next" w={1707} h={806} sizes="(max-width: 900px) 100vw, 760px" alt="What to do next: four changes, ranked" />
          </Card>
          <Card i={3} flip tone="jade" name="Learn" title="Learn the ideas behind your plan." sub="66 lessons in 8 tracks, from saving and taxes to Social Security and drawing your savings down."
            points={["A lesson picked for what your plan needs next", "Lessons that show the idea with your own numbers", "Each one links to the page or tool where you act on it"]}>
            <Shot name="learn" w={1720} h={570} sizes="(max-width: 900px) 100vw, 760px" alt="Next for you: a lesson on the emergency fund, picked because cash covers 2.9 months of spending" />
          </Card>
        </div>
      </section>

      <section className="dl-sec dl-center">
        <h2 className="dl-h2" data-rv="">The years ahead, on a timeline.</h2>
        <p className="dl-sub" data-rv="" style={{ "--d": 1 } as React.CSSProperties}>Retirement, Medicare, Social Security, daycare and college, year by year for each person in your household.</p>
        <div className="dl-shot dl-wide dlx-pan" data-pan=""><div><Shot name="timeline" w={2600} h={673} sizes="(max-width: 1330px) 140vw, 1800px" alt="Timeline of retirement, Medicare, Social Security and college for each person" /></div></div>
        <p className="dl-swipe phone:hidden">Swipe the picture sideways to see all of it.</p>
      </section>

      <section className="dl-sec">
        <div className="dl-center dlx-head">
          <h2 className="dl-h2" data-rv="">What&apos;s in the Dashboard</h2>
          <p className="dl-sub" data-rv="" style={{ "--d": 1 } as React.CSSProperties}>Enter something once and every page uses it. RetCalc&apos;s 14 tools open inside the Dashboard with your numbers filled in.</p>
        </div>
        <div className="dlx-belts">
          {[PAGES.slice(0, half), PAGES.slice(half)].map((row, ri) => {
            const cards = (copy: boolean) => [0, 1].map((r) => row.map((p) => {
              const extra = copy || r > 0;
              return (
                <li key={`${copy ? "b" : "a"}${r}${p.name}`} className={extra ? "hx-copy" : undefined} aria-hidden={extra || undefined}>
                  <div className="dlx-chip"><p.icon aria-hidden="true" /><h3>{p.name}</h3><p>{p.what}</p></div>
                </li>
              );
            }));
            return (
              <div key={ri} className="hx-belt" data-belt={ri ? "left" : "right"}>
                <ul className="hx-track dlx-chips">{cards(false)}{cards(true)}</ul>
              </div>
            );
          })}
        </div>
        <ul className="dlx-more">
          <li data-rv=""><b>More than one Dashboard</b>Keep a second plan beside the first: a copy to try a change on, or a fresh start.</li>
          <li data-rv="" style={{ "--d": 1 } as React.CSSProperties}><b>A spreadsheet and a report</b>Download the whole plan as an Excel workbook, or print it in full color.</li>
          <li data-rv="" style={{ "--d": 2 } as React.CSSProperties}><b>A monthly check-in</b>One email to remind you to update your balances. Turn it off any time.</li>
          <li data-rv="" style={{ "--d": 3 } as React.CSSProperties}><b>On your phone</b>Add RetCalc to your Home Screen and it opens full screen, like an app.</li>
        </ul>
      </section>

      <section className="dl-sec dl-trust">
        <div><span className="dl-ic dl-ic-gold"><CircleDollarSignIcon aria-hidden="true" /></span><h3>Free</h3><p>The Dashboard and every tool are free. The account only keeps your numbers so they&apos;re there when you come back.</p></div>
        <div><span className="dl-ic dl-ic-jade"><LockIcon aria-hidden="true" /></span><h3>No bank logins</h3><p>You type your balances yourself. Nothing connects to your bank, and your numbers are never sold or used for ads.</p></div>
        <div><span className="dl-ic dl-ic-steel"><MessageCircleIcon aria-hidden="true" /></span><h3>Tell us what you think</h3><p>We&apos;re still adding to the Dashboard. Send ideas and feedback to <a href="mailto:contact@retcalc.app">contact@retcalc.app</a>.</p></div>
      </section>

      <section className="dl-final">
        <h2 className="dl-h2">{who === "set" ? "Your Dashboard" : "Set up your Dashboard"}</h2>
        <p className="dl-sub">{who === "set" ? "Pick up where you left off, and update your balances while you're there." : who === "new" ? "Up to eight short steps. You can skip any of them and come back later." : "Create a free account and go through up to eight short steps. You can skip any of them and come back later."}</p>
        <Ways who={who} />
      </section>
    </div>
  );
}
