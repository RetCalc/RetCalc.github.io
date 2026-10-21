/* The tax years, with a made-up year after the newest added here (never in
   the shipped data; 2027 while 2026 is the newest): the Income Tax tool's
   Tax year picker shows once there are two years, each year's figures stay
   its own, every other tool moves to the newest, and a year can run on the
   year before's state figures. Run with `npm run test:tax`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { addYear } from "@/lib/engine/core";
import { dataYears, yearData } from "@/lib/engine/typed";
import { TAX_DEFAULTS, runTax, taxInput, taxYearOf, taxYears } from "../model";
import { stateRuleRows } from "../stateRules";

/** The newest shipped year, and the made-up one after it. */
const N = dataYears()[0], F = N + 1;
const salary = { ...TAX_DEFAULTS, gross: "100,000", state: "IL" };
const retired = { ...TAX_DEFAULTS, mode: "retire" as const, state: "IL" };
/** The picker's rule in Tax.tsx: hidden while there's one year. */
const pickerShows = () => taxYears().length > 1;

/* What the tool shows with the shipped data, before the made-up year. */
const before = { salary: runTax(taxInput(salary, true)), retired: runTax(taxInput(retired, true)) };

test("the Income Tax tool starts on the newest year", () => {
  assert.equal(TAX_DEFAULTS.year, String(N));
  assert.equal(taxYearOf(salary), N);
  // While there's one year (2026 alone, today) there's nothing to pick.
  if (dataYears().length === 1) assert.equal(pickerShows(), false);
});

test("a made-up next year brings the picker, newest first", () => {
  // Brackets and the standard deduction 3% higher; the states still on the
  // year before's figures, as when the IRS publishes before the states.
  const fake = structuredClone(yearData(N));
  fake.year = F;
  for (const k of ["s", "m"] as const) {
    fake.fed[k] = fake.fed[k].map(([at, rate]) => [Math.round(at * 1.03), rate]);
    fake.fedStd[k] = Math.round(fake.fedStd[k] * 1.03);
  }
  fake.states = yearData(N).states;
  addYear(fake);

  assert.deepEqual(dataYears().slice(0, 2), [F, N]);
  assert.deepEqual(taxYears().slice(0, 2), [F, N]);
  assert.equal(pickerShows(), true);
});

test("the picker switches the figures, and the older year stays as it was", () => {
  const older = runTax(taxInput({ ...salary, year: String(N) }, true));
  const next = runTax(taxInput({ ...salary, year: String(F) }, true));
  assert.equal(older.federal, before.salary.federal, "the older year unchanged by adding one");
  assert.equal(older.fedDed, yearData(N).fedStd.s);
  assert.equal(next.fedDed, Math.round(yearData(N).fedStd.s * 1.03));
  assert.ok(next.federal < older.federal, "the wider brackets tax $100,000 less");
  // Both years are on the same state figures, so the state tax matches.
  assert.equal(next.state, older.state);

  const olderRet = runTax(taxInput({ ...retired, year: String(N) }, true));
  const nextRet = runTax(taxInput({ ...retired, year: String(F) }, true));
  assert.equal(olderRet.total, before.retired.total, "the older year's retirement tax unchanged");
  assert.notEqual(nextRet.federal, olderRet.federal);
});

test("per year that isn't there falls back to the newest", () => {
  assert.equal(taxYearOf({ ...salary, year: "1999" }), F);
  assert.equal(taxYearOf({ ...salary, year: "" }), F);
});

test("everything but Income Tax itself uses the newest year", () => {
  // Budget, Healthcare and the Guide borrow Income Tax's inputs without its year.
  const borrowed = runTax(taxInput({ ...salary, year: String(N) }));
  const newest = runTax(taxInput({ ...salary, year: String(F) }, true));
  assert.equal(borrowed.federal, newest.federal);
  assert.equal(yearData().year, F);
});

test("per year on the year before's state figures says so", () => {
  assert.equal(yearData(F).states.year, yearData(N).states.year);
  assert.notEqual(yearData(F).states.year, F);
  assert.deepEqual(stateRuleRows("IL", "s", F), stateRuleRows("IL", "s", N));
});
