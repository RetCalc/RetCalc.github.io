"use client";

/* Whether the screen is a phone: narrower than 768px, the same cut-off as
   styles/phone/*.css and the max-phone: variant. False on the server and
   for the first render, so a page hydrates as it was pre-built; use CSS
   (phone:hidden, max-phone:...) for what must be right at first paint, and
   this only for behaviour (what a tap does, whether a sheet may open). */
import { useSyncExternalStore } from "react";

export const PHONE_QUERY = "(width < 768px)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function usePhone(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(PHONE_QUERY).matches, () => false);
}

/** The same check outside React (an event handler, an effect). */
export const isPhone = () => typeof window !== "undefined" && (window.matchMedia?.(PHONE_QUERY).matches ?? false);
