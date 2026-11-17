"use client";

/* The phone's app bar along the bottom (under 768px only; phone:hidden
   keeps it off tablets and desktops, where the header's tabs do this job):
   Calculator, Tools, Guide, Learn and More. The first four are the header's
   tabs and keep their place the same way: Calculator reopens the mode last
   used, Tools the tool last used (and the tool list when tapped from a
   tool). More opens a sheet with what the header and footer hold on a
   desktop: the Dashboard, the household, About, Privacy, the theme and how
   to put RetCalc on the home screen.

   In a browser tab the bar slides away while scrolling down and returns on
   the way up, as the Dashboard's does, because Safari spends a tap near the
   bottom edge on bringing its own toolbar back. In the home-screen app it
   stays put. It steps aside while typing (the keyboard needs the room) and
   while the Guide's coach holds the bottom of the screen. The Dashboard has
   its own bar (components/dashboard/Frame.tsx), so this one isn't shown
   there. Styles: styles/phone/00-shell.css. */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalculatorIcon, ChevronRightIcon, CompassIcon, EllipsisIcon, GraduationCapIcon, HouseIcon, InfoIcon, LayoutDashboardIcon, LockIcon,
  MonitorIcon, MoonIcon, SquarePlusIcon, SunIcon, UsersRoundIcon, WrenchIcon, type LucideIcon,
} from "lucide-react";
import { ALIASES, CALC_PATHS, SLUGS, calcModeFor, slugFromPath, tabFor, type CalcMode, type Tab } from "@/lib/site";
import { useHousehold } from "@/components/household/HouseholdProvider";
import { setThemeChoice, useThemeChoice, type ThemeChoice } from "@/lib/theme";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { openInstallHelp, useInstallable } from "./install";

const TABS: { tab: Exclude<Tab, "about">; label: string; href: string; icon: LucideIcon }[] = [
  { tab: "calc", label: "Calculator", href: "/calculator", icon: CalculatorIcon },
  { tab: "tools", label: "Tools", href: "/tools", icon: WrenchIcon },
  { tab: "guide", label: "Guide", href: "/guide", icon: CompassIcon },
  { tab: "learn", label: "Learn", href: "/learn", icon: GraduationCapIcon },
];

const THEMES: [ThemeChoice, string, LucideIcon][] = [["light", "Light", SunIcon], ["dark", "Dark", MoonIcon], ["system", "Auto", MonitorIcon]];

export function PhoneTabBar() {
  const path = usePathname();
  const slug = slugFromPath(path);
  const known = (slug as string) === "compare" || (slug as string) === "learn" || slug.startsWith("learn/") || slug.startsWith("guide/") || slug in ALIASES || (SLUGS as string[]).includes(slug);
  const tab: Tab | null = known ? tabFor(slug) : null;
  const mode = calcModeFor(slug);

  // The same memory as the header's tabs (components/shell/NavBar.tsx).
  const [lastMode, setLastMode] = useState<CalcMode>("simple");
  if (mode && mode !== lastMode) setLastMode(mode);
  const [lastTool, setLastTool] = useState<string | null>(null);
  if (tab === "tools" && path !== lastTool) setLastTool(path);
  const hrefFor = (t: Tab, fallback: string) =>
    t === "calc" ? CALC_PATHS[lastMode] : t === "tools" && tab !== "tools" && lastTool ? lastTool : fallback;

  const [open, setOpen] = useState(false);
  const away = useAway(open);
  const inMore = tab === "about" || (slug as string) === "account";

  return (
    <>
      <nav className="ptab phone:hidden" aria-label="Sections" data-away={away ? "" : undefined}>
        {TABS.map(({ tab: t, label, href, icon: Icon }) => (
          <Link key={t} href={hrefFor(t, href)} className="ptab-i" aria-current={t === tab ? "page" : undefined}
            onClick={() => window.scrollTo({ top: 0 })}>
            <Icon aria-hidden="true" /><span>{label}</span>
          </Link>
        ))}
        <button type="button" className="ptab-i" aria-current={inMore ? "page" : undefined} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
          <EllipsisIcon aria-hidden="true" /><span>More</span>
        </button>
      </nav>
      <MoreSheet open={open} setOpen={setOpen} path={path} />
    </>
  );
}

/** Away while scrolling down, back on the way up, at the top and at the
    end of the page. Never away in the home-screen app, which has no
    browser toolbar to follow. */
function useAway(held: boolean): boolean {
  const [away, setAway] = useState(false);
  useEffect(() => {
    if (document.documentElement.classList.contains("pwa")) return;
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
  return away && !held;
}

function MoreSheet({ open, setOpen, path }: { open: boolean; setOpen: (v: boolean) => void; path: string }) {
  const { setPanelOpen } = useHousehold();
  const choice = useThemeChoice();
  const installable = useInstallable();
  const close = () => setOpen(false);
  const row = (href: string, label: string, Icon: LucideIcon, sub?: string) => (
    <Link href={href} className="pmore-i" aria-current={path === href ? "page" : undefined} onClick={close}>
      <span className="pmore-ico"><Icon aria-hidden="true" /></span>
      <span className="pmore-t"><b>{label}</b>{sub ? <small>{sub}</small> : null}</span>
      <ChevronRightIcon className="pmore-chev" aria-hidden="true" />
    </Link>
  );
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent aria-describedby={undefined}>
        <SheetHeader><SheetTitle>More</SheetTitle></SheetHeader>
        <SheetBody>
          <nav className="pmore" aria-label="More">
            {row("/dashboard", "My Dashboard", LayoutDashboardIcon, "Your net worth, pay, taxes and plan in one place")}
            <button type="button" className="pmore-i" onClick={() => { close(); setPanelOpen(true); }}>
              <span className="pmore-ico"><UsersRoundIcon aria-hidden="true" /></span>
              <span className="pmore-t"><b>Your household</b><small>Ages, pay and savings, filled into every tool</small></span>
              <ChevronRightIcon className="pmore-chev" aria-hidden="true" />
            </button>
            {row("/", "Home", HouseIcon)}
            {row("/about", "About RetCalc", InfoIcon, "How each tool works, and the fine print")}
            {row("/privacy", "Privacy", LockIcon)}
            {installable ? (
              <button type="button" className="pmore-i" onClick={() => { close(); openInstallHelp(); }}>
                <span className="pmore-ico"><SquarePlusIcon aria-hidden="true" /></span>
                <span className="pmore-t"><b>Add to Home Screen</b><small>Open RetCalc like an app, full screen</small></span>
                <ChevronRightIcon className="pmore-chev" aria-hidden="true" />
              </button>
            ) : null}
          </nav>
          <div className="pmore-theme">
            <span id="pmoreTheme">Theme</span>
            <Segmented size="fill" role="group" aria-labelledby="pmoreTheme">
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
