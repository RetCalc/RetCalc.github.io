"use client";

/* Whether there's a release you haven't seen: About is marked New until
   it's opened since the current version. Kept in this browser only, a
   convenience; if it can't be read, nothing is marked. */

import { useEffect, useState } from "react";
import { CURRENT } from "./releases";

const KEY = "retcalc.seenRelease", EVENT = "retcalc:seen-release";

function seen(): string | null | undefined {
  try { return localStorage.getItem(KEY); } catch { return undefined; }
}

/** Marks the current release seen (About calls it as it opens). */
export function markReleaseSeen() {
  try { localStorage.setItem(KEY, CURRENT.version); } catch { return; }
  window.dispatchEvent(new Event(EVENT));
}

/** Whether the current release is still unseen in this browser: false until
    the page has read it, so the server's render and the first match. */
export function useNewRelease(): boolean {
  const [isNew, setNew] = useState(false);
  useEffect(() => {
    const read = () => { const s = seen(); setNew(s !== undefined && s !== CURRENT.version); };
    read();
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) read(); };
    window.addEventListener(EVENT, read);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener(EVENT, read); window.removeEventListener("storage", onStorage); };
  }, []);
  return isNew;
}
