"use client";

/* Tool Help's panel: the guide's coach on its own, walking through the
   open tool in parts. Loaded when help opens. From thOpen() and thFill()
   in src/js/app/32-tool-help.js. */

import { useEffect } from "react";
import { CoachPanel, revealFor, useFoldOnType, useRereads } from "@/components/shell/CoachPanel";
import { useActiveTool, useScopedState } from "@/components/tools/ToolState";
import { extraTour, helpNow, setHelp, type Help } from "./state";
import { TOURS, type Tour } from "./tours";

export default function HelpPanel({ h }: { h: Help }) {
  // The open tool's inputs: the page's tool, or one inside the Dashboard.
  const page = useActiveTool(), inScope = useScopedState(h.tool);
  const state = page?.state ?? inScope;
  const T = TOURS[h.tool] ?? (extraTour(h.tool) as Tour), P = T.pages, pi = Math.max(0, Math.min(P.length - 1, h.page));
  // What the tour reads: the inputs of the open tool, or what its page gives (`read`).
  const now = () => (T.read ? T.read() : state ?? {});
  // On opening: what the tool looks like now, and the first part's view.
  useEffect(() => {
    if (h.base) return;
    let base: Record<string, unknown> = {};
    try { base = T.start ? T.start({ s: T.read ? T.read() : state ?? {} }) : {}; } catch { /* starts plain */ }
    setHelp({ ...h, base });
    P[0].show?.();
    setTimeout(() => revealFor(P[0].focus), 0);
  }, [h, T, P, state]);
  useRereads(true);
  useFoldOnType(true, () => !!helpNow()?.min, () => { const x = helpNow(); if (x) setHelp({ ...x, min: true }); });
  // Escape closes it.
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) setHelp(null); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, []);
  const c = { s: now(), base: h.base ?? {} };
  let tasks: { h: string; ok?: boolean }[] = [], chip = "";
  // Help only ticks: a nudge is the guide's.
  try { tasks = P[pi].tasks(c).map((t) => ({ h: t.h, ok: t.ok === true ? true : undefined })); } catch { tasks = []; }
  try { chip = T.chip(c) || ""; } catch { chip = ""; }
  return (
    <CoachPanel id="thCoach" label="Tool help" sub={"Help · " + T.name} title={T.title} min={h.min}
      onToggle={() => setHelp({ ...h, min: !h.min })} onClose={() => setHelp(null)} closeLabel="Close help"
      tasks={tasks}
      part={{ i: pi, titles: P.map((p) => p.title), attr: "data-tp", focus: P[pi].focus, done: { id: "thCoachDone", onClick: () => setHelp(null) }, go: (d) => {
        const n = Math.max(0, Math.min(P.length - 1, pi + d));
        setHelp({ ...h, page: n });
        P[n].show?.();
        setTimeout(() => revealFor(P[n].focus), 0);
      } }}
      chip={chip} foot={null} />
  );
}
