import { expect, test } from "@playwright/test";
import { NEW } from "../playwright.config";
import { compareTool, type Case } from "./compare";

const cases: Case[] = [
  { name: "defaults", steps: [] },
  { name: "single, IRMAA tier strategy", steps: [["rcStatus", "s"], ["rcStrategy", "irm"], ["rcIrmaaTier", "1"], ["rcState", "CA"]] },
  { name: "fixed amount, withheld", steps: [["rcStrategy", "fix"], ["rcFixed", "120000"], ["rcPayFrom", "withhold"], ["rcStopAge", "72"]] },
  { name: "share of balance, no IRMAA", steps: [["rcStrategy", "pct"], ["rcPct", "12"], ["rcIrmaaOn", "0"], ["rcHeir", "40"]] },
  { name: "no conversions (RMDs only)", steps: [["rcStrategy", "none"], ["rcAge", "70"], ["rcEndAge", "100"]] },
  { name: "fill the 24% bracket, early survivor", steps: [["rcBracket", "0.24"], ["rcDeath", "3"], ["rcSpend", "160000"], ["rcOther", "30000"]] },
  { name: "young, big traditional balance", steps: [["rcAge", "45"], ["rcTrad", "3200000"], ["rcStartAge", "50"], ["rcStopAge", "72"], ["rcReturn", "6"]] },
  { name: "blank ages", steps: [["rcAge", ""], ["rcEndAge", ""]] },
  { name: "copied from Drawdown", steps: [["click", "#rcCopyDD"]] },
];

/* The old site dropped the chart's Balance / Tax switch as soon as it drew
   (it rewrote the heading the switch sat in); the new one keeps it. The
   switch is set aside here and checked below. */
for (const slug of ["roth", "rmd"])
  test(`${slug} matches the current site`, async ({ page }, info) => {
    await compareTool(page, info, slug, ["#asideRC", "#tab-roth"], slug === "roth" ? cases : cases.slice(0, 3), "#rcChartTitle .h2ctrl");
  });

test("the Roth chart switches to tax paid", async ({ page }) => {
  await page.goto(NEW + "/roth");
  await expect(page.locator("#rcChartTitle")).toContainText("Traditional balance");
  await page.locator('#segRC [data-rc="tax"]').click();
  await expect(page.locator("#rcChartTitle")).toContainText("Tax paid each year");
  await expect(page.locator("#legendRC")).toContainText("Tax paid, converting");
});
