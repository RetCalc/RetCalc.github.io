"use client";

/* The Dashboard's frame: signed in only, with the icon rail on the left
   (labels on hover) and the page's title bar. On a phone or any touch
   screen the rail gives way to a menu button in the title bar, which opens
   every tab at once. */

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  BanknoteIcon, CalculatorIcon, MenuIcon, XIcon, ClipboardListIcon, InfoIcon, MoonIcon, SunIcon, GraduationCapIcon, WrenchIcon, LandmarkIcon, PiggyBankIcon, ChevronLeftIcon, HouseIcon, LayoutGridIcon, ListChecksIcon, ReceiptIcon,
   SunsetIcon, UserRoundIcon, WalletIcon, type LucideIcon,
} from "lucide-react";
import { Brandmark } from "@/components/shell/Brandmark";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { useAccount } from "@/components/account/AccountProvider";
import { AccountButton } from "@/components/account/AccountButton";
import { setThemeChoice, useTheme } from "@/lib/theme";
import { useLanding } from "./land";
import { OUTSIDE_US, hasAccounts, readDashboard, unstarted, useDashboard } from "./store";

import { SECTION_NAMES, type Section } from "./sections";

export type { Section };
export const SECTIONS: { id: Section; name: string; icon: LucideIcon }[] = [
  { id: "profile", name: SECTION_NAMES.profile, icon: UserRoundIcon },
  { id: "overview", name: SECTION_NAMES.overview, icon: LayoutGridIcon },
  { id: "summary", name: SECTION_NAMES.summary, icon: ClipboardListIcon },
  { id: "accounts", name: SECTION_NAMES.accounts, icon: WalletIcon },
  { id: "home", name: SECTION_NAMES.home, icon: HouseIcon },
  { id: "income", name: SECTION_NAMES.income, icon: BanknoteIcon },
  { id: "taxes", name: SECTION_NAMES.taxes, icon: LandmarkIcon },
  { id: "spending", name: SECTION_NAMES.spending, icon: ReceiptIcon },
  { id: "savings", name: SECTION_NAMES.savings, icon: PiggyBankIcon },
  { id: "retirement", name: SECTION_NAMES.retirement, icon: SunsetIcon },
  { id: "calculator", name: SECTION_NAMES.calculator, icon: CalculatorIcon },
  { id: "tools", name: SECTION_NAMES.tools, icon: WrenchIcon },
  { id: "next", name: SECTION_NAMES.next, icon: ListChecksIcon },
  { id: "learn", name: SECTION_NAMES.learn, icon: GraduationCapIcon },
  { id: "about", name: SECTION_NAMES.about, icon: InfoIcon },
];
export const hrefFor = (s: Section) => (s === "overview" ? "/dashboard" : "/dashboard/" + s);

function toggleTheme() {
  setThemeChoice(document.documentElement.dataset.theme === "light" ? "dark" : "light");
}

function Rail({ current, dots }: { current: Section; dots: Partial<Record<Section, boolean>> }) {
  const theme = useTheme();
  return (
    <nav className="dsh-rail" aria-label="Dashboard">
      <div className="dsh-rail-in">
        <Link href="/" className="dsh-brand" aria-label="RetCalc home"><Brandmark /><span>RetCalc</span></Link>
        {SECTIONS.map(({ id, name, icon: Icon }) => (
          <Link key={id} href={hrefFor(id)} className="dsh-ri" aria-current={id === current ? "page" : undefined} title={name}>
            <Icon aria-hidden="true" />
            {dots[id] ? <i className="dsh-dot" aria-hidden="true" /> : null}
            <span>{name}</span>
          </Link>
        ))}
        <div className="dsh-rail-gap" />
        <div className="dsh-rail-hr" />
        <button type="button" className="dsh-ri" onClick={toggleTheme} aria-label={theme === "light" ? "Light mode: switch to dark" : "Dark mode: switch to light"}>
          {theme === "light" ? <SunIcon aria-hidden="true" /> : <MoonIcon aria-hidden="true" />}<span>{theme === "light" ? "Light mode" : "Dark mode"}</span>
        </button>
        <Link href="/" className="dsh-ri"><ChevronLeftIcon aria-hidden="true" /><span>Back to RetCalc</span></Link>
      </div>
    </nav>
  );
}

/** Phones and touch screens: every tab in one menu, opened from the title
    bar, with the theme switch and the way back to the site. */
function MobileMenu({ current, dots }: { current: Section; dots: Partial<Record<Section, boolean>> }) {
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  return (
    <div className="dsh-burger">
      <Button variant="outline" size="icon" aria-label="Open the dashboard menu" aria-expanded={open} onClick={() => setOpen(true)}><MenuIcon aria-hidden="true" /></Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="household" aria-labelledby="dshMenuTitle">
          <div className="dsh-menu-h">
            <h2 id="dshMenuTitle" className="dsh-dlg-h">Your dashboard</h2>
            <Badge variant="highlight">Beta</Badge>
            <DialogClose render={<Button variant="ghost" size="icon" aria-label="Close the menu" />}><XIcon aria-hidden="true" /></DialogClose>
          </div>
          <nav className="dsh-menu" aria-label="Dashboard">
            {SECTIONS.map(({ id, name, icon: Icon }) => (
              <Link key={id} href={hrefFor(id)} className="dsh-mi" aria-current={id === current ? "page" : undefined} onClick={() => setOpen(false)}>
                <Icon aria-hidden="true" /><span>{name}</span>
                {dots[id] ? <i className="dsh-dot" aria-label="Something to fill in" /> : null}
              </Link>
            ))}
          </nav>
          <div className="dsh-menu-foot">
            <button type="button" className="dsh-mi" onClick={toggleTheme}>
              {theme === "light" ? <SunIcon aria-hidden="true" /> : <MoonIcon aria-hidden="true" />}<span>{theme === "light" ? "Light mode" : "Dark mode"}</span>
            </button>
            <Link href="/" className="dsh-mi"><ChevronLeftIcon aria-hidden="true" /><span>Back to RetCalc</span></Link>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Shown in place of the dashboard until someone is signed in. */
function SignedOut() {
  const { configured, setStep } = useAccount();
  return (
    <div className="dsh-center">
      <div className="dsh-card">
        <Brandmark />
        <h1>Your dashboard</h1>
        {configured ? (
          <>
            <p>Sign in to keep your whole financial picture in one place and come back to it whenever you update your numbers.</p>
            <Button onClick={() => setStep({ at: "start" })}>Sign in</Button>
          </>
        ) : <p>Accounts aren&apos;t set up on this copy of the site.</p>}
        <Button variant="link" nativeButton={false} render={<Link href="/" />}>Back to RetCalc</Button>
      </div>
    </div>
  );
}

/** Renders `children` for a signed-in person; otherwise the sign-in card. */
export function SignedIn({ children }: { children: ReactNode }) {
  const { ready, account } = useAccount();
  if (!ready) return <div className="dsh" />;
  return <div className="dsh">{account ? children : <SignedOut />}</div>;
}

/** A dashboard page: the rail, the title bar and the page. Sends someone
    who hasn't started setup there first. */
export function Frame({ current, title, sub, actions, children }: { current: Section; title: string; sub?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  const { data } = useDashboard();
  const router = useRouter();
  const fresh = unstarted(data);
  useLanding();
  // Checked against what's stored, not the first render's empty copy.
  useEffect(() => { if (unstarted(readDashboard())) router.replace("/dashboard/setup"); }, [fresh, router]);
  // A dot on a section with something still to fill in.
  const abroad = data.profile.state === OUTSIDE_US;
  const dots: Partial<Record<Section, boolean>> = {
    accounts: !hasAccounts(data.entries), retirement: (!data.profile.ss.checked && !abroad) || !data.profile.strategy,
    profile: !data.done || data.skipped.length > 0,
  };
  return (
    <div className="dsh-app">
      <Rail current={current} dots={dots} />
      <div className="dsh-main">
        <header className="dsh-top">
          <MobileMenu current={current} dots={dots} />
          <h1>{title}</h1>
          {/* New, with kinks still to work out. */}
          <Badge variant="highlight">Beta</Badge>
          {sub ? <span className="dsh-sub">{sub}</span> : null}
          <div className="dsh-r">{actions}<AccountButton inDashboard /></div>
        </header>
        <div className="dsh-page">{fresh ? null : children}</div>
      </div>
    </div>
  );
}
