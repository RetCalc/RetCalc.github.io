import { expect, test } from "@playwright/test";
import { NEW, OLD } from "../playwright.config";
import { compareShown, compareTool, open, type Case } from "./compare";

const ADV: [string, string] = ["click", "#segDDIn [data-ddin='adv']"];
const MC_DONE: [string, string] = ["until", "#ddBadge:has-text('simulations')"];

const cases: Case[] = [
  { name: "defaults", steps: [] },
  { name: "each January, guardrails", steps: [ADV, ["ddStarts", "year"], ["ddStrategy", "guardrails"], ["ddRate", "5"]] },
  { name: "advanced: age, VPW", steps: [ADV, ["ddStarts", "year"], ["ddRetireAge", "65"], ["ddStrategy", "vpw"], ["ddYears", "35"]] },
  { name: "advanced: Social Security, limits, legacy", steps: [ADV, ["ddStarts", "year"], ["ddStrategy", "pct"], ["ddSSMode", "est"], ["ddSSWho", "couple"], ["ddSpendFloor", "30000"],
    ["ddSpendCeil", "70000"], ["ddLegacyGoal", "500000"]] },
  { name: "spending smile", steps: [ADV, ["ddStarts", "year"], ["ddPath", "smile"], ["ddRetireAge", "62"]] },
  { name: "risk-based guardrails, spending in stages", steps: [ADV, ["ddStarts", "year"], ["ddPath", "stages"], ["ddStrategy", "riskgr"], ["ddRgTarget", "85"]] },
  { name: "Kitces ratchet, a later start", steps: [ADV, ["ddStarts", "year"], ["ddStrategy", "kitces"], ["ddFromYear", "1950"], ["ddFee", "0.5"]] },
  { name: "a start picked in the table", steps: [ADV, ["ddStarts", "year"], ["click", "#ddStartTable tr[data-start] >> nth=5"]] },
  { name: "the table sorted", steps: [ADV, ["ddStarts", "year"], ["click", "#ddStartTable th[data-sort='end']"], ["click", "#segDDSeq [data-ddseq='year']"]] },
  { name: "spread of spending", steps: [ADV, ["ddStarts", "year"], ["ddStrategy", "pct"], ["click", "#segDDDist [data-dddist='spend']"], ["#ddDistYear", "10"]] },
  { name: "asset mix", steps: [ADV, ["ddStarts", "year"], ["click", "#ddMixBtn"], ["[data-mix='stock']", "50"], ["[data-mix='sv']", "10"], ["click", "[data-mixok]"]] },
  { name: "pinned baseline", steps: [ADV, ["ddStarts", "year"], ["click", "#ddPin"], ["ddRate", "4.5"]] },
  { name: "Monte Carlo", steps: [ADV, ["ddStarts", "year"], ["click", "#segDD [data-dd='mc']"], MC_DONE] },
  { name: "compare strategies", steps: [ADV, ["ddStarts", "year"], ["click", "#segDDTab [data-ddtab='compare']"], ["until", "#ddShowTable tbody tr"]] },
  { name: "safe spending", steps: [ADV, ["ddStarts", "year"], ["click", "#segDDTab [data-ddtab='safe']"], ["until", "#ddHeat tbody tr"], ["until", "#ddValIntro:has-text('CAPE')"]] },
];

test("drawdown simulator matches the current site", async ({ page }, info) => {
  test.setTimeout(600_000);
  await compareTool(page, info, "drawdown", ["#asideDD", "#tab-drawdown"], cases);
});

for (const slug of ["4-percent-rule", "guardrails", "vpw", "vanguard-dynamic-spending", "risk-based-guardrails", "rmd-withdrawal-strategy", "ratcheting-withdrawal", "cape-withdrawal"])
  test(`${slug} matches the current site`, async ({ page }, info) => {
    await compareTool(page, info, slug, ["#asideDD", "#tab-drawdown"], [{ name: "opens", steps: [] }]);
  });

/* The old page's chart threw when every start spent the same that year (a
   fixed amount, before any ran out); the new one draws a single bar. */
test("the spread of spending copes with every start spending the same", async ({ page }) => {
  await page.goto(NEW + "/4-percent-rule");
  await page.locator("#segDDDist [data-dddist='spend']").click();
  await page.locator("#ddDistYear").selectOption("10");
  await expect(page.locator("#ddDistStats")).toContainText("Median$40,000");
  await expect(page.locator("#chartDDH rect")).not.toHaveCount(0);
});

/* The old page left the last results up when nothing could be tested; the
   new one clears them. */
test("a retirement too long for the record says so", async ({ page }) => {
  await page.goto(NEW + "/drawdown");
  await page.locator("#segDDIn [data-ddin='adv']").click();
  await page.locator("#ddFromYear").fill("2000");
  await page.locator("#ddYears").fill("40");
  // leaving the start year snaps it to the last that fits 30 years, 1996
  await expect(page.locator("#ddVerdict")).toContainText("Nothing to test: a 40-year retirement starting in 1996 has not finished yet.");
  await expect(page.locator("#ddSuccess")).toHaveText("—");
  await expect(page.locator("#ddFromNote")).toContainText("Too long for the 1926–2025 data");
});

for (const [name, button] of [["strategy guide", "#ddStratGuide"], ["classic studies", "#ddStudyBtn"], ["asset mix", "#ddMixBtn"]])
  test(`the ${name} matches the current site`, async ({ page }, info) => {
    test.setTimeout(240_000);
    const oldPage = await page.context().newPage();
    for (const [p, url] of [[oldPage, OLD + "/drawdown.html"], [page, NEW + "/drawdown"]] as const) {
      await open(p, url);
      await p.locator(button).click();
      await p.locator(".popup").waitFor();
      await p.waitForTimeout(400);
    }
    await compareShown(oldPage, page, info, name, [".popup"]);
    await oldPage.close();
  });

test("an income source can be added, turned off and removed", async ({ page }) => {
  await page.goto(NEW + "/drawdown");
  await page.locator("#segDDIn [data-ddin='adv']").click();
  await page.locator("#ddAddIncome").click();
  await page.locator("#itName").fill("Pension");
  await page.locator("#itAmount").fill("20000");
  await page.locator("#itSave").click();
  await expect(page.locator("#ddIncomeList .itemrow")).toContainText("Pension$20,000/yr, starting immediately, rest of retirement · inflation-adjusted");
  await expect(page.locator("#ddOtherIncomeHeader")).toBeVisible();
  await page.locator("#ddIncomeList [data-itemtoggle='0']").uncheck();
  await expect(page.locator("#ddIncomeList .itemrow")).toHaveClass(/off/);
  await page.locator("#ddIncomeList [data-itemdel='0']").click();
  await expect(page.locator("#ddIncomeList .itemrow")).toHaveCount(0);
});

test("the strategy guide and studies set the plan", async ({ page }) => {
  await page.goto(NEW + "/drawdown");
  await page.locator("#ddStratGuide").click();
  await page.locator("[data-usestrat='vpw']").click();
  await expect(page.locator("#ddStrategy")).toHaveValue("vpw");
  await page.locator("#ddStudyBtn").click();
  await page.locator("[data-study='guyton']").click();
  await expect(page.locator("#ddStrategy")).toHaveValue("guardrails");
  await expect(page.locator("#ddRate")).toHaveValue("5.4");
  await expect(page.locator(".toast")).toContainText("Loaded Guyton-Klinger guardrails's setup");
});

test("Advanced and the Bridge hand their numbers to the Drawdown Simulator", async ({ page }) => {
  await page.goto(NEW + "/advanced");
  await page.locator("#toDrawdown").click();
  await expect(page).toHaveURL(/\/drawdown$/);
  await expect(page.locator("#ddInitial")).not.toHaveValue("1,000,000");
  await page.goto(NEW + "/bridge");
  await page.locator("#brToDD").click();
  await expect(page).toHaveURL(/\/drawdown$/);
  await expect(page.locator("#ddStrategy")).toHaveValue("fixed");
  await expect(page.locator(".toast")).toContainText("Drawdown set to");
});
