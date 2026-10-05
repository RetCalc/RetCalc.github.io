"use client";

/* Running the Plan Optimizer: the page side of plOptimize() in plan.js.
   The search runs in a worker of its own (public/engine-worker.js, a second
   copy beside the Drawdown Simulator's), so the page keeps drawing while it
   tries a few thousand plans in every historical market; where a worker
   can't start, it runs here in short slices instead. It lives in two
   places, its own tool page and the readiness guide's step, each a "host"
   with its own run and result, kept for the visit. One search runs at a
   time. From src/js/app/31b-plan-optimizer.js. */

import { useSyncExternalStore } from "react";
import { plBaseTactics, plCombos, plOptimize, plPrep, plStarts } from "@/lib/engine/typed-plan";
import type { PlDone, PlPlan, PlProgress, PlTactics } from "@/lib/engine/types";

export type Host = "tool" | "guide";
export type Goal = "legacy" | "last" | "spend";

/** The whole shot never takes less than this, so a quick search still gets its flight. */
export const OP_MIN_MS = 5000;
export const OP_DRAW_MS = 700, OP_HOLD_MS = 260;
export const OP_LOOSE_MS = OP_DRAW_MS + OP_HOLD_MS;

export interface Run {
  id: number; P: PlPlan; goal: Goal; sig: string; t0: number;
  prog: PlProgress | null; done: PlDone | null;
  /** How far the arrow has flown, 0 to 1, and when it landed. */
  shown: number; hitAt: number; nowAt: number;
  /** How the best plan so far improved, so the counters can replay it in step with the arrow. */
  log: { frac: number; best: NonNullable<PlProgress["best"]> }[];
  /** Every plan the search will try, in its order, for the running commentary. */
  combos: PlTactics[] | null;
}
export interface Result extends PlDone { sig: string; P: PlPlan }
export interface HostState { run: Run | null; res: Result | null; fresh: boolean }

const OP: Record<Host, HostState> = { tool: { run: null, res: null, fresh: false }, guide: { run: null, res: null, fresh: false } };
const jobs: Record<number, Host> = {};
const watching: Record<Host, number> = { tool: 0, guide: 0 };
const listeners = new Set<() => void>();
let worker: Worker | null = null, dead = false, nextId = 0;

function put(host: Host, next: Partial<HostState>) {
  OP[host] = { ...OP[host], ...next };
  listeners.forEach((f) => f());
}

export function useOptimizer(host: Host): HostState {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => listeners.delete(f); },
    () => OP[host],
    () => OP[host],
  );
}

/** What identifies a result: the inputs and the goal. A result for other
    inputs is kept, marked as out of date. */
export function opSig(P: PlPlan, goal: string): string {
  const k = ["status", "state", "age1", "age2", "years", "trad", "roth", "rothBasis", "brok", "brokBasis",
    "spend", "pia1", "pia2", "claim1", "claim2", "pension", "pensionAge", "pensionCola", "aca", "household",
    "premium", "rule55", "heirRate", "mix", "target"] as const;
  const rec = P as unknown as Record<string, unknown>;
  return goal + "|" + k.map((x) => { const v = rec[x]; return typeof v === "number" ? Math.round(v) : String(v); }).join("|");
}

/** How big the search is: plans, markets, and so roughly how long. */
export function opEstimate(P: PlPlan) {
  const C = plPrep({ ...P, strategy: "fixed" }), n = plCombos(C, plBaseTactics(C)).length, w = plStarts(C).length;
  return { n, w, runs: n * w, secs: Math.max(Math.round(OP_MIN_MS / 1000) + 1, Math.round((n * w * C.years) / 1.6e6)) };
}

function onMsg(v: (PlProgress | PlDone) & { id: number }) {
  const host = v && jobs[v.id];
  if (!host) return;
  const R = OP[host].run;
  if (!R || R.id !== v.id) return;
  if (v.type === "done") {
    R.done = v;
    delete jobs[v.id];
    // Nobody's watching the flight: the answer is simply in.
    if (!watching[host]) finish(host);
    return;
  }
  R.prog = v;
  if (v.best) R.log.push({ frac: v.frac, best: v.best });
}

function getWorker(): Worker | null {
  if (worker || dead) return worker;
  try {
    worker = new Worker("/engine-worker.js");
    worker.onmessage = (e) => onMsg(e.data);
    worker.onerror = (e) => {
      e.preventDefault?.();
      dead = true;
      worker?.terminate();
      worker = null;
      // Whatever it was working on, finish here instead.
      for (const h of ["tool", "guide"] as Host[]) {
        const R = OP[h].run;
        if (R && !R.done) runHere(R.id, R.P, R.goal);
      }
    };
  } catch {
    dead = true;
    worker = null;
  }
  return worker;
}

function runHere(id: number, P: PlPlan, goal: Goal) {
  const g = plOptimize(P, goal);
  const step = () => {
    if (!jobs[id]) return;
    const until = performance.now() + 12;
    do {
      const s = g.next();
      if (s.done) return;
      onMsg({ ...s.value, id });
      if (s.value.type === "done") return;
    } while (performance.now() < until);
    setTimeout(step, 0);
  };
  setTimeout(step, 40);
}

export function startOptimizer(host: Host, P: PlPlan, goal: Goal) {
  // One search at a time: a new one replaces any other still running.
  for (const h of ["tool", "guide"] as Host[]) if (OP[h].run) stopOptimizer(h, h === host);
  const id = ++nextId;
  jobs[id] = host;
  let combos: PlTactics[] | null = null;
  try {
    const C = plPrep({ ...P, strategy: "fixed" });
    combos = plCombos(C, plBaseTactics(C));
  } catch { /* the commentary does without */ }
  const run: Run = { id, P, goal, sig: opSig(P, goal), t0: performance.now(), prog: null, done: null, shown: 0, hitAt: 0, nowAt: 0, log: [], combos };
  const w = getWorker();
  if (w) {
    try { w.postMessage({ type: "run", id, P, goal }); } catch { runHere(id, P, goal); }
  } else runHere(id, P, goal);
  put(host, { run, res: null });
}

export function stopOptimizer(host: Host, quiet = false) {
  const R = OP[host].run;
  if (!R) return;
  delete jobs[R.id];
  try { worker?.postMessage({ type: "stop" }); } catch { /* gone already */ }
  if (quiet) OP[host] = { ...OP[host], run: null };
  else put(host, { run: null });
}

/** The arrow has landed: the answer replaces the flight. */
export function finish(host: Host) {
  const R = OP[host].run;
  if (!R || !R.done) return;
  put(host, { run: null, res: { ...R.done, sig: R.sig, P: R.P }, fresh: true });
}

/** The result has been shown once; it doesn't reveal itself again. */
export function seen(host: Host) {
  if (OP[host].fresh) OP[host] = { ...OP[host], fresh: false };
}

/** The flight on screen: while one is, the answer waits for the arrow. */
export function watch(host: Host): () => void {
  watching[host]++;
  return () => {
    watching[host]--;
    // Left before the arrow landed: the answer is in when it's ready.
    if (!watching[host]) setTimeout(() => { if (!watching[host]) finish(host); }, 0);
  };
}
