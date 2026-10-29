/* Income Tax's itemized paycheck (paycheck.ts): by check and by month, it
   adds back to the year above it, and with two earners each one's column
   adds up to the household's. Run with `npm run test:tax`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { TAX_DEFAULTS, runTax, taxInput } from "../model";
import { paycheckStub } from "../paycheck";

const near = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);
const run = (patch: Partial<typeof TAX_DEFAULTS>) => { const s = { ...TAX_DEFAULTS, ...patch }; return { s, R: runTax(taxInput(s, true)) }; };
const row = (st: ReturnType<typeof paycheckStub>, key: string) => st.rows.find((r) => r.key === key)!;

test("one earner, paid every two weeks: per check and per month, and it adds back to the year", () => {
  const { s, R } = run({ gross: "95,000", state: "IL", itemize: true, k401: "6,000", hsa: "2,000", health: "1,800" });
  const st = paycheckStub(s, R);
  assert.deepEqual(st.cols, ["Per check", "Per month"]);
  near(row(st, "gross").v[0], 95000 / 26);
  near(row(st, "gross").v[1], 95000 / 12);
  // Gross less everything taken out is take-home: no IRA here, so it's the tool's own.
  near(row(st, "net").v[0] * 26, R.net, 0.05);
  const taxes = st.rows.filter((r) => r.kind === "tax").reduce((t, r) => t + r.v[1] * 12, 0);
  near(taxes, R.total, 0.05);
  assert.deepEqual(st.rows.filter((r) => r.kind === "pre").map((r) => r.key), ["k401", "hsa", "health"]);
});

test("paid monthly, one column", () => {
  const { s, R } = run({ gross: "60,000", prePay: "12" });
  const st = paycheckStub(s, R);
  assert.deepEqual(st.cols, ["Per month"]);
  near(row(st, "gross").v[0], 5000);
});

test("two earners on a joint return: a column each by check, and together by month", () => {
  const { s, R } = run({ status: "m", gross: "120,000", gross2: "60,000", state: "IL", itemize: true, k401: "10,000", k4012: "3,000", health2: "2,400" });
  const st = paycheckStub(s, R);
  assert.deepEqual(st.cols, ["You, per check", "Spouse, per check", "Together, per month"]);
  for (const r of st.rows) near((r.v[0] + r.v[1]) * 26 / 12, r.v[2], 0.01);
  // Each earner's own Social Security, and the income taxes split to the cent.
  near(row(st, "ss").v[0] * 26, R.ss1, 0.05);
  near(row(st, "federal").v[2] * 12, R.federal, 0.05);
  near(row(st, "net").v[2] * 12, R.net, 0.05);
  // The bigger earner carries more of the income tax.
  assert.ok(row(st, "federal").v[0] > row(st, "federal").v[1]);
});

test("an IRA isn't taken out of pay", () => {
  const { s, R } = run({ gross: "80,000", itemize: true, ira: "7,000" });
  const st = paycheckStub(s, R);
  assert.equal(st.rows.some((r) => r.key === "ira"), false);
  near(row(st, "net").v[1] * 12, R.net + 7000, 0.05);
});
