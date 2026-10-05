"use client";

/* The Monte Carlo seed every simulation shares, so a chart stays put while
   you talk about it; Re-roll moves it on for all of them. From mcSeed and
   reroll() in src/js/app/04-charts.js and 09-navigation.js. */
import { useSyncExternalStore } from "react";

let seed = 20260902;
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function reroll(): void {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  listeners.forEach((fn) => fn());
}

/** The seed now, outside a component (the guide's coach reading a tool). */
export const mcSeed = () => seed;

export function useMcSeed(): number {
  return useSyncExternalStore(subscribe, () => seed, () => seed);
}

/** Simulations per redraw. */
export const MC_RUNS = 5000;
