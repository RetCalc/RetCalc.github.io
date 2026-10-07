import { expect, test, type Page } from "@playwright/test";
import { NEW } from "../playwright.config";
import { apply, open, type Step } from "./compare";

/* The migration dry run (doc 3, "Browsers and storage" and "Migration"): a
   guide saved by the live site (retcalc.app has served main's build since
   5 October, MIGRATION.md) is taken from its storage as it is and opened in
   the new guide. It lands on its plan with every answer, a source for each,
   and the same score the old results showed; the old key is left alone for
   a rollback. The answers are main's own guide walks.

   It needs main's build running: LIVE=http://localhost:3300 (a worktree of
   main, `npm run build && npx next start -p 3300`). Without LIVE it skips. */
const LIVE = process.env.LIVE;

const next: Step = ["click", '[data-gd="next"]'];
const pick = (k: string, v: string): Step => ["click", `[data-set="${k}"][data-val="${v}"]`];

const WALKS: { name: string; steps: Step[] }[] = [
  { name: "a plan ahead of schedule, adjusted and finished", steps: [
    next,
    ["gdf-status", "m"], ["gdf-age", "45"], ["gdf-spouseAge", "43"], ["gdf-retire", "60"], ["gdf-state", "TX"], next,
    ["gdf-income", "120000"], ["gdf-income2", "60000"], next,
    pick("thKnow", "yes"), ["gdf-takehome", "9000"], next,
    pick("bgKnow", "yes"), ["gdf-spend", "6000"], next,
    ["gdf-cash", "30000"], next,
    pick("debtHas", "no"), next,
    pick("home", "mortgage"), pick("mortPaid", "yes"), ["gdf-housePay", "2200"], next,
    pick("college", "no"), next,
    ["gdf-saved", "400000"], ["gdf-contrib", "1500"], ["gdf-employer", "500"], pick("match", "full"), ["gdf-rothNow", "50000"], next,
    ["gdf-retSpend", "80000"], ["gdf-pension", "1000"], next,
    next, next,
    ["click", '[data-opt="custom"]'], ["gdd-retire", "58"], ["click", '[data-gd="apply"]'], next,
    ["gdf-minSpend", "50000"], pick("strategy", "guardrails"), next,
    pick("hcIncl", "no"), next, next, next,
  ] },
  { name: "a plan that falls short, with a statement and debt", steps: [
    next,
    ["gdf-age", "50"], ["gdf-retire", "62"], ["gdf-state", "CA"], next,
    ["gdf-income", "70000"], next,
    pick("thKnow", "no"), ["click", '[data-fill="takehome"]'], next,
    pick("bgKnow", "yes"), ["gdf-spend", "4500"], next,
    ["gdf-cash", "2000"], next,
    pick("debtHas", "yes"), ["click", '[data-set="debtSrc"][data-val="quick"]'], ["gdf-debtTotal", "15000"], ["gdf-debtHi", "6000"], next,
    pick("home", "rent"), next,
    pick("college", "yes"), ["gdf-kidAge", "8"], ["gdf-collegeMo", "300"], next,
    ["gdf-saved", "90000"], ["gdf-contrib", "400"], ["gdf-employer", "0"], pick("match", "partial"), ["gdf-risk", "0.0575"], pick("saveTo", "roth"), next,
    ["gdf-retSpend", "50000"], ["gdf-ssOwn", "2100"], ["gdf-ssClaim", "70"], next,
    next, next, next,
    ["click", '.gd-picks [data-fill="minSpend"]:nth-child(2)'], next,
    next, next,
  ] },
];

async function oldScore(p: Page) {
  return Number(((await p.locator("#gdScoreNum").textContent()) ?? "").trim());
}

for (const W of WALKS) {
  test(`a guide saved by the live site opens migrated: ${W.name}`, async ({ page, context }) => {
    test.skip(!LIVE, "needs main's build: LIVE=http://localhost:3300");
    test.setTimeout(300_000);
    const old = await context.newPage();
    await open(old, LIVE + "/guide");
    await old.evaluate(() => localStorage.clear());
    await open(old, LIVE + "/guide");
    await apply(old, W.steps);
    await expect(old.locator(".gd-q")).toHaveText("Your retirement readiness");
    const score = await oldScore(old);
    const saved = await old.evaluate(() => localStorage.getItem("retcalc.guide.v1"));
    expect(saved).toBeTruthy();
    const v1 = JSON.parse(saved!);

    await page.goto(NEW + "/robots.txt");
    await page.evaluate((s) => { localStorage.clear(); localStorage.setItem("retcalc.guide.v1", s); }, saved!);
    await page.goto(NEW + "/guide");
    await expect(page.locator("#gdCard .gd-q")).toHaveText("Your plan");
    await expect(page.locator("#gdScoreNum")).toHaveAttribute("data-score", String(score), { timeout: 30_000 });
    const v2 = JSON.parse((await page.evaluate(() => localStorage.getItem("retcalc.guide.v2")))!);
    expect(v2.v).toBe(2);
    expect(v2.pace).toBe("full");
    // every answer kept, each with a source
    for (const k of ["age", "retire", "income", "spend", "cash", "saved", "contrib", "retSpend"]) {
      expect(v2.a[k], k).toEqual(v1.a[k]);
      expect(v2.src[k], k).toBeTruthy();
    }
    // the old key is left as it was, for a rollback
    expect(await page.evaluate(() => localStorage.getItem("retcalc.guide.v1"))).toBe(saved);
    await old.close();
  });
}
