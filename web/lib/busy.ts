"use client";

/* Whether the page is still working something out: a job in a worker, or
   a deferred redraw behind the typing. While anything is, <html> carries
   data-busy, and anything that reads the page from outside (the guide's
   coach, Tool Help, the tests) can wait for it to clear. */

import { useEffect, useSyncExternalStore } from "react";

let count = 0;
const listeners = new Set<() => void>();
function change(d: number) {
  count = Math.max(0, count + d);
  if (count) document.documentElement.dataset.busy = "1";
  else delete document.documentElement.dataset.busy;
  listeners.forEach((l) => l());
}
export const busyStart = () => change(1);
export const busyEnd = () => change(-1);

/** Marks the page busy while `on`. */
export function useBusy(on: boolean) {
  useEffect(() => {
    if (!on) return;
    busyStart();
    return busyEnd;
  }, [on]);
}

/** Whether the page is busy now; a component that reads the page uses it
    to read again once the work is done. */
export function useBusyState(): boolean {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => count > 0, () => false);
}
