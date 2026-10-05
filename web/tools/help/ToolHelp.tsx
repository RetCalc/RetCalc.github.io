"use client";

/* Tool Help: the Help button in a tool's header, and the panel it opens,
   the guide's coach on its own. Opening it steps the guide's panel aside
   until it closes; leaving the tool closes it. From thOpen(), thFill() and
   thClose() in src/js/app/32-tool-help.js. */

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { CoachPanel, revealFor } from "@/components/shell/CoachPanel";
import { useActiveTool } from "@/components/tools/ToolState";
import { TOURS } from "./tours";

interface Help { tool: string; path: string; page: number; min: boolean; base: Record<string, unknown> }
let help: Help | null = null;
const listeners = new Set<() => void>();
function setHelp(h: Help | null) {
  help = h;
  listeners.forEach((l) => l());
}
export function useHelp(): Help | null {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => help, () => null);
}

/** Opens a tool's help (or closes it, if it's the one open). */
export function toggleHelp(tool: string, s: Record<string, unknown>) {
  if (help?.tool === tool) { setHelp(null); return; }
  const T = TOURS[tool];
  if (!T) return;
  let base: Record<string, unknown> = {};
  try { base = T.start ? T.start({ s }) : {}; } catch { /* starts plain */ }
  setHelp({ tool, path: window.location.pathname, page: 0, min: false, base });
  T.pages[0].show?.();
  setTimeout(() => revealFor(T.pages[0].focus), 0);
}

/** The Help button, on a tool that has a tour. */
export function HelpButton({ tool }: { tool: string }) {
  const h = useHelp(), active = useActiveTool();
  if (!TOURS[tool]) return null;
  return (
    <button type="button" className="btn toolhelp" id="toolHelpBtn" aria-controls="thCoach" aria-expanded={h?.tool === tool}
      onClick={() => toggleHelp(tool, active?.state ?? {})}>
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.4" />
        <path d="M6.2 6.3a1.9 1.9 0 0 1 3.7.5c0 1.3-1.9 1.6-1.9 2.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><circle cx="8" cy="11.4" r=".85" fill="currentColor" /></svg>
      Help
    </button>
  );
}

/** The panel, while help is open on the tool it belongs to. */
export function ToolHelp() {
  const h = useHelp(), path = usePathname(), active = useActiveTool();
  const [, tick] = useState(0);
  // Help belongs to the tool it was opened on: leaving closes it.
  useEffect(() => {
    if (help && help.path !== path) setHelp(null);
  }, [path]);
  // It reads the tool again shortly after anything is touched, and once
  // more after any headline figure has counted to itself.
  useEffect(() => {
    if (!h) return;
    let t1: ReturnType<typeof setTimeout>, t2: ReturnType<typeof setTimeout>;
    const later = (e: Event) => {
      if ((e.target as Element | null)?.closest?.(".gd-coach")) return;
      clearTimeout(t1); clearTimeout(t2);
      t1 = setTimeout(() => tick((x) => x + 1), 120);
      t2 = setTimeout(() => tick((x) => x + 1), 400);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) setHelp(null); };
    // On a phone, starting to type in the tool folds the panel down.
    const fold = (e: FocusEvent) => {
      const el = e.target as Element;
      if (!help || help.min || !el.matches?.("input,select,textarea") || el.closest(".gd-coach") || !window.matchMedia("(max-width:640px)").matches) return;
      setHelp({ ...help, min: true });
    };
    const opts = { capture: true };
    ["input", "change", "click"].forEach((k) => document.addEventListener(k, later, opts));
    document.addEventListener("keydown", esc);
    document.addEventListener("focusin", fold);
    return () => {
      clearTimeout(t1); clearTimeout(t2);
      ["input", "change", "click"].forEach((k) => document.removeEventListener(k, later, opts));
      document.removeEventListener("keydown", esc);
      document.removeEventListener("focusin", fold);
    };
  }, [h]);
  if (!h || h.path !== path) return null;
  const T = TOURS[h.tool], P = T.pages, pi = Math.max(0, Math.min(P.length - 1, h.page));
  const c = { s: active?.state ?? {}, base: h.base };
  let tasks: { h: string; ok?: boolean }[] = [], chip = "";
  // Help only ticks: a nudge is the guide's.
  try { tasks = P[pi].tasks(c).map((t) => ({ h: t.h, ok: t.ok === true ? true : undefined })); } catch { tasks = []; }
  try { chip = T.chip(c) || ""; } catch { chip = ""; }
  return (
    <CoachPanel id="thCoach" label="Tool help" sub={"Help · " + T.name} title={T.title} min={h.min}
      onToggle={() => setHelp({ ...h, min: !h.min })} onClose={() => setHelp(null)} closeLabel="Close help"
      tasks={tasks} next={"<span>Part " + (pi + 1) + " of " + P.length + "</span>" + P[pi].title}
      part={{ i: pi, titles: P.map((p) => p.title), attr: "data-tp", go: (d) => {
        const n = Math.max(0, Math.min(P.length - 1, pi + d));
        setHelp({ ...h, page: n });
        P[n].show?.();
        setTimeout(() => revealFor(P[n].focus), 0);
      } }}
      chip={chip} foot={<button type="button" className="btn" id="thCoachDone" onClick={() => setHelp(null)}>Close help</button>} />
  );
}
