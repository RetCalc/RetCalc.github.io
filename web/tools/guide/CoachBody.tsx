"use client";

/* The guide's coach, docked over a tool on a trip (loaded only then, by
   Coach.tsx): what to do there,
   ticked off as the tool's own fields change, the figure the guide will
   bring back, and Back to guide. It reads the tool while it's open, so
   whichever way you leave, the guide has the last reading. From
   gdCoachSync() and gdCoachFill() in src/js/app/31-guide-coach.js. */

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CoachPanel, revealFor, useFoldOnType, useRereads } from "@/components/shell/CoachPanel";
import { useToast } from "@/components/shell/Toast";
import { useActiveTool } from "@/components/tools/ToolState";
import { prefill, tripBoot } from "./actions";
import { numbered, stepById } from "./route";
import { guide, setGuide, useGuide, type Trip } from "./store";
import { TRIP_META } from "./tripMeta";
import { trip as tripDef, type Task } from "./trips";
import { setNavDir } from "@/lib/nav-motion";
import { Button } from "@/components/ui/button";

export default function CoachBody() {
  const g = useGuide(), path = usePathname(), router = useRouter(), toast = useToast(), active = useActiveTool();
  const t = g.trip, meta = t ? TRIP_META[t.id] : null;
  const showing = !!t && !!meta;
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

  useFoldOnType(showing, () => guide().coachMin, () => setGuide((x) => { x.coachMin = true; }));

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
  const from = stepById(t.from), L = numbered(g.a, g.pace), i = from ? L.indexOf(from) : -1;
  const nextTask = tasks.find((k) => k.ok === false);
  return (
    <CoachPanel id="gdCoach" label="Guide step" sub={"Guide" + (i >= 0 ? " · step " + (i + 1) + " of " + L.length : "")} title={meta.title}
      min={g.coachMin} onToggle={() => setGuide((x) => { x.coachMin = !x.coachMin; })} closeLabel="Close the guide panel"
      onClose={() => {
        setGuide((x) => { x.trip = null; });
        toast("Guide closed. It's saved under the Guide tab whenever you want to pick it back up.");
      }}
      tasks={tasks} next={here && nextTask ? "<span>Next</span>" + nextTask.h.replace(/<em>.*?<\/em>/g, "") : undefined}
      part={here && pages && meta.pages ? { i: pi, titles: meta.pages.map((p) => p.title), focus: meta.pages[pi]?.focus, go: (d) => {
        const n = Math.max(0, Math.min(pages - 1, pi + d));
        setGuide((x) => { if (x.trip) x.trip.page = n; });
        setTimeout(() => revealFor(meta.pages![n].focus), 0);
      } } : undefined}
      chip={chip || (here ? "When you're done here:" : "")}
      foot={<Button className="flex-none" id="gdCoachBack" onClick={() => { setNavDir("back"); router.push("/guide"); }}>Back to guide</Button>}>
      {here ? undefined : (
        <>
          <p>You&apos;ve stepped away from the {meta.name}. Head back to finish this step, or return to the guide.</p>
          <p><Button variant="outline" size="sm" id="gdCoachGo" onClick={() => { setNavDir("fwd"); router.push(meta.path); }}>Open {meta.name}</Button></p>
        </>
      )}
    </CoachPanel>
  );
}
