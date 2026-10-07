/* The page's side of the guide's plan jobs (doc 3, "Performance budget and
   the worker"). Every historical test runs in the engine worker
   (public/engine-worker.js, a copy of its own beside the optimizer's and the
   Drawdown Simulator's), so typing never waits on it:

   - Results are kept by their inputs: the same plan asked again, on Back or
     after a digit typed and deleted, answers at once without the worker.
   - One job runs at a time, the most urgent first (the current card's plan,
     then the rail's need, then what the next card will want).
   - A newer request in the same slot (a card's readout, say) takes the place
     of one still waiting; an answer to a request already overtaken is
     dropped by its id.
   - Where a worker can't start, or dies, the same jobs (planJobs.ts) run on
     the page, a beat later, one at a time.

   How long each took is kept (timings()) and, in development, logged. */

import { plKey } from "@/lib/engine/typed-plan";
import { minSpend, planIn, tactics, target } from "./calc";
import { ALL_LEVERS, runPlanJob, type JobArgs, type JobKind } from "./planJobs";
import { hasChanges, schedule } from "./schedule";
import type { Answers } from "./store";

export interface Ask { kind: JobKind; a: Answers; args?: JobArgs; slot?: string; prio?: number }
/** A request overtaken by a newer one in its slot before it ran. */
export class Superseded extends Error {
  constructor() { super("superseded"); }
}

interface Waiter { resolve: (v: unknown) => void; reject: (e: unknown) => void }
interface Req { id: number; kind: JobKind; key: string; a: Answers; args: JobArgs; slot?: string; prio: number; waiters: Waiter[]; t0: number }
interface Timing { kind: JobKind; ms: number; where: "worker" | "page"; at: number }

/** The worker the jobs go to; tests hand in their own. */
export interface PlanWorker {
  postMessage: (m: unknown) => void;
  terminate: () => void;
  onmessage: ((e: { data: unknown }) => void) | null;
  onerror: ((e: { preventDefault?: () => void }) => void) | null;
}
let makeWorker: () => PlanWorker = () => new Worker("/engine-worker.js") as unknown as PlanWorker;

const KEEP = 300;
const results = new Map<string, unknown>();
let queue: Req[] = [], running: Req | null = null, worker: PlanWorker | null = null, dead = false, seq = 0;
const times: Timing[] = [];

/* ---------- keys ----------
   What a job's answer depends on, so equal inputs share it: the engine's
   input for the plan (planIn) and any optimizer choices, as calc.ts keys its
   own cache, plus whatever else that job reads. */
function planSig(a: Answers, over?: JobArgs["over"], base?: boolean) {
  const T = base ? null : tactics(a), I = planIn(a, over);
  // Changes ahead: the schedule the plan is built from (calc.ts's sim keys it the same way).
  const S = I && !over?.flat && hasChanges(a) ? schedule(a, { retire: I.retire, monthly: I.monthly, stop: I.stopAge }).map((s) => [s.from, s.to, s.monthly]) : null;
  return JSON.stringify(I) + "|" + (T ? plKey(T) : "") + (S ? "|" + JSON.stringify(S) : "");
}
export function planKey(kind: JobKind, a: Answers, args: JobArgs = {}): string {
  switch (kind) {
    case "sim": return "sim|" + planSig(a, args.over, args.base);
    case "need": return "need|" + target(a) + "|" + planSig(a, args.over);
    case "levers": return "levers|" + target(a) + "|" + planSig(a);
    case "strategies": return "strategies|" + minSpend(a) + "|" + planSig(a);
    case "options": return "options|" + JSON.stringify(a) + "|" + target(a) + "|" + JSON.stringify(args.levers ?? ALL_LEVERS);
  }
}

/* ---------- the worker ---------- */
function getWorker(): PlanWorker | null {
  if (worker || dead) return worker;
  try {
    worker = makeWorker();
    worker.onmessage = (e) => {
      const d = e.data as { type?: string; id?: number; res?: unknown; error?: string | null; ms?: number } | null;
      if (!d || d.type !== "guide" || !running || running.id !== d.id) return;
      finish(running, d.error ? new Error(d.error) : null, d.res, "worker", d.ms);
    };
    worker.onerror = (e) => {
      e?.preventDefault?.();
      dead = true;
      try { worker?.terminate(); } catch { /* gone already */ }
      worker = null;
      // Whatever was running, finish here instead.
      if (running) runHere(running);
    };
  } catch {
    dead = true;
    worker = null;
  }
  return worker;
}

function runHere(req: Req) {
  setTimeout(() => {
    if (running !== req) return;
    const t0 = Date.now();
    let res: unknown = null, err: Error | null = null;
    try { res = runPlanJob(req.kind, req.a, req.args); } catch (e) { err = e instanceof Error ? e : new Error(String(e)); }
    finish(req, err, res, "page", Date.now() - t0);
  }, 0);
}

function pump() {
  if (running || !queue.length) return;
  const req = (running = queue.shift()!);
  req.t0 = Date.now();
  const w = getWorker();
  if (w) {
    try {
      w.postMessage({ type: "guide", id: req.id, kind: req.kind, a: req.a, args: req.args });
      return;
    } catch { /* runs here instead */ }
  }
  runHere(req);
}

function finish(req: Req, err: Error | null, res: unknown, where: Timing["where"], ms = Date.now() - req.t0) {
  if (running !== req) return;
  running = null;
  if (!err) {
    results.set(req.key, res);
    if (results.size > KEEP) results.delete(results.keys().next().value!);
  }
  times.push({ kind: req.kind, ms, where, at: Date.now() });
  if (times.length > 100) times.shift();
  if (process.env.NODE_ENV === "development") console.debug(`[guide] ${req.kind} ${ms} ms (${where})`);
  req.waiters.forEach((w) => (err ? w.reject(err) : w.resolve(res)));
  pump();
}

/** A job's answer: at once if these inputs were asked before, else when the
    worker (or the page) has it. Rejects with Superseded when a newer request
    in the same slot took its place before it ran. */
export function ask<T>(q: Ask): Promise<T> {
  const args = q.args ?? {}, key = planKey(q.kind, q.a, args), prio = q.prio ?? 5;
  if (results.has(key)) return Promise.resolve(results.get(key) as T);
  return new Promise<T>((resolve, reject) => {
    const w: Waiter = { resolve: resolve as (v: unknown) => void, reject };
    // The newest request in a slot is the only one worth running.
    if (q.slot) {
      queue = queue.filter((r) => {
        if (r.slot !== q.slot || r.key === key) return true;
        r.waiters.forEach((x) => x.reject(new Superseded()));
        return false;
      });
    }
    const same = running?.key === key ? running : queue.find((r) => r.key === key);
    if (same) {
      same.waiters.push(w);
      if (prio < same.prio) same.prio = prio;
      if (q.slot) same.slot = q.slot;
    } else queue.push({ id: ++seq, kind: q.kind, key, a: structuredClone(q.a), args, slot: q.slot, prio, waiters: [w], t0: 0 });
    queue.sort((x, y) => x.prio - y.prio || x.id - y.id);
    pump();
  });
}

/** The answer already kept for these inputs, if any: what a readout shows
    straight away while a newer one is on its way. */
export function peek<T>(kind: JobKind, a: Answers, args?: JobArgs): T | undefined {
  return results.get(planKey(kind, a, args)) as T | undefined;
}

/** How long recent jobs took, newest last. */
export const timings = (): readonly Timing[] => times;

/** For tests: start again with a worker of their making (or none). */
export function resetPlanClient(make?: () => PlanWorker) {
  try { worker?.terminate(); } catch { /* gone already */ }
  if (make) makeWorker = make;
  results.clear();
  queue = []; running = null; worker = null; dead = false; times.length = 0;
}

