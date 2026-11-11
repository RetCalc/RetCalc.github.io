/* How your assumptions compare (assume-bench.ts): the bands, the usual
   figures sitting in the middle, the presets' places, and the effects
   adding up. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MID, STEP, atRetirement, bandOf, kidsRatio, scalePos, shareOut, stepsFrom, typicalRaise } from "../assume-bench";

const growthBand = (real: number, infl = 0.03) => bandOf(stepsFrom((1 + real) * (1 + infl) - 1, MID.growth, STEP.growth));

test("one step either side is still Balanced; two is Very", () => {
  assert.equal(bandOf(0), "bal");
  assert.equal(bandOf(1), "bal");
  assert.equal(bandOf(-1), "bal");
  assert.equal(bandOf(1.01), "aggr");
  assert.equal(bandOf(-1.5), "cons");
  assert.equal(bandOf(2), "vaggr");
  assert.equal(bandOf(-2), "vcons");
});

test("the usual figures sit in the middle", () => {
  assert.equal(stepsFrom(1.045 * 1.03 - 1, MID.growth, STEP.growth), 0);
  assert.ok(Object.is(stepsFrom(0.03, MID.inflation, STEP.inflation, false) + 0, 0));
  assert.equal(bandOf(stepsFrom(100, MID.ssPct, STEP.ssPct)), "bal");
  assert.equal(bandOf(stepsFrom(80, MID.ssPct, STEP.ssPct)), "bal");
  assert.equal(bandOf(stepsFrom(95, MID.endAge, STEP.endAge, false)), "bal");
});

test("Profile's investing presets land where their names say", () => {
  assert.equal(growthBand(0.02), "cons");
  assert.equal(growthBand(0.03), "bal");
  assert.equal(growthBand(0.045), "bal");
  assert.equal(growthBand(0.0575), "bal");
  assert.equal(growthBand(0.07), "aggr");
});

test("13% growth is very aggressive, 5% is very conservative", () => {
  assert.equal(bandOf(stepsFrom(0.13, MID.growth, STEP.growth)), "vaggr");
  assert.equal(bandOf(stepsFrom(0.05, MID.growth, STEP.growth)), "cons");
  assert.equal(bandOf(stepsFrom(0.045, MID.growth, STEP.growth)), "vcons");
});

test("less inflation leans aggressive: 2.4% to 3.6% is balanced, 2% aggressive", () => {
  assert.equal(bandOf(stepsFrom(0.025, MID.inflation, STEP.inflation, false)), "bal");
  assert.equal(bandOf(stepsFrom(0.035, MID.inflation, STEP.inflation, false)), "bal");
  assert.equal(bandOf(stepsFrom(0.02, MID.inflation, STEP.inflation, false)), "aggr");
  assert.equal(bandOf(stepsFrom(0.015, MID.inflation, STEP.inflation, false)), "vaggr");
  assert.equal(bandOf(stepsFrom(0.04, MID.inflation, STEP.inflation, false)), "cons");
});

test("typical raises fall with age", () => {
  assert.ok(typicalRaise(25, 65) > typicalRaise(40, 65));
  assert.ok(typicalRaise(40, 65) > typicalRaise(55, 65));
  assert.equal(typicalRaise(58, 65), 0.005);
  // 10% raises every year at 34 is very aggressive.
  assert.equal(bandOf(stepsFrom(0.07, typicalRaise(34, 65), STEP.raise)), "vaggr");
});

test("children's costs against the typical", () => {
  const none = { early: null, school: null, teen: null, later: null };
  assert.equal(kidsRatio(none, 2, true, "suburb"), 1);
  const half = kidsRatio({ early: 1150, school: 700, teen: 750, later: null }, 1, true, "suburb");
  assert.ok(Math.abs(half - 0.5) < 0.001);
  assert.equal(bandOf(stepsFrom(half, 1, STEP.kids, false)), "vaggr");
  assert.equal(kidsRatio(none, 0, false, "city"), 1);
});

test("effects shared out add up to the whole", () => {
  const out = shareOut([300, 100, -50], 400);
  assert.ok(Math.abs(out.reduce((a, b) => a + b, 0) - 400) < 1e-9);
  assert.ok(out[0] > 300 && out[2] < 0);
  assert.deepEqual(shareOut([0, 0], 10), [0, 0]);
});

test("a year at retirement is worth itself; later years less", () => {
  assert.equal(atRetirement(1000, 0, 1), 1000);
  assert.ok(Math.abs(atRetirement(1000, 1, 1) - 1000 / 1.02) < 1e-9);
  assert.equal(atRetirement(1000, 0, 0), 0);
});

test("the scale: Balanced fills the middle fifth, the ends held in", () => {
  assert.equal(scalePos(0), 0.5);
  assert.ok(Math.abs(scalePos(1) - 0.6) < 1e-9);
  assert.ok(Math.abs(scalePos(-1) - 0.4) < 1e-9);
  assert.ok(Math.abs(scalePos(2) - 0.8) < 1e-9);
  assert.ok(scalePos(9) < 1 && scalePos(-9) > 0);
});
