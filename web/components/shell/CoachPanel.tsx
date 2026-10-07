"use client";

/* The panel that walks you through a tool: the readiness guide's coach on
   a trip, and Tool Help. The part's title, what it's about, a checklist
   (in parts, for a longer tour, with a progress row to jump between them),
   the next thing left to do once folded, and a footer with the way between
   parts, the figure that matters and the way back. While it's open the
   page leaves room for it: below the panel (body.gd-on, --gdh), or beside
   it where it docks as a sidecar on a wide screen (body.gd-on, --gdw).
   The section the part is about carries an outline (data-coach-mark) while
   the part is open. From #gdCoach and #thCoach in src/page.html and
   gdCoachFill() in 31-guide-coach.js. */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { useBusyState } from "@/lib/busy";
import { Html } from "@/components/common/Html";
import { Button } from "@/components/ui/button";

export interface CoachTask { h: string; ok?: boolean }

/** Wide enough to dock beside the page instead of over it. */
const SIDECAR = "(min-width:1400px)";

/* What a part is about, outlined: a field with its label, a figure with
   its label and note, a table with its scroll box, a section as itself. */
function markTarget(sel: string): Element | null {
  const f = document.querySelector(sel);
  if (!f) return null;
  if (f.matches("input,select,textarea,.seg")) return f.closest(".field") ?? f.parentElement;
  if (f.matches("table")) return f.closest(".scroll") ?? f;
  const r = f.getBoundingClientRect();
  return r.height && r.height < 64 && f.parentElement ? f.parentElement : f;
}
function clearMarks() {
  document.querySelectorAll("[data-coach-mark]").forEach((n) => n.removeAttribute("data-coach-mark"));
}
function useMark(sel: string | undefined) {
  useEffect(() => {
    if (!sel) return;
    // A part about another view brings that view up first; it lands a beat later.
    const put = () => { clearMarks(); markTarget(sel)?.setAttribute("data-coach-mark", ""); };
    put();
    const t = setTimeout(put, 350);
    return () => { clearTimeout(t); clearMarks(); };
  }, [sel]);
}

export function CoachPanel({ id, label, sub, title, min, onToggle, onClose, closeLabel, tasks, part, next, chip, foot, children }: {
  id: string; label: string; sub: string; title: string;
  min: boolean; onToggle: () => void; onClose: () => void; closeLabel: string;
  tasks?: CoachTask[];
  /** A tour in parts: which, of how many, their titles, moving between them,
      the section each is about, and (Tool Help) a last part that finishes. */
  part?: { i: number; titles: string[]; go: (d: number) => void; attr?: "data-cp" | "data-tp"; focus?: string; done?: { id: string; onClick: () => void } };
  /** Shown folded: the next thing left to do. */
  next?: string;
  chip: string;
  foot: React.ReactNode;
  /** In place of the checklist (stepped away from the tool, say). */
  children?: React.ReactNode;
}) {
  const el = useRef<HTMLDivElement>(null), body = useRef<HTMLDivElement>(null);
  // The page leaves room for the panel: its height under the page, or its
  // width beside it once it docks as a sidecar.
  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    const mq = window.matchMedia(SIDECAR);
    const fit = () => {
      const side = mq.matches;
      document.body.style.setProperty("--gdh", side ? "0px" : node.offsetHeight + "px");
      document.body.style.setProperty("--gdw", side ? node.offsetWidth + "px" : "0px");
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(node);
    mq.addEventListener("change", fit);
    return () => { ro.disconnect(); mq.removeEventListener("change", fit); };
  });
  useEffect(() => {
    document.body.classList.add("gd-on");
    return () => { document.body.classList.remove("gd-on"); document.body.style.removeProperty("--gdw"); };
  }, []);
  useMark(part && !children ? part.focus : undefined);
  const tog = min ? "Show the steps" : "Hide the steps";
  const attr = part?.attr || "data-cp";
  const go = (d: number) => { part!.go(d); body.current?.scrollTo(0, 0); };
  const last = !!part && part.i >= part.titles.length - 1;
  const parts = part && !children;
  return (
    <div className={"gd-coach" + (min ? " min" : "")} id={id} role="region" aria-label={label} ref={el}>
      <div className="gd-coach-h">
        <div className="min-w-0 flex-auto">
          <h2 className="m-0 text-body leading-snug font-semibold text-foreground">{parts ? part.titles[part.i] : title}</h2>
          <p className="m-0 mt-0.5 text-label text-muted-foreground">{sub}{parts ? <span className="tabular-nums"> · Part {part.i + 1} of {part.titles.length}</span> : null}</p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-expanded={!min} aria-label={tog} title={tog} onClick={onToggle}>
          <ChevronDown aria-hidden="true" className={min ? "rotate-180 transition-transform duration-200 motion-reduce:transition-none" : "transition-transform duration-200 motion-reduce:transition-none"} />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={closeLabel} title={closeLabel} onClick={onClose}><X aria-hidden="true" /></Button>
      </div>
      {parts && !min ? (
        <div className="gd-cprog" role="group" aria-label="Parts">
          {part.titles.map((t, i) => (
            <button key={i} type="button" aria-label={"Part " + (i + 1) + " of " + part.titles.length + ": " + t} title={t}
              aria-current={i === part.i ? "step" : undefined} onClick={() => { if (i !== part.i) go(i - part.i); }}><i aria-hidden="true"></i></button>
          ))}
        </div>
      ) : null}
      {next ? <Html className="gd-coach-next" html={next} /> : null}
      <div className="gd-coach-b" ref={body}>
        {children ?? <ol className="gd-steps">{(tasks || []).map((k, i) => <Html as="li" key={i} className={k.ok === true ? "ok" : k.ok === false ? "todo" : undefined} html={k.h} />)}</ol>}
      </div>
      <div className="gd-coach-f">
        {parts ? (
          <div className="gd-cnav">
            <Button variant="outline" size="sm" className="flex-none" {...{ [attr]: "-1" }} disabled={!part.i} onClick={() => go(-1)}><i className="arw back" aria-hidden="true"></i>Back</Button>
            {!last ? (
              <Button variant={foot ? "outline" : "default"} size="sm" className="ml-auto min-w-0 shrink" {...{ [attr]: "1" }} onClick={() => go(1)}>
                <span className="truncate">Next: {part.titles[part.i + 1]}</span><i className="arw" aria-hidden="true"></i></Button>
            ) : part.done ? (
              <Button size="sm" className="ml-auto" id={part.done.id} onClick={part.done.onClick}>Done</Button>
            ) : null}
          </div>
        ) : null}
        {chip || foot ? (
          <div className="gd-coach-fr">
            <Html className="gd-chip" html={chip} />
            {foot}
          </div>
        ) : null}
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
  const below = panel && !window.matchMedia(SIDECAR).matches ? panel.offsetHeight : 0;
  if (r.top < rail || r.bottom > window.innerHeight - below - 16) {
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

