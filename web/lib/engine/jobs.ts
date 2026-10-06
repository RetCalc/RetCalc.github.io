"use client";

/* Engine jobs run in a worker (public/engine-worker.js, built from the
   engine by scripts/build-worker.mjs), or here once the page
   has drawn where a worker can't start. Each kind of job is a lane with one
   job at a time: a newer request waits for the running one, replacing any
   already waiting, and a result a newer request has overtaken is dropped.
   From ddRun() in src/js/app/15-drawdown.js. */
import { useEffect, useState } from "react";
import { busyEnd, busyStart } from "@/lib/busy";
import { ddJob } from "./typed-drawdown";

interface Req { id: number; job: string; args: unknown; done: (res: unknown) => void }
const lanes: Record<string, { busy: Req | null; next: Req | null }> = {};
let worker: Worker | null = null, dead = false, seq = 0;

function getWorker(): Worker | null {
  if (worker || dead) return worker;
  try {
    worker = new Worker("/engine-worker.js");
    worker.onmessage = (e) => {
      const v = e.data;
      if (v?.type === "dd") finish(v.lane, v.id, v.res);
    };
    worker.onerror = (e) => {
      e.preventDefault?.();
      dead = true;
      worker?.terminate();
      worker = null;
      // Whatever was running, finish here instead.
      for (const k of Object.keys(lanes)) if (lanes[k].busy) runHere(k, lanes[k].busy!);
    };
  } catch {
    dead = true;
    worker = null;
  }
  return worker;
}

function runHere(lane: string, req: Req) {
  setTimeout(() => {
    let res: unknown = null;
    try {
      res = ddJob(req.job, req.args);
    } catch (e) {
      res = { error: String(e) };
    }
    finish(lane, req.id, res);
  }, 30);
}

function start(lane: string, req: Req) {
  lanes[lane].busy = req;
  const w = getWorker();
  if (w) {
    try {
      w.postMessage({ type: "dd", id: req.id, lane, job: req.job, args: req.args });
      return;
    } catch { /* runs here instead */ }
  }
  runHere(lane, req);
}

function finish(lane: string, id: number, res: unknown) {
  const L = lanes[lane];
  if (!L?.busy || L.busy.id !== id) return;
  const req = L.busy;
  L.busy = null;
  busyEnd();
  if (L.next) {
    const nx = L.next;
    L.next = null;
    start(lane, nx);
    return;
  }
  if (res && !(res as { error?: string }).error) req.done(res);
}

export function runJob(lane: string, job: string, args: unknown, done: (res: unknown) => void): void {
  const L = lanes[lane] ?? (lanes[lane] = { busy: null, next: null });
  const req = { id: ++seq, job, args, done };
  // the page is busy from the asking to the answer, or until a newer request replaces it
  busyStart();
  if (L.busy) {
    if (L.next) busyEnd();
    L.next = req;
  } else start(lane, req);
}

/** A job's latest answer, the arguments it answered, and whether a newer
    one is on its way. `args` null asks for nothing; `key` says when the
    arguments changed. */
export function useJob<T, A = unknown>(lane: string, job: string, args: A | null, key: string): { res: T | null; args: A | null; stale: boolean } {
  const [got, setGot] = useState<{ key: string; res: T; args: A } | null>(null);
  const asking = args != null;
  useEffect(() => {
    if (args == null) return;
    const asked = args;
    runJob(lane, job, asked, (res) => setGot({ key, res: res as T, args: asked }));
    // args is described by key (and whether there are any)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lane, job, key, asking]);
  return { res: got?.res ?? null, args: got?.args ?? null, stale: args != null && got?.key !== key };
}
