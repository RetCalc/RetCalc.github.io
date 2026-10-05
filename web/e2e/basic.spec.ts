import { expect, test } from "@playwright/test";
import { NEW } from "../playwright.config";
import { compareTool } from "./compare";

test("basic calculator matches the current site", async ({ page }, info) => {
  await compareTool(page, info, "home", ["#asideSimple", "#tab-simple"], [
    { name: "defaults", steps: [] },
    { name: "older saver, conservative", steps: [["qAge", "52"], ["qRetire", "67"], ["qSaved", "340000"], ["qContrib", "1500"], ["qRisk", "0.03"]] },
    { name: "weekly, aggressive", steps: [["qPeriod", "Weekly"], ["qContrib", "125"], ["qRisk", "0.07"]] },
    { name: "annual lump, very conservative", steps: [["qPeriod", "Annually"], ["qContrib", "7000"], ["qRisk", "0.02"], ["qSaved", "0"]] },
    { name: "retirement more than 100 years away", steps: [["qAge", "1"], ["qRetire", "150"]] },
    { name: "no age", steps: [["qAge", ""]] },
  ]);
});

/* With no years to retirement the old site left the last result's note
   ("At age 65, ...") under the blank figure; the new one clears it. */
test("basic calculator clears without years to retirement", async ({ page }) => {
  await page.goto(NEW + "/");
  for (const [age, ret, warn] of [["70", "65", "needs to be higher"], ["30", "", "Fill in your age"]]) {
    await page.locator("#qAge").fill(age);
    await page.locator("#qRetire").fill(ret);
    await expect(page.locator("#qWarnText")).toContainText(warn);
    for (const id of ["qFV", "qYear", "qMonth", "qIn", "qGrowth"]) await expect(page.locator("#" + id)).toHaveText("\u2014");
    await expect(page.locator("#qFVnote")).toBeEmpty();
    await expect(page.locator("#qYearTable tbody tr")).toHaveCount(0);
  }
});
