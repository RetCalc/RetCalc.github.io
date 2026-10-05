"use client";

/* A small choice remembered on this device (localStorage), read without a
   flash: pages are pre-built, so the server and the first paint use the
   fallback and the stored value follows. Used for the Drawdown Simulator's
   Simple / Advanced inputs and its first-visit note. */
import { useCallback, useSyncExternalStore } from "react";

const EVENT = "retcalc-stored-text";
// for this visit, where the browser won't keep it
const memory = new Map<string, string>();

function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? fallback;
  } catch {
    return memory.get(key) ?? fallback;
  }
}

/** `onServer`: what the pre-built page shows before this browser's value is
    read, when that should differ from the fallback. */
export function useStoredText(key: string, fallback: string, onServer = fallback): [string, (v: string) => void] {
  const subscribe = useCallback((fn: () => void) => {
    window.addEventListener(EVENT, fn);
    return () => window.removeEventListener(EVENT, fn);
  }, []);
  const value = useSyncExternalStore(subscribe, () => read(key, fallback), () => onServer);
  const set = useCallback((v: string) => {
    memory.set(key, v);
    try {
      localStorage.setItem(key, v);
    } catch { /* not kept, but still shown */ }
    window.dispatchEvent(new Event(EVENT));
  }, [key]);
  return [value, set];
}
