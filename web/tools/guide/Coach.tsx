"use client";

/* The guide's coach, docked over a tool on a trip: what to do there,
   ticked off as the tool's own fields change, the figure the guide will
   bring back, and Back to guide. It reads the tool while it's open, so
   whichever way you leave, the guide has the last reading. From
   gdCoachSync() and gdCoachFill() in src/js/app/31-guide-coach.js. */

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CoachPanel, revealFor } from "@/components/shell/CoachPanel";
import { useToast } from "@/components/shell/Toast";
import { useActiveTool } from "@/components/tools/ToolState";
import { useHelp } from "@/tools/help/ToolHelp";
import { prefill, tripBoot } from "./actions";
import { numbered, stepById } from "./steps";
import { guide, setGuide, useGuide, type Trip } from "./store";
import { TRIP_META } from "./tripMeta";
import { trip as tripDef, type Task } from "./trips";

/** Tools redraw on their own and their headline figures count up to
    themselves, so the coach reads them again shortly after anything is
    touched, and once more after the count has landed. */
function useRereads(on: boolean) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!on) return;
    let t1: ReturnType<typeof setTimeout>, t2: ReturnType<typeof setTimeout>;
    const later = (e: Event) => {
      if ((e.target as Element | null)?.closest?.(".gd-coach")) return;
      clearTimeout(t1); clearTimeout(t2);
      t1 = setTimeout(() => tick((n) => n + 1), 120);
      t2 = setTimeout(() => tick((n) => n + 1), 400);
    };
    const opts = { capture: true };
    ["input", "change", "click"].forEach((k) => document.addEventListener(k, later, opts));
    t1 = setTimeout(() => tick((n) => n + 1), 400);
    return () => { clearTimeout(t1); clearTimeout(t2); ["input", "change", "click"].forEach((k) => document.removeEventListener(k, later, opts)); };
  }, [on]);
}

export function GuideCoach() {
  const g = useGuide(), path = usePathname(), router = useRouter(), toast = useToast(), active = useActiveTool(), helping = !!useHelp();
  const t = g.trip, meta = t ? TRIP_META[t.id] : null;
  // Tool Help, while open, has the panel's place; the guide waits.
  const showing = !!t && !!meta && path !== "/guide" && !helping;
  const here = !!meta && path === meta.path && active?.def.id === meta.store;
  useRereads(showing && here);

  // A reload mid-trip clears what the tool held, so the page opening on
  // that tool gets the guide's numbers put back in.
  useEffect(() => {
    if (tripBoot.done || !t || !meta || !active || active.def.id !== meta.store) return;
    tripBoot.done = true;
    const nt: Trip = structuredClone(t);
    active.load(prefill(nt, g.a, active.state));
    setGuide((x) => { x.trip = nt; });
  }, [t, meta, active, g.a]);

  // On a phone the open panel and the keyboard together would bury the
  // field being typed in, so starting to type in the tool folds it down.
  useEffect(() => {
    if (!showing) return;
    const fold = (e: FocusEvent) => {
      const el = e.target as Element;
      if (guide().coachMin || !el.matches?.("input,select,textarea") || el.closest(".gd-coach") || !window.matchMedia("(max-width:640px)").matches) return;
      setGuide((x) => { x.coachMin = true; });
    };
    document.addEventListener("focusin", fold);
    return () => document.removeEventListener("focusin", fold);
  }, [showing]);

  // What the tool says now: the checklist, the figure, and what coming back
  // would bring, kept with the trip.
  let tasks: Task[] = [], chip = "", pages = 0, pi = 0;
  const T = t ? tripDef(t.id) : undefined;
  let reading: { trip: Trip } | null = null;
  if (showing && here && T && t && active) {
    const nt: Trip = structuredClone(t), c = { a: g.a, s: active.state, trip: nt };
    pages = T.pages?.length ?? 0;
    pi = pages ? Math.max(0, Math.min(pages - 1, nt.page || 0)) : 0;
    try { tasks = T.pages ? T.pages[pi](c) : T.tasks ? T.tasks(c) : []; } catch { tasks = []; }
    try { chip = T.chip(c) || ""; } catch { chip = ""; }
    try { nt.pending = T.capture(c); } catch { /* keeps the last reading */ }
    reading = { trip: nt };
  }
  const changed = reading && JSON.stringify(reading.trip) !== JSON.stringify(t);
  useEffect(() => {
    if (changed && reading) setGuide((x) => { if (x.trip?.id === reading!.trip.id) x.trip = reading!.trip; });
  });

  if (!showing || !t || !meta) return null;
  const from = stepById(t.from), L = numbered(g.a), i = from ? L.indexOf(from) : -1;
  const nextTask = tasks.find((k) => k.ok === false);
  return (
    <CoachPanel id="gdCoach" label="Guide step" sub={"Guide" + (i >= 0 ? " · step " + (i + 1) + " of " + L.length : "")} title={meta.title}
      min={g.coachMin} onToggle={() => setGuide((x) => { x.coachMin = !x.coachMin; })} closeLabel="Close the guide panel"
      onClose={() => {
        setGuide((x) => { x.trip = null; });
        toast("Guide closed. It's saved under the Guide tab whenever you want to pick it back up.");
      }}
      tasks={tasks} next={here && nextTask ? "<span>Next</span>" + nextTask.h.replace(/<em>.*?<\/em>/g, "") : undefined}
      part={here && pages && meta.pages ? { i: pi, titles: meta.pages.map((p) => p.title), go: (d) => {
        const n = Math.max(0, Math.min(pages - 1, pi + d));
        setGuide((x) => { if (x.trip) x.trip.page = n; });
        setTimeout(() => revealFor(meta.pages![n].focus), 0);
      } } : undefined}
      chip={chip || (here ? "When you're done here:" : "")}
      foot={<button type="button" className="btn primary" id="gdCoachBack" onClick={() => router.push("/guide")}>Back to guide</button>}>
      {here ? undefined : (
        <>
          <p>You&apos;ve stepped away from the {meta.name}. Head back to finish this step, or return to the guide.</p>
          <p><button type="button" className="btn mini" id="gdCoachGo" onClick={() => router.push(meta.path)}>Open {meta.name}</button></p>
        </>
      )}
    </CoachPanel>
  );
}
