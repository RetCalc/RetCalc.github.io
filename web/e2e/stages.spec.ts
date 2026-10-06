import { expect, test } from "@playwright/test";
import { NEW } from "../playwright.config";
import { compareTool, type Case } from "./compare";

const card = (i: number, f: string) => `#stageList [data-f='${f}'][data-i='${i}']`;

const cases: Case[] = [
  { name: "defaults", steps: [] },
  { name: "edit stages", steps: [[card(0, "years"), "12.5"], [card(0, "contrib"), "800"], [card(1, "nominal"), "6"], [card(1, "growth"), "1"], ["gFees", "0.5"]] },
  { name: "not inflation adjusted", steps: [["click", card(1, "adj")], ["gInflation", "2.5"]] },
  { name: "add a stage, glide", steps: [["click", "#btnAddStage"], ["click", "#stageList .stagecard:last-child .glidebtn-check:visible"], [card(2, "glideYears"), "4"]] },
  { name: "remove a stage", steps: [["click", "#stageList [data-del='0']"]] },
  { name: "portfolio value target", steps: [["solveForS", "Portfolio Value"], ["targetS", "3000000"]] },
  { name: "use the solved contribution", steps: [["targetS", "150000"], ["click", "#btnApplyS"]] },
  { name: "use the solved length", steps: [["click", "#btnApplyYearsS"]] },
  { name: "split by account", steps: [["click", "#saToggle .glidebtn-check"], [card(0, "cR"), "200"], ["saBrokBal", "40000"], ["saSalary", "80000"], ["saMatchPct", "50"], ["saState", "NY"]] },
  { name: "split back to one total", steps: [["click", "#saToggle .glidebtn-check"], ["saMatchPct", "100"], ["click", "#saToggle .glidebtn-check"]] },
  { name: "rate band", steps: [["bandS", "1"]] },
  { name: "market history", steps: [["click", "#segSeries [data-mode='hist']"], ["histMixS", "50"]] },
  { name: "Monte Carlo", steps: [["click", "#segSeries [data-mode='mc']"], [card(0, "vol"), "25"]] },
  { name: "converter", steps: [["click", "#stageList [data-conv='1']"], ["click", "#convOut button[data-period='Weekly']"]] },
];

test("stages calculator matches the current site", async ({ page }, info) => {
  test.setTimeout(300_000); // a long walk, slower still beside other tests
  await compareTool(page, info, "stages", ["#asideSeries", "#tab-series"], cases);
});

test("a stage can be renamed", async ({ page }) => {
  await page.goto(NEW + "/stages");
  const name = page.locator("#stageList [data-name='0']");
  await name.click();
  await page.keyboard.type("Early career");
  await page.keyboard.press("Enter");
  await expect(name).toHaveText("Early career");
  await expect(page.locator("#stageTable tbody tr")).toHaveCount(2);
});

test("Advanced hands its plan to Stages", async ({ page }) => {
  await page.goto(NEW + "/advanced");
  await page.locator("#years").fill("25");
  await page.locator("#btnToStages").click();
  await expect(page).toHaveURL(/\/stages$/);
  await expect(page.locator(card(0, "years"))).toHaveValue("25");
  await expect(page.locator(card(1, "years"))).toHaveValue("10");
  await expect(page.locator(".toast")).toContainText("Copied into two stages");
});
