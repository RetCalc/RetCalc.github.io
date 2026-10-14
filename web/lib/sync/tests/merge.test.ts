/* The merge rules of account sync (ACCOUNTS_PLAN.md, "How syncing works"). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { dropTwinCopies, fingerprint, mergeItem, mergeScenarios, same } from "../merge";

const c = (value: unknown, at = 0, version = 1) => ({ value, at, version });

test("an item on one side only goes to the other", () => {
  assert.deepEqual(mergeItem("guide", c({ a: 1 }, 5), null), { version: 1, value: { a: 1 }, toLocal: false, toAccount: true });
  assert.deepEqual(mergeItem("guide", null, c({ a: 1 }, 5)), { version: 1, value: { a: 1 }, toLocal: true, toAccount: false });
  assert.equal(mergeItem("guide", null, null), null);
});

test("identical copies need nothing", () => {
  const m = mergeItem("household", c({ age: 40, savedAt: 1 }, 1), c({ age: 40, savedAt: 1 }, 9));
  assert.equal(m!.toLocal || m!.toAccount, false);
});

test("the household with the later savedAt wins, whatever the write times say", () => {
  const local = c({ age: 41, savedAt: 200 }, 1), account = c({ age: 40, savedAt: 100 }, 999);
  const m = mergeItem("household", local, account)!;
  assert.deepEqual(m.value, { age: 41, savedAt: 200 });
  assert.equal(m.toAccount, true);
  assert.equal(m.toLocal, false);
});

test("the Guide: the newer write wins", () => {
  const m = mergeItem("guide", c({ step: 3 }, 100), c({ step: 5 }, 200))!;
  assert.deepEqual(m.value, { step: 5 });
  assert.equal(m.toLocal, true);
});

test("a newer storage version wins over an older one", () => {
  const m = mergeItem("guide", c({ old: true }, 999, 1), c({ new: true }, 1, 2))!;
  assert.equal(m.version, 2);
  assert.deepEqual(m.value, { new: true });
  assert.equal(m.toLocal, true);
});

test("saved scenarios: both sides' names are kept", () => {
  const out = mergeScenarios([{ name: "Early", data: 1 }], [{ name: "Late", data: 2 }]);
  assert.deepEqual(out.map((s) => s.name), ["Late", "Early"]);
});

test("saved scenarios: same name and inputs is one", () => {
  const out = mergeScenarios([{ name: "Plan", data: { a: 1 } }], [{ name: "Plan", data: { a: 1 } }]);
  assert.equal(out.length, 1);
});

test("saved scenarios: a clash keeps both, this device's renamed", () => {
  const out = mergeScenarios([{ name: "Plan", data: { a: 1 } }], [{ name: "Plan", data: { a: 2 } }]);
  assert.deepEqual(out, [{ name: "Plan", data: { a: 2 } }, { name: "Plan (from this device)", data: { a: 1 } }]);
});

test("saved scenarios: a second clash gets a numbered name", () => {
  const out = mergeScenarios(
    [{ name: "Plan", data: 1 }],
    [{ name: "Plan", data: 2 }, { name: "Plan (from this device)", data: 3 }],
  );
  assert.equal(out[2].name, "Plan (from this device 2)");
});

test("scenario lists merge in both directions when each side has something new", () => {
  const m = mergeItem("scenarios-tax", c([{ name: "A", data: 1 }], 1), c([{ name: "B", data: 2 }], 2))!;
  assert.equal(m.toLocal, true);
  assert.equal(m.toAccount, true);
  assert.equal((m.value as unknown[]).length, 2);
});

test("the same value with its fields in another order is the same", () => {
  assert.equal(same({ a: 1, b: { c: 2, d: [1, { e: 3, f: 4 }] } }, { b: { d: [1, { f: 4, e: 3 }], c: 2 }, a: 1 }), true);
  assert.equal(same({ a: 1 }, { a: 2 }), false);
});

test("a scenario that came back from the account reordered is not copied", () => {
  // jsonb returns object keys in its own order
  const out = mergeScenarios([{ name: "Test Basic 1", data: { age: "32", retire: "65", saved: "60,000" } }],
    [{ name: "Test Basic 1", data: { saved: "60,000", age: "32", retire: "65" } }]);
  assert.deepEqual(out.map((s) => s.name), ["Test Basic 1"]);
});

test("syncing again and again never adds copies", () => {
  let local = [{ name: "Plan", data: { a: 1, b: 2 } }], account = [{ name: "Plan", data: { b: 2, a: 1 } }];
  for (let i = 0; i < 5; i++) {
    const m = mergeItem("scenarios-basic", { version: 1, value: local, at: i }, { version: 1, value: account, at: i })!;
    local = m.value as typeof local; account = m.value as typeof account;
  }
  assert.deepEqual(local.map((s) => s.name), ["Plan"]);
});

test("copies an earlier version made of an unchanged scenario are cleaned up", () => {
  const d = { age: "32" }, r = { age: "32" };
  const list = [
    { name: "Test Basic 1", data: d },
    { name: "Test Basic 1 (from this device)", data: r },
    { name: "Test Basic 1 (from this device) (from this device)", data: { age: "32" } },
    { name: "Other", data: { age: "40" } },
  ];
  assert.deepEqual(dropTwinCopies(list).map((s) => s.name), ["Test Basic 1", "Other"]);
  const m = mergeItem("scenarios-basic", { version: 1, value: list, at: 1 }, { version: 1, value: list, at: 1 })!;
  assert.deepEqual((m.value as { name: string }[]).map((s) => s.name), ["Test Basic 1", "Other"]);
  assert.equal(m.toLocal, true);
  assert.equal(m.toAccount, true);
});

test("a real clash is still kept as a copy, and isn't dropped later", () => {
  const list = mergeScenarios([{ name: "Plan", data: { a: 1 } }], [{ name: "Plan", data: { a: 2 } }]);
  assert.deepEqual(dropTwinCopies(list).map((s) => s.name), ["Plan", "Plan (from this device)"]);
});

test("a deletion on this device carries over (the account still has the agreed version)", () => {
  const agreed = [{ name: "A", data: 1 }, { name: "B", data: 2 }], here = [{ name: "A", data: 1 }];
  const m = mergeItem("scenarios-basic", { version: 1, value: here, at: 2 }, { version: 1, value: agreed, at: 1 }, fingerprint(agreed))!;
  assert.deepEqual((m.value as { name: string }[]).map((s) => s.name), ["A"]);
  assert.equal(m.toAccount, true);
  assert.equal(m.toLocal, false);
});

test("a deletion on another device carries over here", () => {
  const agreed = [{ name: "A", data: 1 }, { name: "B", data: 2 }], account = [{ name: "B", data: 2 }];
  const m = mergeItem("scenarios-basic", { version: 1, value: agreed, at: 1 }, { version: 1, value: account, at: 2 }, fingerprint(agreed))!;
  assert.deepEqual((m.value as { name: string }[]).map((s) => s.name), ["B"]);
  assert.equal(m.toLocal, true);
});

test("an edit on one side wins over the agreed version, for any item", () => {
  const agreed = { age: 40, savedAt: 1 };
  const m = mergeItem("household", { version: 1, value: agreed, at: 9 }, { version: 1, value: { age: 41, savedAt: 1 }, at: 1 }, fingerprint(agreed))!;
  assert.deepEqual(m.value, { age: 41, savedAt: 1 });
  assert.equal(m.toLocal, true);
});

test("both sides changed: scenario lists are combined, nothing lost", () => {
  const agreed = [{ name: "A", data: 1 }];
  const m = mergeItem("scenarios-basic", { version: 1, value: [...agreed, { name: "B", data: 2 }], at: 2 },
    { version: 1, value: [...agreed, { name: "C", data: 3 }], at: 2 }, fingerprint(agreed))!;
  assert.deepEqual((m.value as { name: string }[]).map((s) => s.name).sort(), ["A", "B", "C"]);
});

test("the agreed version is the same however its fields are ordered", () => {
  assert.equal(fingerprint({ a: 1, b: [{ c: 1, d: 2 }] }), fingerprint({ b: [{ d: 2, c: 1 }], a: 1 }));
  assert.notEqual(fingerprint({ a: 1 }), fingerprint({ a: 2 }));
});

/* ---------- Guide conflicts: nothing is thrown away ---------- */
const guideState = (done: string[], a: Record<string, unknown>) => ({ v: 2, pace: "full", cur: "plan", a, src: {}, done: Object.fromEntries(done.map((d) => [d, true])), startedAt: "x" });
const FULL = guideState(["about", "income", "spending", "cash", "debt", "savings"], { age: 45, retire: 62, income: 100000, saved: 300000, contrib: 1000 });
const PARTIAL = guideState([], { age: 30, retire: 60 });

test("a thin guide made signed out, on first sign-in, does not replace the finished one in the account", () => {
  const m = mergeItem("guide", c(PARTIAL, 2000, 2), c(FULL, 1000, 2), null)!;
  assert.deepEqual(m.value, FULL);
  assert.equal(m.toAccount, false);
  assert.equal(m.toLocal, true);
  assert.equal(m.keep?.data && (m.keep.data as { a: unknown }).a !== undefined, true);
  assert.deepEqual((m.keep!.data as { a: unknown }).a, PARTIAL.a);
});

test("the other way round, the finished one here stays and the account's thin one is kept as a plan", () => {
  const m = mergeItem("guide", c(FULL, 1000, 2), c(PARTIAL, 2000, 2), null)!;
  assert.deepEqual(m.value, FULL);
  assert.equal(m.toAccount, true);
  assert.match(m.keep!.name, /^Plan from your account, /);
  assert.deepEqual((m.keep!.data as { a: unknown }).a, PARTIAL.a);
});

test("both changed since they last agreed: the newer write stays, the other is kept as a plan", () => {
  const m = mergeItem("guide", c(PARTIAL, 5000, 2), c(FULL, 4000, 2), "someold.fingerprint.x")!;
  assert.deepEqual(m.value, PARTIAL);
  assert.equal(m.toAccount, true);
  assert.match(m.keep!.name, /^Plan from your account, /);
  assert.deepEqual((m.keep!.data as { done: unknown }).done, FULL.done);
});

test("only one side changed since they last agreed: it wins outright with nothing to keep", () => {
  const m = mergeItem("guide", c(PARTIAL, 5000, 2), c(FULL, 4000, 2), fingerprint(FULL))!;
  assert.deepEqual(m.value, PARTIAL);
  assert.equal(m.keep, undefined);
});

test("a Guide with no answers isn't kept, and one that matches the winner isn't either", () => {
  assert.equal(mergeItem("guide", c(guideState([], {}), 9000, 2), c(FULL, 1000, 2), null)!.keep, undefined);
  const twin = { ...FULL, cur: "adjust", startedAt: "y" };
  assert.equal(mergeItem("guide", c(twin, 9000, 2), c(FULL, 1000, 2), null)!.keep, undefined);
});

test("the plan kept by a merge is the shape the toolbar's Save loads", () => {
  const k = mergeItem("guide", c(PARTIAL, 2000, 2), c(FULL, 1000, 2), null)!.keep!;
  assert.deepEqual(Object.keys(k.data as object).sort(), ["a", "done", "pace", "src", "v"]);
  assert.equal((k.data as { v: number }).v, 2);
});
