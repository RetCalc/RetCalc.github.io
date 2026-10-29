/* Income Tax in retirement mode takes each person's age instead of a count of
   people 65 or older. States read their own ages from it, an older saved copy
   or share link that only has the count still decodes to what it meant, and
   the deduction line follows the deduction the return takes. Run with
   `npm run test:tax`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { brAges, brCtx, brTax } from "@/lib/engine/typed-bridge";
import { TAX_DEF, TAX_DEFAULTS, agesFromSeniors, deductionLine, runTax, taxInput } from "../model";

const retired = { ...TAX_DEFAULTS, mode: "retire" as const, trad: "80,000", roth: "0", brok: "0", ss: "0" };
const stateTax = (o: object) => runTax(taxInput({ ...retired, ...o }, true));

test("a state reads the age field, not a yes or no at 65", () => {
  // Georgia: nothing at 61, $35,000 at 62, $65,000 at 65.
  const ga = (age: string) => stateTax({ state: "GA", age });
  assert.equal(ga("61").stateExcluded, 0);
  assert.equal(ga("62").stateExcluded, 35000);
  assert.equal(ga("65").stateExcluded, 65000);
  assert.ok(ga("62").state < ga("61").state);
  // Iowa at 54 and 55, New York at 59 and 60, Wisconsin at 66 and 67.
  assert.equal(stateTax({ state: "IA", age: "54" }).stateExcluded, 0);
  assert.equal(stateTax({ state: "IA", age: "55" }).stateExcluded, 80000);
  assert.equal(stateTax({ state: "NY", age: "59", pension: "30,000", trad: "0" }).stateExcluded, 0);
  assert.equal(stateTax({ state: "NY", age: "60", pension: "30,000", trad: "0" }).stateExcluded, 20000);
  assert.equal(stateTax({ state: "WI", age: "66" }).stateExcluded, 0);
  assert.equal(stateTax({ state: "WI", age: "67" }).stateExcluded, 24000);
});

test("the spouse's age counts only on a joint return", () => {
  const single = stateTax({ state: "GA", status: "s", age: "62", spouseAge: "70", trad: "200,000" });
  const joint = stateTax({ state: "GA", status: "m", age: "62", spouseAge: "70", trad: "200,000" });
  assert.equal(single.stateExcluded, 35000);
  assert.equal(joint.stateExcluded, 35000 + 65000);
  assert.deepEqual(taxInput({ ...retired, status: "s", age: "62", spouseAge: "70" }).ages, [62]);
  assert.deepEqual(taxInput({ ...retired, status: "m", age: "62", spouseAge: "70" }).ages, [62, 70]);
});

test("the federal 65 rules count from the ages", () => {
  assert.equal(stateTax({ status: "m", age: "66", spouseAge: "60" }).seniors, 1);
  assert.equal(stateTax({ status: "m", age: "66", spouseAge: "65" }).seniors, 2);
  assert.equal(stateTax({ status: "s", age: "64" }).seniors, 0);
  // A blank age leaves that person out of every age rule.
  assert.equal(stateTax({ state: "GA", age: "" }).stateExcluded, 0);
});

test("a saved copy from before the age fields decodes to the same answer", () => {
  assert.deepEqual(agesFromSeniors(0, false), [50, 50]);
  assert.deepEqual(agesFromSeniors(1, false), [65, 50]);
  assert.deepEqual(agesFromSeniors(2, true), [65, 65]);
  assert.deepEqual(agesFromSeniors(1, true), [65, 50]);
  // What a copy from then loads as: the defaults filled in under its own
  // answers (it has no age fields), then the tool's clean step.
  const decode = (o: object) => {
    const t = TAX_DEF.clean!({ ...TAX_DEFAULTS, mode: "retire", ...o });
    return { t, R: runTax(taxInput(t, true)) };
  };
  // "Yes" for a single person: one senior, as it was.
  let d = decode({ seniors: "1", status: "s", state: "GA" });
  assert.equal(d.t.age, "65");
  assert.equal(d.t.seniors, "");
  assert.equal(d.R.seniors, 1);
  // "Both spouses" on a joint return.
  d = decode({ seniors: "2", status: "m" });
  assert.deepEqual([d.t.age, d.t.spouseAge], ["65", "65"]);
  assert.equal(d.R.seniors, 2);
  // "No": nobody 65, and young enough that no state age rule reaches them.
  d = decode({ seniors: "0", status: "m", state: "IA" });
  assert.equal(d.R.seniors, 0);
  assert.equal(d.R.stateExcluded, 0);
  // "One spouse" on a joint return.
  d = decode({ seniors: "1", status: "m" });
  assert.equal(d.R.seniors, 1);
  // Same federal and state tax as the count gave before.
  const old = decode({ seniors: "1", status: "s", state: "CA" }).R;
  const neu = runTax(taxInput({ ...TAX_DEFAULTS, mode: "retire", status: "s", state: "CA", age: "65" }, true));
  assert.equal(old.total, neu.total);
  // A copy that already has ages is left as it is.
  d = decode({ seniors: "", age: "58", spouseAge: "61", status: "m" });
  assert.deepEqual([d.t.age, d.t.spouseAge], ["58", "61"]);
});

test("the deduction line follows the deduction the return takes", () => {
  const std = stateTax({ dedType: "std" }), item = stateTax({ dedType: "item", item: "40,000" });
  assert.equal(deductionLine("std", 0, std.fedDed).label, "Standard deduction");
  assert.equal(deductionLine("item", 0, item.fedDed).label, "Itemized deduction");
  assert.equal(deductionLine("item", 0, item.fedDed).amount, item.fedDed);
  assert.notEqual(item.fedDed, std.fedDed);
  assert.equal(deductionLine("std", 1, std.fedDed).label, "Standard deduction, incl. 65+");
  // Normal mode, itemized: the amount is the itemized total, not the standard one.
  const normal = runTax(taxInput({ ...TAX_DEFAULTS, mode: "normal", dedType: "item", item: "40,000" }, true));
  assert.equal(deductionLine("item", 0, normal.fedDed).amount, 40000);
});

test("Early Retirement Bridge years carry the ages the state rules read", () => {
  const ctx = brCtx({
    status: "m", state: "IA", age: 54, spend: 60000, trad: 500000, k401: 0, roth: 0, rothBasis: 0, brok: 0, basisPct: 1,
    g457: 0, stock: 70, work: 0, workUntil: 0, aca: false, household: 2, premium: 0, seppMethod: "amort", seppRate: 0.05, fill: "auto",
  } as never);
  assert.deepEqual(brAges(ctx, 54), [54, 54]);
  // Iowa exempts traditional income from 55: the same $40,000 costs less in the year at 55.
  const at54 = brTax(ctx, 40000, 0, 0, 54), at55 = brTax(ctx, 40000, 0, 0, 55);
  assert.ok(at55 < at54, "Iowa at 55 taxes less than at 54");
  // The cache keeps the two apart and answers the same on a second ask.
  assert.equal(brTax(ctx, 40000, 0, 0, 54), at54);
  assert.equal(brTax(ctx, 40000, 0, 0, 55), at55);
});
