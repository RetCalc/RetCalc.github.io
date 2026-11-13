/* Taxes in retirement (taxes.ts) on the sample household: the strategy's
   withdrawals come out each year whatever the tax plan, conversions don't
   change what the accounts hold in total, and the best plan beats or ties
   no conversions. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import type { DashData } from "../store";

// The plan's code takes two plain helpers from screen files: stand-ins, as the numbers check does.
register(new URL("../../../scripts/baseline/dash-loader.mjs", import.meta.url));
const { results } = await import("../model");
const { EMPTY_PROFILE, DEFAULT_ASSUMPTIONS } = await import("../store");
const { NO_PLAN, bestPlan, compare, marketYear, taxDetail, taxRuns, taxSetup } = await import("../taxes");

const seed = JSON.parse(JSON.parse(readFileSync(new URL("../../../public/dev-seed.json", import.meta.url), "utf8"))["retcalc.dashboard.v1"]) as DashData;

test("the sample household's tax plan follows the strategy's withdrawals", () => {
  const pr = { ...EMPTY_PROFILE, ...seed.profile, assume: { ...DEFAULT_ASSUMPTIONS, ...seed.profile.assume } }, R = results(pr, seed.entries), s = taxSetup(pr, seed.entries, R);
  assert.ok(s, "a setup");
  assert.ok(s!.starts.length > 20, "many historical starts: " + s!.starts.length);
  const y = marketYear(s!, "p50"), base = taxDetail(s!, NO_PLAN, y)!, conv = taxDetail(s!, { f: 3, u: 2, im: 0, ac: 0 }, y)!;
  base.rows.forEach((r, i) => assert.ok(Math.abs(r.out - r.budget) < 1 || r.short > 0, `year ${i} takes the budget out`));
  assert.ok(Math.abs(base.res.end - conv.res.end) < 1, `same total at the end: ${base.res.end} vs ${conv.res.end}`);
  const t0 = performance.now(), best = bestPlan(s!), ms = performance.now() - t0;
  const c = compare(s!, best.T);
  console.log("starts", s!.starts.length, "years", s!.years, "y0", s!.y0, "best", JSON.stringify(best.T), "ms", Math.round(ms), JSON.stringify(c));
  console.log("first rows", JSON.stringify(conv.rows.slice(0, 3).map((r) => ({ age: r.age, b: Math.round(r.budget), left: Math.round(r.left), tax: Math.round(r.tax), conv: Math.round(r.conv), rmd: Math.round(r.rmd), ss: Math.round(r.ss) }))));
  assert.ok(c.gain >= 0 || best.T.f === 0);
  assert.equal(taxRuns(s!, NO_PLAN), taxRuns(s!, NO_PLAN), "runs are remembered");
});

test("retiring before 59½, the tax plan starts where the bridge ends, in each market", () => {
  const base = { ...EMPTY_PROFILE, ...seed.profile, assume: { ...DEFAULT_ASSUMPTIONS, ...seed.profile.assume } };
  const pr = { ...base, p1: { ...base.p1, retire: 52 }, p2: { ...base.p2, retire: 52 } };
  const R = results(pr, seed.entries), s = taxSetup(pr, seed.entries, R);
  assert.ok(s, "a setup");
  assert.ok(s!.bridged && s!.y0 > 0, "starts after the bridge: y0 " + s!.y0);
  assert.equal(s!.age0, 52 + s!.y0);
  assert.ok(s!.starts.every((x) => x.acc != null), "each market starts from the bridge's balances");
  const c = compare(s!, bestPlan(s!).T);
  console.log("bridged", s!.y0, s!.age0, s!.starts.length, JSON.stringify(c));
});

test("the second of you retiring early: each market starts on the strategy's own balance", async () => {
  const { drawdownSetup } = await import("@/tools/drawdown/model");
  const { ddWindows, runDrawdown } = await import("@/lib/engine/typed-drawdown");
  const { drawdownFor } = await import("../flows");
  const base = { ...EMPTY_PROFILE, ...seed.profile, assume: { ...DEFAULT_ASSUMPTIONS, ...seed.profile.assume } };
  // Jordan (born 1986) retires at 54, in 2040, four years before Sam (born 1984) at 60: k = -4.
  for (const over of [{ p1: { ...base.p1, retire: 60 }, p2: { ...base.p2, retire: 54 } }, { p1: { ...base.p1, retire: 52 }, p2: { ...base.p2, retire: 55 } }]) {
    const pr = { ...base, ...over }, R = results(pr, seed.entries), s = taxSetup(pr, seed.entries, R);
    assert.ok(s, "a setup");
    const { o, P } = drawdownSetup(drawdownFor(pr, R.ddPlan!));
    const W = new Map(ddWindows(o).filter((w) => w.month === 1).map((w) => [w.year, w]));
    for (const st of s!.starts.slice(0, 12)) {
      if (!s!.y0) break;
      const want = runDrawdown(o, W.get(st.year)!.seq, null, P).rows[s!.y0 - 1].realEnd;
      const got = st.acc!.trad + st.acc!.roth + st.acc!.brok;
      assert.ok(Math.abs(got - want) < 1, `start ${st.year}: ${got} vs ${want}`);
    }
    const none = taxRuns(s!, NO_PLAN).runs;
    assert.ok(none.filter((r) => !r.res.ok).length <= Math.ceil(none.length * (1 - R.success!)) + 1, "no conversions runs short no more often than the strategy");
  }
});

test("a fixed amount: markets ranked by what's left at the end", () => {
  const base = { ...EMPTY_PROFILE, ...seed.profile, assume: { ...DEFAULT_ASSUMPTIONS, ...seed.profile.assume } };
  const pr = { ...base, strategy: "fixed" }, R = results(pr, seed.entries), s = taxSetup(pr, seed.entries, R)!;
  const endOf = (y: number) => s.starts.find((x) => x.year === y)!.end;
  assert.ok(endOf(marketYear(s, "p10")) <= endOf(marketYear(s, "p50")) && endOf(marketYear(s, "p50")) <= endOf(marketYear(s, "p90")), "10th ≤ median ≤ 90th");
});
