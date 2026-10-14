"use client";

/* Which way the tool list (/tools) is shown: as chart cards, or as compact
   tiles that fit one screen. Compact on a phone and charts on a wider
   screen until the switch is used; then remembered in this browser
   (lib/storage.ts), so coming back to the list finds it as it was left. Not synced to an
   account: it's a per-device choice, like the theme.

   The page shows the remembered view from its first paint: TOOLS_VIEW_SCRIPT
   (lib/tools-view-script.ts, inlined above the list) sets html[data-tools-view]
   before the cards are drawn, and the stylesheet shows one view or the other
   from it (styles/18-tool-picker.css). */
import { useSyncExternalStore } from "react";
import { readStored, writeStored } from "./storage";
import { TOOLS_VIEW_ATTR as ATTR, TOOLS_VIEW_KEY as KEY, TOOLS_VIEW_PHONE as PHONE, TOOLS_VIEW_VERSION as VERSION } from "./tools-view-script";

export type ToolsView = "charts" | "compact";

/** The view chosen with the switch; with none chosen yet, compact on a
    phone and charts on anything wider (a phone's narrow column suits the
    tiles; the charts reward a wide screen). */
export function readToolsView(): ToolsView {
  const v = readStored<string>(KEY, VERSION);
  if (v === "compact" || v === "charts") return v;
  return matchMedia(PHONE).matches ? "compact" : "charts";
}

/** Puts the remembered view on <html>, for a visit that arrives by a link
    inside the site, where the inlined script doesn't run. */
export function applyToolsView(view: ToolsView = readToolsView()): void {
  document.documentElement.setAttribute(ATTR, view);
}

const listeners = new Set<() => void>();

export function setToolsView(view: ToolsView): void {
  writeStored(KEY, VERSION, view);
  applyToolsView(view);
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  // Another tab changing it changes it here too.
  const onStorage = (e: StorageEvent) => { if (e.key === `retcalc.${KEY}.v${VERSION}`) { applyToolsView(); l(); } };
  addEventListener("storage", onStorage);
  // With nothing chosen, the default follows the window across the phone width.
  const mq = matchMedia(PHONE), onWidth = () => { applyToolsView(); l(); };
  mq.addEventListener("change", onWidth);
  return () => { listeners.delete(l); removeEventListener("storage", onStorage); mq.removeEventListener("change", onWidth); };
}

/** The view to show. Charts while the page is built and hydrating (the
    page itself already shows the right one, from the inlined script). */
export function useToolsView(): ToolsView {
  return useSyncExternalStore(subscribe, readToolsView, () => "charts");
}
