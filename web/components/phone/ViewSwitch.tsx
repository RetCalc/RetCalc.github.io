"use client";

/* A tool's two views on a phone (under 768px): Inputs and Results, one tap
   apart, so nobody scrolls past a long form to see what it means. A tool
   marks its blocks:

     data-pv="in"    shown in the Inputs view only (the inputs column, with
                     the pinned answer above it)
     data-pv="out"   shown in the Results view only (every result card,
                     chart and table)

   Anything unmarked shows in both (the tool's header, its article). The
   switch floats above the bottom tab bar, within a thumb's reach, and sets
   body[data-pv]; styles/phone/10-calc.css hides the other view's blocks.
   Both views stay mounted, so nothing typed, opened or scrolled is lost,
   and each view remembers how far down it was.

   On a tablet or desktop there is no switch (phone:hidden), the attributes
   mean nothing, and the page lays out exactly as before. A page shows it
   by rendering <PhoneViewSwitch />: every tool's page through PageShell,
   and a tool opened inside the Dashboard through its host. */

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { isPhone } from "./usePhone";

export type PhoneView = "in" | "out";
const VIEW_EVENT = "retcalc:phone-view";

/** Shows a view from anywhere (a "See results" button, a warning that
    points at an input). Does nothing on wider screens. */
export function showPhoneView(view: PhoneView) {
  if (isPhone()) window.dispatchEvent(new CustomEvent<PhoneView>(VIEW_EVENT, { detail: view }));
}

export function PhoneViewSwitch({ inLabel = "Inputs", outLabel = "Results" }: { inLabel?: string; outLabel?: string }) {
  const path = usePathname();
  const [view, setView] = useState<PhoneView>("in");
  const anchor = useRef<HTMLSpanElement>(null);
  const scroll = useRef<Record<PhoneView, number | null>>({ in: null, out: null });

  // A shared link opens on what was shared: its results.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the address is only known in the browser
    if (isPhone() && /^#[sg]=/.test(window.location.hash)) setView("out");
  }, []);
  // A new page starts on its inputs.
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) { setLastPath(path); setView("in"); }
  useEffect(() => { scroll.current = { in: null, out: null }; }, [path]);

  const shown = useRef(view);
  useEffect(() => {
    shown.current = view;
    document.body.setAttribute("data-pv", view);
    return () => document.body.removeAttribute("data-pv");
  }, [view]);

  const go = useCallback((next: PhoneView) => {
    const cur = shown.current;
    if (cur === next) return;
    scroll.current[cur] = window.scrollY;
    // Where the tool's own content starts, under the pinned bars.
    const top = anchor.current ? anchor.current.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 60) : 0;
    const y = scroll.current[next] ?? Math.min(window.scrollY, Math.max(0, top));
    setView(next);
    // After the views have swapped (the page's height changes with them).
    requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "instant" }));
  }, []);

  useEffect(() => {
    const on = (e: Event) => go((e as CustomEvent<PhoneView>).detail);
    window.addEventListener(VIEW_EVENT, on);
    return () => window.removeEventListener(VIEW_EVENT, on);
  }, [go]);

  return (
    <>
      <span ref={anchor} className="pv-anchor phone:hidden" aria-hidden="true" />
      <div className="pv-switch phone:hidden">
        <Segmented size="fill" role="group" aria-label="Show inputs or results">
          <SegmentedItem pressed={view === "in"} onClick={() => go("in")}>{inLabel}</SegmentedItem>
          <SegmentedItem pressed={view === "out"} onClick={() => go("out")}>{outLabel}</SegmentedItem>
        </Segmented>
      </div>
    </>
  );
}
