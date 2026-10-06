import { expect, test } from "@playwright/test";
import { NEW } from "../playwright.config";
import { compareTool, type Case, type Step } from "./compare";

const done: Step = ["until", "#opOut .op-res"];

const inputs: Case[] = [
  { name: "defaults", steps: [] },
  { name: "single, today, saving", steps: [["opStatus", "s"], ["click", '#opModeSeg [data-opmode="now"]'], ["opAge", "45"], ["opRetire", "60"], ["opRisk", "0.0575"]] },
  { name: "salary instead of a statement, pension at 65", steps: [["opSS1", ""], ["opInc1", "120000"], ["opSS2", ""], ["opInc2", "60000"], ["opPension", "24000"], ["opPenAge", "65"], ["opPenCola", "1"]] },
  { name: "rule of 55, no spending", steps: [["opRetire", "57"], ["opSpRet", "55"], ["opRule55", "1"], ["opSpend", ""]] },
];
const searches: Case[] = [
  { name: "leave the most", steps: [["click", "#opRunBtn"], done] },
  { name: "make it last, single in Texas", steps: [["opStatus", "s"], ["opState", "TX"], ["opSpend", "70000"], ["click", '.op-goal[data-goal="last"]'], ["click", "#opRunBtn"], done] },
  { name: "spend the most, retiring at 66", steps: [["opRetire", "66"], ["opSpRet", "64"], ["opTarget", "0.95"], ["click", '.op-goal[data-goal="spend"]'], ["click", "#opRunBtn"], done] },
  { name: "a changed plan marks the result out of date", steps: [["opAca", "0"], ["opRetire", "67"], ["opSpRet", "65"], ["click", "#opRunBtn"], done, ["opMix", "40"]] },
];

test("optimizer inputs match the current site", async ({ page }, info) => {
  await compareTool(page, info, "optimizer", ["#asideOP", "#tab-optimizer"], inputs);
});

test("optimizer searches match the current site", async ({ page }, info) => {
  test.setTimeout(300_000);
  await compareTool(page, info, "optimizer", ["#asideOP", "#tab-optimizer"], searches);
});

test("a search can be stopped", async ({ page }) => {
  await page.goto(NEW + "/optimizer");
  await page.locator("#opRunBtn").click();
  await expect(page.locator(".op-run")).toBeVisible();
  await expect(page.locator("#opRunBtn")).toBeDisabled();
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.locator(".op-run")).toHaveCount(0);
  await expect(page.locator(".op-ready")).toBeVisible();
});

test("the optimizer charts show the age under the pointer", async ({ page, isMobile }) => {
  test.skip(isMobile, "hover is a mouse check");
  test.setTimeout(120_000);
  await page.goto(NEW + "/optimizer");
  await page.locator("#opRunBtn").click();
  await page.locator("#opOut .op-res").waitFor({ timeout: 90_000 });
  const flow = page.locator('[data-opchart="flow"]');
  await flow.locator("svg").hover({ position: { x: 200, y: 120 } });
  await expect(flow.locator(".gd-tip")).toContainText("Age");
  await expect(flow.locator(".gd-tip")).toContainText("lived on");
});
