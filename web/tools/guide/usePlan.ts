"use client";

/* A plan job's answer for the page (planClient.ts): the answer for these
   inputs if it's already kept, else the last answer while the worker works
   on the new one, marked stale, so a readout shows its last value with a
   quiet "updating" until the new one lands. A card never waits on it. */

import { useEffect, useState } from "react";
import { ask, peek, planKey, Superseded } from "./planClient";
import type { JobArgs, JobKind } from "./planJobs";
import type { Answers } from "./store";

export interface Plan<T> {
  /** The answer, or the last one while a newer is on its way; undefined
      until the first lands. null when the answers don't make a plan. */
  res: T | null | undefined;
  /** A newer answer is on its way. */
  stale: boolean;
}

export function usePlanJob<T>(kind: JobKind, a: Answers | null, opts: { args?: JobArgs; slot?: string; prio?: number } = {}): Plan<T> {
  const key = a ? planKey(kind, a, opts.args) : "";
  const [got, setGot] = useState<{ key: string; res: T | null } | null>(null);
  const kept = a ? peek<T | null>(kind, a, opts.args) : undefined;
  useEffect(() => {
    if (!a || kept !== undefined) return;
    let live = true;
    ask<T | null>({ kind, a, args: opts.args, slot: opts.slot, prio: opts.prio })
      .then((res) => { if (live) setGot({ key, res }); })
      .catch((e) => { if (!(e instanceof Superseded)) console.error(e); });
    return () => { live = false; };
    // the inputs are described by key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, kind, kept === undefined]);
  if (!a) return { res: null, stale: false };
  if (kept !== undefined) return { res: kept, stale: false };
  return { res: got?.res, stale: true };
}
