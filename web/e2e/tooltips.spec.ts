/* The "?" explanations, whose text loads the first time one is used. */
import { expect, test } from "@playwright/test";
import { NEW } from "../playwright.config";

test("a ? shows its explanation", async ({ page, isMobile }) => {
  await page.goto(NEW + "/mortgage");
  const dot = page.locator('label[for="moPmi"] .tipdot');
  if (isMobile) {
    // On a phone it opens as a sheet titled with the field's name.
    await dot.click();
    await expect(page.locator(".tipsheet .selmenu-h")).toContainText("PMI");
    await expect(page.locator(".tipsheet-b")).toContainText("mortgage insurance");
  } else {
    await dot.hover();
    await expect(page.locator("#tipbox")).toHaveClass(/on/);
    await expect(page.locator("#tipbox")).toContainText("mortgage insurance");
  }
});
