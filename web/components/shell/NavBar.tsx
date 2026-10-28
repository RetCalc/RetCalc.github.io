"use client";

/* The site header, one row pinned whole: the logo (a link home), the tabs
   (Guide with its Readiness / Paycheck menu, Calculator with its Basic /
   Advanced menu, Tools, About), and on the right the household
   button and the theme button.
   Ported from src/js/app/09-navigation.js. A tool's own controls (its saved
   scenarios) are in its header or tool bar, not here.

   Tools works like a tab that keeps its place: from another tab it reopens
   the tool last used, and clicked again from that tool it goes to the
   picker.

   With a mouse, the Guide and Calculator menus open on hover and the tab
   itself goes straight to the one last used. Touch screens have no hover,
   so there a tap on the tab opens the menu. */

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ALIASES, CALC_MODE_NAMES, CALC_PATHS, SLUGS, calcModeFor, slugFromPath, tabFor, type CalcMode, type Tab } from "@/lib/site";
import type { StateOption } from "@/lib/states";
import { HouseholdChip } from "@/components/household/HouseholdBar";
import { AccountButton } from "@/components/account/AccountButton";
import { BrandLink, ThemeButton } from "./Masthead";

export { slugFromPath };

const TABS: { tab: Tab; label: string; href: string; controls: string }[] = [
  { tab: "guide", label: "Guide", href: "/guide", controls: "tab-guide" },
  { tab: "calc", label: "Calculator", href: "/calculator", controls: "tab-simple" },
  { tab: "tools", label: "Tools", href: "/tools", controls: "tab-toolpicker" },
  { tab: "about", label: "About", href: "/about", controls: "tab-about" },
];
const MODES: { mode: CalcMode; desc: string }[] = [
  { mode: "simple", desc: "Five questions for a quick answer" },
  { mode: "single", desc: "Every assumption, taxes and fees, and the changes you see coming" },
];

/** The Guide's two walkthroughs: the whole picture, or straight to the numbers. */
type GuideMode = "readiness" | "paycheck";
const GUIDE_MODES: { mode: GuideMode; tab: string; name: string; href: string; desc: string }[] = [
  { mode: "readiness", tab: "Readiness", name: "Readiness Guide", href: "/guide", desc: "Your whole financial picture, with a readiness score and next steps" },
  { mode: "paycheck", tab: "Paycheck", name: "Paycheck to Retirement", href: "/guide/paycheck", desc: "From your paycheck to what you'll have at retirement" },
];
const guideModeFor = (slug: string): GuideMode | null =>
  slug.startsWith("guide/paycheck") ? "paycheck" : slug === "guide" || slug.startsWith("guide/") ? "readiness" : null;

/** The tabs with a menu, and what's in each. */
type MenuTab = "guide" | "calc";
interface MenuItem { key: string; name: string; desc: string; href: string; checked: boolean }

function canHover() {
  return window.matchMedia?.("(hover:hover) and (pointer:fine)").matches ?? false;
}

export function NavBar({ states }: { states: StateOption[] }) {
  const path = usePathname();
  const router = useRouter();
  const slug = slugFromPath(path);
  // An address that isn't a page (the 404) sits under no tab.
  const known = (slug as string) === "compare" || (slug as string) === "guide/report" || (slug as string) === "guide/paycheck" || (slug as string) === "guide/paycheck/report" || slug in ALIASES || (SLUGS as string[]).includes(slug);
  const tab: Tab | null = known ? tabFor(slug) : null;
  const mode = calcModeFor(slug);

  // The Calculator tab shows (and returns to) the mode last used.
  const [lastMode, setLastMode] = useState<CalcMode>("simple");
  const shownMode = mode ?? lastMode;
  if (mode && mode !== lastMode) setLastMode(mode);

  // The Tools tab reopens the tool last used (a page under Tools other
  // than the picker); from that tool it goes to the picker.
  const [lastTool, setLastTool] = useState<string | null>(null);
  if (tab === "tools" && slug !== "tools" && path !== lastTool) setLastTool(path);
  const hrefFor = (t: Tab, fallback: string) => (t === "tools" && tab !== "tools" && lastTool ? lastTool : fallback);

  // The Guide tab shows (and returns to) the walkthrough last used.
  const gMode = guideModeFor(slug);
  const [lastGuide, setLastGuide] = useState<GuideMode>("readiness");
  const shownGuide = gMode ?? lastGuide;
  if (gMode && gMode !== lastGuide) setLastGuide(gMode);

  const [menu, setMenu] = useState<"closed" | "hover" | "open">("closed");
  // Which tab's menu is showing.
  const [menuTab, setMenuTab] = useState<MenuTab>("calc");
  const [menuLeft, setMenuLeft] = useState(10);
  const menuBtns = useRef<Partial<Record<MenuTab, HTMLButtonElement | null>>>({});
  const menuItems: MenuItem[] = menuTab === "calc"
    ? MODES.map((m) => ({ key: m.mode, name: CALC_MODE_NAMES[m.mode], desc: m.desc, href: CALC_PATHS[m.mode], checked: m.mode === shownMode }))
    : GUIDE_MODES.map((m) => ({ key: m.mode, name: m.name, desc: m.desc, href: m.href, checked: m.mode === shownGuide }));
  const homeOf = (t: MenuTab) => (t === "calc" ? CALC_PATHS[shownMode] : GUIDE_MODES.find((m) => m.mode === shownGuide)!.href);
  const menuRef = useRef<HTMLDivElement>(null);
  const tabBtns = useRef<(HTMLButtonElement | null)[]>([]);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const open = menu !== "closed";

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
     exactly as before. It tracks the picked tab's centre (Calculator's
     width changes with its mode; the phone rail scrolls). Not in the
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
  }, [tabIdx, shownMode, shownGuide]);
  useEffect(() => {
    if (!sliding) return;
    const t = setTimeout(() => setSliding(false), 320); // in case transitionend never comes
    return () => clearTimeout(t);
  }, [sliding, markX]);

  const place = (t: MenuTab = menuTab) => {
    const btn = menuBtns.current[t], nb = btn?.closest(".navbar"), m = menuRef.current;
    if (!nb || !m || !btn) return;
    const bl = btn.getBoundingClientRect().left - nb.getBoundingClientRect().left;
    // Line the menu's text up with the tab's, but never past the right edge.
    setMenuLeft(Math.max(10, Math.min(bl - 12, nb.clientWidth - m.offsetWidth - 10)));
  };
  const openMenu = (t: MenuTab, how: "hover" | "open", focusItem: boolean) => {
    setMenuTab(t);
    setMenu(how);
    requestAnimationFrame(() => {
      place(t);
      if (focusItem) {
        const i = t === "calc" ? MODES.findIndex((m) => m.mode === shownMode) : GUIDE_MODES.findIndex((m) => m.mode === shownGuide);
        items.current[i]?.focus();
      }
    });
  };
  const closeMenu = (refocus = false) => {
    setMenu("closed");
    if (refocus) menuBtns.current[menuTab]?.focus();
  };

  // A press anywhere outside the menu and its tab closes it; so does Escape.
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!t.closest?.("#calcMenu") && !t.closest?.("[aria-haspopup=menu]")) setMenu("closed");
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu(true);
    };
    const resize = () => place();
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", resize);
    };
    // closeMenu and place change only with the open menu's tab, a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, menuTab]);

  const hoverIn = (t: MenuTab = menuTab) => {
    if (!canHover()) return;
    clearTimeout(hoverTimer.current);
    if (!open || menuTab !== t) openMenu(t, "hover", false);
  };
  const hoverOut = () => {
    if (!canHover()) return;
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      // keep it open while a keyboard user is inside it
      if (!menuRef.current?.contains(document.activeElement)) setMenu("closed");
    }, 220);
  };

  const go = (href: string) => {
    if (href !== path) router.push(href);
  };

  return (
    <>
      <div className={`sbcover${stuck ? " stuck" : ""}`} id="sbCover" aria-hidden="true" />
      <div className="calcscrim" id="calcScrim" hidden={menu !== "open"} onClick={() => closeMenu()} />
      <header ref={navbar} className={`navbar oneline${stuck ? " stuck" : ""}${open ? " menu-open" : ""}`}>
        <BrandLink tagline={false} />
        <nav role="tablist" aria-label="Sections" className={sliding ? "sliding" : undefined}>
          {TABS.map((t, i) => {
            const selected = t.tab === tab;
            const isCalc = t.tab === "calc";
            // A tab with a menu: Calculator, and the Guide.
            const mt: MenuTab | null = isCalc ? "calc" : t.tab === "guide" ? "guide" : null;
            const mOpen = open && menuTab === mt;
            return (
              <button
                key={t.tab}
                ref={(el) => {
                  tabBtns.current[i] = el;
                  if (mt) menuBtns.current[mt] = el;
                }}
                role="tab"
                id={isCalc ? "tabbtn-calc" : `tabbtn-${t.tab}`}
                className={mt ? "calcbtn" : undefined}
                data-tab={t.tab}
                // A tool page sits under Tools but isn't the picker panel, and
                // Privacy sits under About but isn't the About panel.
                aria-controls={isCalc ? `tab-${shownMode}` : selected && ((t.tab === "tools" && slug !== "tools") || (t.tab === "about" && slug !== "about")) ? undefined : t.controls}
                aria-selected={selected}
                tabIndex={selected || (tab === null && i === 0) ? undefined : -1}
                aria-haspopup={mt ? "menu" : undefined}
                aria-expanded={mt ? mOpen : undefined}
                onMouseEnter={mt ? () => hoverIn(mt) : () => router.prefetch(hrefFor(t.tab, t.href))}
                onMouseLeave={mt ? hoverOut : undefined}
                onClick={(e) => {
                  if (!mt) {
                    go(hrefFor(t.tab, t.href));
                    return;
                  }
                  if (canHover() && e.detail !== 0) {
                    clearTimeout(hoverTimer.current);
                    closeMenu();
                    go(homeOf(mt));
                    return;
                  }
                  if (mOpen) closeMenu();
                  else openMenu(mt, "open", e.detail === 0);
                }}
                onKeyDown={(e) => {
                  if (mt && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                    e.preventDefault();
                    openMenu(mt, "open", true);
                    return;
                  }
                  const n = TABS.length;
                  const j = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n
                    : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
                  if (j < 0) return;
                  e.preventDefault();
                  closeMenu();
                  tabBtns.current[j]?.focus();
                  // Arrowing onto a tab with a menu only lands there, so it
                  // doesn't get in the way of reaching the next one.
                  if (TABS[j].tab !== "calc" && TABS[j].tab !== "guide") go(hrefFor(TABS[j].tab, TABS[j].href));
                }}
              >
                {isCalc ? (
                  <>
                    <span>Calculator</span>
                    <span className="calc-mode">
                      <span id="calcMode">{CALC_MODE_NAMES[shownMode]}</span>
                      <svg className="calc-chev" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 4.6L6 7.6l3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                  </>
                ) : mt === "guide" ? (
                  <>
                    <span>Guide</span>
                    <span className="calc-mode">
                      <span id="guideMode">{GUIDE_MODES.find((m) => m.mode === shownGuide)!.tab}</span>
                      <svg className="calc-chev" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 4.6L6 7.6l3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                  </>
                ) : (
                  t.label
                )}
              </button>
            );
          })}
          {markX != null && tabIdx >= 0 ? <span className="tabmark" aria-hidden="true" style={{ "--mx": markX + "px" } as React.CSSProperties}
            onTransitionEnd={(e) => { if (e.propertyName === "transform") setSliding(false); }} /> : null}
        </nav>
        <div className="navrow-end"><HouseholdChip states={states} /><AccountButton /><span className="theme-slot"><ThemeButton /></span></div>
        {/* Outside the nav so the phone rail's horizontal scroll can't clip it. */}
        <div className="calcmenu left-(--x)" id="calcMenu" role="menu" aria-labelledby={menuTab === "calc" ? "tabbtn-calc" : "tabbtn-guide"} hidden={!open}
          ref={menuRef} style={{ "--x": menuLeft + "px" } as React.CSSProperties} onMouseEnter={() => hoverIn()} onMouseLeave={hoverOut}>
          <div className="calcmenu-h" aria-hidden="true">{menuTab === "calc" ? "Calculator" : "Guide"}</div>
          {menuItems.map((m, i) => (
            <button
              key={m.key}
              ref={(el) => {
                items.current[i] = el;
              }}
              type="button"
              role="menuitemradio"
              data-mode={m.key}
              aria-checked={m.checked}
              tabIndex={-1}
              onMouseEnter={() => router.prefetch(m.href)}
              onClick={(e) => {
                closeMenu(e.detail === 0);
                go(m.href);
              }}
              onKeyDown={(e) => {
                const n = menuItems.length;
                const j = e.key === "ArrowDown" ? (i + 1) % n : e.key === "ArrowUp" ? (i - 1 + n) % n
                  : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
                if (e.key === "Escape") {
                  e.preventDefault();
                  closeMenu(true);
                } else if (e.key === "Tab") closeMenu();
                else if (j >= 0) {
                  e.preventDefault();
                  items.current[j]?.focus();
                }
              }}
            >
              <span className="cm-name">{m.name}</span>
              <span className="cm-desc">{m.desc}</span>
            </button>
          ))}
        </div>
      </header>
    </>
  );
}
