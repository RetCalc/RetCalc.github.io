"use client";

/* The panel docked at the bottom of a tool that walks you through it: the
   readiness guide's coach on a trip, and Tool Help. A title, a checklist
   (in parts, for a longer tour), the next thing left to do once folded, and
   a footer with the figure that matters and the way back. While it's open
   the page leaves room for it (body.gd-on, --gdh). From #gdCoach and
   #thCoach in src/page.html and gdCoachFill() in 31-guide-coach.js. */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useBusyState } from "@/lib/busy";
import { Html } from "@/components/ui/Html";

export interface CoachTask { h: string; ok?: boolean }

export function CoachPanel({ id, label, sub, title, min, onToggle, onClose, closeLabel, tasks, part, next, chip, foot, children }: {
  id: string; label: string; sub: string; title: string;
  min: boolean; onToggle: () => void; onClose: () => void; closeLabel: string;
  tasks?: CoachTask[];
  /** A tour in parts: which, of how many, its title, and moving between them. */
  part?: { i: number; titles: string[]; go: (d: number) => void; attr?: "data-cp" | "data-tp" };
  /** Shown folded: the next thing left to do, or the part you're on. */
  next?: string;
  chip: string;
  foot: React.ReactNode;
  /** In place of the checklist (stepped away from the tool, say). */
  children?: React.ReactNode;
}) {
  const el = useRef<HTMLDivElement>(null), body = useRef<HTMLDivElement>(null);
  // The page leaves room for the panel at its current height.
  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    const fit = () => document.body.style.setProperty("--gdh", node.offsetHeight + "px");
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(node);
    return () => ro.disconnect();
  });
  useEffect(() => {
    document.body.classList.add("gd-on");
    return () => document.body.classList.remove("gd-on");
  }, []);
  const tog = min ? "Show the steps" : "Hide the steps";
  return (
    <div className={"gd-coach" + (min ? " min" : "")} id={id} role="region" aria-label={label} ref={el}>
      <div className="gd-coach-h">
        <div className="t"><span>{sub}</span><b>{title}</b></div>
        <button type="button" className="gd-coach-ib gd-coach-tog" aria-expanded={!min} aria-label={tog} title={tog} onClick={onToggle}>
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button type="button" className="gd-coach-ib" aria-label={closeLabel} title={closeLabel} onClick={onClose}>
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
      </div>
      {next ? <Html className="gd-coach-next" html={next} /> : null}
      <div className="gd-coach-b" ref={body}>
        {children ?? (
          <>
            {part ? <div className="gd-cpage"><span>Part {part.i + 1} of {part.titles.length}</span><b>{part.titles[part.i]}</b></div> : null}
            <ol className="gd-steps">{(tasks || []).map((k, i) => <Html as="li" key={i} className={k.ok === true ? "ok" : k.ok === false ? "todo" : undefined} html={k.h} />)}</ol>
            {part ? (
              <div className="gd-cnav">
                <button type="button" className="btn mini" {...{ [part.attr || "data-cp"]: "-1" }} disabled={!part.i} onClick={() => { part.go(-1); body.current?.scrollTo(0, 0); }}><i className="arw back" aria-hidden="true"></i>Back</button>
                <span className="gd-cdots" aria-hidden="true">{part.titles.map((_, i) => <i key={i} className={i === part.i ? "on" : undefined}></i>)}</span>
                {part.i < part.titles.length - 1 ? <button type="button" className="btn mini primary" {...{ [part.attr || "data-cp"]: "1" }} onClick={() => { part.go(1); body.current?.scrollTo(0, 0); }}>
                  Next: {part.titles[part.i + 1]}<i className="arw" aria-hidden="true"></i></button> : null}
              </div>
            ) : null}
          </>
        )}
      </div>
      <div className="gd-coach-f">
        <Html className="gd-chip" html={chip} />
        {foot}
      </div>
    </div>
  );
}

/** Brings the part of the tool a tour part is about into view, clear of
    the tab rail at the top and the panel at the bottom. */
export function revealFor(sel: string) {
  const f = document.querySelector(sel);
  if (!f) return;
  // A Drawdown Simulator setting only shown in Advanced brings Advanced up.
  if (f.closest("#asideDD .ddadv")) (document.querySelector('#asideDD [data-ddin="adv"]:not(.on)') as HTMLButtonElement | null)?.click();
  const r = f.getBoundingClientRect(), rail = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--navh")) || 44) + 16;
  const panel = document.querySelector(".gd-coach") as HTMLElement | null;
  if (r.top < rail || r.bottom > window.innerHeight - (panel?.offsetHeight || 0) - 16) {
    let smooth = true;
    try { smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* old browsers */ }
    window.scrollBy({ top: r.top - rail, behavior: smooth ? "smooth" : "auto" });
  }
}

/** A panel reading a tool from outside draws again shortly after anything
    on the page is touched, once more after any headline figure has counted
    to itself, and again whenever work the page was doing in the background
    lands. */
export function useRereads(on: boolean) {
  const [, tick] = useState(0);
  const busy = useBusyState();
  useEffect(() => {
    if (!on) return;
    let t1: ReturnType<typeof setTimeout>, t2: ReturnType<typeof setTimeout>;
    const later = (e?: Event) => {
      if ((e?.target as Element | null)?.closest?.(".gd-coach")) return;
      clearTimeout(t1); clearTimeout(t2);
      t1 = setTimeout(() => tick((n) => n + 1), 120);
      t2 = setTimeout(() => tick((n) => n + 1), 400);
    };
    const opts = { capture: true };
    ["input", "change", "click"].forEach((k) => document.addEventListener(k, later, opts));
    if (!busy) later();
    return () => { clearTimeout(t1); clearTimeout(t2); ["input", "change", "click"].forEach((k) => document.removeEventListener(k, later, opts)); };
  }, [on, busy]);
}

/** On a phone, the open panel and the keyboard together would bury the
    field being typed in, so starting to type in the tool folds it down. */
export function useFoldOnType(active: boolean, folded: () => boolean, fold: () => void) {
  const latest = useRef({ folded, fold });
  useEffect(() => {
    latest.current = { folded, fold };
  });
  useEffect(() => {
    if (!active) return;
    const onFocus = (e: FocusEvent) => {
      const el = e.target as Element;
      if (latest.current.folded() || !el.matches?.("input,select,textarea") || el.closest(".gd-coach") || !window.matchMedia("(max-width:640px)").matches) return;
      latest.current.fold();
    };
    document.addEventListener("focusin", onFocus);
    return () => document.removeEventListener("focusin", onFocus);
  }, [active]);
}

