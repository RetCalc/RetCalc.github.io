import { expect, test } from "@playwright/test";
import { NEW } from "../playwright.config";

test("the mix won't save until it adds up to 100%", async ({ page }) => {
  await page.goto(NEW + "/backtest");
  await page.locator("#btMixBtn").click();
  await page.locator("[data-mix='stock']").fill("70");
  await expect(page.locator("#btMixTot")).toContainText("it needs to add up to 100%");
  await expect(page.locator("[data-mixok]")).toBeDisabled();
  await page.locator("[data-mix='bond']").fill("30");
  await page.locator("[data-mixok]").click();
  await expect(page.locator("#btMixText")).toHaveText("70% US stocks, 30% bonds");
});

test("the figures go to Advanced", async ({ page }) => {
  await page.goto(NEW + "/backtest");
  const cagr = (await page.locator("#btUseNote").textContent())!.match(/Sends ([\d.]+)%/)![1];
  await page.locator("#btUseRate").click();
  await expect(page).toHaveURL(/\/advanced$/);
  await expect(page.locator("#nominal")).toHaveValue(String(+cagr));
});
