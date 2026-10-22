"use client";

/* Whether the tools' sidebar is shown or hidden: shown until it's hidden,
   then remembered in this browser (lib/storage.ts), like the theme and the
   tool list's view. Not synced to an account: it's a per-device choice.

   The page shows the remembered state from its first paint: TOOL_RAIL_SCRIPT
   (lib/tool-rail-script.ts, inlined in <head>) sets html[data-tool-rail]
   before anything is drawn, and the stylesheet folds the sidebar from it
   (styles/01-masthead-layout.css). */
import { useSyncExternalStore } from "react";
import { readStored, writeStored } from "./storage";
import { TOOL_RAIL_ATTR as ATTR, TOOL_RAIL_KEY as KEY, TOOL_RAIL_VERSION as VERSION } from "./tool-rail-script";

export function readRailHidden(): boolean {
  return readStored<string>(KEY, VERSION) === "hidden";
}

function apply(hidden: boolean): void {
  if (hidden) document.documentElement.setAttribute(ATTR, "hidden");
  else document.documentElement.removeAttribute(ATTR);
}

const listeners = new Set<() => void>();

export function setRailHidden(hidden: boolean): void {
  writeStored(KEY, VERSION, hidden ? "hidden" : "shown");
  apply(hidden);
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  // Another tab hiding or showing it does the same here.
  const onStorage = (e: StorageEvent) => { if (e.key === `retcalc.${KEY}.v${VERSION}`) { apply(readRailHidden()); l(); } };
  addEventListener("storage", onStorage);
  return () => { listeners.delete(l); removeEventListener("storage", onStorage); };
}

/** Hidden or not. Shown while the page is built and hydrating (the page
    itself is already folded, from the inlined script). */
export function useRailHidden(): boolean {
  return useSyncExternalStore(subscribe, readRailHidden, () => false);
}
