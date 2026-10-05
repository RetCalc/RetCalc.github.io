import { test } from "@playwright/test";
import { compareTool } from "./compare";

const coast: [string, string] = ["click", '#segFireMode [data-firemode="coast"]'];
const hist: [string, string] = ["click", '#segFireChart [data-mode="hist"]'];

test("FIRE calculator matches the current site", async ({ page }, info) => {
  await compareTool(page, info, "fire", ["#asideFire", "#tab-fire"], [
    { name: "defaults", steps: [] },
    { name: "bigger saver, portfolio target", steps: [["fiInitial", "180000"], ["fiContrib", "3500"], ["fiSolveFor", "portfolio"], ["fiTarget", "1500000"]] },
    { name: "narrow band, quarterly, growing contributions", steps: [["fiBand", "0.5"], ["fiPeriod", "Quarterly"], ["fiContrib", "6000"], ["fiGrowth", "3"]] },
    { name: "already there", steps: [["fiInitial", "2000000"]] },
    { name: "never gets there", steps: [["fiContrib", "50"], ["fiInitial", "0"], ["fiTarget", "200000"]] },
    { name: "coast FIRE", steps: [coast, ["fiCurAge", "35"], ["fiRetireAge", "62"], ["fiInitial", "120000"]] },
    { name: "market history", steps: [hist] },
    { name: "market history, 80% success, bond-heavy", steps: [hist, ["fiHistMix", "40"], ["#fiSuccessSlider", "80"]] },
    { name: "coast FIRE in market history", steps: [coast, hist, ["fiInitial", "90000"], ["#fiSuccessSlider", "25"]] },
  ]);
});
