"use client";

/* Charts redraw with larger type and thicker lines below 640px wide, where
   the same 900-unit drawing would otherwise shrink to unreadable. */
import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 639.98px)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function useNarrow(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
