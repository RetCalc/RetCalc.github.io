/* schedule.ts (doc 3, "Changes ahead", section 3 items 2b and 13): a
   one-stage schedule equals plAtRetire exactly; the worked table in 2b is
   reproduced, and so is its cross-check, stage by stage with the balance
   carried forward; the children's step-downs, the other changes, the
   floor, the household by age and the college years; and the plan the
   engine tests is built from the schedule. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BASIC_INFL } from "@/lib/engine/typed";
import { plAtRetire } from "@/lib/engine/typed-plan";
import type { PlToday } from "@/lib/engine/types";
import { planIn, saveMo, sim } from "../calc";
import { atRetireScheduled, children, collegeWindows, householdAtRetire, householdByAge, schedule, scheduleValue, shortfall } from "../schedule";
import type { Answers } from "../store";
import { FIXTURES } from "../../../scripts/baseline/guide-fixtures.mjs";

const fx = (id: string) => structuredClone(FIXTURES.find((f) => f.id === id)!) as { a: Answers; plus?: Partial<Answers> };
const plan = (a: Answers) => ({ ...a, ...(fx("priya-tom").plus as Partial<Answers>) });
const brief = (L: { from: number; to: number; monthly: number }[]) => L.map((s) => [s.from, s.to, s.monthly]);

test("a one-stage schedule equals plAtRetire exactly", () => {
  for (const id of ["maya-sam", "priya-tom", "couple-58"]) {
    const I = planIn(fx(id).a)!, P = plAtRetire(I) as unknown as Record<string, number> & { path: number[] };
    const Q = atRetireScheduled(I, [{ from: I.age, to: I.retire, monthly: I.monthly }]) as unknown as Record<string, number> & { path: number[] };
    for (const k of ["trad", "roth", "brok", "rothBasis", "brokBasis", "fv"]) assert.ok(Math.abs(P[k] - Q[k]) < 1e-6, id + " " + k + ": " + P[k] + " vs " + Q[k]);
    P.path.forEach((v, i) => assert.ok(Math.abs(v - Q.path[i]) < 1e-6, id + " path " + i));
  }
});

test("doc 3's worked table (2b): five stages from 32 to 60 come to $6,667,133", () => {
  const stages = [{ from: 32, to: 35, monthly: 10000 }, { from: 35, to: 38, monthly: 7500 }, { from: 38, to: 43, monthly: 5500 },
    { from: 43, to: 57, monthly: 7000 }, { from: 57, to: 60, monthly: 9500 }];
  const V = scheduleValue(32, 60, 0.0575, 150000, stages);
  assert.equal(V.A.toFixed(3), "4.785");
  assert.deepEqual(V.each.map(Math.round), [1557223, 987577, 967172, 2071813, 365650]);
  assert.equal(Math.round(V.total), 6667133);
  assert.equal(Math.round(scheduleValue(32, 60, 0.0575, 150000, [{ from: 32, to: 60, monthly: 10000 }]).total), 8694813);
  // the cross-check: each stage grown on its own, the balance carried forward
  let bal = 150000;
  for (const s of stages) bal = plAtRetire({ status: "s", age: s.from, retire: s.to, stopAge: null, real: 0.0575, infl: BASIC_INFL, trad: bal, roth: 0, brok: 0, saveTrad: s.monthly, saveRoth: 0, saveBrok: 0 } as PlToday).fv;
  assert.equal(Math.round(bal), 6667133);
});

test("Priya and Tom: two children planned, three years apart, in childcare (doc 3, item 13's rules)", () => {
  const a = plan(fx("priya-tom").a), L = schedule(a, { monthly: saveMo(a) });
  // Childcare $2,300 (suburb), $1,840 for the second; 6 to 12 $1,400 ($1,120); teens $1,500 ($1,200).
  assert.deepEqual(brief(L), [[32, 35, 10000], [35, 38, 7700], [38, 41, 5860], [41, 44, 6760], [44, 48, 7480], [48, 51, 7380], [51, 54, 7300], [54, 57, 8800], [57, 60, 10000]]);
  assert.equal(L[0].label, "Before children");
  assert.equal(L[1].label, "A child in childcare");
  assert.equal(L[8].label, "Empty nest");
  assert.equal(L[1].src, "estimated");
  // the household before 65, and each child's college years at your ages
  assert.deepEqual(householdByAge(a).filter((h, i, all) => !i || h.n !== all[i - 1].n).map((h) => [h.age, h.n]), [[32, 2], [35, 3], [38, 4], [54, 3], [57, 2]]);
  assert.deepEqual(collegeWindows(a).map((w) => [w.from, w.to]), [[53, 57], [56, 60]]);
  assert.equal(householdAtRetire(a, 60), 2);
  assert.equal(householdAtRetire(a, 55), 3);
});

test("children you have now: today's saving already pays for them, and rises as they grow", () => {
  const a: Answers = { status: "s", age: 40, retire: 65, saved: 0, contrib: 2000, employer: 0, kidsNow: [3], childcare: true };
  assert.deepEqual(brief(schedule(a, { monthly: 2000 })), [[40, 43, 2000], [43, 50, 2900], [50, 56, 2800], [56, 65, 4300]]);
  // overrides replace the defaults (the teen years keep theirs)
  assert.deepEqual(brief(schedule({ ...a, childEarly: 1800, childSchool: 1200 }, { monthly: 2000 })), [[40, 43, 2000], [43, 50, 2600], [50, 56, 2300], [56, 65, 3800]]);
  // childcare by area: a big city costs more before school
  assert.deepEqual(brief(schedule({ ...a, careArea: "city" }, { monthly: 2000 })), [[40, 43, 2000], [43, 50, 3400], [50, 56, 3300], [56, 65, 4800]]);
  assert.equal(children({ ...a, kidsNow: [3, 7] })[1].n, 1);
});

test("the other changes: a raise, a payoff, part-time years, a spouse's pause, a hand edit, and the floor", () => {
  const a: Answers = { status: "m", age: 40, retire: 60, saved: 0, contrib: 1000, employer: 0, events: [
    { id: "r", kind: "raise", at: 45, extra: 500 }, { id: "p", kind: "payoff", at: 50, freed: 800 },
    { id: "t", kind: "parttime", from: 55, to: 57, saving: 0 }, { id: "c", kind: "custom", from: 58, to: 60, delta: -200, label: "Helping a parent" },
  ] };
  const L = schedule(a, { monthly: 1000 });
  assert.deepEqual(brief(L), [[40, 45, 1000], [45, 50, 1500], [50, 55, 2300], [55, 57, 0], [57, 58, 2300], [58, 60, 2100]]);
  assert.match(L[3].label, /Part-time/);
  assert.match(L[5].label, /Helping a parent/);
  // costs above the saving read $0, with a note, not a negative figure
  const b: Answers = { status: "s", age: 30, retire: 60, saved: 0, contrib: 1000, employer: 0, kidsPlanned: 2, firstIn: 0, spacing: 1, childcare: true };
  const F = schedule(b, { monthly: 1000 });
  assert.equal(F[0].monthly, 0);
  assert.ok(F[0].floored);
});

test("a stage the saving can't cover says how far short it is, and the budget's share adds up", () => {
  // Maya and Sam with a second child in three years: today's $1,200 per month,
  // then childcare ($1,840 for a second child) on top of the first child's
  // school years ($1,400, which today's spending already covers), then the
  // first child's teens ($100 more).
  const a: Answers = { ...fx("maya-sam").a, kidsNow: [6], kidsPlanned: 1, firstIn: 3, childcare: true };
  const L = schedule(a, { monthly: saveMo(a) });
  assert.deepEqual(brief(L), [[38, 41, 1200], [41, 45, 0], [45, 47, 0], [47, 51, 0], [51, 54, 1480], [54, 60, 1400], [60, 62, 2600]]);
  assert.equal(L[1].short, 640);
  assert.ok(L[1].floored);
  assert.equal(L[2].short, 740);
  assert.equal(L[3].short, 20);
  const SF = shortfall(L);
  assert.equal(SF.total, 640 * 12 * 4 + 740 * 12 * 2 + 20 * 12 * 4);
  assert.equal(SF.most, 740);
});

test("the plan the engine tests is built from the schedule, and Over.flat is the plan without it", () => {
  const flat = fx("priya-tom").a, a = plan(flat), S = sim(a)!, T = sim(a, { flat: true })!;
  assert.equal(Math.round(T.fv), Math.round(sim(flat)!.fv));
  assert.equal(Math.round(T.fv), 8694813);
  const V = scheduleValue(32, 60, 0.0575, 150000, S.sched!);
  assert.ok(Math.abs(S.fv - V.total) < 0.01, S.fv + " vs " + V.total);
  assert.ok(S.fv < T.fv);
  assert.equal(S.sched!.length, 9);
});
