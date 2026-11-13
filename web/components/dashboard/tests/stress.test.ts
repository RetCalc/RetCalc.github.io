/* "If things go wrong": each hard event's inputs to the plan's Drawdown run
   (stress.ts). The survivor benefit and Social Security paying less go in
   as extra expenses; they must run exactly as the benefits themselves
   changed would. Long-term care is an extra expense in its years; the
   life insurance found is the least that brings the chance back. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { DRAWDOWN_DEFAULTS, drawdownSetup, type DrawdownState } from "@/tools/drawdown/model";
import { ddPrep, ddQuick, type DdOpts } from "@/lib/engine/typed-drawdown";
import { badStarts, careItems, coverFor, holds, runSet, ssCutItems, ssStreams, stepItems, survivorRun, BAD_YEARS } from "../stress";

/** A couple retiring at 62 with $1.4M, starting at 8% (so some starts fail),
    Social Security of $30,000 and $18,000 per year from 67 and 64. */
function plan(over: Record<string, unknown> = {}) {
  return drawdownSetup({
    ...DRAWDOWN_DEFAULTS, strategy: "fixed", rate: "8", initial: "1,400,000", years: "33", retireAge: "62", stock: "60",
    ssMode: "manual", ssWho: "couple", ssAmount: "30,000", ssAmount2: "18,000", ssDelay: "67", ssDelay2: "64", ...over,
  } as unknown as DrawdownState);
}
const same = (a: ReturnType<typeof runSet>, b: ReturnType<typeof runSet>, msg: string) => {
  assert.equal(a.ok, b.ok, msg + ": starts that lasted");
  assert.ok(Math.abs(a.mid.end - b.mid.end) < 1e-6, `${msg}: middle market ${a.mid.end} vs ${b.mid.end}`);
  assert.equal(a.mid.outAge, b.mid.outAge, msg + ": age it ran out");
};

test("the run set counts as the Retirement tab's own run does", () => {
  const { o, P } = plan(), R = runSet(o, P), Q = ddQuick(o);
  assert.equal(R.rate, Q.successRate);
  assert.ok(R.rate > 0.3 && R.rate < 1, "a plan some starts fail: " + R.rate);
  if (R.mid.outAge == null) assert.ok(Math.abs(R.mid.end - Q.medianEnd) < 1e-6);
});

test("Social Security as two streams, or one split by each benefit", () => {
  const { o } = plan();
  assert.deepEqual(ssStreams(o), [{ a: 30000, d: 5 }, { a: 18000, d: 2 }]);
  const one = { ...o, ssAnnual: 48000, ssAnnual2: 0, ssDelayYears: 3, ssDelayYears2: 0 } as DdOpts;
  assert.deepEqual(ssStreams(one, [2500, 1500]), [{ a: 30000, d: 3 }, { a: 18000, d: 3 }]);
});

test("a stretch at one amount is one item; the last runs for good", () => {
  const items = stepItems("x", [0, 0, 5, 5, 5, 8, 8]);
  assert.deepEqual(items.map((i) => [i.startYear, i.annual, i.duration]), [[3, 5, { type: "years", years: 3 }], [6, 8, { type: "forever" }]]);
  assert.ok(items.every((i) => i.inflate && i.on !== false));
});

test("survivor: the larger benefit only, as if the smaller one stopped, and 75% spending", () => {
  // Both claimed by year 6: from then the household keeps the $30,000 one.
  const { o, P } = plan(), k = 8, S = survivorRun(o, P, k);
  assert.deepEqual(S.lost.slice(0, k), Array(k).fill(0));
  assert.ok(S.lost.slice(k).every((v) => v === 18000));
  assert.ok(S.P.path.every((m, y) => Math.abs(m - P.path[y] * (y >= k ? 0.75 : 1)) < 1e-12));
  // Died before the first benefit starts: until then the second is the larger one paid.
  const S0 = survivorRun(o, P, 0);
  assert.deepEqual(S0.lost.slice(0, 5), [0, 0, 0, 0, 0]);
  assert.ok(S0.lost.slice(5).every((v) => v === 18000));
});

test("survivor's extra expense runs exactly as the benefit itself changed", () => {
  // Both benefits from year 0; the partner dies in year 0: one benefit of $30,000.
  const { o, P } = plan({ ssDelay: "62", ssDelay2: "62" }), S = survivorRun(o, P, 0, undefined, 1);
  const alone = { ...o, ssAnnual: 30000, ssAnnual2: 0 } as DdOpts;
  same(runSet(S.o, S.P), runSet(alone, P), "survivor benefit");
});

test("Social Security at 83% from a year: exactly every benefit scaled from then", () => {
  const { o, P } = plan({ ssDelay: "62", ssDelay2: "62" });
  const cut = { ...o, expenseItems: ssCutItems(o, 0, 0.83) };
  const scaled = { ...o, ssAnnual: 30000 * 0.83, ssAnnual2: 18000 * 0.83 } as DdOpts;
  same(runSet(cut, P), runSet(scaled, P), "benefits at 83%");
  // From year 4, with the second claimed in year 2 and the first in year 5.
  const later = plan().o, items = ssCutItems(later, 4, 0.83);
  assert.deepEqual(items.map((i) => [i.startYear, i.annual, i.duration.type]), [[5, Math.round(18000 * 0.17), "years"], [6, Math.round(48000 * 0.17), "forever"]]);
});

test("long-term care: an extra expense in its years, on top of spending", () => {
  const { o, P } = plan(), items = careItems(o, 23, 100000, 3);
  assert.deepEqual(items.map((i) => [i.startYear, i.annual, i.inflate, i.duration]), [[24, 100000, true, { type: "years", years: 3 }]]);
  assert.deepEqual(careItems(o, o.years, 100000, 3), [], "past the plan's last year");
  assert.deepEqual(careItems(o, 5, 0, 3), []);
  const base = runSet(o, P), care = runSet({ ...o, expenseItems: [...o.expenseItems, ...items] }, P);
  assert.ok(care.ok <= base.ok && (care.mid.outAge != null || care.mid.end < base.mid.end));
});

test("life insurance: the least sum (to $10,000) that brings the chance back", () => {
  const { o, P } = plan(), base = runSet(o, P).rate;
  const S = survivorRun(o, P, 10, undefined, 1); // no spending drop: only the lost benefit
  const want = base, x = coverFor(S.o, S.P, 10, want);
  assert.ok(x != null && x > 0, "a sum is needed: " + x);
  const at = (v: number) => runSet({ ...S.o, incomeItems: [...S.o.incomeItems, { name: "i", annual: v, inflate: true, startYear: 11, on: true, duration: { type: "once" } }] }, S.P).rate;
  assert.ok(at(x!) >= want - 1e-9);
  assert.ok(at(x! - 20000) < want, "$20,000 less isn't enough");
  assert.equal(coverFor(o, P, 10, base), 0, "nothing lost, nothing needed");
});

test("bad markets: each January the record covers to the plan's end", () => {
  const { o, P } = plan();
  assert.deepEqual(badStarts(o, P).map((s) => s.year), [1929, 1937, 1966, 1973]);
  assert.deepEqual(badStarts({ ...o, years: 20 }, ddPrep({ ...o, years: 20 })).map((s) => s.year), [1929, 1937, 1966, 1973, 2000]);
  assert.equal(BAD_YEARS.length, 6);
  for (const s of badStarts(o, P)) assert.ok(s.outAge == null ? s.end > 0 : s.end === 0 && s.outAge >= 62 && s.outAge < 95);
});

test("holds up: no more than 10 points below the plan's own", () => {
  assert.ok(holds(0.9, 0.8));
  assert.ok(!holds(0.9, 0.799));
  assert.ok(holds(0.5, 0.7));
});
