/* The Full walkthrough's hand-off to Advanced (trips.ts): the guide's
   changes ahead come across as Advanced's own, so Advanced's figure is the
   one Stages used to show (the guide's number), and an edit there comes
   back as your own change. Run with `npm run test:guide`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BASIC_INFL } from "@/lib/engine/typed";
import { ADVANCED_DEFAULTS, advancedFields } from "@/tools/advanced/model";
import { changesCompute, compileChanges } from "@/tools/advanced/changes";
import { STAGES_DEFAULTS, stageFields, stagesCompute } from "@/tools/stages/model";
import { saveMo } from "../calc";
import { schedule } from "../schedule";
import { editsFrom, guideChanges } from "../toAdvanced";
import type { Answers } from "../store";
import { FIXTURES } from "../../../scripts/baseline/guide-fixtures.mjs";

/* Advanced as the trip fills it (trips.ts prefill): the plan, saving keeping
   pace with inflation, and the guide's changes. */
const filled = (a: Answers) => {
  const infl = BASIC_INFL as number, grossR = (1 + (a.risk || 0.045)) * (1 + infl) - 1;
  const base = { ...ADVANCED_DEFAULTS, ...advancedFields({ initial: a.saved || 0, contrib: Math.round(saveMo(a)), period: "Monthly", growth: infl, gross: grossR, nominal: grossR,
    inflation: infl, years: Math.round(a.retire! - a.age!), withdrawal: 0.04, taxRate: 0.1, vol: 0.15, fees: 0 }), age: String(Math.round(a.age!)) };
  return guideChanges(a, base).s;
};
const priya = () => ({ ...(structuredClone(FIXTURES.find((f) => f.id === "priya-tom")!.a) as Answers), kidsPlanned: 2, firstIn: 3, spacing: 3 }) as Answers;

test("the guide's schedule comes across as changes, and Advanced lands where Stages did", () => {
  const a = priya(), s = filled(a);
  assert.ok(s.changes.length > 0, "the schedule's changes are written in");
  assert.ok(s.changes.every((c) => c.id.startsWith("g-")));
  // What the old Stages trip wrote: one stage per schedule row, in today's dollars.
  const infl = BASIC_INFL as number, grossR = (1 + (a.risk || 0.045)) * (1 + infl) - 1;
  const sched = schedule(a, { monthly: saveMo(a), stop: null });
  assert.ok(sched.length > 1);
  const stages = sched.map((x, i) => stageFields({ years: x.to - x.from, contrib: x.monthly, period: "Monthly", growth: infl, nominal: grossR, vol: 0.15, adj: i > 0 }));
  const was = stagesCompute({ ...STAGES_DEFAULTS, initial: String(a.saved || 0), inflation: String(+(infl * 100).toFixed(6)), withdrawal: "4", taxRate: "10", fees: "0", stages }, null).R.fvReal;
  const now = changesCompute(s, null).V.R.fvReal;
  assert.ok(Math.abs(now - was) < 1, `Advanced ${now} against Stages ${was}`);
});

test("an edit in Advanced comes back as your own change, and none comes back quietly", () => {
  const a = priya(), s = filled(a), age = Math.round(a.age!), was = compileChanges(s, null).perYear;
  assert.deepEqual(editsFrom(was, compileChanges(s, null).perYear, age), []);
  // Save $300 a month more from three years in, for three years.
  const more = { ...s, changes: [...s.changes, { id: "m", kind: "saving" as const, name: "More", on: true, from: 3, until: 6, mode: "amount" as const, amount: 300, ramp: 0, acct: "auto" as const, nominal: 0 }] };
  assert.deepEqual(editsFrom(was, compileChanges(more, null).perYear, age).map((e) => e.kind === "custom" ? [e.from, e.to, e.delta] : null), [[age + 3, age + 6, 300]]);
});

test("a second trip replaces the guide's changes and keeps yours", () => {
  const a = priya(), s = filled(a), mine = { ...s.changes[0], id: "mine", name: "Mine" };
  const again = guideChanges(a, { ...s, changes: [...s.changes, mine] }).s;
  assert.equal(again.changes.filter((c) => c.id === "mine").length, 1);
  assert.equal(again.changes.filter((c) => c.id.startsWith("g-")).length, s.changes.length);
});

test("with no schedule, a plan to stop saving comes across as one change", () => {
  const a = { ...priya(), kidsPlanned: 0, events: [], stopAge: 50 } as Answers;
  const s = filled(a);
  assert.deepEqual(s.changes.map((c) => [c.name, c.from, c.amount, c.mode]), [["Coasting", 50 - Math.round(a.age!), -100, "pct"]]);
});
