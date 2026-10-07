import { expect, test, type Page } from "@playwright/test";
import { NEW } from "../playwright.config";

/* The Retirement Readiness Guide (doc 3, "End-to-end"): both paces, the
   number appearing on the sixth card, the pace switch, old and new saved
   guides and links, the shell, and the trips into the tools.

   Until the overhaul these walks typed the same answers into the old site
   and compared the two pages. The overhaul changes the guide's cards on
   purpose, so the walks are new-only now; the figures they read are
   guarded to the cent by the guide's numbers baseline
   (scripts/baseline/guide.mjs), which these walks also spot-check. */

/* Maya and Sam (scripts/baseline/guide-fixtures.mjs): every question
   answered, so each card's Continue is open and a walk is the route itself. */
const MAYA = { status: "m", age: 38, spouseAge: 36, retire: 62, state: "IL", income: 95000, income2: 60000,
  thKnow: "yes", takehome: 9200, bgKnow: "yes", spend: 7000, cash: 12000, debtHas: "yes", debtSrc: "quick", debtTotal: 18000, debtHi: 9000,
  home: "mortgage", mortPaid: "no", housePay: 2100, college: "yes", kidAge: 6, collegeMo: 300,
  saved: 210000, rothNow: 40000, contrib: 900, employer: 300, match: "full", risk: 0.0575, saveTo: "trad", retSpend: 70000, hcIncl: "no" };
const stateWith = (pace: "quick" | "full", cur = "welcome") => ({ v: 2, pace, cur, a: MAYA, src: {}, done: {}, trip: null, back: null, coachMin: false,
  snapshots: [], moves: {}, lessons: {}, startedAt: "2026-10-07T00:00:00.000Z" });
const QUICK_CARDS = 10, FULL_CARDS = 15;

/** Storage set from a page with no scripts of its own, so nothing the
    guide does on loading can write over it. */
async function stored(page: Page, items: Record<string, unknown>) {
  await page.goto(NEW + "/robots.txt");
  await page.evaluate((o) => { localStorage.clear(); for (const [k, v] of Object.entries(o)) localStorage.setItem(k, JSON.stringify(v)); }, items);
}
async function seeded(page: Page, state: unknown) {
  await stored(page, state ? { "retcalc.guide.v2": state } : {});
  await page.goto(NEW + "/guide");
  await expect(page.locator("#gdCard .gd-q")).toBeVisible();
}
/** The route: in the rail, or on a phone in the strip's sheet. */
async function routeMap(page: Page) {
  if (await page.locator("#gdStrip").isVisible()) {
    await page.locator('#gdStrip [data-gd="route"]').click();
    return page.locator('[role="dialog"]');
  }
  return page.locator("#gdMap");
}
const next = (page: Page) => page.locator('#gdCard [data-gd="next"]').click();
const pick = (page: Page, k: string, v: string) => page.locator(`#gdCard [data-set="${k}"][data-val="${v}"]`).click();
/** Continue from the Welcome card to the plan, reading each card's count. */
async function walkThrough(page: Page) {
  const counts: string[] = [];
  await page.locator('[data-gd="next"]').click();
  for (let i = 0; i < 30; i++) {
    counts.push((await page.locator("#gdCount").textContent()) ?? "");
    if ((await page.locator("#gdCard .gd-q").textContent()) === "Your retirement readiness") break;
    await next(page);
  }
  return counts;
}

/* ---------- Both paces ---------- */

test("the Quick check, typed from the start, shows the number on card 6", async ({ page }) => {
  test.setTimeout(120_000);
  await seeded(page, null);
  await page.locator('[data-gd="next"]').click();
  // 1 · About you
  await expect(page.locator("#gdCount")).toHaveText(/^Step 1 of \d+ · about \d+ minutes? left$/);
  await page.locator("#gdf-status").selectOption("m");
  await page.fill("#gdf-age", "38"); await page.fill("#gdf-spouseAge", "36"); await page.fill("#gdf-retire", "62");
  await expect(page.locator("#gdCard .gd-means")).toContainText("24 years to save");
  await next(page);
  // 2 · Income and take-home: estimated, marked, until the real figure is typed
  await page.fill("#gdf-income", "95000"); await page.fill("#gdf-income2", "60000");
  await expect(page.locator('#gdCard .gd-means .gd-src[data-src="estimated"]')).toHaveText("estimated");
  await page.locator("#gdCard [data-more]").click();
  await page.fill("#gdf-takehome", "9200");
  await expect(page.locator('#gdCard .gd-means .gd-src[data-src="entered"]')).toHaveText("you entered");
  await next(page);
  // 3 · What you spend · 4 · Your safety net · 5 · Debt
  await page.fill("#gdf-spend", "7000");
  await expect(page.locator("#gdCard .gd-means")).toContainText("$2,200 a month");
  await next(page);
  await page.fill("#gdf-cash", "12000");
  await expect(page.locator("#gdCard .gd-means")).toContainText("1.7 months");
  await next(page);
  await pick(page, "debtHas", "yes");
  await page.fill("#gdf-debtTotal", "18000"); await page.fill("#gdf-debtHi", "9000");
  await expect(page.locator("#gdCard .gd-means")).toContainText("debt scores 12 of 15");
  // no number yet: savings aren't in
  await expect(page.locator("#gdNumFv")).toHaveCount(0);
  await next(page);
  // 6 · the first number, with the placeholder spending (doc 3, item 5)
  await expect(page.locator("#gdCount")).toHaveText(/^Step 6 of /);
  await page.fill("#gdf-saved", "210000"); await page.fill("#gdf-contrib", "900"); await page.fill("#gdf-employer", "300");
  await pick(page, "match", "full");
  await page.locator("#gdf-risk").selectOption("0.0575");
  const tile = (await page.locator("#gdStrip").isVisible()) ? page.locator("#gdStrip") : page.locator("#gdNumber");
  await expect(tile).toContainText("$1.52M");
  await expect(tile).toContainText("$1.15M");
});

test("the Quick check and the Full walkthrough walk their own cards", async ({ page }) => {
  test.setTimeout(120_000);
  await seeded(page, stateWith("quick"));
  await expect(page.locator('.gd-top [data-pace="quick"].on')).toHaveCount(1);
  const quick = await walkThrough(page);
  expect(quick.length).toBe(QUICK_CARDS);
  expect(quick[0]).toMatch(new RegExp(`^Step 1 of ${QUICK_CARDS} · about \\d+ minutes? left$`));
  expect(quick.at(-1)).toMatch(new RegExp(`^Step ${QUICK_CARDS} of ${QUICK_CARDS}`));
  await seeded(page, stateWith("full"));
  const full = await walkThrough(page);
  expect(full.length).toBe(FULL_CARDS);
  expect(full.at(-1)).toMatch(new RegExp(`^Step ${FULL_CARDS} of ${FULL_CARDS}`));
});

test("switching pace keeps every answer and your place", async ({ page }) => {
  await seeded(page, stateWith("full", "debt"));
  await expect(page.locator("#gdCount")).toHaveText(new RegExp(`^Step 5 of ${FULL_CARDS}`));
  await page.locator('.gd-top [data-pace="quick"]').click();
  await expect(page.locator("#gdCount")).toHaveText(new RegExp(`^Step 5 of ${QUICK_CARDS}`));
  await expect(page.locator("#gdf-debtTotal")).toHaveValue("18,000");
  // a deeper card stays open from the route, and says so
  await (await routeMap(page)).locator('.gd-map-st[data-go="goals"]').click();
  await expect(page.locator("#gdCount")).toHaveText(/^A deeper card/);
  await next(page);
  await expect(page.locator("#gdCard .gd-q")).toHaveText("Where do your retirement savings stand?");
});

/* ---------- Saved guides and links ---------- */

test("a guide saved by v1 opens migrated, and v1's key is left alone", async ({ page }) => {
  const v1 = { v: 1, cur: "outlook", a: { ...MAYA, spendSrc: "budget" }, done: { about: true, income: true, takehome: true }, trip: null, back: null, coachMin: false };
  await stored(page, { "retcalc.guide.v1": v1 });
  await page.goto(NEW + "/guide");
  await expect(page.locator("#gdCard .gd-q")).toHaveText("Your retirement projection");
  await expect(page.locator('.gd-top [data-pace="full"].on')).toHaveCount(1);
  const kept = await page.evaluate(() => localStorage.getItem("retcalc.guide.v1"));
  expect(JSON.parse(kept!)).toEqual(v1);
  const v2 = JSON.parse((await page.evaluate(() => localStorage.getItem("retcalc.guide.v2")))!);
  expect(v2.v).toBe(2);
  expect(v2.src.spend).toMatchObject({ kind: "tool", tool: "budget" });
  expect(v2.done).toEqual({ about: true, income: true });
});

test("a shared v1 link opens the plan on its results, after asking in the site's dialog", async ({ page, context }) => {
  await seeded(page, { ...stateWith("quick", "income"), done: { about: true } });
  const url = NEW + "/guide#g=" + Buffer.from(JSON.stringify({ v: 1, a: { age: 45, retire: 62, income: 100000, saved: 300000, contrib: 1000, match: "full",
    retSpend: 60000, cash: 20000, spend: 5000, takehome: 6500, debtHas: "no" } })).toString("base64url");
  const other = await context.newPage();
  let native = false;
  other.on("dialog", (d) => { native = true; void d.dismiss(); });
  await other.goto(url);
  await other.locator(".popbtn", { hasText: "Replace my answers" }).click();
  expect(native).toBe(false);
  await expect(other.locator(".gd-q")).toHaveText("Your retirement readiness");
  await expect(other.locator(".gd-hero .r")).not.toHaveText("");
  await expect(other).toHaveURL(NEW + "/guide");
});

test("a v2 link opens on the plan card with its pace", async ({ page }) => {
  await stored(page, {});
  const link = { v: 2, a: MAYA, src: { spend: { kind: "tool", tool: "budget", at: "2026-10-07T00:00:00.000Z" } }, pace: "quick" };
  await page.goto(NEW + "/guide#g=" + Buffer.from(JSON.stringify(link)).toString("base64url"));
  await expect(page.locator(".gd-q")).toHaveText("Your retirement readiness");
  await expect(page.locator('.gd-top [data-pace="quick"].on')).toHaveCount(1);
  const v2 = JSON.parse((await page.evaluate(() => localStorage.getItem("retcalc.guide.v2")))!);
  expect(v2.src.spend).toMatchObject({ kind: "tool", tool: "budget" });
});

test("the plan prints on one page", async ({ page }) => {
  const plan = { v: 1, a: { age: 45, retire: 62, income: 100000, saved: 300000, contrib: 1000, match: "full", retSpend: 60000, cash: 20000, spend: 5000, takehome: 6500, debtHas: "no" } };
  await stored(page, {});
  await page.goto(NEW + "/guide#g=" + Buffer.from(JSON.stringify(plan)).toString("base64url"));
  await expect(page.locator(".gd-q")).toHaveText("Your retirement readiness");
  await page.evaluate(() => { (window as unknown as { printed: number }).printed = 0; window.print = () => { (window as unknown as { printed: number }).printed++; }; });
  await page.locator('[data-gd="print"]').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
  await expect(page.locator("#sheet h1")).toHaveText("Retirement Readiness Plan");
  await expect(page.locator("#sheet .sh-chart svg")).toHaveCount(1);
});

/* ---------- The shell ---------- */

test("your number so far follows the plan, and says what the card changed", async ({ page }) => {
  await seeded(page, stateWith("quick", "savings"));
  await expect(page.locator("#gdNumFv")).toHaveText("$1.52M");
  await expect(page.locator("#gdNumNeed")).toHaveText("$567,000");
  await page.fill("#gdf-saved", "260000");
  await expect(page.locator(".gd-num-moved")).toContainText("raised what you're on course for from $1.52M to");
  await expect(page.locator("#gdNumFv")).not.toHaveText("$1.52M");
});

test("until retirement spending is entered, 80% of take-home stands in, marked", async ({ page }) => {
  await seeded(page, { ...stateWith("quick", "savings"), a: { ...MAYA, retSpend: null } });
  await expect(page.locator("#gdNumNeed")).toHaveText("$1.15M");
  await expect(page.locator('.gd-num .gd-src[data-src="default"]')).toHaveText("default");
  await expect(page.locator(".gd-num-note")).toContainText("$88,500 a year");
});

test("a field holding an estimate says so", async ({ page }) => {
  await seeded(page, { ...stateWith("quick", "spending"), src: { spend: { kind: "estimated", at: "2026-10-07T00:00:00.000Z" } } });
  await expect(page.locator('#gdCard .field:has(#gdf-spend) .gd-src[data-src="estimated"]')).toHaveText("estimated");
});

test("Start over asks in the site's own dialog", async ({ page }) => {
  await seeded(page, { ...stateWith("quick", "cash"), done: { about: true } });
  let native = false;
  page.on("dialog", (d) => { native = true; void d.dismiss(); });
  await (await routeMap(page)).locator('[data-gd="restart"]').click();
  await page.locator(".popbtn", { hasText: "Start over" }).click();
  expect(native).toBe(false);
  await expect(page.locator("#gdCard .gd-q")).toHaveText("How ready are you for retirement?");
});

test("on a phone the rail folds into a strip, and the route opens as a sheet", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1280) > 640, "phone only");
  await seeded(page, stateWith("quick", "cash"));
  await expect(page.locator("#gdStrip")).toContainText("On course $1.52M");
  await expect(page.locator("#gdNumber")).toBeHidden();
  await page.locator('#gdStrip [data-gd="route"]').click();
  await page.locator('[role="dialog"] .gd-map-st[data-go="debt"]').click();
  await expect(page.locator("#gdCard .gd-q")).toHaveText("Do you owe money on anything besides a mortgage?");
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);
});

/* ---------- Trips into the tools (kept as built; doc 3 phase 5 rewrites their copy) ---------- */

test("a trip into Income Tax brings take-home back, marked as the tool's, with an undo", async ({ page }) => {
  await seeded(page, { ...stateWith("full", "income"), a: { ...MAYA, takehome: null, thKnow: null } });
  await page.locator("#gdCard [data-more]").click();
  await page.locator('#gdCard [data-trip="tax"]').click();
  await expect(page.locator("#gdCoach")).toBeVisible();
  await expect(page.locator("#txGross")).toHaveValue("95,000");
  // a reload in the middle of the trip fills the tool in again
  await page.reload();
  await expect(page.locator("#gdCoach")).toBeVisible();
  await expect(page.locator("#txGross")).toHaveValue("95,000");
  await page.locator('[data-view="take"]').click();
  await page.locator("#gdCoachBack").click();
  await expect(page.locator("#gdCard .gd-callout.ok")).toContainText("From Income Tax");
  await expect(page.locator('#gdCard .gd-means .gd-src[data-src="tool"]')).toHaveText("from Income Tax");
});

test("a trip into Budget brings spending back", async ({ page }) => {
  await seeded(page, { ...stateWith("full", "spending"), a: { ...MAYA, spend: null } });
  await page.locator('#gdCard [data-trip="budget"]').click();
  await expect(page.locator("#gdCoach")).toBeVisible();
  for (const [i, v] of [[0, "1800"], [2, "200"], [11, "600"], [12, "300"], [5, "350"]] as const) await page.fill(`[data-f="amount"][data-i="${i}"]`, v);
  await page.locator("#gdCoachBack").click();
  await expect(page.locator("#gdCard .gd-callout.ok")).toContainText("From your budget");
  await expect(page.locator('#gdCard .field:has(#gdf-spend) .gd-src[data-src="tool"]')).toHaveText("from Budget");
});

test("the Drawdown Simulator tour goes there and back", async ({ page }) => {
  test.setTimeout(120_000);
  await seeded(page, stateWith("full", "strategy"));
  await page.locator('#gdCard [data-trip="drawdown"]').click();
  await expect(page.locator("#gdCoach .gd-chip b")).toBeVisible({ timeout: 60_000 });
  await page.locator('#gdCoach [data-cp="1"]').click();
  await page.locator('#gdCoach [data-cp="1"]').click();
  await page.locator("#ddStrategy").selectOption("guardrails");
  await page.locator("#gdCoachBack").click();
  await expect(page.locator("#gdCard .gd-callout.ok", { hasText: "Back from the Drawdown Simulator" })).toBeVisible();
});

test("the Plan Optimizer runs on the guide's plan and its roadmap applies", async ({ page }) => {
  test.setTimeout(180_000);
  await seeded(page, stateWith("full", "optimize"));
  await page.locator('#gdCard [data-op="run"]').click();
  await expect(page.locator("#gdCard .op-res")).toBeVisible({ timeout: 150_000 });
  const apply = page.locator('[data-gd="optapply"]');
  if (await apply.count()) {
    await apply.click();
    await expect(page.locator("#gdCard .gd-callout.ok", { hasText: "Applied" })).toBeVisible();
  }
});
