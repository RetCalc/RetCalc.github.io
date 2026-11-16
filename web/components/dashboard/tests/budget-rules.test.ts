/* How your spending compares (budget-rules.ts): owning and renting take
   different rules, each line sorts into need or want, and 50/30/20 waits
   until setup's one number is split into lines. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { budgetRules, presetOf, sortOf, sortable } from "../budget-rules";
import type { BudgetRow } from "@/tools/budget/model";

const row = (group: string, desc: string, amount: number, extra: Partial<BudgetRow> = {}): BudgetRow =>
  ({ group, desc, amount: String(amount), freq: 12, custom: false, slot: desc, ...extra });

// Sam and Jordan: $11,000 per month before taxes, $8,300 after.
const OWN: BudgetRow[] = [
  row("Housing", "Rent / Mortgage", 2400), row("Housing", "Property tax", 430), row("Housing", "Home / Renters insurance", 120),
  row("Housing", "Utilities", 260), row("Housing", "Internet & phone", 180),
  row("Transportation", "Car payment", 620), row("Transportation", "Car insurance", 160), row("Transportation", "Gas", 220),
  { ...row("Transportation", "Maintenance & repairs", 1200), freq: 1 },
  row("Health", "Out-of-pocket medical", 150), row("Food", "Groceries", 900), row("Food", "Eating out", 450),
  row("Lifestyle", "Activities & hobbies", 200), row("Lifestyle", "Subscriptions", 90),
  { ...row("Lifestyle", "Travel", 4800), freq: 1 }, { ...row("Lifestyle", "Gifts", 1200), freq: 1 },
  { group: "Debt", desc: "Student loan", amount: "560", freq: 12, custom: true, slot: "debt:s1" },
];
const base = { gross: 11000, after: 8300, premiums: 0, save: 1540 };
const near = (a: number, b: number, d = 0.05) => assert.ok(Math.abs(a - b) < d, `${a} ≉ ${b}`);
const byId = (r: ReturnType<typeof budgetRules>, id: string) => r.cards.find((c) => c.id === id)!;

test("owning: 28% and 36% of pay before taxes, the mortgage in both", () => {
  const r = budgetRules({ rows: OWN, rent: false, ...base });
  const h = byId(r, "house"), d = byId(r, "debt");
  assert.equal(h.name, "Housing"); near(h.pct, (2950 / 11000) * 100); assert.ok(h.ok);
  assert.equal(d.name, "All debt payments"); near(d.dollars, 2950 + 620 + 560); assert.ok(!d.ok);
  near(d.gap, (4130 / 11000) * 100 - 36); near(d.gapDollars, 4130 - 3960, 0.5);
});

test("renting: rent against 30%, debt besides rent against 10% after taxes", () => {
  const rows = OWN.filter((r) => r.slot !== "Property tax").map((r) => (r.slot === "Rent / Mortgage" ? { ...r, amount: "2600" } : r.slot === "Home / Renters insurance" ? { ...r, amount: "20" } : r));
  const r = budgetRules({ rows, rent: true, ...base });
  const h = byId(r, "house"), d = byId(r, "debt");
  assert.equal(h.name, "Rent"); assert.equal(h.max, 30); near(h.dollars, 2620); assert.ok(h.ok);
  assert.equal(d.of, "after"); near(d.dollars, 620 + 560); near(d.pct, (1180 / 8300) * 100); assert.ok(!d.ok);
});

test("transportation is a range; saving is at least 15%", () => {
  const r = budgetRules({ rows: OWN, rent: false, ...base });
  const c = byId(r, "car"), s = byId(r, "save");
  near(c.dollars, 1100); assert.ok(c.ok);
  near(s.pct, 14); assert.ok(!s.ok); near(s.gapDollars, 110, 0.5);
  assert.ok(byId(budgetRules({ rows: OWN, rent: false, ...base, save: 1700 }), "save").ok);
});

test("no housing line, no housing card; no pay, no cards", () => {
  const rows = OWN.filter((r) => r.group !== "Housing");
  assert.equal(budgetRules({ rows, rent: true, ...base }).cards.some((c) => c.id === "house"), false);
  assert.equal(budgetRules({ rows: OWN, rent: false, ...base, gross: 0 }).cards.length, 0);
});

test("preset lines sort themselves; lines you add go by group until switched", () => {
  assert.equal(sortOf(row("Food", "Groceries", 1), 0), "need");
  assert.equal(sortOf(row("Food", "Eating out", 1), 0), "want");
  const added = { group: "Lifestyle", desc: "Gym", amount: "50", freq: 12, custom: true };
  assert.equal(sortOf(added, 30), "want");
  assert.equal(sortOf({ ...added, want: false }, 30), "need");
  assert.equal(sortOf({ ...added, group: "Health" }, 30), "need");
  assert.equal(sortOf({ group: "Custom", desc: "College savings", amount: "1", freq: 12, custom: true }, 30), null);
  assert.ok(sortable(added, 30));
  assert.ok(!sortable({ ...added, slot: "debt:x" }, 30));
  assert.ok(!sortable({ ...added, desc: "Everything else" }, 30));
});

test("50/30/20: needs, wants and what's left of income after taxes", () => {
  const r = budgetRules({ rows: OWN, rent: false, ...base, after: 9400 });
  const s = r.split!;
  near(s.need, 2950 + 440 + 1100 + 150 + 900 + 560); near(s.want, 450 + 200 + 90 + 400 + 100);
  near(s.needPct + s.wantPct + s.savePct, 100);
  near(s.savePct, (2060 / 9400) * 100);
});

test("premiums taken out of pay count back in, as a need", () => {
  const rows = [...OWN, row("Health", "Health insurance", 300)];
  const s = budgetRules({ rows, rent: false, ...base, after: 9100, premiums: 300 }).split!;
  near(s.base, 9400); near(s.need, 6100 + 300);
});

test("setup's one number holds spending: no 50/30/20 yet", () => {
  const rows = [...OWN, { group: "Custom", desc: "Everything else", amount: "2000", freq: 12, custom: true }];
  assert.equal(budgetRules({ rows, rent: false, ...base }).split, null);
});

test("setup's one number holds spending: a rule with no lines of its own waits too", () => {
  const rows = [row("Housing", "Rent / Mortgage", 2000), { group: "Custom", desc: "Everything else", amount: "4000", freq: 12, custom: true }];
  const ids = budgetRules({ rows, rent: true, ...base }).cards.map((c) => c.id);
  assert.deepEqual(ids, ["house", "save"]);
  assert.deepEqual(budgetRules({ rows: rows.slice(0, 1), rent: true, ...base }).cards.map((c) => c.id), ["house", "debt", "car", "save"]);
});

test("a renamed preset goes by its group: Car payment renamed Ubers is getting around, not a debt", () => {
  const rows = OWN.map((r) => (r.slot === "Car payment" ? { ...r, desc: "Ubers" } : r));
  const ubers = rows.find((r) => r.desc === "Ubers")!, i = rows.indexOf(ubers);
  assert.equal(presetOf(ubers, i), undefined);
  const r = budgetRules({ rows, rent: false, ...base });
  near(byId(r, "debt").dollars, 2950 + 560);
  near(byId(r, "car").dollars, 1100);
  assert.ok(sortable(ubers, i));
  assert.equal(sortOf(ubers, i), "need");
  assert.equal(sortOf({ ...ubers, want: true }, i), "want");
});

test("a renamed preset leaves housing; renaming only its case doesn't", () => {
  const away = OWN.map((r) => (r.slot === "Property tax" ? { ...r, desc: "Lawn care" } : r));
  near(byId(budgetRules({ rows: away, rent: false, ...base }), "house").dollars, 2400 + 120);
  const cased = OWN.map((r) => (r.slot === "Property tax" ? { ...r, desc: "property tax " } : r));
  near(byId(budgetRules({ rows: cased, rent: false, ...base }), "house").dollars, 2950);
});

test("a line under Debt counts as a debt whatever it's called", () => {
  const rows = [...OWN, { group: "Debt", desc: "Credit card", amount: "200", freq: 12, custom: true }];
  near(byId(budgetRules({ rows, rent: true, ...base }), "debt").dollars, 620 + 560 + 200);
});
