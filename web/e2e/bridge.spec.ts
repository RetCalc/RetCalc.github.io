import { expect, test } from "@playwright/test";
import { NEW } from "../playwright.config";

/* The old site left the last plan's results up once spending was cleared;
   the new one clears them. */
test("the bridge clears without spending", async ({ page }) => {
  await page.goto(NEW + "/bridge");
  await expect(page.locator("#brCompare tbody tr")).toHaveCount(6);
  await page.locator("#brSpend").fill("");
  await expect(page.locator("#brVerdict")).toHaveText("Enter your spending and at least one account balance to plan the bridge.");
  await expect(page.locator("#brCompare tbody tr")).toHaveCount(0);
  await expect(page.locator("#brBest")).toHaveText("\u2014");
});

test("the bridge charts show the year under the pointer", async ({ page, isMobile }) => {
  test.skip(isMobile, "hover is a mouse check");
  await page.goto(NEW + "/bridge");
  const bars = page.locator("#chartWrapBR");
  await bars.hover({ position: { x: 120, y: 150 } });
  await expect(bars.locator(".tip")).toContainText("Age 50");
  await expect(bars.locator(".tip")).toContainText("Tax $");
  const bal = page.locator("#chartWrapBRB");
  await bal.hover({ position: { x: 120, y: 150 } });
  await expect(bal.locator(".tip")).toContainText("Total $");
  await page.locator('#segBRBal [data-brbal="hist"]').click();
  await bal.hover({ position: { x: 300, y: 150 } });
  await expect(bal.locator(".tip")).toContainText("Median $");
});
