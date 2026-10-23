"use client";

/* The Dashboard's frame: signed in only, with the icon rail on the left
   (labels on hover; a bottom bar on a phone) and the page's title bar. */

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  BanknoteIcon, CalculatorIcon, ClipboardListIcon, InfoIcon, MoonIcon, SunIcon, GraduationCapIcon, WrenchIcon, LandmarkIcon, PiggyBankIcon, ChevronLeftIcon, HouseIcon, LayoutGridIcon, ListChecksIcon, ReceiptIcon,
   SunsetIcon, UserRoundIcon, WalletIcon, type LucideIcon,
} from "lucide-react";
import { Brandmark } from "@/components/shell/Brandmark";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAccount } from "@/components/account/AccountProvider";
import { AccountButton } from "@/components/account/AccountButton";
import { setThemeChoice, useTheme } from "@/lib/theme";
import { useLanding } from "./land";
import { OUTSIDE_US, hasAccounts, readDashboard, unstarted, useDashboard } from "./store";

import { SECTION_NAMES, type Section } from "./sections";

export type { Section };
export const SECTIONS: { id: Section; name: string; icon: LucideIcon; phone?: boolean }[] = [
  { id: "profile", name: SECTION_NAMES.profile, icon: UserRoundIcon },
  { id: "overview", name: SECTION_NAMES.overview, icon: LayoutGridIcon, phone: true },
  { id: "summary", name: SECTION_NAMES.summary, icon: ClipboardListIcon },
  { id: "accounts", name: SECTION_NAMES.accounts, icon: WalletIcon, phone: true },
  { id: "home", name: SECTION_NAMES.home, icon: HouseIcon },
  { id: "income", name: SECTION_NAMES.income, icon: BanknoteIcon },
  { id: "taxes", name: SECTION_NAMES.taxes, icon: LandmarkIcon },
  { id: "spending", name: SECTION_NAMES.spending, icon: ReceiptIcon, phone: true },
  { id: "savings", name: SECTION_NAMES.savings, icon: PiggyBankIcon },
  { id: "retirement", name: SECTION_NAMES.retirement, icon: SunsetIcon, phone: true },
  { id: "calculator", name: SECTION_NAMES.calculator, icon: CalculatorIcon },
  { id: "tools", name: SECTION_NAMES.tools, icon: WrenchIcon },
  { id: "next", name: SECTION_NAMES.next, icon: ListChecksIcon, phone: true },
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
        {SECTIONS.map(({ id, name, icon: Icon, phone }) => (
          <Link key={id} href={hrefFor(id)} className={phone ? "dsh-ri" : "dsh-ri dsh-desk"} aria-current={id === current ? "page" : undefined} title={name}>
            <Icon aria-hidden="true" />
            {dots[id] ? <i className="dsh-dot" aria-hidden="true" /> : null}
            <span>{name}</span>
          </Link>
        ))}
        <div className="dsh-rail-gap" />
        <div className="dsh-rail-hr" />
        <button type="button" className="dsh-ri dsh-desk" onClick={toggleTheme} aria-label={theme === "light" ? "Light mode: switch to dark" : "Dark mode: switch to light"}>
          {theme === "light" ? <SunIcon aria-hidden="true" /> : <MoonIcon aria-hidden="true" />}<span>{theme === "light" ? "Light mode" : "Dark mode"}</span>
        </button>
        <Link href="/" className="dsh-ri dsh-desk"><ChevronLeftIcon aria-hidden="true" /><span>Back to RetCalc</span></Link>
      </div>
    </nav>
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
