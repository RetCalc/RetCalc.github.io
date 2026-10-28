/* Changes ahead on the Advanced calculator (changes.ts): changes that do
   nothing leave every figure where Advanced has it, to the cent, and the
   ones that do something do what they say. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ADVANCED_DEFAULTS, advancedCompute, type AdvancedInputs } from "../model";
import { changesCompute, changesOn, coastAnswer, coastChange, compileChanges, retireAnswer } from "../changes";
import { newScenario, type Scenario } from "@/components/dashboard/scenarios";

const SPLIT = { acOn: true, tradBal: "100,000", tradC: "800", rothBal: "20,000", rothC: "300", brokBal: "15,000", brokC: "200", hsaBal: "5,000", hsaC: "100", salary: "120,000", matchPct: "50", matchCap: "6", acState: "IL", acStatus: "m" };
const CASES: [string, Partial<AdvancedInputs>][] = [
  ["as it comes", {}],
  ["rising saving and a glide", { growth: "3", glideOn: true, glideEnd: "5", glideYears: "5" }],
  ["fees, bi-weekly, a part year", { fees: "0.5", period: "Bi-Weekly", years: "27.5" }],
  ["split by account with a match", { ...SPLIT, growth: "2" }],
  ["split, a long glide", { ...SPLIT, growth: "0", glideOn: true, glideEnd: "5", glideYears: "8" }],
  ["split, rates by account", { ...SPLIT, gRates: { t: 0.03, r: 0.01, b: 0.05 } }],
];
const inputs = (c: Partial<AdvancedInputs>, changes: Scenario[] = []) => ({ ...ADVANCED_DEFAULTS, ...c, changes } as AdvancedInputs);
const ret = (from: number, nominal: number, id = "r"): Scenario => ({ ...newScenario(id, "returns", 0, 0), from, nominal, ramp: 0 });
const close = (a: number, b: number, what: string) => assert.ok(Math.abs(a - b) < 0.01, `${what}: ${a} against ${b}`);

test("with no change on, the plan is Advanced's own", () => {
  assert.equal(changesOn(inputs({})), false);
  assert.equal(changesOn(inputs({}, [{ ...ret(5, 0.085), on: false }])), false);
  // Children switched on but none set up: nothing to run.
  assert.equal(changesOn(inputs({}, [{ ...newScenario("children", "children", 0, 0), on: true }])), false);
});

test("a change that changes nothing leaves every figure where Advanced has it", () => {
  for (const [name, c] of CASES) {
    const A = advancedCompute(inputs(c), null), base = A.p.gross;
    for (const from of [0, 5, Math.floor(A.p.years) - 2]) {
      const { V } = changesCompute(inputs(c, [ret(from, base)]), null);
      close(V.R.fv, A.R.fv, `${name}, from ${from}: balance`);
      close(V.R.fvReal, A.R.fvReal, `${name}, from ${from}: in today's dollars`);
      // Rates by account: each account grows at their blend here, so the
      // tax on the split, and what's left after it, can move a little.
      const near = c.gRates ? (x: number, y: number, w: string) => assert.ok(Math.abs(x / y - 1) < 0.005, `${w}: ${x} against ${y}`) : close;
      near(V.R.afterTax, A.R.afterTax, `${name}, from ${from}: after-tax income`);
      near(V.portToday, A.S.portToday, `${name}, from ${from}: portfolio needed`);
    }
  }
});

test("saving more in today's dollars is a bigger contribution rising with inflation", () => {
  const c = { contrib: "1,000", period: "Monthly", growth: "3", inflation: "3" };
  const more: Scenario = { ...newScenario("m", "saving", 0, 0), from: 0, amount: 500, mode: "amount" };
  close(changesCompute(inputs(c, [more]), null).V.R.fv, advancedCompute(inputs({ ...c, contrib: "1,500" }), null).R.fv, "saving $500 more");
});

test("stopping saving leaves only the starting value growing", () => {
  const stop = coastChange(0);
  close(changesCompute(inputs({}, [stop]), null).V.R.fv, advancedCompute(inputs({ contrib: "0" }), null).R.fv, "no saving at all");
  const split = changesCompute(inputs(SPLIT, [stop]), null).V;
  close(split.R.fv, advancedCompute(inputs({ ...SPLIT, tradC: "0", rothC: "0", brokC: "0", hsaC: "0" }), null).R.fv, "no saving and no match");
});

test("a change runs from its year: stages break there, and a lump sum lands on its day", () => {
  const raise: Scenario = { ...newScenario("m", "saving", 0, 0), name: "A raise", from: 10, amount: 300, mode: "amount" };
  const gift: Scenario = { ...newScenario("g", "lump", 0, 0), name: "A gift", from: 4, amount: 20000 };
  const C = compileChanges(inputs({ growth: "0" }, [raise, gift]), null);
  assert.deepEqual(C.shown.map((x) => [x.from, x.to]), [[0, 4], [4, 10], [10, 30]]);
  assert.deepEqual(C.shown.map((x) => x.names), [[], ["A gift"], ["A raise"]]);
  assert.equal(C.inputs.stages[1].lump, 20000);
  assert.deepEqual(C.starts, [{ id: "m", year: 10 }, { id: "g", year: 4 }]);
  const base = advancedCompute(inputs({ growth: "0" }), null).R.fvReal;
  assert.ok(changesCompute(inputs({ growth: "0" }, [gift]), null).V.R.fvReal > base + 20000);
});

test("the children's costs come out of saving", () => {
  // A child on the way: their costs start from nothing, so saving falls.
  const kids = { now: [], planned: 1, firstIn: 2, spacing: 3, childcare: true, early: "", school: "" };
  const row: Scenario = { ...newScenario("children", "children", 0, 0), on: true };
  const s = { ...inputs({ contrib: "2,000" }, [row]), kids };
  const C = compileChanges(s, null);
  assert.ok(C.shown.length > 1);
  assert.ok(changesCompute(s, null).V.R.fv < advancedCompute(inputs({ contrib: "2,000" }), null).R.fv);
  // Switched off, they're not counted.
  assert.equal(changesOn({ ...s, changes: [{ ...row, on: false }] }), false);
});

test("when you could stop saving: the earliest year that still gets there", () => {
  const s = inputs({ initial: "200,000", contrib: "2,000", period: "Monthly", target: "60,000" });
  const A = coastAnswer(s, null)!;
  assert.ok(A.at != null && A.at > 0);
  const at = (y: number) => changesCompute({ ...s, changes: [coastChange(y)] }, null).V;
  assert.ok(at(A.at).R.fvReal >= at(A.at).portToday);
  assert.ok(at(A.at - 1).R.fvReal < at(A.at - 1).portToday);
  // Asking too much: no year to stop.
  assert.equal(coastAnswer({ ...s, target: "900,000" }, null)!.at, null);
});

test("when you could retire: the fewest years that get there, sooner or later than planned", () => {
  const s = inputs({ initial: "200,000", contrib: "2,000", period: "Monthly", target: "60,000", years: "30" });
  const R = retireAnswer(s, null)!;
  assert.ok(R.years != null && R.years < 30);
  const later = retireAnswer({ ...s, target: "200,000" }, null)!;
  assert.ok(later.years != null && later.years > 30);
});
