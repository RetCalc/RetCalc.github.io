/* The guide's side of the engine worker (public/engine-worker.js): plan
   jobs posted as { type: "guide", id, kind, a, args } are run and answered
   as { type: "guide", id, res, error, ms }. scripts/build-worker.mjs puts
   this, and what it imports, after the engine and the optimizer's glue,
   whose own handler ignores these messages. The app never imports this
   file; planClient.ts talks to it. */

import { runPlanJob, type JobArgs, type JobKind } from "./planJobs";
import type { Answers } from "./store";

interface Ask { type: "guide"; id: number; kind: JobKind; a: Answers; args?: JobArgs }
const scope = self as unknown as {
  addEventListener: (type: "message", f: (e: { data: unknown }) => void) => void;
  postMessage: (m: unknown) => void;
};

scope.addEventListener("message", (e) => {
  const d = e.data as Ask | null;
  if (!d || d.type !== "guide") return;
  const t0 = Date.now();
  let res: unknown = null, error: string | null = null;
  try { res = runPlanJob(d.kind, d.a, d.args); } catch (err) { error = String(err); }
  scope.postMessage({ type: "guide", id: d.id, res, error, ms: Date.now() - t0 });
});
