"use client";

/* Which tool's help is open, on which page, at which part: kept small so
   every tool page can carry the Help button without the tours themselves
   (HelpPanel.tsx loads them when help opens). */

import { useSyncExternalStore } from "react";

export interface Help {
  tool: string; path: string; page: number; min: boolean;
  /** What the tool looked like when help opened; read once the panel is up. */
  base: Record<string, unknown> | null;
}
/** The tools with a tour. */
export const TOUR_TOOLS = new Set(["tax", "mortgage", "budget", "college", "rentbuy", "drawdown", "roth", "debt", "backtest", "healthcare", "fire", "bridge", "social", "optimizer"]);

/* Tours a page brings with it (the Dashboard's tabs), registered when its
   code loads, so the site's own pages never load them. Typed loosely here;
   tours.ts has the shape. */
const extra: Record<string, unknown> = {};
export function registerTours(t: Record<string, unknown>) { Object.assign(extra, t); }
export const extraTour = (id: string) => extra[id];
/** Whether there's a tour for this id, the site's or a page's. */
export const hasTour = (id: string) => TOUR_TOOLS.has(id) || id in extra;

let help: Help | null = null;
const listeners = new Set<() => void>();
export const helpNow = () => help;
export function setHelp(h: Help | null) {
  help = h;
  listeners.forEach((l) => l());
}
export function useHelp(): Help | null {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => help, () => null);
}
/** Opens a tool's help, or closes it if it's the one open. */
export function toggleHelp(tool: string) {
  if (help?.tool === tool) setHelp(null);
  else if (hasTour(tool)) setHelp({ tool, path: window.location.pathname, page: 0, min: false, base: null });
}
