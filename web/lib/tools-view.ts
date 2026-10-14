"use client";

/* Which way the tool list (/tools) is shown: as chart cards, or as compact
   tiles that fit one screen. Remembered in this browser (lib/storage.ts),
   so coming back to the list finds it as it was left. Not synced to an
   account: it's a per-device choice, like the theme.

   The page shows the remembered view from its first paint: TOOLS_VIEW_SCRIPT
   (lib/tools-view-script.ts, inlined above the list) sets html[data-tools-view]
   before the cards are drawn, and the stylesheet shows one view or the other
   from it (styles/18-tool-picker.css). */
import { useSyncExternalStore } from "react";
import { readStored, writeStored } from "./storage";
import { TOOLS_VIEW_ATTR as ATTR, TOOLS_VIEW_KEY as KEY, TOOLS_VIEW_VERSION as VERSION } from "./tools-view-script";

export type ToolsView = "charts" | "compact";

export function readToolsView(): ToolsView {
  return readStored<string>(KEY, VERSION) === "compact" ? "compact" : "charts";
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
  return () => { listeners.delete(l); removeEventListener("storage", onStorage); };
}

/** The remembered view. Charts while the page is built and hydrating (the
    page itself already shows the right one, from the inlined script). */
export function useToolsView(): ToolsView {
  return useSyncExternalStore(subscribe, readToolsView, () => "charts");
}
