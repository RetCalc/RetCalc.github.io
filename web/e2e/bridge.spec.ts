import { expect, test } from "@playwright/test";
import { NEW } from "../playwright.config";
import { compareTool, type Case } from "./compare";

const cases: Case[] = [
  { name: "defaults", steps: [] },
  { name: "rule of 55, single in Texas", steps: [["brAge", "56"], ["brStatus", "s"], ["brState", "TX"], ["brSpend", "45000"]] },
  { name: "no health insurance, fill the 12% bracket", steps: [["brAca", "0"], ["brFill", "b12"]] },
  { name: "Monte Carlo", steps: [["click", '#segBR [data-brmode="mc"]']] },
  { name: "below-average market, ladder plan", steps: [["click", '#brCompare tr[data-plan="ladder"]'], ["click", '#segBRPath [data-brpath="below"]']] },
  { name: "balances across history", steps: [["click", '#segBRBal [data-brbal="hist"]']] },
  { name: "72(t) by RMD, 457(b), part-time work", steps: [["brSeppMethod", "rmd"], ["brG457", "200000"], ["brWork", "30000"], ["brWorkUntil", "52"]] },
  { name: "young retiree, small brokerage", steps: [["brAge", "40"], ["brBrok", "50000"], ["brRothBasis", "20000"], ["brPremium", "1400"]] },
];

for (const slug of ["bridge", "72t"])
  test(`${slug} matches the current site`, async ({ page }, info) => {
    await compareTool(page, info, slug, ["#asideBR", "#tab-bridge"], slug === "bridge" ? cases : cases.slice(0, 2));
  });

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
