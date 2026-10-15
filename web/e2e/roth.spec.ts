import { expect, test } from "@playwright/test";
import { NEW } from "../playwright.config";

test("the Roth chart switches to tax paid", async ({ page }) => {
  await page.goto(NEW + "/roth");
  await expect(page.locator("#rcChartTitle")).toContainText("Traditional balance");
  await page.locator('#segRC [data-rc="tax"]').click();
  await expect(page.locator("#rcChartTitle")).toContainText("Tax paid each year");
  await expect(page.locator("#legendRC")).toContainText("Tax paid, converting");
});
