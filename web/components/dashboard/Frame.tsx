"use client";

/* The Dashboard's frame: signed in only, with the icon rail on the left
   (labels on hover) and the page's title bar. On a phone, or a tablet held
   upright, the rail gives way to a bar along the bottom: the tabs used most
   and More, which opens every tab at once. A tablet on its side keeps the
   rail, its labels always showing. */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BanknoteIcon, CalculatorIcon, CircleEllipsisIcon, EllipsisIcon, MenuIcon, SquarePlusIcon, MonitorIcon, XIcon, ClipboardListIcon, InfoIcon, MoonIcon, SunIcon, GraduationCapIcon, WrenchIcon, PiggyBankIcon, ChevronLeftIcon, ChevronRightIcon, HouseIcon, LayoutGridIcon, ListChecksIcon, ReceiptIcon,
   SunsetIcon, CalendarRangeIcon, UserRoundIcon, WalletIcon, type LucideIcon,
} from "lucide-react";
import { Brandmark } from "@/components/shell/Brandmark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { usePhone } from "@/components/phone/usePhone";
import { Short } from "@/components/phone/Words";
import { openInstallHelp, useInstallable } from "@/components/phone/install";
import { useAccount } from "@/components/account/AccountProvider";
import { AccountButton } from "@/components/account/AccountButton";
import { setThemeChoice, useThemeChoice, type ThemeChoice } from "@/lib/theme";
import { useLanding } from "./land";
import { HelpButton } from "@/tools/help/ToolHelp";
import { Landing } from "./Landing";
import { MailMe } from "./MailMe";
import { TAB_TOURS } from "./tours";
import { OUTSIDE_US, hasAccounts, unstarted, useDashboard, useProfiles } from "./store";
import { usePlanStamp } from "./snapshot";

import { SECTION_NAMES, type Section } from "./sections";
import { useNewRelease } from "./seen-release";

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
  { id: "years", name: SECTION_NAMES.years, icon: CalendarRangeIcon },
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

function Rail({ current, dots, fresh }: { current: Section; dots: Partial<Record<Section, boolean>>; fresh: boolean }) {
  return (
    <nav className="dsh-rail" aria-label="Dashboard">
      <div className="dsh-rail-in">
        <Link href="/" className="dsh-brand" aria-label="RetCalc home"><Brandmark /><span>RetCalc</span></Link>
        {SECTIONS.map(({ id, name, icon: Icon }) => (
          <Link key={id} href={hrefFor(id)} className="dsh-ri" aria-current={id === current ? "page" : undefined} title={name}>
            <Icon aria-hidden="true" />
            {dots[id] ? <><i className="dsh-dot" aria-hidden="true" /><span className="sr-only">, something to fill in</span></> : null}
            {id === "about" && fresh ? <i className="dsh-dot" data-new="" aria-hidden="true" /> : null}
            <span>{name}</span>
            {id === "about" && fresh ? <span className="dsh-ri-new">New<span className="sr-only"> release to see</span></span> : null}
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
const BAR: Section[] = ["overview", "summary", "calculator", "retirement"];

/** Phones and touch screens: a bar along the bottom with the tabs used
    most, and More, which opens every tab at once with the theme switch and
    the way back to the site. */
function TabBar({ current, dots, fresh }: { current: Section; dots: Partial<Record<Section, boolean>>; fresh: boolean }) {
  const [open, setOpen] = useState(false);
  // A phone opens every tab as a bottom sheet list; an upright tablet keeps its dialog.
  const phone = usePhone();
  // Away while scrolling down, back on the way up or at the end, as a
  // phone browser's own toolbar does: Safari spends a tap near the bottom
  // on bringing its toolbar back, so the bar is only there when it is.
  const [away, setAway] = useState(false);
  useEffect(() => {
    let last = window.scrollY, frame = 0;
    const on = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY, end = y + window.innerHeight >= document.documentElement.scrollHeight - 4;
        if (y < 60 || end || y < last - 6) setAway(false);
        else if (y > last + 6) setAway(true);
        if (Math.abs(y - last) > 6) last = y;
      });
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); cancelAnimationFrame(frame); };
  }, []);
  const elsewhere = !BAR.includes(current), moreDot = SECTIONS.some((s) => !BAR.includes(s.id) && dots[s.id]);
  return (
    <>
      <nav className="dsh-tabbar" aria-label="Dashboard tabs" data-away={away && !open ? "" : undefined}>
        {BAR.map((id) => {
          const { name, icon: Icon } = SECTIONS.find((s) => s.id === id)!;
          return (
            <Link key={id} href={hrefFor(id)} className="dsh-tb" aria-current={id === current ? "page" : undefined}>
              <span className="dsh-tb-i"><Icon aria-hidden="true" />{dots[id] ? <i className="dsh-dot" aria-hidden="true" /> : null}</span>
              <span>{id === "summary" ? <Short phone="Summary">{name}</Short> : name}</span>{dots[id] ? <span className="sr-only">, something to fill in</span> : null}
            </Link>
          );
        })}
        <button type="button" className="dsh-tb" aria-current={elsewhere ? "page" : undefined} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(true)}>
          <span className="dsh-tb-i"><MenuIcon className="max-phone:hidden" aria-hidden="true" /><EllipsisIcon className="phone:hidden" aria-hidden="true" />{moreDot ? <i className="dsh-dot" aria-hidden="true" /> : fresh ? <i className="dsh-dot" data-new="" aria-hidden="true" /> : null}</span>
          <span>{elsewhere ? SECTIONS.find((s) => s.id === current)?.name ?? "More" : "More"}</span>
          <span className="sr-only">: every tab</span>
        </button>
      </nav>
      {phone ? <MoreSheet open={open} setOpen={setOpen} current={current} dots={dots} fresh={fresh} /> : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent size="household" aria-labelledby="dshMenuTitle">
            <div className="dsh-menu-h">
              <h2 id="dshMenuTitle" className="dsh-dlg-h">Your Dashboard</h2>
              <DialogClose render={<Button variant="ghost" size="icon" aria-label="Close the menu" />}><XIcon aria-hidden="true" /></DialogClose>
            </div>
            <nav className="dsh-menu" aria-label="Dashboard">
              {SECTIONS.map(({ id, name, icon: Icon }) => (
                <Link key={id} href={hrefFor(id)} className="dsh-mi" aria-current={id === current ? "page" : undefined} onClick={() => setOpen(false)}>
                  <Icon aria-hidden="true" /><span>{name}</span>
                  {dots[id] ? <i className="dsh-dot" aria-label="Something to fill in" /> : null}
                  {id === "about" && fresh ? <Badge variant="caution" className="ml-auto">New</Badge> : null}
                </Link>
              ))}
            </nav>
            <div className="dsh-menu-foot">
              <ThemeButton className="dsh-mi" />
              <Link href="/" className="dsh-mi"><ChevronLeftIcon aria-hidden="true" /><span>Back to RetCalc</span></Link>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

const THEMES: [ThemeChoice, string, LucideIcon][] = [["light", "Light", SunIcon], ["dark", "Dark", MoonIcon], ["system", "Auto", MonitorIcon]];

/** Phones: More as a bottom sheet, every tab a row (the site's own More
    sheet's rows, components/phone/TabBar.tsx), then the theme and the way
    back to the site. The same tabs, dots and New mark as the dialog an
    upright tablet keeps. */
function MoreSheet({ open, setOpen, current, dots, fresh }: { open: boolean; setOpen: (v: boolean) => void; current: Section; dots: Partial<Record<Section, boolean>>; fresh: boolean }) {
  const choice = useThemeChoice();
  const installable = useInstallable();
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent aria-describedby={undefined}>
        <SheetHeader><SheetTitle>Your Dashboard</SheetTitle></SheetHeader>
        <SheetBody>
          <nav className="pmore dsh-pmore" aria-label="Dashboard">
            {SECTIONS.map(({ id, name, icon: Icon }) => (
              <Link key={id} href={hrefFor(id)} className="pmore-i" aria-current={id === current ? "page" : undefined} onClick={close}>
                <span className="pmore-ico"><Icon aria-hidden="true" /></span>
                <span className="pmore-t"><b>{name}</b></span>
                {dots[id] ? <><i className="dsh-dot" aria-hidden="true" /><span className="sr-only">, something to fill in</span></> : null}
                {id === "about" && fresh ? <Badge variant="caution">New</Badge> : null}
                <ChevronRightIcon className="pmore-chev" aria-hidden="true" />
              </Link>
            ))}
            <Link href="/" className="pmore-i" onClick={close}>
              <span className="pmore-ico"><ChevronLeftIcon aria-hidden="true" /></span>
              <span className="pmore-t"><b>Back to RetCalc</b></span>
              <ChevronRightIcon className="pmore-chev" aria-hidden="true" />
            </Link>
            {installable ? (
              <button type="button" className="pmore-i" onClick={() => { close(); openInstallHelp(); }}>
                <span className="pmore-ico"><SquarePlusIcon aria-hidden="true" /></span>
                <span className="pmore-t"><b>Add to Home Screen</b></span>
                <ChevronRightIcon className="pmore-chev" aria-hidden="true" />
              </button>
            ) : null}
          </nav>
          <div className="pmore-theme">
            <span id="dshMoreTheme">Theme</span>
            <Segmented size="fill" role="group" aria-labelledby="dshMoreTheme">
              {THEMES.map(([v, label, Icon]) => (
                <SegmentedItem key={v} pressed={choice === v} onClick={() => setThemeChoice(v)}><Icon aria-hidden="true" />{label}</SegmentedItem>
              ))}
            </Segmented>
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

/** Renders `children` for a signed-in person who has started setup;
    otherwise the Dashboard's front page, with an account as the way in when
    signed out and setup when signed in. Setup itself passes `setup`. A
    profile added from scratch, beside others, goes to setup instead of
    the front page. */
export function SignedIn({ children, setup }: { children: ReactNode; setup?: boolean }) {
  const { ready, account } = useAccount();
  const { data } = useDashboard();
  const { list } = useProfiles();
  const router = useRouter();
  const toSetup = ready && !!account && !setup && unstarted(data) && list.length > 1;
  // Once: each new call would cancel the navigation already under way.
  const sent = useRef(false);
  useEffect(() => { if (toSetup && !sent.current) { sent.current = true; router.replace("/dashboard/setup"); } }, [toSetup, router]);
  if (!ready) return <div className="dsh" />;
  if (!account) return <Landing signedIn={false} />;
  if (toSetup) return <div className="dsh" />;
  if (!setup && unstarted(data)) return <Landing signedIn />;
  return <div className="dsh">{children}</div>;
}

/** Rows of figures fit their width at any window size or zoom: the
    figures shrink first (styles/22-dash-refresh.css), and if any unit in
    a row would still wrap onto its own line, the whole row says its units
    short ("/mo", "/yr", from each unit's data-u) by taking .dsh-tight.
    Measured with the long units, again whenever the page resizes or its
    figures change. */
function useFitFigures() {
  useEffect(() => {
    const page = document.getElementById("dsh-page");
    if (!page) return;
    let raf = 0;
    // A figure doesn't fit when its unit drops a line or runs past its column.
    const misfit = (f: HTMLElement) => {
      const u = f.querySelector<HTMLElement>("small[data-u]");
      if (!u) return false;
      const fr = f.getBoundingClientRect(), ur = u.getBoundingClientRect();
      // A unit set on a line of its own (a phone's figures two to a row) is meant to be under it.
      const own = getComputedStyle(u).display === "block";
      return f.scrollWidth > f.clientWidth + 1 || ur.right > fr.right + 1 || (!own && ur.bottom - fr.top > parseFloat(getComputedStyle(f).fontSize) * 1.5);
    };
    // Long units; if any misfits, short ones; if one still does, every
    // unit in the row under its figure.
    const fit = () => {
      raf = 0;
      page.querySelectorAll<HTMLElement>(".dsh-stats, .dsh-duo-figs, .dsh-barkey").forEach((row) => {
        row.classList.remove("dsh-tight", "dsh-stack");
        const figs = [...row.querySelectorAll<HTMLElement>(".dsh-fig, .dsh-lg-v")];
        if (!figs.some(misfit)) return;
        row.classList.add("dsh-tight");
        if (figs.some(misfit)) row.classList.add("dsh-stack");
      });
    };
    const soon = () => { if (!raf) raf = requestAnimationFrame(fit); };
    const ro = new ResizeObserver(soon);
    ro.observe(page);
    const mo = new MutationObserver(soon);
    mo.observe(page, { childList: true, subtree: true, characterData: true });
    soon();
    return () => { ro.disconnect(); mo.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, []);
}

/** True once the page's large title has scrolled out of view: the slim
    bar pinned to the top takes over (iOS's large title, collapsing). */
function usePinned() {
  const ref = useRef<HTMLHeadingElement>(null);
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setPinned(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, pinned] as const;
}

/** The line over the page's title: today's date on the Dashboard's front
    tab, the way back to Tools in a tool opened from there, and the
    Dashboard's name everywhere else. On a phone it sits at the left of the
    navigation bar: the date, or `back` (a tool's way back to the page it
    was opened from) as an app's back button; a tab of its own needs none
    there (the tab bar holds the Dashboard), so the crumb steps aside. */
function Crumb({ current, title, back }: { current: Section; title: string; back?: { href: string; name: string } }) {
  if (current === "overview")
    return <span className="dsh-crumb" suppressHydrationWarning>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span>;
  const phoneBack = back ? <Link className="dsh-pback phone:hidden" href={back.href}><ChevronLeftIcon aria-hidden="true" /><span>{back.name}</span></Link> : null;
  if (current === "tools" && title !== SECTION_NAMES.tools)
    return <><Link className="dsh-crumb" href={hrefFor("tools")}>{SECTION_NAMES.tools}<ChevronRightIcon aria-hidden="true" /></Link>{phoneBack}</>;
  return <><Link className="dsh-crumb" href={hrefFor("overview")}>My Dashboard<ChevronRightIcon aria-hidden="true" /></Link>{phoneBack}</>;
}

/** Phones: the page's secondary buttons (`menu`) as a bottom sheet behind
    the title bar's "•••". The buttons are never moved or remounted: on a
    tablet or desktop their wrapper is display:contents and they sit in the
    title bar as before; on a phone the same wrapper is the sheet
    (styles/phone/20-dashboard.css), so a download that is still building,
    or the dialog it opens, carries on whether the sheet is open or not. */
function useMenuSheet(phone: boolean) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null), sheet = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    sheet.current?.querySelector<HTMLElement>("a[href], button:not([disabled])")?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);
  // Only ever open on a phone: a wide screen never finds it open.
  return { open: open && phone, setOpen, btn, sheet };
}

/** A dashboard page: the rail, the title bar and the page. Someone who
    hasn't started setup sees the front page instead (SignedIn). */
export function Frame({ current, title, meta, actions, menu, back, help, children }: {
  current: Section; title: string; meta?: ReactNode;
  /** Buttons in the title bar, shown on a phone too (a row under the title). */
  actions?: ReactNode;
  /** Secondary buttons: in the title bar on wide screens, behind "•••" in a bottom sheet on a phone. */
  menu?: ReactNode;
  /** Phones: the navigation bar's back button (where a tool was opened from). */
  back?: { href: string; name: string };
  help?: string; children: ReactNode;
}) {
  const { data } = useDashboard();
  const fresh = unstarted(data);
  useLanding();
  useFitFigures();
  // Each new Net worth entry keeps the plan as it stood (snapshot.ts).
  usePlanStamp();
  const [titleRef, pinned] = usePinned();
  const phone = usePhone();
  const { open: menuOpen, setOpen: setMenuOpen, btn: menuBtn, sheet: menuSheet } = useMenuSheet(phone);
  const Icon = SECTIONS.find((s) => s.id === current)!.icon;
  const hasHelp = !!(help || TAB_TOURS[current]);
  // A dot on a section with something still to fill in.
  const abroad = data.profile.state === OUTSIDE_US;
  // A release you haven't seen marks About (opening it marks it seen).
  const newRelease = useNewRelease() && current !== "about";
  const dots: Partial<Record<Section, boolean>> = {
    accounts: !hasAccounts(data.entries), retirement: (!data.profile.ss.checked && !abroad) || !data.profile.strategy,
    profile: !data.done || data.skipped.length > 0,
  };
  return (
    <div className="dsh-app" data-pinned={pinned ? "" : undefined}>
      <a className="dsh-skip" href="#dsh-page">Skip to the page</a>
      <Rail current={current} dots={dots} fresh={newRelease} />
      <div className="dsh-main">
        <header className="dsh-top">
          <div className="dsh-title">
            <span className="dsh-ico" aria-hidden="true"><Icon /></span>
            <div className="dsh-tt">
              <Crumb current={current} title={title} back={back} />
              <h1 ref={titleRef} data-long={title.length > 18 ? "" : undefined}>{title}</h1>
            </div>
            {meta ? <span className="dsh-meta"><Badge variant="outline">{meta}</Badge></span> : null}
          </div>
          {/* On a phone these wrappers let Help and the account stay beside
              the title, and the page's own buttons take a row of their own. */}
          <div className="dsh-r">
            {help || TAB_TOURS[current] ? <span className="dsh-help"><HelpButton tool={help ?? TAB_TOURS[current]!} /></span> : null}
            {menu ? <button type="button" ref={menuBtn} className="dsh-mbtn phone:hidden" aria-label="Download or print your plan" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><CircleEllipsisIcon aria-hidden="true" /></button> : null}
            {menu ? <span className="dsh-mscrim phone:hidden" data-open={menuOpen ? "" : undefined} aria-hidden="true" onClick={() => setMenuOpen(false)} /> : null}
            {actions || menu ? <span className="dsh-acts">{actions}
              {menu ? (
                <span ref={menuSheet} className="dsh-msheet phone:contents" data-open={menuOpen ? "" : undefined}
                  role={phone ? "dialog" : undefined} aria-modal={phone ? true : undefined} aria-labelledby={phone ? "dshMsheetT" : undefined} inert={phone && !menuOpen}
                  onClick={(e) => { if ((e.target as HTMLElement).closest("a[href]")) setMenuOpen(false); }}>
                  <span className="dsh-msheet-h phone:hidden"><span id="dshMsheetT">Your plan</span>
                    <button type="button" className="dsh-msheet-x" aria-label="Close" onClick={() => { setMenuOpen(false); menuBtn.current?.focus(); }}><XIcon aria-hidden="true" /></button></span>
                  {menu}
                </span>
              ) : null}
            </span> : null}
            <span className="dsh-acct"><AccountButton inDashboard /></span>
          </div>
        </header>
        {/* Once the large title scrolls away: the page's name, and Help,
            in a slim bar along the top. Help here presses the title bar's. */}
        <div className="dsh-pin" aria-hidden={!pinned} inert={!pinned}>
          <span className="dsh-pin-t">{title}</span>
          {hasHelp ? <Button variant="outline" size="sm" onClick={() => document.getElementById("toolHelpBtn")?.click()}>Help</Button> : null}
        </div>
        <div className="dsh-page" id="dsh-page" tabIndex={-1}>{fresh ? null : children}</div>
        {/* The site's footer is a website's; the Dashboard keeps one line of it. */}
        <footer className="dsh-pagefoot">
          <span>An educational tool, not financial or tax advice. Past returns don&apos;t predict future ones.</span>
          <span className="dsh-pagefoot-l"><Link href="/dashboard/about#disclaimer">Disclaimer</Link><Link href="/privacy">Privacy</Link><MailMe user="contact" domain="retcalc.app" /></span>
        </footer>
      </div>
      <TabBar current={current} dots={dots} fresh={newRelease} />
    </div>
  );
}
