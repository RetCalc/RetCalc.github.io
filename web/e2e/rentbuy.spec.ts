import { expect, test } from "@playwright/test";
import { NEW } from "../playwright.config";

/* With no price the old site left the last result on screen; the new one
   clears it. An intended difference, checked on the new site alone. */
test("rent vs. buy clears without a price", async ({ page }) => {
  await page.goto(NEW + "/rentbuy");
  await page.locator("#rbPrice").fill("0");
  for (const id of ["rbWinner", "rbBuyerNW", "rbRenterNW"]) await expect(page.locator("#" + id)).toHaveText("\u2014");
  for (const id of ["rbWinNote", "rbBreakEven", "rbLoan"]) await expect(page.locator("#" + id)).toBeEmpty();
  await expect(page.locator("#rbTable tbody tr")).toHaveCount(0);
});
