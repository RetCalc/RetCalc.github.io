import { test } from "@playwright/test";
import { compareTool } from "./compare";

test("mortgage matches the current site", async ({ page }, info) => {
  await compareTool(page, info, "mortgage", ["#asideMort", "#tab-mortgage"], [
    { name: "defaults", steps: [] },
    { name: "5% down with PMI", steps: [["moDownPct", "5"]] },
    { name: "down payment as an amount", steps: [["moPrice", "620000"], ["moDownAmt", "100000"]] },
    { name: "15-year at 5.5%", steps: [["moTerm", "15"], ["moRate", "5.5"], ["moHoa", "250"]] },
    { name: "extra payments and a recast", steps: [["moExtrasOn", "1"], ["moExtraMo", "200"], ["moExtraOnce", "25000"], ["moExtraWhen", "36"], ["moRecast", "1"]] },
    { name: "refinance", steps: [["moExtrasOn", "1"], ["moRefiRate", "5.25"], ["moRefiTerm", "15"], ["moRefiCost", "6000"]] },
    { name: "zero interest", steps: [["moRate", "0"]] },
    { name: "no price", steps: [["moPrice", "0"]] },
  ]);
});
