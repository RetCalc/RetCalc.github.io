import { expect, test } from "@playwright/test";
import { NEW } from "../playwright.config";

const row = (n: number, field: string) => `#dtList .dtrow:nth-child(${n}) ${field}`;

/* With every balance at zero the old site left the last plan's notes,
   verdict and chart on screen. The new one clears them: an intended
   difference, so it's checked on the new site alone. */
test("debt payoff clears when nothing is owed", async ({ page }) => {
  await page.goto(NEW + "/debt");
  for (const n of [1, 2, 3, 4]) await page.locator(row(n, ".c1 input")).fill("0");
  await expect(page.locator("#dtFree")).toHaveText("\u2014");
  await expect(page.locator("#dtInterest")).toHaveText("\u2014");
  await expect(page.locator("#dtSaved")).toHaveText("\u2014");
  await expect(page.locator("#dtFreeNote")).toHaveText("Add a debt to start");
  await expect(page.locator("#dtInterestNote")).toBeEmpty();
  await expect(page.locator("#dtVerdict")).toBeEmpty();
  await expect(page.locator("#dtOrder tbody tr")).toHaveCount(0);
});
