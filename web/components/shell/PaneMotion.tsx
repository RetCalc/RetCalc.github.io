"use client";

/* The new page's entrance after a page change, as the old site played it:
   its panes rise in, or settle in from above going back, and the tool list's
   cards arrive one after another. Not on the first page of a visit. The
   keyframes are styles/03-navigation.css's, which also turns them off for
   reduced motion. From playPaneEnter() in src/js/app/09-navigation.js. */

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { setNavDir, takeNavDir } from "@/lib/nav-motion";

const CLASSES = ["pane-in", "pane-in-fwd", "pane-in-back", "pane-in-cards"];

export function PaneMotion() {
  const path = usePathname();
  const first = useRef(true);
  // The browser's back and forward buttons: back to the tool list goes back.
  useEffect(() => {
    const pop = () => setNavDir(location.pathname === "/tools" ? "back" : "tab");
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    const d = takeNavDir();
    document.querySelectorAll<HTMLElement>("#main > .stack, #main > aside").forEach((el) => {
      const cls = el.id === "tab-toolpicker" ? "pane-in-cards" : d === "fwd" ? "pane-in-fwd" : d === "back" ? "pane-in-back" : "pane-in";
      el.classList.remove(...CLASSES);
      void el.offsetWidth; // replays on a repeat visit
      el.classList.add(cls);
    });
  }, [path]);
  return null;
}
