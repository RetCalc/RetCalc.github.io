"use client";

/* The Dashboard's front page, shown in its place to anyone signed out and
   to someone signed in who hasn't started setup: what it does, with real
   screenshots of the sample household (Sam and Jordan, never real people),
   and a way in. Signed out, the way in is an account; signed in, setup.
   The site's own top bar and footer stay around it. The same page is also
   at /financial-dashboard (`standalone`), sent whole from the server for
   search engines: there the way in follows whoever is looking. */

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  ArrowRightIcon, BanknoteIcon, CalculatorIcon, CheckIcon, ClipboardListIcon, ClockIcon, GraduationCapIcon, HouseIcon,
  LayoutGridIcon, ListChecksIcon, LockIcon, MessageCircleIcon, PiggyBankIcon, PlayIcon, ReceiptIcon, SunsetIcon, WalletIcon,
  WrenchIcon, CircleDollarSignIcon, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/components/account/AccountProvider";
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
function Tour() {
  const [playing, setPlaying] = useState(false);
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

function Points({ items }: { items: string[] }) {
  return <ul className="dl-points">{items.map((t) => <li key={t}><CheckIcon aria-hidden="true" />{t}</li>)}</ul>;
}

function Feature({ kicker, title, sub, points, flip, children }: { kicker: string; title: string; sub: string; points?: string[]; flip?: boolean; children: ReactNode }) {
  return (
    <section className={flip ? "dl-sec dl-feature dl-flip" : "dl-sec dl-feature"}>
      <div className="dl-copy">
        <div className="dl-kicker">{kicker}</div>
        <h2 className="dl-h2 dl-h2-sm">{title}</h2>
        <p className="dl-sub">{sub}</p>
        {points ? <Points items={points} /> : null}
      </div>
      <div className="dl-shot">{children}</div>
    </section>
  );
}

const PAGES: { icon: LucideIcon; name: string; what: string }[] = [
  { icon: LayoutGridIcon, name: "Dashboard", what: "Your main numbers on one screen" },
  { icon: ClipboardListIcon, name: "Plan summary", what: "The whole plan on one page" },
  { icon: WalletIcon, name: "Net worth", what: "Accounts and debts, kept by date" },
  { icon: HouseIcon, name: "Home", what: "Your mortgage and what owning costs, or your rent" },
  { icon: BanknoteIcon, name: "Income", what: "Pay, the employer match and Social Security" },
  { icon: ReceiptIcon, name: "Spending", what: "Your budget and emergency fund" },
  { icon: PiggyBankIcon, name: "Taxes & Savings", what: "This year's taxes on your pay, and where each paycheck goes" },
  { icon: CalculatorIcon, name: "Calculator", what: "Your saving, stage by stage" },
  { icon: SunsetIcon, name: "Retirement", what: "Withdrawal strategies, early retirement and health cover" },
  { icon: WrenchIcon, name: "Tools", what: "All 14, opened with your numbers" },
  { icon: ListChecksIcon, name: "Next steps", what: "Changes ranked by how much they help" },
  { icon: GraduationCapIcon, name: "Learn", what: "56 lessons on the ideas behind your plan" },
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
  // At /dashboard the page knows; at its public address it asks the account
  // (signed out until it has loaded, as the server sends it).
  const who: Who = standalone ? (ready && account ? (unstarted(data) ? "new" : "set") : "out") : signedIn ? "new" : "out";
  return (
    <div className="dl">
      <div className="dl-hero">
        <div className="dl-eyebrow">My Dashboard</div>
        <h1 className="dl-display">One place for your money and <em>your retirement plan.</em></h1>
        <p className="dl-lede">Net worth, pay, taxes, spending, saving and retirement, all worked out from <b>one profile</b>. Come back each month or quarter, update your balances, and see where you stand.</p>
        <Ways who={who} />
        {who === "new" ? (
          <p className="dl-started"><ClockIcon aria-hidden="true" /><span><b>Eight short steps.</b> Skip anything you don&apos;t know yet; each answer is saved as you go, so you can stop and finish later.</span></p>
        ) : null}
        <div className="dl-fine">
          <span><CheckIcon aria-hidden="true" />Free</span>
          <span><CheckIcon aria-hidden="true" />No bank logins: you type your own numbers</span>
          <span><CheckIcon aria-hidden="true" />Works on your phone</span>
        </div>
        <div className="dl-stage">
          <div className="dl-window">
            <div className="dl-chrome" aria-hidden="true"><i /><i /><i /><span>retcalc.app/dashboard</span></div>
            <Tour />
          </div>
          {/* On a phone, the same page in an iPhone: its titanium edge, side
              buttons and Dynamic Island are drawn here; the status bar and
              home indicator are in the screenshot. */}
          <div className="dl-phone">
            <i className="dl-ph-btn dl-ph-act" aria-hidden="true" /><i className="dl-ph-btn dl-ph-up" aria-hidden="true" />
            <i className="dl-ph-btn dl-ph-dn" aria-hidden="true" /><i className="dl-ph-btn dl-ph-pwr" aria-hidden="true" />
            <div className="dl-ph-screen">
              <Shot name="mobile" w={1170} h={2532} sizes="300px" alt="The Dashboard on a phone: the one-line answer, Update balances, net worth, and the tabs along the bottom" />
              <span className="dl-ph-island" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>

      <section className="dl-sec dl-center">
        <div className="dl-kicker">How it works</div>
        <h2 className="dl-h2">Set it up once, then update it as things change.</h2>
        <p className="dl-sub">Everything you enter goes into one profile, and every page works from it.</p>
        <div className="dl-steps">
          <div className="dl-step">
            <div className="dl-step-t"><span className="dl-n">1</span><h3>Answer a few questions</h3><p>Who&apos;s in your household, what you earn, what you&apos;ve saved and when you&apos;d like to retire.</p></div>
            <div className="dl-pic"><div className="dl-sum"><Shot name="setupsum" w={720} h={1080} sizes="340px" alt="Your plan so far: household, ages, retirement ages, pay and savings, filling in as you answer" /></div></div>
          </div>
          <div className="dl-step">
            <div className="dl-step-t"><span className="dl-n">2</span><h3>See where you stand</h3><p>A readiness score out of 100, your chance of success and the changes that would move your plan most.</p></div>
            <div className="dl-pic">
              <div className="dl-snip" aria-hidden="true">
                <p><b>You&apos;re on track:</b> $1,969,000 at 60, and your plan lasted in every past market since 1926.</p>
                <div className="dl-snrow"><div><small>Readiness score</small><strong>96</strong><span> of 100</span></div><div><small>Chance of success</small><strong>100%</strong></div></div>
              </div>
            </div>
          </div>
          <div className="dl-step">
            <div className="dl-step-t"><span className="dl-n">3</span><h3>Come back and update</h3><p>Add today&apos;s balances each month or quarter. Each entry is saved, so you can see how your net worth changes.</p></div>
            <div className="dl-pic">
              <div className="dl-snip" aria-hidden="true">
                <div className="dl-entry"><span>Your last entry was <b>October 1, 2026</b>, 24 days ago.</span><span className="dl-fakebtn">Update balances</span></div>
                <ul className="dl-entries">
                  <li><span>October 1, 2026</span><b>$300,000</b><em>+$15,500</em></li>
                  <li><span>July 1, 2026</span><b>$284,500</b><em>+$13,300</em></li>
                  <li><span>April 1, 2026</span><b>$271,200</b><em>+$9,800</em></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Feature kicker="Net worth" title="Your net worth now, and where it's heading." sub="Your accounts, home and debts added up, then projected through retirement."
        points={["Your own entries over time, then the projection", "The range of 8 in 10 past markets, not one guess", "All in today's dollars, so it compares with what things cost now"]}>
        <Shot name="networth-tile" w={1734} h={982} sizes="(max-width: 900px) 100vw, 760px" alt="Net worth chart with entries, the projection and the range of past markets" />
      </Feature>
      <Feature flip kicker="Income, taxes, spending and savings" title="See where each paycheck goes." sub="Pay, taxes, your budget and your saving are worked out together, so the numbers match on every page."
        points={["Federal, state, Social Security and Medicare taxes worked out for you", "Saving split across your 401(k), HSA, IRA and brokerage", "Shows whether you're getting your full employer match"]}>
        <Shot name="savings" w={1742} h={734} sizes="(max-width: 900px) 100vw, 760px" alt="Where each month's pay goes: savings, taxes, expenses and unassigned" />
      </Feature>
      <Feature kicker="Retirement" title="Test your retirement plan against past markets." sub="Choose from 15 withdrawal strategies and see how often your plan lasted in every market since 1926."
        points={["What you'll have, what you'll spend and the taxes on it", "Social Security for each of you, from the age you claim", "Health cover until Medicare, and a bridge to 59½ if you retire early"]}>
        <Shot name="retire-tile" w={1512} h={612} sizes="(max-width: 900px) 100vw, 760px" alt="At retirement: savings, chance of success, planned spending, taxes and Social Security, and the years of health cover to plan before Medicare" />
      </Feature>
      <Feature flip kicker="Next steps" title="Know what to work on next." sub="A short list of changes, ranked by how much each one improves your plan, with a link to make each one.">
        <Shot name="next" w={1734} h={778} sizes="(max-width: 900px) 100vw, 760px" alt="What to do next: four changes, ranked" />
      </Feature>
      <Feature kicker="Learn" title="Learn the ideas behind your plan." sub="56 short lessons in 8 tracks, from saving and taxes to Social Security and drawing your savings down."
        points={["A lesson picked for what your plan needs next", "Lessons that show the idea with your own numbers", "Each one links to the page or tool where you act on it"]}>
        <Shot name="learn" w={1752} h={572} sizes="(max-width: 900px) 100vw, 760px" alt="Next for you: a lesson on the emergency fund, picked because cash covers 2.9 months of spending" />
      </Feature>

      <section className="dl-sec dl-center">
        <div className="dl-kicker">Your timeline</div>
        <h2 className="dl-h2">The years ahead, on a timeline.</h2>
        <p className="dl-sub">Retirement, Medicare, Social Security, daycare and college, year by year for each person in your household.</p>
        <div className="dl-shot dl-wide"><Shot name="timeline" w={2632} h={646} sizes="(max-width: 1330px) 100vw, 1290px" alt="Timeline of retirement, Medicare, Social Security and college for each person" /></div>
      </section>

      <section className="dl-sec dl-center">
        <div className="dl-kicker">Pages</div>
        <h2 className="dl-h2">What&apos;s in the Dashboard</h2>
        <p className="dl-sub">Enter something once and every page uses it. RetCalc&apos;s 14 tools open inside the Dashboard with your numbers filled in.</p>
        <div className="dl-pages">
          {PAGES.map((p) => <div className="dl-page" key={p.name}><p.icon aria-hidden="true" /><h3>{p.name}</h3><p>{p.what}</p></div>)}
        </div>
      </section>

      <section className="dl-sec dl-trust">
        <div><span className="dl-ic dl-ic-gold"><CircleDollarSignIcon aria-hidden="true" /></span><h3>Free</h3><p>The Dashboard and every tool are free. The account only keeps your numbers so they&apos;re there when you come back.</p></div>
        <div><span className="dl-ic dl-ic-jade"><LockIcon aria-hidden="true" /></span><h3>No bank logins</h3><p>You type your balances yourself. Nothing connects to your bank, and your numbers are never sold or used for ads.</p></div>
        <div><span className="dl-ic dl-ic-steel"><MessageCircleIcon aria-hidden="true" /></span><h3>Tell us what you think</h3><p>We&apos;re still adding to the Dashboard. Send ideas and feedback to <a href="mailto:contact@retcalc.app">contact@retcalc.app</a>.</p></div>
      </section>

      <section className="dl-final">
        <h2 className="dl-h2">{who === "set" ? "Your Dashboard" : "Set up your Dashboard"}</h2>
        <p className="dl-sub">{who === "set" ? "Pick up where you left off, and update your balances while you're there." : who === "new" ? "Eight short steps. You can skip any of them and come back later." : "Create a free account and go through eight short steps. You can skip any of them and come back later."}</p>
        <Ways who={who} />
      </section>
    </div>
  );
}
