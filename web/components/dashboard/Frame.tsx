"use client";

/* The Dashboard's frame: signed in only, with the icon rail on the left
   (labels on hover; a bottom bar on a phone) and the page's title bar. */

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  BanknoteIcon, CalculatorIcon, ChevronLeftIcon, HouseIcon, LayoutGridIcon, ListChecksIcon, ReceiptIcon,
  SunMoonIcon, SunsetIcon, UserRoundIcon, WalletIcon, type LucideIcon,
} from "lucide-react";
import { Brandmark } from "@/components/shell/Brandmark";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/components/account/AccountProvider";
import { setThemeChoice } from "@/lib/theme";
import { OUTSIDE_US, hasAccounts, readDashboard, unstarted, useDashboard } from "./store";

import { SECTION_NAMES, type Section } from "./sections";

export type { Section };
export const SECTIONS: { id: Section; name: string; icon: LucideIcon; phone?: boolean }[] = [
  { id: "overview", name: SECTION_NAMES.overview, icon: LayoutGridIcon, phone: true },
  { id: "profile", name: SECTION_NAMES.profile, icon: UserRoundIcon },
  { id: "accounts", name: SECTION_NAMES.accounts, icon: WalletIcon, phone: true },
  { id: "home", name: SECTION_NAMES.home, icon: HouseIcon },
  { id: "income", name: SECTION_NAMES.income, icon: BanknoteIcon },
  { id: "spending", name: SECTION_NAMES.spending, icon: ReceiptIcon, phone: true },
  { id: "retirement", name: SECTION_NAMES.retirement, icon: SunsetIcon, phone: true },
  { id: "tools", name: SECTION_NAMES.tools, icon: CalculatorIcon },
  { id: "next", name: SECTION_NAMES.next, icon: ListChecksIcon, phone: true },
];
export const hrefFor = (s: Section) => (s === "overview" ? "/dashboard" : "/dashboard/" + s);

function toggleTheme() {
  setThemeChoice(document.documentElement.dataset.theme === "light" ? "dark" : "light");
}

function Rail({ current, dots }: { current: Section; dots: Partial<Record<Section, boolean>> }) {
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
        <button type="button" className="dsh-ri dsh-desk" onClick={toggleTheme}><SunMoonIcon aria-hidden="true" /><span>Light and dark</span></button>
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
  const { account } = useAccount();
  const { data } = useDashboard();
  const router = useRouter();
  const fresh = unstarted(data);
  // Checked against what's stored, not the first render's empty copy.
  useEffect(() => { if (unstarted(readDashboard())) router.replace("/dashboard/setup"); }, [fresh, router]);
  // A dot on a section with something still to fill in.
  const abroad = data.profile.state === OUTSIDE_US;
  const dots: Partial<Record<Section, boolean>> = {
    accounts: !hasAccounts(data.entries), retirement: (!data.profile.ss.checked && !abroad) || !data.profile.strategy,
    profile: !data.done || data.skipped.length > 0,
  };
  const initial = (account?.firstName ?? data.profile.p1.name ?? account?.email ?? "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="dsh-app">
      <Rail current={current} dots={dots} />
      <div className="dsh-main">
        <header className="dsh-top">
          <h1>{title}</h1>
          {sub ? <span className="dsh-sub">{sub}</span> : null}
          <div className="dsh-r">{actions}<Link href="/account" className="dsh-avatar" aria-label="Your account">{initial}</Link></div>
        </header>
        <div className="dsh-page">{fresh ? null : children}</div>
      </div>
    </div>
  );
}
