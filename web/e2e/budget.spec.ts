import { test } from "@playwright/test";
import { compareTool } from "./compare";

const amount = (n: number) => `#bgList .bgrow >> nth=${n - 1} >> input[inputmode=decimal]`;

test("budget matches the current site", async ({ page }, info) => {
  await compareTool(page, info, "budget", ["#tab-budget"], [
    { name: "defaults", steps: [] },
    { name: "income and a few lines", steps: [["bgIncomeIn", "86000"], [amount(1), "2100"], [amount(3), "180"], [amount(12), "650"], [amount(16), "3000"], [amount(18), "400"]] },
    { name: "monthly income, over budget", steps: [["click", '#bgIncomeFreq [data-freq="12"]'], ["bgIncomeIn", "3000"], [amount(1), "2500"], [amount(6), "700"]] },
    { name: "yearly line and emergency fund", steps: [["bgIncomeIn", "60000"], [amount(4), "90"], ["click", "#bgList .bgrow >> nth=3 >> [data-fv='1']"], ["efMonths", "9"]] },
    { name: "custom item", steps: [["bgIncomeIn", "50000"], ["click", "#bgAdd"], ["#bgList input.desc", "Pet care"], ["#bgList .bggroup:last-child .bgrow:last-child input[inputmode=decimal]", "120"]] },
    { name: "copy from Income Tax", steps: [["click", "#bgCopyTax"]] },
    { name: "college savings line", steps: [["click", "#bgCopyCollege"]] },
    { name: "retirement contribution from Basic", steps: [["click", "#bgCopyRetire"], ["click", ".popup .popbtn >> nth=0"]] },
  ]);
});
