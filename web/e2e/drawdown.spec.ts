import { expect, test } from "@playwright/test";
import { NEW } from "../playwright.config";

/* The old page's chart threw when every start spent the same that year (a
   fixed amount, before any ran out); the new one draws a single bar. */
test("the spread of spending copes with every start spending the same", async ({ page }) => {
  await page.goto(NEW + "/4-percent-rule");
  await page.locator("#segDDDist [data-dddist='spend']").click();
  await page.locator("#ddDistYear").selectOption("10");
  await expect(page.locator("#ddDistStats")).toContainText("Median$40,000");
  await expect(page.locator("#chartDDH rect")).not.toHaveCount(0);
});

/* The old page left the last results up when nothing could be tested; the
   new one clears them. */
test("a retirement too long for the record says so", async ({ page }) => {
  await page.goto(NEW + "/drawdown");
  await page.locator("#segDDIn [data-ddin='adv']").click();
  await page.locator("#ddFromYear").fill("2000");
  await page.locator("#ddYears").fill("40");
  // leaving the start year snaps it to the last that fits 30 years, 1996
  await expect(page.locator("#ddVerdict")).toContainText("Nothing to test: a 40-year retirement starting in 1996 has not finished yet.");
  await expect(page.locator("#ddSuccess")).toHaveText("—");
  await expect(page.locator("#ddFromNote")).toContainText("Too long for the 1926–2025 data");
});

test("an income source can be added, turned off and removed", async ({ page }) => {
  await page.goto(NEW + "/drawdown");
  await page.locator("#segDDIn [data-ddin='adv']").click();
  await page.locator("#ddAddIncome").click();
  await page.locator("#itName").fill("Pension");
  await page.locator("#itAmount").fill("20000");
  await page.locator("#itSave").click();
  await expect(page.locator("#ddIncomeList .itemrow")).toContainText("Pension$20,000/yr, starting immediately, rest of retirement · inflation-adjusted");
  await expect(page.locator("#ddOtherIncomeHeader")).toBeVisible();
  await page.locator("#ddIncomeList [data-itemtoggle='0']").uncheck();
  await expect(page.locator("#ddIncomeList .itemrow")).toHaveClass(/off/);
  await page.locator("#ddIncomeList [data-itemdel='0']").click();
  await expect(page.locator("#ddIncomeList .itemrow")).toHaveCount(0);
});

test("the strategy guide and studies set the plan", async ({ page }) => {
  await page.goto(NEW + "/drawdown");
  await page.locator("#ddStratGuide").click();
  await page.locator("[data-usestrat='vpw']").click();
  await expect(page.locator("#ddStrategy")).toHaveValue("vpw");
  await page.locator("#ddStudyBtn").click();
  await page.locator("[data-study='guyton']").click();
  await expect(page.locator("#ddStrategy")).toHaveValue("guardrails");
  await expect(page.locator("#ddRate")).toHaveValue("5.4");
  await expect(page.locator(".toast")).toContainText("Loaded Guyton-Klinger guardrails's setup");
});

test("Advanced and the Bridge hand their numbers to the Drawdown Simulator", async ({ page }) => {
  await page.goto(NEW + "/advanced");
  await page.locator("#toDrawdown").click();
  await expect(page).toHaveURL(/\/drawdown$/);
  await expect(page.locator("#ddInitial")).not.toHaveValue("1,000,000");
  await page.goto(NEW + "/bridge");
  await page.locator("#brToDD").click();
  await expect(page).toHaveURL(/\/drawdown$/);
  await expect(page.locator("#ddStrategy")).toHaveValue("fixed");
  await expect(page.locator(".toast")).toContainText("Drawdown set to");
});
