/* "Planning for kids?" in the Stages calculator (tools/stages/kids.ts): the
   children's stages counted in years from now, over the plan's own years. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNum } from "@/lib/format";
import { STAGES_DEFAULTS, type StagesInputs } from "@/tools/stages/model";
import { stagesFromKidsYears, stagesKidSegs, stagesMonthly, stagesYears, readKids } from "@/tools/stages/kids";
import { NO_KIDS, type PlanKids } from "../model";

const one: PlanKids = { ...NO_KIDS, planned: 1, firstIn: 2, childcare: true };
const base = (over: Partial<StagesInputs> = {}): StagesInputs => ({ ...STAGES_DEFAULTS, ...over });

test("the stages cover the same years as before, from year 0", () => {
  const s = base(), { stages } = stagesFromKidsYears(s, one, {});
  assert.equal(stagesYears(stages), stagesYears(s.stages));
  assert.equal(stagesYears(s.stages), 30);
  assert.equal(stagesKidSegs(s, one)[0].from, 40);
});

test("without the split, each stage saves the first stage's amount less what its children add", () => {
  const s = base(), { today, ppy } = stagesMonthly(s), segs = stagesKidSegs(s, one), { stages } = stagesFromKidsYears(s, one, {});
  const mo = today.brok;
  assert.equal(ppy, 26);
  segs.forEach((seg, i) => {
    const want = Math.max(0, mo - Math.max(0, seg.change)) + Math.max(0, -seg.change);
    assert.ok(Math.abs((parseNum(stages[i].contrib) * ppy) / 12 - want) < 0.02, stages[i].name + ": " + stages[i].contrib);
    assert.equal(stages[i].period, s.stages[0].period);
    assert.equal(stages[i].nominal, s.stages[0].nominal);
  });
  assert.ok(stages.some((st) => parseNum(st.contrib) < parseNum(s.stages[0].contrib)), "some stage saves less");
});

test("where the children cost more than the saving, that stage saves nothing and is counted", () => {
  const s = base({ stages: [{ ...STAGES_DEFAULTS.stages[0], contrib: "50", period: "Monthly", years: "30" }] });
  const { stages, short } = stagesFromKidsYears(s, one, {});
  assert.ok(short > 0);
  assert.ok(stages.some((st) => parseNum(st.contrib) === 0));
});

test("with the split on, the accounts keep their shares where the cover leaves them", () => {
  const first = { ...STAGES_DEFAULTS.stages[0], contrib: "2,000", period: "Monthly", years: "30", sTrad: 0.5, sRoth: 0.25 };
  const s = base({ saOn: true, stages: [first] });
  const { stages } = stagesFromKidsYears(s, one, {});
  // The brokerage goes first, so a stage costing less than the brokerage's 500 keeps traditional and Roth whole.
  const seg = stagesKidSegs(s, one).findIndex((x) => x.change > 0 && x.change < 500);
  if (seg >= 0) {
    const st = stages[seg], total = parseNum(st.contrib);
    assert.ok(Math.abs(total * (st.sTrad ?? 0) - 1000) < 1);
    assert.ok(Math.abs(total * (st.sRoth ?? 0) - 500) < 1);
  }
});

test("a damaged saved copy reads as no children", () => {
  assert.equal(readKids(null), null);
  assert.equal(readKids({ now: "two" }), null);
  assert.deepEqual(readKids({ now: [3, 99, -1], planned: 9, firstIn: 1 })!.now, [3]);
});
