/* The merge rules of account sync (ACCOUNTS_PLAN.md, "How syncing works"). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeItem, mergeScenarios } from "../merge";

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
