import { expect, test, type Page } from "@playwright/test";
import { NEW } from "../playwright.config";
import { FIXTURES } from "../scripts/baseline/guide-fixtures.mjs";

/* The guide's quality checks (doc 3, "Accessibility" and "Content"; doc 1's
   success table): every card in both themes has no axe violations; no card
   shows more than three numbers to fill in by default; every lesson stays
   under 120 words; on a touch screen every control is at least 44px; the
   keyboard reaches every choice, the pace switch, More detail and the
   route; focus arrives on each new question; and nothing moves under
   reduced motion. axe-core is the copy eslint-plugin-jsx-a11y already
   installs; no dependency is added. */

const fx = (id: string) => FIXTURES.find((f: { id: string }) => f.id === id)!;
const MAYA = fx("maya-sam").a as Record<string, unknown>;
const PRIYA = { ...(fx("priya-tom").a as object), ...(fx("priya-tom").plus as object) } as Record<string, unknown>;
const EARLY = fx("early-55").a as Record<string, unknown>;
const FULL = ["welcome", "about", "income", "spending", "cash", "debt", "goals", "savings", "invested", "accounts", "changes", "retspend", "social",
  "number", "lasting", "adjust", "strategy", "health", "optimize", "plan"];
const CARDS: { name: string; cur: string; a: Record<string, unknown>; pace?: "quick" | "full" }[] = [
  ...FULL.map((cur) => ({ name: cur, cur, a: MAYA })),
  { name: "changes with children", cur: "changes", a: PRIYA },
  { name: "bridge", cur: "bridge", a: EARLY },
  { name: "the on-ramp", cur: "retired", a: { age: 68, saved: 900000, retSpend: 50000, retired: true } },
  { name: "welcome, a first visit", cur: "welcome", a: {} },
];

const state = (cur: string, a: Record<string, unknown>, pace = "full") => ({ v: 2, pace, cur, a, src: {}, done: {}, trip: null, back: null, coachMin: false,
  snapshots: [], moves: {}, lessons: {}, startedAt: "2026-10-07T00:00:00.000Z" });
async function open(page: Page, cur: string, a: Record<string, unknown>, theme = "dark") {
  await page.goto(NEW + "/robots.txt");
  await page.evaluate(([s, t]) => { localStorage.clear(); localStorage.setItem("retcalc.guide.v2", JSON.stringify(s)); localStorage.setItem("retcalc.theme.v1", JSON.stringify(t)); },
    [state(cur, a), theme] as const);
  await page.goto(NEW + "/guide");
  await expect(page.locator("#gdCard .gd-q")).toBeVisible();
  // the readouts land from the worker
  await expect(page.locator("#gdCard .gd-means.stale, #gdCard [aria-busy=true]")).toHaveCount(0, { timeout: 30_000 });
  await page.waitForTimeout(300);
}
async function axe(page: Page) {
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  return page.evaluate(async () => {
    const w = window as unknown as { axe: { run: (c: Element, o: object) => Promise<{ violations: { id: string; impact: string; nodes: { target: string[]; failureSummary: string }[] }[] }> } };
    const r = await w.axe.run(document.querySelector("#tab-guide")!, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"], resultTypes: ["violations"] });
    return r.violations.map((v) => v.id + " (" + v.impact + "): " + v.nodes.slice(0, 3).map((n) => n.target.join(" ") + " · " + n.failureSummary.replace(/\s+/g, " ").slice(0, 160)).join(" | "));
  });
}

for (const theme of ["dark", "light"]) {
  test(`every card has no axe violations, ${theme}`, async ({ page }) => {
    test.setTimeout(240_000);
    const found: string[] = [];
    for (const c of CARDS) {
      await open(page, c.cur, c.a, theme);
      for (const v of await axe(page)) found.push(c.name + ": " + v);
    }
    expect(found).toEqual([]);
  });
}

test("no card asks for more than three numbers by default, and every lesson is under 120 words", async ({ page }) => {
  test.setTimeout(180_000);
  const over: string[] = [];
  for (const c of CARDS) {
    await open(page, c.cur, c.a);
    const n = await page.evaluate(() => [...document.querySelectorAll<HTMLInputElement>("#gdCard input:not([type=range]):not([type=checkbox]):not([type=hidden])")]
      .filter((el) => el.offsetParent !== null && !el.closest(".gd-means")).length);
    if (n > 3) over.push(c.name + ": " + n + " fields");
    const words = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("#gdCard .gd-lesson-b")].map((el) => el.innerText.trim().split(/\s+/).length));
    for (const w of words) if (w > 120) over.push(c.name + ": a lesson of " + w + " words");
  }
  expect(over).toEqual([]);
});

test("on a touch screen every control in the card is at least 44px tall", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1280) > 640, "phone only");
  test.setTimeout(180_000);
  const small: string[] = [];
  for (const c of CARDS) {
    await open(page, c.cur, c.a);
    const s = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("#gdCard button, #gdCard input:not([type=hidden]):not([type=checkbox]), #gdCard select, #gdCard a[href], #gdCard [role=checkbox]")]
      // links inside a sentence are exempt (WCAG 2.5.8), as on the Optimizer card's "Change the split"
      .filter((el) => el.offsetParent !== null && getComputedStyle(el).display !== "inline" && !el.closest(".gd-lesson-links, p, li, .op-acct"))
      .map((el) => { const r = el.getBoundingClientRect(); const box = (el.closest("[data-slot=input-group]") as HTMLElement | null)?.getBoundingClientRect(); return { h: Math.max(r.height, box?.height ?? 0), what: (el.getAttribute("data-trip") || el.getAttribute("data-gd") || el.id || el.textContent || el.tagName).trim().slice(0, 40) }; })
      .filter((x) => x.h < 43.5).map((x) => x.what + " " + Math.round(x.h) + "px"));
    for (const x of s) small.push(c.name + ": " + x);
  }
  expect(small).toEqual([]);
});

test("the keyboard reaches the pace, every choice, More detail and the route, and focus lands on each new question", async ({ page }) => {
  await open(page, "welcome", {});
  const tabTo = async (sel: string) => {
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press("Tab");
      if (await page.evaluate((s) => !!document.activeElement?.matches(s), sel)) return;
    }
    throw new Error("Tab never reached " + sel);
  };
  await tabTo('#gdCard [data-pace="full"]');
  await page.keyboard.press("Space");
  await expect(page.locator('#gdCard [data-pace="full"]')).toHaveAttribute("aria-checked", "true");
  await tabTo('#gdCard [data-gd="next"]');
  await page.keyboard.press("Enter");
  // focus arrives on the new question
  await expect(page.locator("#gdCard .gd-q")).toBeFocused();
  await open(page, "debt", { ...MAYA, debtHas: null });
  await tabTo('#gdCard [data-set="debtHas"][data-val="yes"]');
  await page.keyboard.press("Enter");
  await expect(page.locator('#gdCard [data-set="debtHas"][data-val="yes"]')).toHaveAttribute("aria-pressed", "true");
  await open(page, "savings", MAYA);
  await tabTo("#gdCard [data-more]");
  await page.keyboard.press("Enter");
  await expect(page.locator('#gdCard [data-set="match"][data-val="full"]')).toBeVisible();
  if (!(await page.locator("#gdStrip").isVisible())) {
    // a folded chapter opens from the keyboard too
    await tabTo("#gdMap .gd-map-chw:nth-child(2) [data-slot=collapsible-trigger]");
    await page.keyboard.press("Enter");
    await tabTo('#gdMap .gd-map-st[data-go="cash"]');
    await page.keyboard.press("Enter");
    await expect(page.locator("#gdCard .gd-q")).toHaveText("How much cash do you have for emergencies?");
  }
});

test("under reduced motion nothing animates when you move on", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await open(page, "income", MAYA);
  await page.locator('#gdCard [data-gd="next"]').click();
  await expect(page.locator("#gdCard .gd-q")).toHaveText("What do you spend each month?");
  const running = await page.evaluate(() => document.getAnimations().filter((x) => x.playState === "running" && (x.effect as KeyframeEffect | null)?.target?.closest?.("#tab-guide")).length);
  expect(running).toBe(0);
  await ctx.close();
});
