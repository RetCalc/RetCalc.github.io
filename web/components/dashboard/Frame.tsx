"use client";

/* The Dashboard's frame: signed in only, with the icon rail on the left
   (labels on hover) and the page's title bar. On a phone, or a tablet held
   upright, the rail gives way to a bar along the bottom: the tabs used most
   and More, which opens every tab at once. A tablet on its side keeps the
   rail, its labels always showing. */

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  BanknoteIcon, CalculatorIcon, MenuIcon, MonitorIcon, XIcon, ClipboardListIcon, InfoIcon, MoonIcon, SunIcon, GraduationCapIcon, WrenchIcon, PiggyBankIcon, ChevronLeftIcon, HouseIcon, LayoutGridIcon, ListChecksIcon, ReceiptIcon,
   SunsetIcon, UserRoundIcon, WalletIcon, type LucideIcon,
} from "lucide-react";
import { Brandmark } from "@/components/shell/Brandmark";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { useAccount } from "@/components/account/AccountProvider";
import { AccountButton } from "@/components/account/AccountButton";
import { setThemeChoice, useThemeChoice, type ThemeChoice } from "@/lib/theme";
import { useLanding } from "./land";
import { HelpButton } from "@/tools/help/ToolHelp";
import { Landing } from "./Landing";
import { TAB_TOURS } from "./tours";
import { OUTSIDE_US, hasAccounts, unstarted, useDashboard } from "./store";

import { SECTION_NAMES, type Section } from "./sections";

export type { Section };
export const SECTIONS: { id: Section; name: string; icon: LucideIcon }[] = [
  { id: "profile", name: SECTION_NAMES.profile, icon: UserRoundIcon },
  { id: "overview", name: SECTION_NAMES.overview, icon: LayoutGridIcon },
  { id: "summary", name: SECTION_NAMES.summary, icon: ClipboardListIcon },
  { id: "accounts", name: SECTION_NAMES.accounts, icon: WalletIcon },
  { id: "home", name: SECTION_NAMES.home, icon: HouseIcon },
  { id: "income", name: SECTION_NAMES.income, icon: BanknoteIcon },
  { id: "spending", name: SECTION_NAMES.spending, icon: ReceiptIcon },
  { id: "savings", name: SECTION_NAMES.savings, icon: PiggyBankIcon },
  { id: "calculator", name: SECTION_NAMES.calculator, icon: CalculatorIcon },
  { id: "retirement", name: SECTION_NAMES.retirement, icon: SunsetIcon },
  { id: "tools", name: SECTION_NAMES.tools, icon: WrenchIcon },
  { id: "next", name: SECTION_NAMES.next, icon: ListChecksIcon },
  { id: "learn", name: SECTION_NAMES.learn, icon: GraduationCapIcon },
  { id: "about", name: SECTION_NAMES.about, icon: InfoIcon },
];
export const hrefFor = (s: Section) => (s === "overview" ? "/dashboard" : "/dashboard/" + s);

/* The theme switch steps through light, dark and the device's own setting,
   as the site's switch offers. */
const NEXT_THEME: Record<ThemeChoice, ThemeChoice> = { light: "dark", dark: "system", system: "light" };
const THEME_WORDS: Record<ThemeChoice, string> = { light: "Light mode", dark: "Dark mode", system: "Match my device" };
function ThemeButton({ className }: { className: string }) {
  const choice = useThemeChoice(), Icon = choice === "light" ? SunIcon : choice === "dark" ? MoonIcon : MonitorIcon;
  return (
    <button type="button" className={className} onClick={() => setThemeChoice(NEXT_THEME[choice])} aria-label={`${THEME_WORDS[choice]}: switch to ${THEME_WORDS[NEXT_THEME[choice]].toLowerCase()}`}>
      <Icon aria-hidden="true" /><span>{THEME_WORDS[choice]}</span>
    </button>
  );
}

function Rail({ current, dots }: { current: Section; dots: Partial<Record<Section, boolean>> }) {
  return (
    <nav className="dsh-rail" aria-label="Dashboard">
      <div className="dsh-rail-in">
        <Link href="/" className="dsh-brand" aria-label="RetCalc home"><Brandmark /><span>RetCalc</span></Link>
        {SECTIONS.map(({ id, name, icon: Icon }) => (
          <Link key={id} href={hrefFor(id)} className="dsh-ri" aria-current={id === current ? "page" : undefined} title={name}>
            <Icon aria-hidden="true" />
            {dots[id] ? <><i className="dsh-dot" aria-hidden="true" /><span className="sr-only">, something to fill in</span></> : null}
            <span>{name}</span>
          </Link>
        ))}
        <div className="dsh-rail-gap" />
        <div className="dsh-rail-hr" />
        <ThemeButton className="dsh-ri" />
        <Link href="/" className="dsh-ri"><ChevronLeftIcon aria-hidden="true" /><span>Back to RetCalc</span></Link>
      </div>
    </nav>
  );
}

/* The tabs a phone keeps at hand in its bottom bar; the rest are under More. */
const BAR: Section[] = ["overview", "accounts", "retirement", "next"];

/** Phones and touch screens: a bar along the bottom with the tabs used
    most, and More, which opens every tab at once with the theme switch and
    the way back to the site. */
function TabBar({ current, dots }: { current: Section; dots: Partial<Record<Section, boolean>> }) {
  const [open, setOpen] = useState(false);
  const elsewhere = !BAR.includes(current), moreDot = SECTIONS.some((s) => !BAR.includes(s.id) && dots[s.id]);
  return (
    <>
      <nav className="dsh-tabbar" aria-label="Dashboard tabs">
        {BAR.map((id) => {
          const { name, icon: Icon } = SECTIONS.find((s) => s.id === id)!;
          return (
            <Link key={id} href={hrefFor(id)} className="dsh-tb" aria-current={id === current ? "page" : undefined}>
              <span className="dsh-tb-i"><Icon aria-hidden="true" />{dots[id] ? <i className="dsh-dot" aria-hidden="true" /> : null}</span>
              <span>{name}</span>{dots[id] ? <span className="sr-only">, something to fill in</span> : null}
            </Link>
          );
        })}
        <button type="button" className="dsh-tb" aria-current={elsewhere ? "page" : undefined} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(true)}>
          <span className="dsh-tb-i"><MenuIcon aria-hidden="true" />{moreDot ? <i className="dsh-dot" aria-hidden="true" /> : null}</span>
          <span>{elsewhere ? SECTIONS.find((s) => s.id === current)?.name ?? "More" : "More"}</span>
          <span className="sr-only">: every tab</span>
        </button>
      </nav>
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
            <ThemeButton className="dsh-mi" />
            <Link href="/" className="dsh-mi"><ChevronLeftIcon aria-hidden="true" /><span>Back to RetCalc</span></Link>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Renders `children` for a signed-in person who has started setup;
    otherwise the Dashboard's front page, with an account as the way in when
    signed out and setup when signed in. Setup itself passes `setup`. */
export function SignedIn({ children, setup }: { children: ReactNode; setup?: boolean }) {
  const { ready, account } = useAccount();
  const { data } = useDashboard();
  if (!ready) return <div className="dsh" />;
  if (!account) return <Landing signedIn={false} />;
  if (!setup && unstarted(data)) return <Landing signedIn />;
  return <div className="dsh">{children}</div>;
}

/** A dashboard page: the rail, the title bar and the page. Someone who
    hasn't started setup sees the front page instead (SignedIn). */
export function Frame({ current, title, sub, actions, help, children }: { current: Section; title: string; sub?: ReactNode; actions?: ReactNode; help?: string; children: ReactNode }) {
  const { data } = useDashboard();
  const fresh = unstarted(data);
  useLanding();
  // A dot on a section with something still to fill in.
  const abroad = data.profile.state === OUTSIDE_US;
  const dots: Partial<Record<Section, boolean>> = {
    accounts: !hasAccounts(data.entries), retirement: (!data.profile.ss.checked && !abroad) || !data.profile.strategy,
    profile: !data.done || data.skipped.length > 0,
  };
  return (
    <div className="dsh-app">
      <a className="dsh-skip" href="#dsh-page">Skip to the page</a>
      <Rail current={current} dots={dots} />
      <div className="dsh-main">
        <header className="dsh-top">
          <div className="dsh-title">
            <h1>{title}</h1>
            {/* New, with kinks still to work out. */}
            <Badge variant="highlight">Beta</Badge>
          </div>
          {sub ? <span className="dsh-sub">{sub}</span> : null}
          {/* On a phone these wrappers let Help and the account stay beside
              the title, and the page's own buttons take a row of their own. */}
          <div className="dsh-r">
            {help || TAB_TOURS[current] ? <span className="dsh-help"><HelpButton tool={help ?? TAB_TOURS[current]!} /></span> : null}
            {actions ? <span className="dsh-acts">{actions}</span> : null}
            <span className="dsh-acct"><AccountButton inDashboard /></span>
          </div>
        </header>
        <div className="dsh-page" id="dsh-page" tabIndex={-1}>{fresh ? null : children}</div>
      </div>
      <TabBar current={current} dots={dots} />
    </div>
  );
}
