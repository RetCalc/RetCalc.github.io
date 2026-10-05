import { expect, test } from "@playwright/test";
import { NEW } from "../playwright.config";
import { compareTool } from "./compare";

test("rent vs. buy matches the current site", async ({ page }, info) => {
  await compareTool(page, info, "rentbuy", ["#asideRB", "#tab-rentbuy"], [
    { name: "defaults", steps: [] },
    { name: "short horizon, renting wins", steps: [["rbHorizon", "5"]] },
    { name: "cheap rent, 15-year loan", steps: [["rbRent", "1400"], ["rbTerm", "15"], ["rbRate", "5.75"]] },
    { name: "small down payment, single", steps: [["rbDown", "5"], ["rbStatus", "s"], ["rbAppr", "2"], ["rbGainTax", "20"]] },
    { name: "copied from the mortgage tool", steps: [["click", "#rbCopyMort"]] },
  ]);
});

/* With no price the old site left the last result on screen; the new one
   clears it. An intended difference, checked on the new site alone. */
test("rent vs. buy clears without a price", async ({ page }) => {
  await page.goto(NEW + "/rentbuy");
  await page.locator("#rbPrice").fill("0");
  for (const id of ["rbWinner", "rbBuyerNW", "rbRenterNW"]) await expect(page.locator("#" + id)).toHaveText("\u2014");
  for (const id of ["rbWinNote", "rbBreakEven", "rbLoan"]) await expect(page.locator("#" + id)).toBeEmpty();
  await expect(page.locator("#rbTable tbody tr")).toHaveCount(0);
});
