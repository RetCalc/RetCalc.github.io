import { expect, test } from "@playwright/test";
import { NEW } from "../playwright.config";

/* With no years to retirement the old site left the last result's note
   ("At age 65, ...") under the blank figure; the new one clears it. */
test("basic calculator clears without years to retirement", async ({ page }) => {
  await page.goto(NEW + "/calculator");
  for (const [age, ret, warn] of [["70", "65", "needs to be higher"], ["30", "", "Fill in your age"]]) {
    await page.locator("#qAge").fill(age);
    await page.locator("#qRetire").fill(ret);
    await expect(page.locator("#qWarnText")).toContainText(warn);
    for (const id of ["qFV", "qYear", "qMonth", "qIn", "qGrowth"]) await expect(page.locator("#" + id)).toHaveText("\u2014");
    await expect(page.locator("#qFVnote")).toBeEmpty();
    await expect(page.locator("#qYearTable tbody tr")).toHaveCount(0);
  }
});
