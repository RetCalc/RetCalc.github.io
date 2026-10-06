import { expect, test } from "@playwright/test";
import { NEW } from "../playwright.config";
import { compareTool } from "./compare";

const row = (n: number, field: string) => `#dtList .dtrow:nth-child(${n}) ${field}`;

test("debt payoff matches the current site", async ({ page }, info) => {
  await compareTool(page, info, "debt", ["#tab-debt"], [
    { name: "defaults", steps: [] },
    { name: "snowball", steps: [["click", '#segDT [data-dt="snowball"]']] },
    { name: "no extra payment", steps: [["dtExtra", "0"]] },
    { name: "bigger extra", steps: [["dtExtra", "1500"]] },
    { name: "edited debt", steps: [[row(1, '[data-f="desc"]'), "Visa"], [row(1, ".c1 input"), "15000"], [row(1, ".c2 input"), "27.5"]] },
    { name: "a minimum below interest", steps: [[row(3, ".c3 input"), "50"]] },
    { name: "added and removed debts", steps: [["click", "#dtAdd"], [row(5, ".c1 input"), "3000"], [row(5, ".c2 input"), "12"], [row(5, ".c3 input"), "90"], ["click", row(2, 'button[aria-label="Remove"]')]] },
  ]);
});

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
