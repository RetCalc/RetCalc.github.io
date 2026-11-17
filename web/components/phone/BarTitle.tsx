"use client";

/* The phone top bar's title: the page's own name, shown in the bar once
   the page's heading has scrolled out of sight, as an iPhone app's large
   title shrinks into its navigation bar. It reads the heading the page
   already has (a tool's name, a page's h1), so no page has to say anything
   twice. Hidden from screen readers, which have the heading itself; off
   tablets and desktops altogether (phone:hidden). */

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isPhone } from "./usePhone";

/* The page's visible heading, most specific first. */
const HEADINGS = "#toolCrumb, .toolbar .toolhead-name, main h1:not(.srlive), .dsh-landing h1";

export function PhoneBarTitle() {
  const path = usePathname();
  const [title, setTitle] = useState("");
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!isPhone() || path === "/") return;
    let io: IntersectionObserver | null = null, raf = 0, tries = 0;
    const find = () => {
      raf = 0;
      const h = [...document.querySelectorAll<HTMLElement>(HEADINGS)].find((el) => el.offsetParent !== null);
      if (!h) {
        // A page that draws its heading a moment later (a lesson, the Guide).
        if (++tries < 20) raf = requestAnimationFrame(find);
        return;
      }
      // A lesson's title can run long: the bar cuts it with an ellipsis. A
      // headline longer than that is not a name, and the logo stays.
      const name = (h.textContent ?? "").replace(/\s+/g, " ").trim();
      if (name.length > 60) return;
      setTitle(name);
      const bar = document.querySelector<HTMLElement>(".navbar.oneline")?.offsetHeight ?? 48;
      io = new IntersectionObserver(([e]) => setOn(!e.isIntersecting && e.boundingClientRect.top < bar + 8), { rootMargin: `-${bar}px 0px 0px 0px` });
      io.observe(h);
    };
    raf = requestAnimationFrame(find);
    return () => { io?.disconnect(); if (raf) cancelAnimationFrame(raf); setOn(false); setTitle(""); };
  }, [path]);

  return <span className="pbar-title phone:hidden" aria-hidden="true" data-on={on && title ? "" : undefined}>{title}</span>;
}
