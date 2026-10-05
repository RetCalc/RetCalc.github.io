"use client";

/* True once the page is running in the browser. Pages are pre-built ahead of
   time, so anything that depends on today's date or this browser renders
   blank on the server and fills in on arrival, rather than baking in the
   build day. */
import { useSyncExternalStore } from "react";

const noop = () => () => {};
export function useClient(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
