"use client";

/* Links that point to a part of a page ("/dashboard/profile#assumptions")
   land on it: once it's on the page, it's scrolled to the top of the
   screen with a little room above, opened if it's something that opens,
   and glows briefly so it's plain where the link went. */

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Parts that live inside a tool, which has no ids of its own to point at. */
const INSIDE: Record<string, () => Element | null | undefined> = {
  // Savings: the Paycheck's sliders.
  rest: () => [...document.querySelectorAll('[data-slot="card-title"]')].find((t) => t.textContent === "Where the rest goes")?.closest('[data-slot="card"]'),
  // Spending: the Budget's emergency fund.
  emergency: () => document.getElementById("efMonths")?.closest("#asideBudget > [data-slot=card] > div"),
};

const find = (id: string) => INSIDE[id]?.() ?? document.getElementById(id);

/** Told to a page as it's landed on, so it can open what the link points to. */
export const LAND_EVENT = "dsh-land";

function land() {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (!id) return () => {};
  let tries = 0;
  // The page fills in from what's saved after it first draws, and a tool
  // loads after that, so wait for the part to be there (up to 5 seconds).
  const timer = window.setInterval(() => {
    const el = find(id);
    if (!el && ++tries < 50) return;
    window.clearInterval(timer);
    if (!el) return;
    window.dispatchEvent(new CustomEvent(LAND_EVENT, { detail: id }));
    // A wrapper glows on the tile or card it holds.
    const glow = el.matches('.dsh-tile, [data-slot="card"]') ? el : el.querySelector(':scope > .dsh-tile, :scope > [data-slot="card"]') ?? el;
    window.requestAnimationFrame(() => {
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const go = (behavior: ScrollBehavior) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 16, behavior });
      go(still ? "auto" : "smooth");
      // A tool that loads above it can still push it down: once more, if so.
      window.setTimeout(() => { if (Math.abs(el.getBoundingClientRect().top - 16) > 24) go("auto"); }, 900);
      glow.removeAttribute("data-landed");
      void (glow as HTMLElement).offsetWidth;
      glow.setAttribute("data-landed", "");
      window.setTimeout(() => glow.removeAttribute("data-landed"), 1800);
    });
  }, 100);
  return () => window.clearInterval(timer);
}

/** Lands on the address's part on arrival, and on links to a part of the
    page already open. */
export function useLanding() {
  const path = usePathname();
  useEffect(() => {
    let stop = land();
    const again = () => { stop(); stop = land(); };
    // A link to this same page changes only the address's part, which the
    // router does without a hashchange.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href*='#']") as HTMLAnchorElement | null;
      if (a && new URL(a.href).pathname === window.location.pathname) window.setTimeout(again, 60);
    };
    window.addEventListener("hashchange", again);
    document.addEventListener("click", onClick);
    return () => { stop(); window.removeEventListener("hashchange", again); document.removeEventListener("click", onClick); };
  }, [path]);
}

/** Runs `fn` when a link lands on `id` (or, ending in "*", any id it starts). */
export function useLandedOn(id: string, fn: (landed: string) => void) {
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<string>).detail;
      if (id.endsWith("*") ? d.startsWith(id.slice(0, -1)) : d === id) fn(d);
    };
    window.addEventListener(LAND_EVENT, on);
    return () => window.removeEventListener(LAND_EVENT, on);
  }, [id, fn]);
}
