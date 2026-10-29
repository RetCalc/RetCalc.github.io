/* Catch-up contributions on the Paycheck tab: the caps include each
   person's catch-up from their age at the end of the year (401(k) 50, or 60
   to 63 in place of it; IRA 50; HSA 55), nothing changes without an age, and
   the captions say why. Limits: IRS Notice 2025-67 and Rev. Proc. 2025-19
   (2026). Run with `npm run test:budget`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BUDGET_DEFAULTS, type BudgetInputs } from "../model";
import { PC_ZERO, hsaCatchUp, iraLimit, k401Limit, paycheckFill, paycheckInput, paycheckRun, pcCap, pcCapAhead, pcCatchText, pcRothRoom, pcSplit, type PcAges } from "../paycheck-math";

const near = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);
/** Yearly pay, paid monthly so a "per check" figure is a month. */
const one = (patch: Partial<BudgetInputs> = {}, ages?: PcAges) =>
  paycheckInput({ ...BUDGET_DEFAULTS, pcGross: "200,000", pcState: "TX", pcFreq: "12", pcFreq2: "12", ...patch }, "TX", undefined, ages);
const two = (patch: Partial<BudgetInputs> = {}, ages?: PcAges) => one({ pcStatus: "m2", pcGross2: "150,000", ...patch }, ages);
const yr = (pi: ReturnType<typeof one>, s: "match" | "k401max" | "hsa" | "rothIra") => pcCap(pi, s, PC_ZERO) * pi.p;

test("the limits by age: 2026 figures", () => {
  assert.equal(k401Limit(null), 24500);
  assert.equal(k401Limit(49), 24500);
  assert.equal(k401Limit(50), 32500);
  assert.equal(k401Limit(59), 32500);
  // 60 to 63: the larger catch-up in place of the 50 one.
  assert.equal(k401Limit(60), 35750);
  assert.equal(k401Limit(63), 35750);
  assert.equal(k401Limit(64), 32500);
  assert.equal(iraLimit(null), 7500);
  assert.equal(iraLimit(49), 7500);
  assert.equal(iraLimit(50), 8600);
  assert.equal(hsaCatchUp(54), 0);
  assert.equal(hsaCatchUp(55), 1000);
  assert.equal(hsaCatchUp(null), 0);
});

test("without an age every cap is the base limit, as before", () => {
  const pi = one();
  near(yr(pi, "k401max"), 24500); near(yr(pi, "hsa"), 4400); near(yr(pi, "rothIra"), 7500);
  const withNulls = one({}, [null, null]);
  for (const s of ["k401max", "hsa", "rothIra"] as const) near(yr(withNulls, s), yr(pi, s));
  assert.equal(JSON.stringify(paycheckRun(withNulls).k401s), JSON.stringify(paycheckRun(pi).k401s));
});

test("one person: the cap includes the catch-up that applies at their age", () => {
  near(yr(one({}, [49, null]), "k401max"), 24500);
  near(yr(one({}, [50, null]), "k401max"), 32500);
  near(yr(one({}, [61, null]), "k401max"), 35750);
  near(yr(one({}, [66, null]), "k401max"), 32500);
  near(yr(one({}, [50, null]), "rothIra"), 8600);
  near(yr(one({}, [54, null]), "hsa"), 4400);
  near(yr(one({}, [55, null]), "hsa"), 5400);
  near(yr(one({ pcHsaFamily: true }, [55, null]), "hsa"), 9750);
});

test("the 401(k) line beyond the match has the room left under the person's own limit", () => {
  const pi = one({ pcMatch: "1,000" }, [52, null]);
  near(pcCap(pi, "k401max", pi.amounts) * 12, 32500 - 12000);
});

test("two incomes: a cap per person from each one's own age", () => {
  const pi = two({}, [52, 40]);
  near(yr(pi, "k401max"), 32500 + 24500);
  near(yr(pi, "rothIra"), 8600 + 7500);
  // Self-only plans each: only the one of 55 or older gets the catch-up.
  const self2 = two({ pcHsaBoth: true }, [56, 40]);
  near(yr(self2, "hsa"), 4400 + 1000 + 4400);
  // Both in their 60s: both the larger catch-up.
  near(yr(two({}, [61, 63]), "k401max"), 35750 * 2);
});

test("the family HSA limit is shared: each spouse of 55 or older adds their own $1,000", () => {
  const fam = (ages: PcAges, m: Partial<BudgetInputs> = {}) => two({ pcHsaFamily: true, ...m }, ages);
  near(yr(fam([50, 50]), "hsa"), 8750);
  near(yr(fam([56, 50]), "hsa"), 9750);
  near(yr(fam([56, 57]), "hsa"), 10750);
  // Married on one income: the spouse's age still counts for the family plan.
  const solo = one({ pcStatus: "m", pcHsaFamily: true }, [56, 57]);
  near(yr(solo, "hsa"), 10750);
  // A single person on family coverage has no spouse to add.
  near(yr(one({ pcStatus: "s", pcHsaFamily: true }, [56, 57]), "hsa"), 9750);
});

test("a spouse's age does not raise a one-income 401(k) or IRA cap", () => {
  const pi = one({ pcStatus: "m" }, [45, 58]);
  near(yr(pi, "k401max"), 24500); near(yr(pi, "rothIra"), 7500);
});

test("the splits follow each person's own limit", () => {
  const pi = two({ pcK401max: "2,000", pcRothIra: "1,000", pcHsaBoth: true, pcHsa: "400" }, [52, 40]);
  const sp = pcSplit(pi);
  // Beyond the match: in proportion to the room under each limit.
  near(sp.k401max[0] / sp.k401max[1], (32500 / 12 - sp.match[0]) / (24500 / 12 - sp.match[1]), 1e-6);
  near(sp.k401max[0] + sp.k401max[1], 2000);
  // The IRA by limit: 8,600 and 7,500.
  near(sp.rothIra[0], (1000 * 8600) / 16100); near(sp.rothIra[1], (1000 * 7500) / 16100);
  // Filled to the cap, nobody goes over their own limit.
  const full = { ...pi.amounts, rothIra: pcCap(pi, "rothIra", pi.amounts) };
  const fs = pcSplit(pi, full);
  near(fs.rothIra[0] * 12, 8600); near(fs.rothIra[1] * 12, 7500);
  // Two self-only HSAs, one of them 55 or older: filled to the cap, each is at their own limit.
  const hpi = { ...pi, ages: [56, 40] as PcAges };
  const hfull = { ...hpi.amounts, hsa: pcCap(hpi, "hsa", hpi.amounts) };
  const hs = pcSplit(hpi, hfull);
  near(hs.hsa[0] * 12, 5400); near(hs.hsa[1] * 12, 4400);
});

test("Fill goes to the higher cap, and not past it", () => {
  const pi = one({ pcGross: "400,000", pcOrder: "k401max,match,hsa,ef,rothIra,brok", pcMatch: "0" }, [55, null]);
  const a = paycheckFill(pi, ["k401max"]);
  near(a.k401max * 12, 32500, 0.1); // whole cents per check
  const base = paycheckFill(one({ pcGross: "400,000" }), ["k401max"]);
  near(base.k401max * 12, 24500, 0.1);
});

test("the Roth income test scales the whole limit, catch-up included", () => {
  const b = { ...BUDGET_DEFAULTS, pcGross: "160,000", pcStatus: "s" as const, pcState: "TX", pcFreq: "12" };
  const young = paycheckInput(b, "TX", undefined, [40, null]), old = paycheckInput(b, "TX", undefined, [55, null]);
  const ry = pcRothRoom(young, paycheckRun(young)), ro = pcRothRoom(old, paycheckRun(old));
  assert.equal(ry.limit, 7500);
  assert.equal(ro.limit, 8600);
  assert.ok(ro.direct > ry.direct);
});

test("years ahead: the catch-up opens as each person reaches the age", () => {
  const pi = one({ pcMatch: "0" }, [48, null]);
  const at = (k: number) => pcCapAhead(pi, "k401max", pi.amounts, k) * pi.p;
  near(at(0), 24500); near(at(1), 24500);
  near(at(2), 32500); // 50
  near(at(11), 32500); near(at(12), 35750); // 60
  near(at(15), 35750); near(at(16), 32500); // 64: back to the 50 catch-up
  // HSA at 55, IRA at 50.
  const hsaAt = (k: number) => pcCapAhead(pi, "hsa", pi.amounts, k) * pi.p;
  near(hsaAt(6), 4400); near(hsaAt(7), 5400);
  const iraAt = (k: number) => pcCapAhead(pi, "rothIra", pi.amounts, k) * pi.p;
  near(iraAt(1), 7500); near(iraAt(2), 8600);
  // No ages: the same at any distance.
  const none = one();
  near(pcCapAhead(none, "k401max", none.amounts, 20) * none.p, 24500);
});

test("captions: why the limit is higher, and what it could be without an age", () => {
  const none = pcCatchText(one(), "k401max", PC_ZERO);
  assert.equal(none.included, null);
  assert.equal(none.ifText, "if you are 50 or older");
  near(none.ifCap * 12, 32500);
  assert.equal(pcCatchText(one(), "hsa", PC_ZERO).ifText, "if you are 55 or older");
  near(pcCatchText(one(), "hsa", PC_ZERO).ifCap * 12, 5400);

  const at52 = pcCatchText(one({}, [52, null]), "k401max", PC_ZERO);
  assert.equal(at52.included, "includes the age 50 catch-up");
  assert.equal(at52.ifText, null);
  assert.equal(pcCatchText(one({}, [61, null]), "k401max", PC_ZERO).included, "includes the catch-up for age 60 to 63");
  assert.equal(pcCatchText(one({}, [57, null]), "hsa", PC_ZERO).included, "includes the age 55 catch-up");
  // Under the age: nothing to say.
  const young = pcCatchText(one({}, [45, null]), "k401max", PC_ZERO);
  assert.equal(young.included, null); assert.equal(young.ifText, null);

  // Two incomes: who it is for, and whose age is missing.
  assert.equal(pcCatchText(two({}, [52, 40]), "k401max", PC_ZERO).included, "includes the age 50 catch-up for you");
  assert.equal(pcCatchText(two({}, [40, 52]), "k401max", PC_ZERO).included, "includes the age 50 catch-up for your spouse");
  assert.equal(pcCatchText(two({}, [52, 53]), "rothIra", PC_ZERO).included, "includes the age 50 catch-up for both of you");
  assert.equal(pcCatchText(two({}, [61, 52]), "k401max", PC_ZERO).included, "includes the catch-ups for age 50 and for 60 to 63 for both of you");
  assert.equal(pcCatchText(two({}, [52, null]), "k401max", PC_ZERO).ifText, "if your spouse is 50 or older");
  assert.equal(pcCatchText(two({}, [null, null]), "k401max", PC_ZERO).ifText, "if either of you is 50 or older");
  // No ages at all and nothing changes: the old behavior.
  assert.equal(pcCatchText(two(), "match", PC_ZERO).included, null);
});

test("over the base limit stays over: a person under 50 is not given room", () => {
  const pi = one({ pcK401max: "2,700" }, [45, null]); // 32,400 per year at 12 checks
  assert.ok(pi.amounts.k401max > pcCap(pi, "k401max", pi.amounts));
  const ok = one({ pcK401max: "2,700" }, [52, null]);
  assert.ok(ok.amounts.k401max <= pcCap(ok, "k401max", ok.amounts) + 0.005);
});
