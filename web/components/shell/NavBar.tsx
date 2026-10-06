"use client";

/* The tab rail under the masthead: Guide, Calculator (with its Basic /
   Advanced / Stages menu), Tools, About. Ported from src/js/app/09-navigation.js.

   With a mouse, the Calculator menu opens on hover and the tab itself goes
   straight to the mode last used. Touch screens have no hover, so there a
   tap on the tab opens the menu. */

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CALC_MODE_NAMES, CALC_PATHS, calcModeFor, tabFor, type CalcMode, type Slug, type Tab } from "@/lib/site";

const TABS: { tab: Tab; label: string; href: string; controls: string }[] = [
  { tab: "guide", label: "Guide", href: "/guide", controls: "tab-guide" },
  { tab: "calc", label: "Calculator", href: "/", controls: "tab-simple" },
  { tab: "tools", label: "Tools", href: "/tools", controls: "tab-toolpicker" },
  { tab: "about", label: "About", href: "/about", controls: "tab-about" },
];
const MODES: { mode: CalcMode; desc: string }[] = [
  { mode: "simple", desc: "Five questions for a quick answer" },
  { mode: "single", desc: "Every assumption, taxes and fees, one timeline" },
  { mode: "series", desc: "Chain periods together as your plans change" },
];

export function slugFromPath(path: string): Slug {
  const seg = path.replace(/^\/+|\/+$/g, "");
  return (seg || "home") as Slug;
}

function canHover() {
  return window.matchMedia?.("(hover:hover) and (pointer:fine)").matches ?? false;
}

export function NavBar() {
  const path = usePathname();
  const router = useRouter();
  const slug = slugFromPath(path);
  const tab = tabFor(slug);
  const mode = calcModeFor(slug);

  // The Calculator tab shows (and returns to) the mode last used.
  const [lastMode, setLastMode] = useState<CalcMode>("simple");
  const shownMode = mode ?? lastMode;
  if (mode && mode !== lastMode) setLastMode(mode);

  const [menu, setMenu] = useState<"closed" | "hover" | "open">("closed");
  const [menuLeft, setMenuLeft] = useState(10);
  const calcBtn = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const tabBtns = useRef<(HTMLButtonElement | null)[]>([]);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const open = menu !== "closed";

  /* Once the rail is pinned under the masthead it gets a deeper shadow, and
     the strip above it (the phone's notch area) fills in. */
  const navbar = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    let queued = false;
    const check = () => {
      queued = false;
      const nb = navbar.current;
      if (!nb) return;
      // pinned at var(--sb-clear), not always 0
      const off = parseFloat(getComputedStyle(nb).top) || 0;
      setStuck(nb.getBoundingClientRect().top <= off + 0.5);
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

  const place = () => {
    const nb = calcBtn.current?.closest(".navbar"), m = menuRef.current;
    if (!nb || !m || !calcBtn.current) return;
    const bl = calcBtn.current.getBoundingClientRect().left - nb.getBoundingClientRect().left;
    // Line the menu's text up with the tab's, but never past the right edge.
    setMenuLeft(Math.max(10, Math.min(bl - 12, nb.clientWidth - m.offsetWidth - 10)));
  };
  const openMenu = (how: "hover" | "open", focusItem: boolean) => {
    setMenu(how);
    requestAnimationFrame(() => {
      place();
      if (focusItem) items.current[MODES.findIndex((m) => m.mode === shownMode)]?.focus();
    });
  };
  const closeMenu = (refocus = false) => {
    setMenu("closed");
    if (refocus) calcBtn.current?.focus();
  };

  // A press anywhere outside the menu and its tab closes it; so does Escape.
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!t.closest?.("#calcMenu") && !t.closest?.("#tabbtn-calc")) setMenu("closed");
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
  }, [open]);

  const hoverIn = () => {
    if (!canHover()) return;
    clearTimeout(hoverTimer.current);
    if (!open) openMenu("hover", false);
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
      <div ref={navbar} className={`navbar${stuck ? " stuck" : ""}${open ? " menu-open" : ""}`}>
        <nav role="tablist" aria-label="Sections">
          {TABS.map((t, i) => {
            const selected = t.tab === tab;
            const isCalc = t.tab === "calc";
            return (
              <button
                key={t.tab}
                ref={(el) => {
                  tabBtns.current[i] = el;
                  if (isCalc) calcBtn.current = el;
                }}
                role="tab"
                id={isCalc ? "tabbtn-calc" : `tabbtn-${t.tab}`}
                className={isCalc ? "calcbtn" : undefined}
                data-tab={t.tab}
                aria-controls={isCalc ? `tab-${shownMode}` : t.controls}
                aria-selected={selected}
                tabIndex={selected ? undefined : -1}
                aria-haspopup={isCalc ? "menu" : undefined}
                aria-expanded={isCalc ? open : undefined}
                onMouseEnter={isCalc ? hoverIn : () => router.prefetch(t.href)}
                onMouseLeave={isCalc ? hoverOut : undefined}
                onClick={(e) => {
                  if (!isCalc) {
                    go(t.href);
                    return;
                  }
                  if (canHover() && e.detail !== 0) {
                    clearTimeout(hoverTimer.current);
                    closeMenu();
                    go(CALC_PATHS[shownMode]);
                    return;
                  }
                  if (open) closeMenu();
                  else openMenu("open", e.detail === 0);
                }}
                onKeyDown={(e) => {
                  if (isCalc && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                    e.preventDefault();
                    openMenu("open", true);
                    return;
                  }
                  const n = TABS.length;
                  const j = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n
                    : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
                  if (j < 0) return;
                  e.preventDefault();
                  closeMenu();
                  tabBtns.current[j]?.focus();
                  // Arrowing onto Calculator only lands there, so it doesn't
                  // get in the way of reaching Tools.
                  if (TABS[j].tab !== "calc") go(TABS[j].href);
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
                ) : (
                  t.label
                )}
              </button>
            );
          })}
        </nav>
        {/* Outside the nav so the phone rail's horizontal scroll can't clip it. */}
        <div className="calcmenu left-(--x)" id="calcMenu" role="menu" aria-labelledby="tabbtn-calc" hidden={!open}
          ref={menuRef} style={{ "--x": menuLeft + "px" } as React.CSSProperties} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
          <div className="calcmenu-h" aria-hidden="true">Calculator</div>
          {MODES.map((m, i) => (
            <button
              key={m.mode}
              ref={(el) => {
                items.current[i] = el;
              }}
              type="button"
              role="menuitemradio"
              data-mode={m.mode}
              aria-checked={m.mode === shownMode}
              tabIndex={-1}
              onMouseEnter={() => router.prefetch(CALC_PATHS[m.mode])}
              onClick={(e) => {
                closeMenu(e.detail === 0);
                go(CALC_PATHS[m.mode]);
              }}
              onKeyDown={(e) => {
                const n = MODES.length;
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
              <span className="cm-name">{CALC_MODE_NAMES[m.mode]}</span>
              <span className="cm-desc">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
