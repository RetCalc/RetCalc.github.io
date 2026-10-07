/* The guide's plan jobs through the client and the real worker bundle give
   exactly what the same jobs give on the page, for every fixture household
   (doc 4, first pull request, item 3), and those are the baseline's
   figures. The worker is public/engine-worker.js itself, built fresh and run
   in a Node VM standing in for the browser's worker. */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import v8 from "node:v8";
import { sim } from "../calc";
import { ask, peek, resetPlanClient, Superseded, timings, type PlanWorker } from "../planClient";
import { runPlanJob, wire, type JobKind } from "../planJobs";
import type { Answers } from "../store";
import { FIXTURES } from "../../../scripts/baseline/guide-fixtures.mjs";

const WEB = join(import.meta.dirname, "..", "..", "..");
const base = JSON.parse(readFileSync(join(WEB, "scripts", "baseline", "guide.json"), "utf8")) as {
  households: Record<string, { figures: { fv: number; success: number; need: number; levers: Record<string, { fv: number; need: number; success: number } | null> } }>;
};
let code = "";
/** Plain data in this realm, the way structured clone hands it over. */
const plain = <T>(v: T): T => v8.deserialize(v8.serialize(v));

/** The engine worker in a VM: the bundle as the browser would load it. */
class VmWorker implements PlanWorker {
  onmessage: PlanWorker["onmessage"] = null;
  onerror: PlanWorker["onerror"] = null;
  posted = 0;
  private ctx: vm.Context & { __in?: string; onmessage?: (e: unknown) => void };
  private listeners: ((e: { data: unknown }) => void)[] = [];
  constructor() {
    const ctx: Record<string, unknown> = { console, setTimeout, clearTimeout };
    ctx.self = ctx;
    ctx.addEventListener = (t: string, f: (e: { data: unknown }) => void) => { if (t === "message") this.listeners.push(f); };
    ctx.postMessage = (m: unknown) => { const data = plain(m); setImmediate(() => this.onmessage?.({ data })); };
    this.ctx = vm.createContext(ctx);
    vm.runInContext(code, this.ctx);
  }
  postMessage(m: unknown) {
    this.posted++;
    const json = JSON.stringify(m);
    setImmediate(() => {
      this.ctx.__in = json;
      const data = vm.runInContext("JSON.parse(__in)", this.ctx);
      this.ctx.onmessage?.({ data });
      this.listeners.forEach((f) => f({ data }));
    });
  }
  terminate() {}
}

const fixture = (id: string) => structuredClone(FIXTURES.find((f) => f.id === id)!.a) as Answers;

before(() => {
  const r = spawnSync(process.execPath, [join(WEB, "scripts", "build-worker.mjs")], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  code = readFileSync(join(WEB, "public", "engine-worker.js"), "utf8");
});

test("a plan crosses whole, but for the shared tax cache", () => {
  const S = sim(fixture("maya-sam"))!;
  const W = wire(S);
  assert.equal(W.C.P, S.C.P);
  assert.equal((W.C as unknown as { cache: unknown }).cache, null);
  const { C: _c, ...rest } = S, { C: _w, ...wrest } = W;
  assert.deepEqual(wrest, rest);
  const { cache: _x, ...cs } = S.C as unknown as Record<string, unknown>, { cache: _y, ...cw } = W.C as unknown as Record<string, unknown>;
  assert.deepEqual(cw, cs);
});

test("every job through the worker equals the same job on the page, for every fixture", async () => {
  const w = new VmWorker();
  resetPlanClient(() => w);
  for (const f of FIXTURES) {
    const a = fixture(f.id), want = base.households[f.id].figures;
    for (const kind of ["sim", "need", "levers", "strategies"] as JobKind[]) {
      const got = await ask<unknown>({ kind, a });
      assert.deepEqual(plain(got), plain(runPlanJob(kind, a)), `${f.id}: ${kind}`);
    }
    // and they are the baseline's figures
    const S = (await ask<ReturnType<typeof wire>>({ kind: "sim", a }));
    assert.equal(Math.round(S.fv * 100) / 100, want.fv, f.id + " fv");
    assert.equal(Math.round(S.success * 1e6) / 1e6, want.success, f.id + " success");
    assert.equal(await ask({ kind: "need", a }), want.need, f.id + " need");
    const L = (await ask<{ rows: ({ id: string; fv: number; need: number } | null)[] }>({ kind: "levers", a }));
    for (const r of L.rows) {
      const b = r && want.levers[r.id];
      if (!r) continue;
      assert.equal(Math.round(r.fv * 100) / 100, b!.fv, `${f.id} lever ${r.id} fv`);
      assert.equal(r.need, b!.need, `${f.id} lever ${r.id} need`);
    }
  }
  assert.ok(timings().every((t) => t.where === "worker"));
});

test("Adjust your plan's options through the worker equal the page's", async () => {
  const w = new VmWorker();
  resetPlanClient(() => w);
  for (const id of ["maya-sam", "dan"]) {
    const a = fixture(id);
    assert.deepEqual(plain(await ask({ kind: "options", a })), plain(runPlanJob("options", a)), id);
  }
});

test("a plan asked again answers without the worker", async () => {
  const w = new VmWorker();
  resetPlanClient(() => w);
  const a = fixture("dan");
  await ask({ kind: "sim", a });
  const n = w.posted;
  // a field the plan doesn't read changes nothing
  const again = await ask({ kind: "sim", a: { ...a, cash: 99999 } });
  assert.equal(w.posted, n);
  assert.ok(again && peek("sim", a));
});

test("a newer request in a slot takes the place of one still waiting", async () => {
  const w = new VmWorker();
  resetPlanClient(() => w);
  const a = fixture("dan");
  const first = ask({ kind: "sim", a, slot: "card" });           // runs at once
  const second = ask({ kind: "sim", a: { ...a, retire: 66 }, slot: "card" }); // waits
  const third = ask({ kind: "sim", a: { ...a, retire: 67 }, slot: "card" });  // overtakes the second
  await assert.rejects(second, (e) => e instanceof Superseded);
  const [x, z] = (await Promise.all([first, third])) as { retire: number }[];
  assert.equal(x.retire, 65);
  assert.equal(z.retire, 67);
  assert.equal(w.posted, 2);
});

test("the most urgent job runs first", async () => {
  const w = new VmWorker();
  resetPlanClient(() => w);
  const a = fixture("renter-29"), order: string[] = [];
  const p0 = ask({ kind: "sim", a }).then(() => order.push("first"));
  const p1 = ask({ kind: "levers", a, prio: 9 }).then(() => order.push("levers"));
  const p2 = ask({ kind: "need", a, prio: 1 }).then(() => order.push("need"));
  await Promise.all([p0, p1, p2]);
  assert.deepEqual(order, ["first", "need", "levers"]);
});

test("where a worker can't start, the page runs the same jobs", async () => {
  resetPlanClient(() => { throw new Error("no workers here"); });
  const a = fixture("couple-58");
  assert.deepEqual(plain(await ask({ kind: "sim", a })), plain(runPlanJob("sim", a)));
  assert.ok(timings().every((t) => t.where === "page"));
});

test("a worker that dies mid-job hands it to the page", async () => {
  const dying: PlanWorker = { onmessage: null, onerror: null, postMessage() { setImmediate(() => this.onerror?.({})); }, terminate() {} };
  resetPlanClient(() => dying);
  const a = fixture("early-55");
  assert.deepEqual(plain(await ask({ kind: "need", a })), plain(runPlanJob("need", a)));
  assert.equal(timings().at(-1)!.where, "page");
});
