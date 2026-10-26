"use client";

/* Which lessons have been read, and when: stored under retcalc.learn.v1 and
   synced to the account when signed in (lib/storage.ts), so progress follows
   the reader between devices. A lesson counts as read once its "In short"
   comes into view (LessonPage), and can be marked unread again. */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { readStored, writeStored } from "@/lib/storage";
import { SYNCED_EVENT } from "@/lib/sync/engine";

export interface LearnData { read: Record<string, string> }
const KEY = "learn", VERSION = 1;
const EMPTY: LearnData = { read: {} };

let current: LearnData | null = null;
const listeners = new Set<() => void>();
const load = (): LearnData => readStored<LearnData>(KEY, VERSION) ?? EMPTY;
const get = () => (current ??= load());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
function save(d: LearnData) {
  current = d;
  writeStored(KEY, VERSION, d);
  listeners.forEach((l) => l());
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function useLearn() {
  const data = useSyncExternalStore(subscribe, get, () => EMPTY);
  useEffect(() => {
    const on = (e: Event) => {
      if ((e as CustomEvent<string[]>).detail?.includes(KEY)) { current = load(); listeners.forEach((l) => l()); }
    };
    window.addEventListener(SYNCED_EVENT, on);
    return () => window.removeEventListener(SYNCED_EVENT, on);
  }, []);
  const markRead = useCallback((slug: string) => { if (!get().read[slug]) save({ read: { ...get().read, [slug]: today() } }); }, []);
  const markUnread = useCallback((slug: string) => {
    const read = { ...get().read };
    delete read[slug];
    save({ read });
  }, []);
  return { read: data.read, markRead, markUnread };
}
