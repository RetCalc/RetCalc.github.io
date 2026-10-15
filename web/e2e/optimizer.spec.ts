import { expect, test } from "@playwright/test";
import { NEW } from "../playwright.config";

test("a search can be stopped", async ({ page }) => {
  await page.goto(NEW + "/optimizer");
  await page.locator("#opRunBtn").click();
  await expect(page.locator(".op-run")).toBeVisible();
  await expect(page.locator("#opRunBtn")).toBeDisabled();
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.locator(".op-run")).toHaveCount(0);
  await expect(page.locator(".op-ready-in")).toBeVisible();
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
