import { expect, test } from "@playwright/test";
import { NEW } from "../playwright.config";

test("a tool without a summary offers only its link", async ({ page }) => {
  await page.goto(NEW + "/backtest");
  await page.locator("#btnShareMenu").click();
  await expect(page.locator(".popbtn")).toHaveCount(1);
});
