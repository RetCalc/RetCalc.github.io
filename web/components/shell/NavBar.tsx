"use client";

/* The site header, one row pinned whole: the logo (a link home), the tabs
   (Guide, Calculator, Tools, Learn, About), and on the right the household
   button and the theme button.
   Ported from src/js/app/09-navigation.js. A tool's own controls (its saved
   scenarios) are in its header or tool bar, not here.

   Calculator and Tools are tabs that keep their place: Calculator reopens
   the mode last used (Basic or Advanced, switched on the page itself), and
   Tools reopens the tool last used, going to the picker when clicked again
   from that tool. Guide opens its landing page, which leads to both
   walkthroughs. */

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ALIASES, CALC_PATHS, SLUGS, calcModeFor, slugFromPath, tabFor, type CalcMode, type Tab } from "@/lib/site";
import type { StateOption } from "@/lib/states";
import { HouseholdChip } from "@/components/household/HouseholdBar";
import { AccountButton } from "@/components/account/AccountButton";
import { BrandLink, ThemeButton } from "./Masthead";

export { slugFromPath };

const TABS: { tab: Tab; label: string; href: string; controls: string }[] = [
  { tab: "guide", label: "Guide", href: "/guide", controls: "tab-guide" },
  { tab: "calc", label: "Calculator", href: "/calculator", controls: "tab-simple" },
  { tab: "tools", label: "Tools", href: "/tools", controls: "tab-toolpicker" },
  { tab: "learn", label: "Learn", href: "/learn", controls: "" },
  { tab: "about", label: "About", href: "/about", controls: "tab-about" },
];

export function NavBar({ states }: { states: StateOption[] }) {
  const path = usePathname();
  const router = useRouter();
  const slug = slugFromPath(path);
  // An address that isn't a page (the 404) sits under no tab.
  const known = (slug as string) === "compare" || (slug as string) === "learn" || slug.startsWith("learn/") || slug.startsWith("guide/") || slug in ALIASES || (SLUGS as string[]).includes(slug);
  const tab: Tab | null = known ? tabFor(slug) : null;
  const mode = calcModeFor(slug);

  // The Calculator tab returns to the mode last used.
  const [lastMode, setLastMode] = useState<CalcMode>("simple");
  if (mode && mode !== lastMode) setLastMode(mode);

  // The Tools tab reopens the tool last used (a page under Tools other
  // than the picker); from that tool it goes to the picker.
  const [lastTool, setLastTool] = useState<string | null>(null);
  if (tab === "tools" && slug !== "tools" && path !== lastTool) setLastTool(path);
  const hrefFor = (t: Tab, fallback: string) =>
    t === "calc" ? CALC_PATHS[lastMode] : t === "tools" && tab !== "tools" && lastTool ? lastTool : fallback;

  const tabBtns = useRef<(HTMLButtonElement | null)[]>([]);

  /* Once the rail is pinned under the masthead it gets a deeper shadow, and
     the strip above it (the phone's notch area) fills in. */
  const navbar = useRef<HTMLElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    let queued = false;
    const check = () => {
      queued = false;
      const nb = navbar.current;
      if (!nb) return;
      // pinned at var(--sb-clear), not always 0. The header starts pinned
      // (nothing above it), so it reads as stuck once the page moves.
      const off = parseFloat(getComputedStyle(nb).top) || 0;
      setStuck(nb.getBoundingClientRect().top <= off + 0.5 && window.scrollY > 4);
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(check);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    check();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* A tab change slides the marker (the logo's arrow) from the old tab to
     the new one: a single arrow (.tabmark) travels along the rail, then
     hands back to the picked tab's own arrow, so the rail at rest is drawn
     exactly as before. It tracks the picked tab's centre (the phone rail
     scrolls). Not in the
     home-screen app's bottom bar, which has its own top-edge marker, and
     not under reduced motion, where the arrow just appears. */
  const [markX, setMarkX] = useState<number | null>(null);
  const [sliding, setSliding] = useState(false);
  const tabIdx = TABS.findIndex((t) => t.tab === tab);
  const [lastIdx, setLastIdx] = useState(tabIdx);
  if (lastIdx !== tabIdx) {
    setLastIdx(tabIdx);
    const still = document.documentElement.classList.contains("pwa") || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!still && tabIdx >= 0 && lastIdx >= 0) setSliding(true);
  }
  useLayoutEffect(() => {
    const btn = tabBtns.current[tabIdx];
    if (!btn) return;
    const measure = () => {
      const nav = btn.parentElement!, b = btn.getBoundingClientRect();
      setMarkX(b.left - nav.getBoundingClientRect().left - nav.clientLeft + nav.scrollLeft + b.width / 2);
    };
    measure();
    const ro = new ResizeObserver(measure);
    tabBtns.current.forEach((b) => b && ro.observe(b));
    return () => ro.disconnect();
  }, [tabIdx]);
  useEffect(() => {
    if (!sliding) return;
    const t = setTimeout(() => setSliding(false), 320); // in case transitionend never comes
    return () => clearTimeout(t);
  }, [sliding, markX]);

  const go = (href: string) => {
    if (href !== path) router.push(href);
  };

  return (
    <>
      <div className={`sbcover${stuck ? " stuck" : ""}`} id="sbCover" aria-hidden="true" />
      <header ref={navbar} className={`navbar oneline${stuck ? " stuck" : ""}`}>
        <BrandLink tagline={false} />
        <nav role="tablist" aria-label="Sections" className={sliding ? "sliding" : undefined}>
          {TABS.map((t, i) => {
            const selected = t.tab === tab;
            return (
              <button
                key={t.tab}
                ref={(el) => {
                  tabBtns.current[i] = el;
                }}
                role="tab"
                id={`tabbtn-${t.tab}`}
                data-tab={t.tab}
                // A tool page sits under Tools but isn't the picker panel, and
                // Privacy sits under About but isn't the About panel.
                aria-controls={t.tab === "calc" ? `tab-${mode ?? lastMode}` : selected && ((t.tab === "tools" && slug !== "tools") || (t.tab === "about" && slug !== "about")) ? undefined : t.controls || undefined}
                aria-selected={selected}
                tabIndex={selected || (tab === null && i === 0) ? undefined : -1}
                onMouseEnter={() => router.prefetch(hrefFor(t.tab, t.href))}
                onClick={() => go(hrefFor(t.tab, t.href))}
                onKeyDown={(e) => {
                  const n = TABS.length;
                  const j = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n
                    : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
                  if (j < 0) return;
                  e.preventDefault();
                  tabBtns.current[j]?.focus();
                  go(hrefFor(TABS[j].tab, TABS[j].href));
                }}
              >
                {t.label}
              </button>
            );
          })}
          {markX != null && tabIdx >= 0 ? <span className="tabmark" aria-hidden="true" style={{ "--mx": markX + "px" } as React.CSSProperties}
            onTransitionEnd={(e) => { if (e.propertyName === "transform") setSliding(false); }} /> : null}
        </nav>
        <div className="navrow-end"><HouseholdChip states={states} /><AccountButton /><span className="theme-slot"><ThemeButton /></span></div>
      </header>
    </>
  );
}
