import { expect, test, type Page } from "@playwright/test";
import { NEW } from "../playwright.config";
import { FIXTURES } from "../scripts/baseline/guide-fixtures.mjs";

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
const QUICK_CARDS = 12, FULL_CARDS = 19;

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
    if ((await page.locator("#gdCard .gd-q").textContent()) === "Your plan") break;
    await next(page);
  }
  return counts;
}

/* ---------- Both paces ---------- */

test("the Quick check, typed from the start: the number on card 6, done in 12 cards", async ({ page }) => {
  test.setTimeout(120_000);
  await seeded(page, null);
  await page.locator('[data-gd="next"]').click();
  const tile = (await page.locator("#gdStrip").isVisible()) ? page.locator("#gdStrip") : page.locator("#gdNumber");
  const step = (n: number) => expect(page.locator("#gdCount")).toHaveText(new RegExp(`^Step ${n} of ${QUICK_CARDS}( ·|$)`));
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
  // 6 · the first number, on the Balanced default, with the placeholder spending (doc 3, item 5)
  await step(6);
  // the lesson in their own ages, at the mix the plan assumes until card 7 asks
  await expect(page.locator('#gdCard [data-lesson="time"]')).toContainText("a dollar saved at 38 is worth $2.88 by 62");
  await page.fill("#gdf-saved", "210000"); await page.fill("#gdf-contrib", "900"); await page.fill("#gdf-employer", "300");
  await expect(tile).toContainText("$1.21M");
  await expect(tile).toContainText("$1.15M");
  await expect(page.locator("#gdCard .gd-means")).toContainText("9.3%");
  await page.locator("#gdCard [data-more]").click();
  await pick(page, "match", "full");
  await next(page);
  // 7 · How it's invested: the number moves with the mix
  await step(7);
  await page.locator("#gdf-risk").selectOption("0.0575");
  await expect(tile).toContainText("$1.52M");
  await expect(page.locator("#gdCard .gd-mixes tr.on")).toContainText("$1.52M");
  await next(page);
  // 8 · Spending in retirement: the placeholder becomes an answer
  await step(8);
  await page.fill("#gdf-retSpend", "70000");
  await expect(page.locator("#gdCard .gd-means")).toContainText("the plan needs about $567,000 at 62: entering it cut that from $1.15M");
  await expect(tile).toContainText("$567,000");
  await next(page);
  // 9 · Social Security, estimated from income (doc 3, calculation 3)
  await step(9);
  await expect(page.locator("#gdCard .gd-means")).toContainText("$5,597 a month from 67, $67,159 a year");
  await expect(page.locator('#gdCard [data-lesson="wait"]')).toContainText("$2,275");
  await next(page);
  // 10 · Your number · 11 · Tested against history · 12 · Your plan
  await step(10); await next(page);
  await step(11); await next(page);
  await step(12);
  await expect(page.locator("#gdCard .gd-q")).toHaveText("Your plan");
  await expect(page.locator("#gdScoreNum")).toHaveAttribute("data-score", "89");
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
  await expect(page.locator("#gdCard .gd-q")).toHaveText("What have you saved, and what do you add each month?");
});

test("Where it sits holds Continue while Roth and brokerage add up to more than the savings", async ({ page }) => {
  await seeded(page, stateWith("full", "accounts"));
  await page.fill("#gdf-rothNow", "250000");
  await expect(page.locator("#gdf-rothNow-err")).toContainText("Count each dollar once");
  await expect(page.locator('#gdCard [data-gd="next"]')).toBeDisabled();
  await expect(page.locator("#gdCard .gd-why")).toContainText("can't add up to more than your savings");
  await page.fill("#gdf-rothNow", "40000");
  await expect(page.locator('#gdCard [data-gd="next"]')).toBeEnabled();
});

test("a statement figure replaces the Social Security estimate", async ({ page }) => {
  await seeded(page, stateWith("quick", "social"));
  await expect(page.locator('#gdCard .gd-means .gd-src[data-src="estimated"]')).toHaveText("estimated");
  await page.fill("#gdf-ssOwn", "3000"); await page.fill("#gdf-ssOwn2", "2000");
  await expect(page.locator('#gdCard .gd-means .gd-src[data-src="entered"]')).toHaveText("you entered");
  await expect(page.locator("#gdCard .gd-means")).toContainText("$5,000 a month from 67");
  await expect(page.locator('#gdCard [data-lesson="wait"]')).toContainText("$3,720"); // $3,000 at 70
});

/* ---------- Will it last, make it stronger, your plan ---------- */

const DAN = { ...(FIXTURES.find((f: { id: string }) => f.id === "dan")!.a as Record<string, unknown>) };

test("Your number and Tested against history, from the engine's own figures", async ({ page }) => {
  await seeded(page, stateWith("quick", "number"));
  await expect(page.locator("#gdOutFv")).toHaveText("$1,518,176");
  await expect(page.locator("#gdOutNeed")).toHaveText("$567,000");
  await expect(page.locator("#gdOutCover")).toHaveText("2.7×");
  await expect(page.locator('[data-lesson="income-sources"]')).toContainText("$60,727");
  await expect(page.locator("[data-sources]")).toContainText("estimates for Social Security (from income), and defaults for 60% in stocks in retirement and money lasting to 95 for the younger of you");
  await next(page);
  await expect(page.locator("#gdLastRate")).toHaveText("100%");
  await expect(page.locator("#gdCard .gd-means")).toContainText("66 of 66 starting years");
  await expect(page.locator('[data-lesson="sequence"]')).toContainText("Retiring in 1966");
});

test("the lever table matches the fixtures: Maya and Sam ahead, Dan behind", async ({ page }) => {
  test.setTimeout(120_000);
  await seeded(page, stateWith("full", "adjust"));
  const row = (id: string) => page.locator(`[data-lever-row="${id}"]`);
  await expect(row("save+100")).toContainText("$1,577,738", { timeout: 60_000 });
  await expect(row("retire+1")).toContainText("$478,000");
  await expect(row("spend+10000")).toContainText("$929,000");
  await seeded(page, { ...stateWith("quick", "adjust"), a: DAN });
  await expect(page.locator("#gdCount")).toHaveText(/^Step \d+ of 13/); // Adjust joins Dan's Quick check
  await expect(row("save+250")).toContainText("54%", { timeout: 60_000 });
  await expect(row("retire+3")).toContainText("89%");
});

test("the plan card: the number and the score, the moves in order with ticks that stay, the toolkit", async ({ page }) => {
  await seeded(page, stateWith("quick", "plan"));
  await expect(page.locator("#gdProjected")).toHaveText("$1.52M");
  await expect(page.locator("#gdNeeded")).toHaveText("$567,000");
  await expect(page.locator("#gdScoreNum")).toHaveAttribute("data-score", "89");
  await expect(page.locator(".gd-move").first()).toHaveAttribute("data-move", "cushion", { timeout: 30_000 });
  await expect(page.locator(".gd-move").nth(1)).toHaveAttribute("data-move", "debt");
  await expect(page.locator(".gd-move").nth(2)).toHaveAttribute("data-move", "surplus");
  expect((await page.locator("[data-kit]").evaluateAll((l) => l.map((e) => e.getAttribute("data-kit")))).sort()).toEqual(["debt", "drawdown", "healthcare", "optimizer"]);
  // what's going well never names an area a move is working on (correction 2)
  await expect(page.locator(".gd-wins")).not.toContainText("Debt");
  await page.locator('[data-move="debt"] [data-slot="checkbox"]').click();
  await page.reload();
  await expect(page.locator('[data-move="debt"]')).toHaveClass(/done/, { timeout: 30_000 });
  // each area says what it still has to give (correction 3)
  const score = (await page.locator("#gdStrip").isVisible()) ? null : page.locator("#gdScore");
  if (score) await expect(score.locator('[data-go="cash"] .head')).toHaveText("Up to 8 more: 3 months earns 11; 6 months earns 15.");
});

test("a second visit shows what moved since the snapshot", async ({ page }) => {
  // finish once: save a snapshot
  await seeded(page, { ...stateWith("quick", "plan"), a: { ...MAYA, cash: 6000 } });
  await page.locator('[data-gd="snapshot"]').click({ timeout: 30_000 });
  const saved = JSON.parse((await page.evaluate(() => localStorage.getItem("retcalc.guide.v2")))!);
  expect(saved.snapshots).toHaveLength(1);
  expect(saved.finishedAt).toBeTruthy();
  // come back: Welcome back, bring the cash up to date, see what moved
  await page.goto(NEW + "/robots.txt");
  await page.goto(NEW + "/guide");
  await expect(page.locator("#gdCard .gd-q")).toHaveText("Welcome back");
  await page.fill("#gdf-cash", "12000");
  await page.locator('[data-gd="moved"]').click();
  const moved = page.locator("[data-moved]");
  await expect(moved).toContainText("Emergency fund", { timeout: 30_000 });
  await expect(moved).toContainText("+3 points");
  await expect(moved).toContainText("Readiness score");
  await page.locator('#gdCard [data-go="plan"]').click();
  await expect(page.locator("#gdCard .gd-q")).toHaveText("Your plan");
  await expect(page.locator(".gd-since")).toContainText("Emergency fund");
});

/* ---------- Changes ahead and the hand-offs ---------- */

const PRIYA = { ...(FIXTURES.find((f: { id: string }) => f.id === "priya-tom")!.a as Record<string, unknown>) };

test("Changes ahead: two children planned turn into a schedule, and the number moves with it", async ({ page }) => {
  await seeded(page, { ...stateWith("full", "changes"), a: PRIYA });
  await expect(page.locator("#gdCard .gd-means")).toContainText("Your saving schedule appears once");
  await page.fill("#gdf-kidsPlanned", "2"); await page.fill("#gdf-firstIn", "3"); await page.fill("#gdf-spacing", "3");
  const rows = page.locator("[data-stage-row]");
  await expect(rows).toHaveCount(7);
  await expect(rows.first()).toContainText("Before children");
  await expect(page.locator('[data-stage-row="35"] input')).toHaveValue("7,500");
  await expect(page.locator("[data-changes]")).toContainText("against $8.69M saving today's $10,000 every month", { timeout: 30_000 });
  await expect(page.locator("[data-changes]")).toContainText("you're on course for $6.88M at 60");
  await expect(page.locator("#gdCard .gd-means")).toContainText("Your second starts college at 56, 4 years before you retire");
  // a hand edit becomes your own, kept as a change
  await page.fill('[data-stage-row="35"] input', "8000");
  await expect(page.locator('[data-event="custom"]')).toContainText("Your edit, ages 35 to 38");
  // another change, as a small form
  await page.locator('[data-ev-add="raise"]').click();
  await expect(page.locator('[data-event="raise"]')).toBeVisible();
  // four years apart, the second child's college years run past 60, and the plan card asks about them
  await page.fill("#gdf-spacing", "4");
  await expect(page.locator("#gdCard .gd-means")).toContainText("starts college at 57, 3 years before you retire: those years overlap your retirement");
  await page.evaluate(() => { const g = JSON.parse(localStorage.getItem("retcalc.guide.v2")!); g.cur = "plan"; localStorage.setItem("retcalc.guide.v2", JSON.stringify(g)); });
  await page.reload();
  await expect(page.locator('[data-move="college-overlap"]')).toBeVisible({ timeout: 30_000 });
});

test("the Full walkthrough hands off to Stages with the guide's stages, and its figure is the guide's number", async ({ page }) => {
  test.setTimeout(120_000);
  await seeded(page, { ...stateWith("full", "number"), a: { ...PRIYA, kidsPlanned: 2, firstIn: 3, spacing: 3 } });
  const fv = (await page.locator("#gdOutFv").textContent())!;
  expect(fv).toBe("$6,884,235");
  await page.locator('#gdCard [data-trip="stages"]').click();
  await expect(page.locator("#gdCoach")).toBeVisible();
  await expect(page.locator('[data-name="0"]')).toHaveText("Before children");
  await expect(page.locator("#xFVreal")).toHaveText(fv);
  // a changed stage comes back as your own edit, with an undo
  await page.fill('[data-f="contrib"][data-i="1"]', "8,000");
  await page.locator("#gdCoachBack").click();
  await expect(page.locator("#gdCard .gd-callout.ok")).toContainText("From Stages: ages 35 to 38, +$500/mo");
  await expect(page.locator('#gdCard [data-gd="undo"]')).toBeVisible();
  // and Advanced, beside it, goes there and back
  await page.locator('#gdCard [data-trip="advanced"]').click();
  await expect(page.locator("#gdCoach")).toBeVisible();
  await page.locator("#gdCoachBack").click();
  await expect(page.locator("#gdCard .gd-callout.ok")).toContainText("Back from Advanced");
});

test("the Quick check hands off to Basic from Your number", async ({ page }) => {
  await seeded(page, stateWith("quick", "number"));
  await expect(page.locator('#gdCard [data-trip="basic"]')).toBeVisible();
  await expect(page.locator('#gdCard [data-trip="stages"]')).toHaveCount(0);
});

/* ---------- Saved guides and links ---------- */

test("a guide saved by v1 opens migrated, and v1's key is left alone", async ({ page }) => {
  const v1 = { v: 1, cur: "outlook", a: { ...MAYA, spendSrc: "budget" }, done: { about: true, income: true, takehome: true }, trip: null, back: null, coachMin: false };
  await stored(page, { "retcalc.guide.v1": v1 });
  await page.goto(NEW + "/guide");
  await expect(page.locator("#gdCard .gd-q")).toHaveText("Your number");
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
  await expect(other.locator(".gd-q")).toHaveText("Your plan");
  await expect(other.locator("#gdScoreNum")).not.toHaveText("");
  await expect(other).toHaveURL(NEW + "/guide");
});

test("a v2 link opens on the plan card with its pace", async ({ page }) => {
  await stored(page, {});
  const link = { v: 2, a: MAYA, src: { spend: { kind: "tool", tool: "budget", at: "2026-10-07T00:00:00.000Z" } }, pace: "quick" };
  await page.goto(NEW + "/guide#g=" + Buffer.from(JSON.stringify(link)).toString("base64url"));
  await expect(page.locator(".gd-q")).toHaveText("Your plan");
  await expect(page.locator('.gd-top [data-pace="quick"].on')).toHaveCount(1);
  const v2 = JSON.parse((await page.evaluate(() => localStorage.getItem("retcalc.guide.v2")))!);
  expect(v2.src.spend).toMatchObject({ kind: "tool", tool: "budget" });
});

test("the plan prints on one page", async ({ page }) => {
  const plan = { v: 1, a: { age: 45, retire: 62, income: 100000, saved: 300000, contrib: 1000, match: "full", retSpend: 60000, cash: 20000, spend: 5000, takehome: 6500, debtHas: "no" } };
  await stored(page, {});
  await page.goto(NEW + "/guide#g=" + Buffer.from(JSON.stringify(plan)).toString("base64url"));
  await expect(page.locator(".gd-q")).toHaveText("Your plan");
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
