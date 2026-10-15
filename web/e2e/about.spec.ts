import { expect, test } from "@playwright/test";
import { NEW } from "../playwright.config";

test("the contact address is put together in the browser", async ({ page }) => {
  await page.goto(NEW + "/about");
  await expect(page.locator("#tab-about a.mailme")).toHaveAttribute("href", "mailto:contact@retcalc.app");
});
