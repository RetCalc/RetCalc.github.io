/* report/model.ts: the full report's figures for every fixture household,
   and Maya and Sam with a second child and college for two. The pages a
   plan gets follow from it; money in and out of retirement balance; the
   figures are the Guide's own. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { COLLEGE_DEFAULTS } from "@/tools/college/model";
import { factsHere } from "../moves";
import { reportModel } from "../report/model";
import type { Answers } from "../store";
import { FIXTURES } from "../../../scripts/baseline/guide-fixtures.mjs";

const LEV = { retire: true, save: true, spend: true };
const fx = (id: string) => structuredClone(FIXTURES.find((f) => f.id === id)!.a) as Answers;
const DAY = new Date("2026-10-14T12:00:00");

test("every fixture household gets a report, its pages in order, money in and out balancing", () => {
  for (const f of FIXTURES) {
    const M = reportModel(structuredClone(f.a) as Answers, {}, LEV, {}, DAY);
    assert.ok(M, f.id);
    assert.deepEqual(M.pages.map((p) => p.n), M.pages.map((_, i) => i + 1), f.id);
    assert.equal(M.pages[0].id, "cover");
    const tin = M.money.in.reduce((t, x) => t + x[1], 0), tout = M.money.out.reduce((t, x) => t + x[1], 0);
    assert.ok(Math.abs(tin - tout) < 1, f.id + ": in " + tin + " vs out " + tout);
    assert.deepEqual(M.stops.map((s) => s.age), M.stops.map((s) => s.age).sort((x, y) => x - y), f.id + " stops in order");
    assert.equal(M.pages.filter((p) => p.id === "years").length, Math.ceil(M.rows.length / M.perPage));
    assert.equal(M.runs.length, M.S.H.total);
  }
});

test("Maya and Sam: the Guide's figures, the health page, one child in college, no family page", () => {
  const a = fx("maya-sam"), M = reportModel(a, {}, LEV, { you: "Maya", spouse: "Sam" }, DAY)!;
  const F = factsHere(a, LEV);
  assert.equal(M.S.fv, F.S!.fv);
  assert.equal(M.need, F.need);
  assert.equal(M.who.title, "Maya and Sam");
  assert.equal(M.who.pair(62), "Maya 62, Sam 60");
  assert.ok(M.pages.some((p) => p.id === "health"));
  assert.ok(!M.pages.some((p) => p.id === "family"));
  // college is yes, with a child of 6: the College Savings defaults, one child
  assert.equal(M.college!.kids.length, 1);
  assert.deepEqual(M.levers3.map((l) => l.fig), ["58", "Stop", "$98,000"]);
});

test("a second child and college for two add their pages, with the shortfall and today's-dollar college", () => {
  const clState = { ...COLLEGE_DEFAULTS, kids: [
    { preset: "27000", cost: "27,000", years: "12", collegeYrs: "4" }, { preset: "27000", cost: "27,000", years: "21", collegeYrs: "4" }] };
  const a: Answers = { ...fx("maya-sam"), kidsNow: [6], kidsPlanned: 1, firstIn: 3, childcare: true, clState, collegeMo: 1061 };
  const M = reportModel(a, {}, LEV, {}, DAY)!;
  assert.deepEqual(M.pages.map((p) => p.id).slice(0, 6), ["cover", "stand", "road", "family", "college", "last"]);
  assert.equal(M.pages.find((p) => p.id === "college")!.title, "College for two");
  assert.equal(M.changes!.short.total, 640 * 12 * 4 + 740 * 12 * 2 + 20 * 12 * 4);
  assert.equal(Math.round(M.changes!.flat!.fv), 1518176);
  assert.ok(M.college!.totalToday < M.college!.kids.reduce((t, k) => t + k.total, 0));
  assert.ok(M.list.some((m) => m.id === "short"));
  assert.equal(M.who.title, "Your retirement plan");
});

test("the five plan-only pages appear for the plans that need them, from the Guide's and tools' own figures", () => {
  const early = reportModel(fx("early-55"), {}, LEV, {}, DAY)!;
  assert.ok(early.pages.some((p) => p.id === "bridge"));
  assert.equal(early.bridge!.years, 5);
  assert.ok(early.bridge!.rule55);
  assert.ok(!early.pages.some((p) => p.id === "social"), "single: no couple's Social Security page");

  const c58 = reportModel(fx("couple-58"), {}, LEV, {}, DAY)!;
  assert.ok(c58.pages.some((p) => p.id === "pension") && c58.pages.some((p) => p.id === "social"));
  assert.equal(c58.pension!.monthly, 1500);
  assert.equal(c58.social!.survivor, Math.max(c58.S.ss.a1, c58.S.ss.a2));
  // the claiming ladder at the plan's own age is the plan's own benefit
  assert.ok(Math.abs(c58.social!.ladder1.find((x) => x.age === c58.S.ss.claim)!.v - c58.S.ss.a1) < 1e-6);

  const debtRows = [{ desc: "Credit card", balance: "9,000", apr: "22.9", min: "245" }, { desc: "Car loan", balance: "9,000", apr: "6.4", min: "320" }];
  const maya = reportModel({ ...fx("maya-sam"), debtRows, debtExtra: 300, optC1: 70, optC2: 68, optF: 3, optU: 2 }, {}, LEV, {}, DAY)!;
  assert.ok(maya.pages.some((p) => p.id === "debt") && maya.pages.some((p) => p.id === "roadmap"));
  assert.deepEqual(maya.debt!.plan!.order.map((d) => d.desc), ["Credit card", "Car loan"], "highest rate first");
  assert.ok(maya.debt!.plan!.interest < maya.debt!.plan!.minInterest);
  assert.ok(maya.roadmap!.base, "the plan without the roadmap, for the comparison");
  assert.equal(maya.roadmap!.claimsShort, "70 & 68");

  const dan = reportModel(fx("dan"), {}, LEV, {}, DAY)!;
  assert.ok(dan.pages.some((p) => p.id === "debt") && !dan.debt!.plan, "quick debt answers: totals, no tool plan");
  assert.ok(!dan.pages.some((p) => p.id === "bridge" || p.id === "pension" || p.id === "roadmap"));
});
