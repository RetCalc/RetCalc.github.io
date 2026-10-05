/* The household profile filling tools in, on the new site alone: the old
   site filled every tool at once, the new one fills each when it's next
   opened (MIGRATION.md), so the moment differs but the numbers must not. */
import { expect, test } from "@playwright/test";
import { NEW } from "../playwright.config";

test("a saved household fills Income Tax and Budget", async ({ page }) => {
  await page.goto(NEW + "/tools");
  await page.locator("#hhEdit").click();
  await page.locator("#hhStatus").selectOption("m");
  await page.locator("#hhAge").fill("45");
  await page.locator("#hhState").selectOption("CA");
  await page.locator("#hhIncome").fill("150000");
  await page.locator("#hhIncome2").fill("60000");
  await page.locator("#hhFill").click();
  await expect(page.locator("#toast")).toContainText("Filled in 2 tools: Income Tax, Budget");

  await page.locator("a.toolcard[data-pick=tax]").click();
  await expect(page.locator("#txStatus")).toHaveValue("m");
  await expect(page.locator("#txGross")).toHaveValue("150,000");
  await expect(page.locator("#txGross2")).toHaveValue("60,000");
  await expect(page.locator("#txState")).toHaveValue("CA");

  // Take-home pay under the Income Tax tool's rules, in whole dollars.
  await page.goto(NEW + "/budget");
  await expect(page.locator("#bgIncomeIn")).toHaveValue(/^\d{1,3}(,\d{3})+$/);

  // Edits after the fill stay put when the tool is opened again.
  await page.locator("#bgIncomeIn").fill("1000");
  await page.locator("#btnToolBack").click();
  await page.locator("a.toolcard[data-pick=budget]").click();
  await expect(page.locator("#bgIncomeIn")).toHaveValue("1,000");
});
