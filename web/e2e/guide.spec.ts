import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { NEW, OLD } from "../playwright.config";
import { apply, compareShown, open, snapshot, type Step } from "./compare";

/* A walk through the readiness guide on both sites, the same answers typed
   into each, compared at every step ("check"). Each walk starts from a
   clean slate. */
type Walk = (Step | ["check", string])[];

const next: Step = ["click", '[data-gd="next"]'];
const pick = (k: string, v: string): Step => ["click", `[data-set="${k}"][data-val="${v}"]`];

async function walk(oldPage: Page, page: Page, info: TestInfo, name: string, steps: Walk, roots = ["#tab-guide"]) {
  // A tool's article shows on its own page here; on the old single-page
  // site a tool opened from the guide had none.
  for (const [p, url] of [[oldPage, OLD + "/guide.html"], [page, NEW + "/guide"]] as const) {
    await open(p, url);
    await p.evaluate(() => localStorage.clear());
    await open(p, url, "#seoArticles");
  }
  let batch: Step[] = [];
  for (const s of steps) {
    if (s[0] !== "check") { batch.push(s as Step); continue; }
    await apply(oldPage, batch);
    await apply(page, batch);
    batch = [];
    // On a trip, the coach panel docked over the tool. The Drawdown
    // Simulator on the old single-page site had already drawn with its
    // defaults, and kept the start year picked then; opened fresh here, it
    // picks for the guide's plan. So on that tour the coach's words are
    // compared, not the page under it.
    const where = s[1].includes("coach") ? ["#gdCoach"] : roots;
    if (s[1].includes("coach (words)")) expect.soft(await snapshot(page, where), name + ": " + s[1]).toEqual(await snapshot(oldPage, where));
    else await compareShown(oldPage, page, info, name + ": " + s[1], where);
  }
}

const ahead: Walk = [
  ["check", "welcome"], next,
  ["gdf-status", "m"], ["gdf-age", "45"], ["gdf-spouseAge", "43"], ["gdf-retire", "60"], ["gdf-state", "TX"], ["check", "about you"], next,
  ["gdf-income", "120000"], ["gdf-income2", "60000"], ["check", "income"], next,
  pick("thKnow", "yes"), ["gdf-takehome", "9000"], ["check", "take-home"], next,
  pick("bgKnow", "yes"), ["gdf-spend", "6000"], ["check", "spending"], next,
  ["gdf-cash", "30000"], ["check", "emergency fund"], next,
  pick("debtHas", "no"), next,
  pick("home", "mortgage"), pick("mortPaid", "yes"), ["gdf-housePay", "2200"], ["check", "housing"], next,
  pick("college", "no"), next,
  ["gdf-saved", "400000"], ["gdf-contrib", "1500"], ["gdf-employer", "500"], pick("match", "full"), ["gdf-rothNow", "50000"], ["check", "savings"], next,
  ["gdf-retSpend", "80000"], ["gdf-pension", "1000"], ["check", "retirement spending"], next,
  ["check", "projection"], next,
  ["check", "will it last"], next,
  ["check", "adjust"], ["click", '[data-opt="custom"]'], ["gdd-retire", "58"], ["check", "adjust, own numbers"],
  ["click", '[data-gd="apply"]'], ["check", "adjust, applied"], next,
  ["gdf-minSpend", "50000"], pick("strategy", "guardrails"), ["check", "drawing it down"], next,
  pick("hcIncl", "no"), ["check", "healthcare"], next,
  ["check", "bridge"], next,
  ["check", "optimizer"], next,
  ["check", "results"],
];

const behind: Walk = [
  next,
  ["gdf-age", "50"], ["gdf-retire", "62"], ["gdf-state", "CA"], next,
  ["gdf-income", "70000"], next,
  pick("thKnow", "no"), ["check", "take-home, estimate"], ["click", '[data-fill="takehome"]'], next,
  pick("bgKnow", "yes"), ["gdf-spend", "4500"], next,
  ["gdf-cash", "2000"], next,
  pick("debtHas", "yes"), ["click", '[data-set="debtSrc"][data-val="quick"]'], ["gdf-debtTotal", "15000"], ["gdf-debtHi", "6000"], ["check", "debt totals"], next,
  pick("home", "rent"), next,
  pick("college", "yes"), ["gdf-kidAge", "8"], ["gdf-collegeMo", "300"], ["check", "college"], next,
  ["gdf-saved", "90000"], ["gdf-contrib", "400"], ["gdf-employer", "0"], pick("match", "partial"), ["gdf-risk", "0.0575"], pick("saveTo", "roth"), next,
  ["gdf-retSpend", "50000"], ["gdf-ssOwn", "2100"], ["gdf-ssClaim", "70"], ["check", "retirement spending, statement"], next,
  ["check", "projection, short"], next, next,
  ["check", "close the gap"], ["click", '[data-opt="balance"]'], ["check", "balanced"], next,
  ["click", '.gd-picks [data-fill="minSpend"]:nth-child(2)'], ["check", "minimum filled"], next,
  next, next,
  ["check", "results, behind"],
];

test("the guide matches the current site, a plan ahead of schedule", async ({ page }, info) => {
  test.setTimeout(300_000);
  const oldPage = await page.context().newPage();
  await walk(oldPage, page, info, "ahead", ahead);
});

test("the guide matches the current site, a plan that falls short", async ({ page }, info) => {
  test.setTimeout(300_000);
  const oldPage = await page.context().newPage();
  await walk(oldPage, page, info, "behind", behind);
});

const trips: Walk = [
  next, ["gdf-age", "40"], ["gdf-retire", "67"], ["gdf-state", "IL"], next, ["gdf-income", "90000"], next,
  pick("thKnow", "no"), ["click", '[data-trip="tax"]'], ["until", "#gdCoach"], ["check", "tax coach"],
  ["click", '[data-view="take"]'], ["check", "tax coach, take-home"],
  ["click", "#gdCoachBack"], ["until", "#gdCard .gd-callout.ok"], ["check", "back from tax"], next,
  pick("bgKnow", "no"), ["click", '[data-trip="budget"]'], ["until", "#gdCoach"], ["check", "budget coach"],
  ['[data-f="amount"][data-i="0"]', "1800"], ['[data-f="amount"][data-i="2"]', "200"], ['[data-f="amount"][data-i="11"]', "600"],
  ['[data-f="amount"][data-i="12"]', "300"], ['[data-f="amount"][data-i="17"]', "500"], ['[data-f="amount"][data-i="5"]', "350"], ["check", "budget coach, filled"],
  ["click", "#gdCoachBack"], ["until", "#gdCard .gd-callout.ok"], ["check", "back from budget"],
];

const drawdown: Walk = [
  next, ["gdf-age", "55"], ["gdf-retire", "63"], next, ["gdf-income", "110000"], next,
  pick("thKnow", "yes"), ["gdf-takehome", "7000"], next, pick("bgKnow", "yes"), ["gdf-spend", "5000"], next,
  ["gdf-cash", "40000"], next, pick("debtHas", "no"), next, pick("home", "own"), next, pick("college", "no"), next,
  ["gdf-saved", "900000"], ["gdf-contrib", "2000"], ["gdf-employer", "500"], pick("match", "full"), next,
  ["gdf-retSpend", "70000"], next, next, next, next,
  ["click", '[data-trip="drawdown"]'], ["until", "#gdCoach .gd-chip b"], ["check", "drawdown coach (words), part 1"],
  ["click", '#gdCoach [data-cp="1"]'], ["check", "drawdown coach (words), part 2"],
  ["click", '#gdCoach [data-cp="1"]'], ["ddStrategy", "guardrails"], ["check", "drawdown coach (words), part 3"],
  ["click", "#gdCoachBack"], ["until", "#gdCard .gd-callout.ok"], ["check", "back from drawdown"],
];

test("the guide's trips into the tools match the current site", async ({ page }, info) => {
  test.setTimeout(300_000);
  const oldPage = await page.context().newPage();
  await walk(oldPage, page, info, "trips", trips);
});

test("the guide's drawdown tour matches the current site", async ({ page }, info) => {
  test.setTimeout(300_000);
  const oldPage = await page.context().newPage();
  await walk(oldPage, page, info, "drawdown tour", drawdown);
});

const optimizer: Walk = [
  next, ["gdf-status", "m"], ["gdf-age", "58"], ["gdf-spouseAge", "56"], ["gdf-retire", "62"], ["gdf-state", "IL"], next,
  ["gdf-income", "150000"], ["gdf-income2", "50000"], next, pick("thKnow", "yes"), ["gdf-takehome", "11000"], next,
  pick("bgKnow", "yes"), ["gdf-spend", "8000"], next, ["gdf-cash", "50000"], next, pick("debtHas", "no"), next,
  pick("home", "own"), next, pick("college", "no"), next,
  ["gdf-saved", "1500000"], ["gdf-contrib", "2000"], ["gdf-employer", "1000"], pick("match", "full"), ["gdf-rothNow", "200000"], ["gdf-brokNow", "300000"], next,
  ["gdf-retSpend", "90000"], next, next, next, next, next, next,
  ["check", "optimizer, ready"], ["click", '#gdCard [data-op="run"]'], ["until", "#gdCard .op-res"], ["check", "optimizer, found"],
  ["click", '[data-gd="optapply"]'], ["check", "optimizer, applied"], next, ["check", "results with the roadmap"],
];

test("the guide's Plan Optimizer matches the current site", async ({ page }, info) => {
  test.setTimeout(300_000);
  const oldPage = await page.context().newPage();
  await walk(oldPage, page, info, "optimizer", optimizer);
});

/* New-only: a shared plan opens on its results, and a reload in the middle
   of a trip fills the tool in again. */
test("a shared guide link opens the plan on its results", async ({ page, context }) => {
  await page.goto(NEW + "/guide");
  await page.evaluate(() => localStorage.clear());
  await page.goto(NEW + "/guide");
  await page.locator('[data-gd="next"]').click();
  await page.fill("#gdf-age", "45"); await page.fill("#gdf-retire", "62");
  await page.locator('[data-gd="next"]').click();
  await page.fill("#gdf-income", "100000");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const url = await page.evaluate(() => {
    const enc = (v: unknown) => btoa(JSON.stringify(v)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return location.origin + "/guide#g=" + enc({ v: 1, a: { age: 45, retire: 62, income: 100000, saved: 300000, contrib: 1000, match: "full", retSpend: 60000, cash: 20000, spend: 5000, takehome: 6500, debtHas: "no" } });
  });
  // with answers of your own, it asks before replacing them
  const other = await context.newPage();
  let asked = false;
  other.on("dialog", (d) => { asked = true; void d.accept(); });
  await other.goto(url);
  await expect.poll(() => asked).toBe(true);
  await expect(other.locator(".gd-q")).toHaveText("Your retirement readiness");
  await expect(other.locator(".gd-hero .r")).not.toHaveText("");
  await expect(other).toHaveURL(NEW + "/guide");
});

test("a reload in the middle of a trip fills the tool in again", async ({ page }) => {
  await page.goto(NEW + "/guide");
  await page.evaluate(() => localStorage.clear());
  await page.goto(NEW + "/guide");
  await page.locator('[data-gd="next"]').click();
  await page.fill("#gdf-age", "40"); await page.fill("#gdf-retire", "67");
  await page.locator('[data-gd="next"]').click();
  await page.fill("#gdf-income", "123000");
  await page.locator('[data-gd="next"]').click();
  await page.locator('[data-set="thKnow"][data-val="no"]').click();
  await page.locator('[data-trip="tax"]').click();
  await expect(page.locator("#gdCoach")).toBeVisible();
  await expect(page.locator("#txGross")).toHaveValue("123,000");
  await page.reload();
  await expect(page.locator("#gdCoach")).toBeVisible();
  await expect(page.locator("#txGross")).toHaveValue("123,000");
  await page.locator("#gdCoachBack").click();
  await expect(page.locator("#gdCard .gd-callout.ok")).toContainText("From Income Tax");
});

test("the plan prints on one page", async ({ page }) => {
  const plan = { v: 1, a: { age: 45, retire: 62, income: 100000, saved: 300000, contrib: 1000, match: "full", retSpend: 60000, cash: 20000, spend: 5000, takehome: 6500, debtHas: "no" } };
  await page.goto(NEW + "/guide#g=" + Buffer.from(JSON.stringify(plan)).toString("base64url"));
  await expect(page.locator(".gd-q")).toHaveText("Your retirement readiness");
  await page.evaluate(() => { (window as unknown as { printed: number }).printed = 0; window.print = () => { (window as unknown as { printed: number }).printed++; }; });
  await page.locator('[data-gd="print"]').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
  await expect(page.locator("#sheet h1")).toHaveText("Retirement Readiness Plan");
  await expect(page.locator("#sheet .sh-chart svg")).toHaveCount(1);
});
