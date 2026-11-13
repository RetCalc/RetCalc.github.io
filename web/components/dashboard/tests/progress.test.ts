/* Your plan over time (progress.ts): the snapshot kept with an entry,
   read back from storage; which entries "Since" and "Against your plan"
   compare; the net worth change split into saved and the rest; and the
   projected path, in later dollars, against later balances. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { aheadOf, planAt, planLine, planRef, readPlan, sinceBase, splitChange, type PlanSnap } from "../progress";
import type { Entry } from "../store";

const snap = (o: Partial<PlanSnap> = {}): PlanSnap => ({
  nw: 100000, score: 70, chance: 0.81, supports: 6450, atRetire: 900000, retireYear: 2050,
  saving: 1000, inflation: 0, path: [100000, 110000, 121000, 133000], first: 0.5, ...o,
});
const entry = (date: string, nw: number, plan?: PlanSnap | null): Entry => ({
  date, from: "accounts", items: [{ id: "a", side: "asset", kind: "workplace", name: "401(k)", value: nw }], ...(plan !== undefined ? { plan } : {}),
});
const nwOf = (e: Entry) => e.items.reduce((s, i) => s + (i.side === "asset" ? i.value : -i.value), 0);

test("a stored snapshot reads back with every field, and a broken one is dropped", () => {
  const s = snap();
  assert.deepEqual(readPlan(JSON.parse(JSON.stringify(s))), s);
  // Waiting to be worked out stays waiting.
  assert.equal(readPlan(null), null);
  // No net worth, or not an object: as if the entry had none.
  assert.equal(readPlan({ score: 70 }), undefined);
  assert.equal(readPlan("x"), undefined);
  // Missing figures come back empty, never as junk.
  const r = readPlan({ nw: 5, path: [1, "x", 2], first: 7, saving: -3 })!;
  assert.deepEqual([r.chance, r.supports, r.path, r.first, r.saving, r.inflation], [null, null, [1, 2], 1, 0, 0.03]);
});

test("the snapshot stays small", () => {
  // 40 years to retirement, rounded to $100: well under a kilobyte.
  const s = snap({ path: Array.from({ length: 41 }, (_, i) => Math.round((250000 * 1.05 ** i) / 100) * 100) });
  assert.ok(JSON.stringify(s).length < 700, String(JSON.stringify(s).length));
});

test("Since compares the newest entry with the latest one before it that kept the plan", () => {
  const old = entry("2026-01-10", 90000); // saved before plans were kept
  const a = entry("2026-08-12", 100000, snap());
  const b = entry("2026-09-12", 101000); // none kept
  // Only once the newest entry was saved with the plan kept.
  assert.equal(sinceBase([old, a, b]), null);
  assert.equal(sinceBase([old, a]), null);
  const c = entry("2026-10-12", 108200, null);
  assert.equal(sinceBase([old, a, b, c])?.date, "2026-08-12");
  assert.equal(sinceBase([old, c]), null);
});

test("net worth's change splits into what the plan saved and the rest", () => {
  const base = { date: "2026-08-12", plan: { saving: 1050, retireYear: 2050 } };
  // Two months at $1,050: $2,100 saved; the rest of $8,200 is markets.
  const s = splitChange(8200, base, "2026-10-12");
  assert.equal(Math.round(s.months), 2);
  assert.equal(s.saved, 2100);
  assert.equal(s.other, 6100);
  // A fall: saved still counts, markets took the rest.
  assert.deepEqual([splitChange(-1000, base, "2026-10-12").saved, splitChange(-1000, base, "2026-10-12").other], [2100, -3100]);
  // Nothing is saved past retirement.
  const late = splitChange(0, { date: "2049-07-01", plan: { saving: 1000, retireYear: 2050 } }, "2050-07-01");
  assert.equal(late.saved, 6000);
  // And never a negative saving.
  assert.equal(splitChange(500, { date: "2026-08-12", plan: { saving: -50, retireYear: null } }, "2026-10-12").saved, 0);
});

test("the plan to measure against: the newest at least three months old, else the oldest", () => {
  const es = [entry("2026-01-05", 1, snap()), entry("2026-05-05", 1, snap()), entry("2026-09-05", 1, snap()), entry("2026-10-05", 1, snap({ path: [] }))];
  assert.equal(planRef(es, "2026-11-13")?.date, "2026-05-05");
  assert.equal(planRef(es.slice(2), "2026-11-13")?.date, "2026-09-05");
  assert.equal(planRef([entry("2026-10-05", 1)], "2026-11-13"), null);
});

test("the projected path between its points, with prices risen since", () => {
  const ref = entry("2026-01-01", 100000, snap()) as Entry & { plan: PlanSnap };
  assert.equal(planAt(ref, 2026), 100000);
  // Half a year on is the first point, then a year apart.
  assert.equal(planAt(ref, 2026.5), 110000);
  assert.equal(planAt(ref, 2027), 115500);
  assert.equal(planAt(ref, 2028.5), 133000);
  assert.equal(planAt(ref, 2029), null);
  assert.equal(planAt(ref, 2025.5), null);
  // 3% inflation: a year on, the same plan in that year's dollars.
  const infl = { ...ref, plan: { ...ref.plan, inflation: 0.03 } };
  assert.ok(Math.abs(planAt(infl, 2027)! - 115500 * 1.03) < 1e-6);
  // The line runs from the snapshot's day to the date asked, through its points.
  assert.deepEqual(planLine(ref, 2027.25).map((p) => p.t), [2026, 2026.5, 2027.25]);
});

test("ahead of the plan, or behind it, at the latest entry", () => {
  const ref = entry("2026-01-01", 100000, snap()) as Entry & { plan: PlanSnap };
  const es = [ref, entry("2026-07-02", 124000, null)];
  const a = aheadOf(es, ref, nwOf)!;
  assert.ok(a.by > 13000 && a.by < 14100, String(a.by));
  assert.ok(aheadOf([ref, entry("2026-07-02", 100000)], ref, nwOf)!.by < 0);
  // Nothing after it yet: nothing to say.
  assert.equal(aheadOf([ref], ref, nwOf), null);
});
