import { expect, test } from "@playwright/test";
import { NEW } from "../playwright.config";
import { compareTool, type Case } from "./compare";

const cases: Case[] = [
  { name: "defaults", steps: [] },
  { name: "60/40 over the last 30 years", steps: [["click", '#segBTMix [data-mix="60"]'], ["click", '#segBTEra [data-era="30"]']] },
  { name: "all stocks, 1970 through 2000", steps: [["click", '#segBTMix [data-mix="100"]'], ["btFrom", "1970"], ["btTo", "2000"]] },
  { name: "rebalanced every 5 years", steps: [["btRebal", "every"], ["btRebalN", "5"]] },
  { name: "rebalanced when it drifts 10 points", steps: [["btRebal", "band"], ["btRebalBand", "10"]] },
  { name: "never rebalanced, last 50", steps: [["btRebal", "never"], ["click", '#segBTEra [data-era="50"]']] },
  { name: "small value and cash", steps: [["click", "#btMixBtn"], ["[data-mix='stock']", "40"], ["[data-mix='sv']", "20"], ["[data-mix='bond']", "30"],
    ["[data-mix='cash']", "10"], ["click", "[data-mixok]"]] },
  { name: "years clamp to the data", steps: [["btFrom", "1800"], ["click", "#btYears"], ["btTo", ""], ["click", "#btYears"]] },
  { name: "sorted by return, rolling after inflation", steps: [["click", '#btTable th[data-sort="ret"]'], ["click", '#segBTRoll [data-roll="real"]']] },
  { name: "sorted by year, newest first", steps: [["click", '#btTable th[data-sort="year"]']] },
];

test("backtest matches the current site", async ({ page }, info) => {
  await compareTool(page, info, "backtest", ["#asideBT", "#tab-backtest"], cases);
});

test("the mix won't save until it adds up to 100%", async ({ page }) => {
  await page.goto(NEW + "/backtest");
  await page.locator("#btMixBtn").click();
  await page.locator("[data-mix='stock']").fill("70");
  await expect(page.locator("#btMixTot")).toContainText("it needs to add up to 100%");
  await expect(page.locator("[data-mixok]")).toBeDisabled();
  await page.locator("[data-mix='bond']").fill("30");
  await page.locator("[data-mixok]").click();
  await expect(page.locator("#btMixText")).toHaveText("70% US stocks, 30% bonds");
});

test("the figures go to Advanced", async ({ page }) => {
  await page.goto(NEW + "/backtest");
  const cagr = (await page.locator("#btUseNote").textContent())!.match(/Sends ([\d.]+)%/)![1];
  await page.locator("#btUseRate").click();
  await expect(page).toHaveURL(/\/advanced$/);
  await expect(page.locator("#nominal")).toHaveValue(String(+cagr));
});
