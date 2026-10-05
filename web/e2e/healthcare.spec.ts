import { test } from "@playwright/test";
import { compareTool } from "./compare";

test("healthcare matches the current site", async ({ page }, info) => {
  await compareTool(page, info, "healthcare", ["#asideHC", "#tab-healthcare"], [
    { name: "defaults (no income)", steps: [] },
    { name: "single, subsidized", steps: [["hcIncome", "42000"]] },
    { name: "near the 400% cliff", steps: [["hcIncome", "80000"], ["hcHousehold", "2"]] },
    { name: "over the cliff, Medicare surcharge", steps: [["hcIncome", "260000"]] },
    { name: "couple, spouse younger, kids", steps: [["hcStatus", "m"], ["hcHousehold", "4"], ["hcSpouseAge", "58"], ["hcIncome", "95000"], ["hcState", "CA"]] },
    { name: "Medicaid range with Social Security", steps: [["hcIncome", "9000"], ["hcSS", "14000"], ["hcHousehold", "1"]] },
    { name: "own premium quote", steps: [["hcIncome", "60000"], ["hcManualPremium", "1450"], ["hcState", "NY"]] },
    { name: "retiring at 66", steps: [["hcRetireAge", "66"], ["hcIncome", "120000"], ["hcStatus", "m"]] },
    { name: "copied from Income Tax (normal mode)", steps: [["click", "#hcCopyTax"]] },
  ]);
});
