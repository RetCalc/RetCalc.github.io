import { expect, test, type Page } from "@playwright/test";
import { NEW, OLD } from "../playwright.config";
import { apply, open, snapshot, type Step } from "./compare";

/* The Share menu's one-page summary and image card, on both sites: the
   printed page's words, and the words drawn on the card. */
const url = (base: string, slug: string) => (base === OLD ? `${OLD}/${slug === "home" ? "index" : slug}.html` : `${NEW}/${slug === "home" ? "" : slug}`);

const TOOLS: [slug: string, card: boolean, steps?: Step[]][] = [
  ["home", true], ["advanced", true], ["stages", false], ["incometax", true], ["mortgage", true],
  ["college", true], ["rentbuy", true], ["drawdown", true], ["roth", false], ["debt", false], ["bridge", true],
  ["budget", true, [["bgIncomeIn", "6000"], ['[data-f="amount"][data-i="0"]', "1800"], ['[data-f="amount"][data-i="11"]', "600"], ['[data-f="amount"][data-i="17"]', "500"]]],
];

async function menu(p: Page, label: string) {
  await p.locator("#btnShareMenu").click();
  await p.locator(".popbtn", { hasText: label }).first().click();
}
/** The printed page's text, read as the printer sees it. */
async function sheet(p: Page) {
  await p.evaluate(() => { window.print = () => {}; });
  await menu(p, "Summary");
  await p.locator("#sheet .sh-h").waitFor({ state: "attached" });
  await p.emulateMedia({ media: "print" });
  const s = await snapshot(p, ["#sheet"]);
  await p.emulateMedia({ media: null });
  return s;
}
/** The words on the card (the chart's own labels aside). */
async function card(p: Page) {
  await p.evaluate(() => {
    const w = window as unknown as { cardSvg?: Blob };
    const make = URL.createObjectURL;
    URL.createObjectURL = (b: Blob | MediaSource) => { if (b instanceof Blob && b.type.startsWith("image/svg") && !w.cardSvg) w.cardSvg = b; return make.call(URL, b); };
  });
  await menu(p, "Save image card");
  await expect.poll(() => p.evaluate(() => !!(window as unknown as { cardSvg?: Blob }).cardSvg)).toBe(true);
  return p.evaluate(async () => {
    const svg = await (window as unknown as { cardSvg: Blob }).cardSvg.text();
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    return [...doc.documentElement.children].filter((e) => e.tagName === "text").map((e) => e.textContent);
  });
}

for (const [slug, hasCard, steps] of TOOLS)
  test(`${slug} summary and card match the current site`, async ({ page }) => {
    const oldPage = await page.context().newPage();
    for (const [p, base] of [[oldPage, OLD], [page, NEW]] as const) { await open(p, url(base, slug)); if (steps) await apply(p, steps); }
    expect.soft(await sheet(page), slug + " summary").toEqual(await sheet(oldPage));
    if (hasCard) expect.soft(await card(page), slug + " card").toEqual(await card(oldPage));
  });

test("a tool without a summary offers only its link", async ({ page }) => {
  await page.goto(NEW + "/backtest");
  await page.locator("#btnShareMenu").click();
  await expect(page.locator(".popbtn")).toHaveCount(1);
});
